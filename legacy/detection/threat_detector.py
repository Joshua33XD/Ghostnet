# =============================================================================
# GhostNet v3 — detection/threat_detector.py
# Master threat detector — runs all 10 detectors each cycle, then adds:
#   • ML anomaly score  (IsolationForest)
#   • OSI classification
#   • Immune memory similarity search
#   • Threat fusion into final score
# =============================================================================
from __future__ import annotations

import threading
from typing import List

from ghostnet import config, logger
from ghostnet.detection.detectors import (
    dos_flood, mqtt_abuse, replay_anomaly, data_exfiltration,
    resource_exhaustion, crash_restart, firmware_tamper,
    config_tamper, brute_force, network_anomaly,
)
from ghostnet.detection.detectors.base import ThreatResult
from ghostnet.detection.ml_detector import MLAnomalyDetector
from ghostnet.detection.threat_fusion import ThreatFusion
from ghostnet.memory.immune_memory import ImmuneMemory
from ghostnet.osi.mapper import OSIMapper
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

    Pipeline per node:
      1. Run all 10 deterministic detectors  -> List[ThreatResult]
      2. Score ML IsolationForest            -> MLResult
      3. Classify triggered threats via OSI  -> List[OSIResult]
      4. Query immune memory for similarity  -> List[MemoryMatch]
      5. Fuse all signals                    -> FusionResult
      6. Update StateStore with all results
    """

    def __init__(self, store: StateStore) -> None:
        self._store    = store
        self._thread: threading.Thread | None = None
        self._stop_event = threading.Event()
        # v3 components (singletons, shared across all nodes)
        self._ml      = MLAnomalyDetector()
        self._osi     = OSIMapper()
        self._fusion  = ThreatFusion()
        self._memory  = ImmuneMemory()

    # Expose memory reference so QuarantineManager can record incidents
    @property
    def immune_memory(self) -> ImmuneMemory:
        return self._memory

    def start(self) -> None:
        logger.info(
            f"Threat detector started — {len(_ALL_DETECTORS)} deterministic detectors "
            f"+ ML (IsolationForest) + OSI mapper + immune memory "
            f"every {config.DETECTION_INTERVAL_SECS}s."
        )
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

        # -- Step 1: Run 10 deterministic detectors ----------------------------
        results: List[ThreatResult] = []
        for detector in _ALL_DETECTORS:
            result = detector.detect(node)
            results.append(result)

            label      = THREAT_LABELS.get(result.name, result.name)
            was_active = result.name in node.active_threats

            if result.triggered:
                if not was_active:
                    logger.threat_detected(node_id, label, result.severity, result.message)
            else:
                if was_active:
                    logger.threat_cleared(node_id, label)

        # Update active threats set
        active = {r.name for r in results if r.triggered}
        self._store.update_active_threats(node_id, active)

        # -- Step 2: ML anomaly score ------------------------------------------
        ml_result = self._ml.score(node)
        self._store.set_ml_result(node_id, ml_result)

        if not ml_result.warmup and ml_result.ml_anomaly:
            logger.info(
                f"[ML] Anomaly detected — score={ml_result.ml_score:.3f} "
                f"confidence={ml_result.ml_confidence:.2f}",
                node_id=node_id,
            )

        # -- Step 3: OSI classification for triggered threats ------------------
        triggered_names = [r.name for r in results if r.triggered]
        osi_results = self._osi.classify_all(triggered_names, node)
        primary_osi = self._osi.primary(osi_results)
        self._store.set_osi_result(node_id, primary_osi)

        # -- Step 4: Query immune memory for similar patterns ------------------
        memory_matches = self._memory.find_similar(node_id, ml_result.top_features)
        if memory_matches:
            top = memory_matches[0]
            logger.info(
                f"[Memory] Match #{top.incident_id} similarity={top.similarity:.2f} "
                f"— {top.attack_category}",
                node_id=node_id,
            )

        # -- Step 5: Threat fusion ---------------------------------------------
        fusion_result = self._fusion.fuse(node, results, ml_result, osi_results, memory_matches)
        self._store.set_fusion_result(node_id, fusion_result)

        return results
