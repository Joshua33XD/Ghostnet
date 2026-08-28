# =============================================================================
# GhostNet — detection/threat_detector.py
# Master threat detector — runs all 10 detectors each cycle, updates state,
# logs every result (triggered or not) for full transparency.
# =============================================================================
from __future__ import annotations

import threading
import time
from typing import List

from ghostnet import config, logger
from ghostnet.detection.detectors import (
    dos_flood, mqtt_abuse, replay_anomaly, data_exfiltration,
    resource_exhaustion, crash_restart, firmware_tamper,
    config_tamper, brute_force, network_anomaly,
)
from ghostnet.detection.detectors.base import ThreatResult
from ghostnet.storage.state_store import NodeStatus, StateStore

_ALL_DETECTORS = [
    dos_flood, mqtt_abuse, replay_anomaly, data_exfiltration,
    resource_exhaustion, crash_restart, firmware_tamper,
    config_tamper, brute_force, network_anomaly,
]

# Human-readable threat labels for logging
THREAT_LABELS = {
    "dos_flood":           "DoS / Traffic Flood",
    "mqtt_abuse":          "MQTT Abuse",
    "replay_anomaly":      "Replay Anomaly",
    "data_exfiltration":   "Data Exfiltration",
    "resource_exhaustion": "Resource Exhaustion",
    "crash_restart":       "Crash / Restart Loop",
    "firmware_tamper":     "Firmware Tampering",
    "config_tamper":       "Config Tampering",
    "brute_force":         "Brute-Force",
    "network_anomaly":     "Network Anomaly",
}


class ThreatDetector:
    """
    Runs every cycle for every node.
    Returns a list of ThreatResults and updates:
      - active_threats on the node
      - anomaly_score (max of individual contributions, EWMA smoothed)
    """

    def __init__(self, store: StateStore) -> None:
        self._store = store
        self._thread: threading.Thread | None = None
        self._stop_event = threading.Event()

    def start(self) -> None:
        logger.info(f"Threat detector started — running {len(_ALL_DETECTORS)} detectors "
                    f"every {config.DETECTION_INTERVAL_SECS}s.")
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._run, daemon=True, name="ThreatDetector")
        self._thread.start()

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=5)
        logger.info("Threat detector stopped.")

    def _run(self) -> None:
        while not self._stop_event.wait(config.DETECTION_INTERVAL_SECS):
            for node in self._store.all_nodes():
                if node.status == NodeStatus.OFFLINE:
                    continue
                self.evaluate_node(node.node_id)

    def evaluate_node(self, node_id: str) -> List[ThreatResult]:
        node = self._store.get(node_id)
        if node is None:
            return []

        results: List[ThreatResult] = []
        newly_triggered: List[ThreatResult] = []
        cleared_threats: List[ThreatResult] = []

        for detector in _ALL_DETECTORS:
            result = detector.detect(node)
            results.append(result)

            label = THREAT_LABELS.get(result.name, result.name)
            was_active = result.name in node.active_threats

            if result.triggered:
                if not was_active:
                    newly_triggered.append(result)
                    logger.threat_detected(node_id, label, result.severity, result.message)
            else:
                if was_active:
                    cleared_threats.append(result)
                    logger.threat_cleared(node_id, label)

        # Update active threats set on node
        active = {r.name for r in results if r.triggered}
        self._store.update_active_threats(node_id, active)

        # Update EWMA anomaly score from threat contributions
        if results:
            # Use the max individual contribution as the primary signal
            max_contrib = max((r.score_contribution for r in results), default=0.0)
            alpha = config.EWMA_ALPHA
            old_score = node.anomaly_score
            new_score = alpha * max_contrib + (1 - alpha) * old_score
            self._store.update_score_only(node_id, new_score, old_score)

        return results
