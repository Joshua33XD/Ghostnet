# =============================================================================
# GhostNet — response/quarantine_manager.py (Network-Only IDS Edition)
# Manages device quarantine lifecycle and clean-window recovery.
# =============================================================================
from __future__ import annotations

import threading
import time
from typing import Callable, Optional

from ghostnet import config, logger
from ghostnet.storage.state_store import DeviceStatus, StateStore


class QuarantineManager:
    """
    Evaluates device health based on Suricata alert recency and handles clean-window recovery.
    """

    def __init__(
        self,
        store: StateStore,
        publish_fn: Optional[Callable[[str, str], None]] = None,
        check_interval: float = 2.0,
    ) -> None:
        self._store = store
        self._publish = publish_fn
        self._check_interval = check_interval
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()

    def start(self) -> None:
        logger.info(
            f"Quarantine manager started (clean_window={config.ALERT_WINDOW_SECS}s, "
            f"interval={self._check_interval}s)"
        )
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._run, daemon=True, name="QuarantineManager")
        self._thread.start()

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=3.0)
            self._thread = None
        logger.info("Quarantine manager stopped.")

    def _run(self) -> None:
        while not self._stop_event.wait(self._check_interval):
            self.evaluate_all()

    def evaluate_all(self) -> None:
        """Evaluates all devices, checking clean windows for recovery."""
        transitions = self._store.evaluate_all_devices()
        for ip, old_s, new_s in transitions:
            if self._publish:
                try:
                    topic = f"ghostnet/devices/{ip}/status"
                    payload = f'{{"status": "{new_s}", "previous": "{old_s}"}}'
                    self._publish(topic, payload)
                except Exception:
                    pass

    def quarantine(self, ip: str, reason: str = "Operator quarantine") -> bool:
        """Manually quarantine a device by IP."""
        success = self._store.manual_quarantine(ip, reason)
        if success and self._publish:
            try:
                self._publish(f"ghostnet/devices/{ip}/action", "QUARANTINE")
            except Exception:
                pass
        return success

    def release(self, ip: str) -> bool:
        """Manually release a device back to HEALTHY."""
        success = self._store.mark_recovered(ip)
        if success and self._publish:
            try:
                self._publish(f"ghostnet/devices/{ip}/action", "RELEASE")
            except Exception:
                pass
        return success
