# =============================================================================
# GhostNet — detection/anomaly_detector.py
# Continuously evaluates node behaviour using EWMA scoring.
# Every evaluation step is printed — nothing happens silently.
# =============================================================================

from __future__ import annotations

import threading
import time

from ghostnet import config, logger
from ghostnet.storage.state_store import NodeStatus, StateStore


class AnomalyDetector:
    """
    Periodically scans all known nodes and calculates an anomaly score.

    Score components
    ────────────────
    1. Rate deviation  — how far the current message rate is above the
                         configured normal limit (RATE_LIMIT_MSG_PER_SEC).
    2. Payload deviation — how far the average payload size is above the
                           configured normal limit (MAX_NORMAL_PAYLOAD_BYTES).

    Each component is normalised to [0, 1] and blended via EWMA so that
    gradual changes are detected without false positives from short spikes.

    Final score is also EWMA-smoothed across cycles.
    """

    def __init__(self, store: StateStore) -> None:
        self._store = store
        self._thread: threading.Thread | None = None
        self._stop_event = threading.Event()

    # ── Lifecycle ──────────────────────────────────────────────────────────────

    def start(self) -> None:
        logger.info("Anomaly detector started "
                    f"(interval={config.DETECTION_INTERVAL_SECS}s, "
                    f"threshold={config.ANOMALY_THRESHOLD}, α={config.EWMA_ALPHA})")
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._run, daemon=True, name="AnomalyDetector")
        self._thread.start()

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=5)
        logger.info("Anomaly detector stopped.")

    # ── Main loop ──────────────────────────────────────────────────────────────

    def _run(self) -> None:
        while not self._stop_event.wait(config.DETECTION_INTERVAL_SECS):
            nodes = self._store.all_nodes()
            if not nodes:
                continue
            for node in nodes:
                # Skip nodes that are already offline — no active data to score.
                if node.status == NodeStatus.OFFLINE:
                    continue
                self._evaluate(node.node_id)

    # ── Per-node evaluation ────────────────────────────────────────────────────

    def _evaluate(self, node_id: str) -> None:
        node = self._store.get(node_id)
        if node is None:
            return

        # ── Step 1: measure current rate ──────────────────────────────────────
        raw_rate = node.current_rate()          # msg/s over last 10 s
        raw_payload = node.avg_payload()        # average bytes

        # ── Step 2: update EWMA of rate and payload ────────────────────────────
        alpha = config.EWMA_ALPHA
        new_ewma_rate = alpha * raw_rate + (1 - alpha) * node.ewma_rate
        new_ewma_payload = alpha * raw_payload + (1 - alpha) * node.ewma_payload
        self._store.update_ewma(node_id, new_ewma_rate, new_ewma_payload)

        # ── Step 3: compute normalised deviations ─────────────────────────────
        rate_limit = config.RATE_LIMIT_MSG_PER_SEC
        payload_limit = config.MAX_NORMAL_PAYLOAD_BYTES

        # Clamp to [0, 1]: 0 = no deviation, 1 = at or beyond limit.
        rate_dev = min(new_ewma_rate / rate_limit, 1.0) if rate_limit > 0 else 0.0
        payload_dev = min(new_ewma_payload / payload_limit, 1.0) if payload_limit > 0 else 0.0

        # Weighted blend: rate deviation is weighted slightly higher.
        raw_score = 0.6 * rate_dev + 0.4 * payload_dev

        # ── Step 4: EWMA-smooth the score itself ──────────────────────────────
        old_score = node.anomaly_score
        new_score = alpha * raw_score + (1 - alpha) * old_score

        self._store.set_anomaly_score(node_id, new_score, old_score, rate_dev, payload_dev)
