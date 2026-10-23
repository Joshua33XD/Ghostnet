# =============================================================================
# GhostNet — detection/heartbeat_monitor.py
# Checks that every known node is still sending heartbeats.
# Prints a visible log line for every check so silence is never hidden.
# =============================================================================

from __future__ import annotations

import threading
import time

from ghostnet import config, logger
from ghostnet.storage.state_store import NodeStatus, StateStore


class HeartbeatMonitor:
    """
    Periodically walks through all known nodes and checks whether each one
    has sent a heartbeat within the configured timeout.

    If a node is silent for longer than HEARTBEAT_TIMEOUT_SECS it is
    immediately marked OFFLINE and the event is logged.

    When a heartbeat arrives (handled in StateStore.record_heartbeat) the
    node is automatically brought back to HEALTHY.
    """

    def __init__(self, store: StateStore) -> None:
        self._store = store
        self._thread: threading.Thread | None = None
        self._stop_event = threading.Event()

    # ── Lifecycle ──────────────────────────────────────────────────────────────

    def start(self) -> None:
        logger.info("Heartbeat monitor started "
                    f"(timeout={config.HEARTBEAT_TIMEOUT_SECS}s, "
                    f"check_interval={config.HEARTBEAT_CHECK_INTERVAL_SECS}s)")
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._run, daemon=True, name="HeartbeatMonitor")
        self._thread.start()

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=5)
        logger.info("Heartbeat monitor stopped.")

    # ── Main loop ──────────────────────────────────────────────────────────────

    def _run(self) -> None:
        while not self._stop_event.wait(config.HEARTBEAT_CHECK_INTERVAL_SECS):
            nodes = self._store.all_nodes()
            if not nodes:
                continue

            now = time.time()
            logger.info(f"Heartbeat check — evaluating {len(nodes)} node(s).")

            for node in nodes:
                # Already quarantined nodes are still monitored for heartbeats.
                elapsed = now - node.last_heartbeat

                if node.status == NodeStatus.OFFLINE:
                    # Already offline — keep reporting elapsed time.
                    logger.warn(
                        f"Still OFFLINE — {elapsed:.1f}s since last heartbeat.",
                        node_id=node.node_id,
                    )
                    continue

                if elapsed > config.HEARTBEAT_TIMEOUT_SECS:
                    self._store.mark_offline(node.node_id, elapsed)
                else:
                    remaining = config.HEARTBEAT_TIMEOUT_SECS - elapsed
                    logger.info(
                        f"Heartbeat OK — last seen {elapsed:.1f}s ago "
                        f"(timeout in {remaining:.1f}s).",
                        node_id=node.node_id,
                    )
