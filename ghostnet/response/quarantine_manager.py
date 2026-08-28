# =============================================================================
# GhostNet — response/quarantine_manager.py  (full protect + heal edition)
#
# Per-threat protect → heal lifecycle:
#
#   1. ThreatDetector fires → active_threats updated on node
#   2. QuarantineManager reads active threats → sends protection command
#   3. Each cycle: checks if threat still active
#      - Still active  → maintain protection, log status
#      - Cleared       → increment clean streak, send heal command when streak hits RECOVERY_WINDOW
# =============================================================================
from __future__ import annotations

import threading
import time
from typing import Optional

from ghostnet import config, logger
from ghostnet.detection.detectors.base import (
    RESPONSE_QUARANTINE, RESPONSE_RELEASE,
    RESPONSE_LOCKOUT, RESPONSE_UNLOCK,
    RESPONSE_RESTORE_FIRMWARE, RESPONSE_RESTORE_CONFIG,
    RESPONSE_RESTART_SERVICE, RESPONSE_REJECT_MESSAGES,
    RESPONSE_RESUME_MESSAGES,
)
from ghostnet.storage.state_store import NodeStatus, StateStore

# Map threat name → (protect_response, heal_response, description)
THREAT_RESPONSES = {
    "dos_flood":           (RESPONSE_QUARANTINE,       RESPONSE_RELEASE,          "Network isolated to stop flood."),
    "mqtt_abuse":          (RESPONSE_QUARANTINE,       RESPONSE_RELEASE,          "MQTT client isolated due to topic abuse."),
    "replay_anomaly":      (RESPONSE_REJECT_MESSAGES,  RESPONSE_RESUME_MESSAGES,  "Messages being rejected (replay protection)."),
    "data_exfiltration":   (RESPONSE_QUARANTINE,       RESPONSE_RELEASE,          "Network isolated to stop data leak."),
    "resource_exhaustion": (RESPONSE_RESTART_SERVICE,  RESPONSE_RESUME_MESSAGES,  "Service restart triggered to recover resources."),
    "crash_restart":       (RESPONSE_RESTART_SERVICE,  RESPONSE_RESUME_MESSAGES,  "Managed restart to break crash loop."),
    "firmware_tamper":     (RESPONSE_RESTORE_FIRMWARE, RESPONSE_RESUME_MESSAGES,  "Firmware restore command sent."),
    "config_tamper":       (RESPONSE_RESTORE_CONFIG,   RESPONSE_RESUME_MESSAGES,  "Config restore command sent."),
    "brute_force":         (RESPONSE_LOCKOUT,          RESPONSE_UNLOCK,           "Account/session locked out."),
    "network_anomaly":     (RESPONSE_QUARANTINE,       RESPONSE_RELEASE,          "Network isolated due to traffic anomaly."),
}

HUMAN_LABELS = {
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


class QuarantineManager:
    def __init__(self, store: StateStore, publish_fn=None) -> None:
        self._store   = store
        self._publish = publish_fn
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        # Track which protection commands have already been sent
        # { node_id → set(threat_name) }
        self._sent_protect: dict = {}
        # { node_id → { threat_name → clean_streak } }
        self._heal_streaks: dict = {}

    # ── Lifecycle ──────────────────────────────────────────────────────────────
    def start(self) -> None:
        logger.info(
            f"Quarantine manager started "
            f"(anomaly_threshold={config.ANOMALY_THRESHOLD}, "
            f"recovery_threshold={config.RECOVERY_THRESHOLD}, "
            f"recovery_window={config.RECOVERY_WINDOW} cycles)"
        )
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._run, daemon=True, name="QuarantineManager")
        self._thread.start()

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=5)
        logger.info("Quarantine manager stopped.")

    def _run(self) -> None:
        while not self._stop_event.wait(config.DETECTION_INTERVAL_SECS):
            self.evaluate_all()

    # ── Core evaluation ────────────────────────────────────────────────────────
    def evaluate_all(self) -> None:
        for node in self._store.all_nodes():
            self._evaluate_node(node.node_id)

    def _evaluate_node(self, node_id: str) -> None:
        node = self._store.get(node_id)
        if node is None:
            return

        active_threats = node.active_threats
        sent_protect   = self._sent_protect.setdefault(node_id, set())
        heal_streaks   = self._heal_streaks.setdefault(node_id, {})

        # ── STEP 1: Apply protection for newly triggered threats ───────────────
        for threat_name in active_threats:
            if threat_name not in sent_protect:
                protect_cmd, _, reason = THREAT_RESPONSES.get(
                    threat_name, (RESPONSE_QUARANTINE, RESPONSE_RELEASE, "Unknown threat.")
                )
                label = HUMAN_LABELS.get(threat_name, threat_name)
                logger.protect_action(node_id, protect_cmd, f"[{label}] {reason}")
                self._send_command(node_id, protect_cmd)
                sent_protect.add(threat_name)
                heal_streaks[threat_name] = 0

                # Quarantine the node in state store if the response involves isolation
                if protect_cmd == RESPONSE_QUARANTINE and node.status != NodeStatus.QUARANTINED:
                    score = node.anomaly_score
                    logger.attack_detected(node_id, score)
                    self._store.mark_quarantined(node_id)

        # ── STEP 2: Self-heal threats that have cleared ────────────────────────
        cleared = sent_protect - active_threats
        for threat_name in list(cleared):
            label = HUMAN_LABELS.get(threat_name, threat_name)
            streak = heal_streaks.get(threat_name, 0) + 1
            heal_streaks[threat_name] = streak

            _, heal_cmd, _ = THREAT_RESPONSES.get(
                threat_name, (None, RESPONSE_RELEASE, "")
            )
            logger.quarantine_check(node_id, node.anomaly_score, streak, config.RECOVERY_WINDOW)

            if streak >= config.RECOVERY_WINDOW:
                logger.self_heal(node_id, heal_cmd)
                self._send_command(node_id, heal_cmd)
                sent_protect.discard(threat_name)
                heal_streaks[threat_name] = 0
                logger.info(
                    f"[{label}] threat healed after {streak} clean cycles — {heal_cmd!r} sent.",
                    node_id=node_id,
                )
            else:
                logger.info(
                    f"[{label}] cleared — waiting for {config.RECOVERY_WINDOW - streak} more clean cycle(s) before heal.",
                    node_id=node_id,
                )

        # ── STEP 3: Overall node recovery ─────────────────────────────────────
        if not active_threats and not sent_protect:
            if node.status == NodeStatus.QUARANTINED:
                score = node.anomaly_score
                if score < config.RECOVERY_THRESHOLD:
                    self._store.increment_clean_streak(node_id)
                    streak = node.quarantine_clean_streak
                    logger.quarantine_check(node_id, score, streak, config.RECOVERY_WINDOW)
                    if streak >= config.RECOVERY_WINDOW:
                        self._store.mark_recovered(node_id)
                        self._send_command(node_id, RESPONSE_RELEASE)
                else:
                    self._store.reset_clean_streak(node_id)
            elif node.status == NodeStatus.SUSPICIOUS and node.anomaly_score < config.RECOVERY_THRESHOLD:
                self._store.set_status(node_id, NodeStatus.HEALTHY)
                logger.info("Score normalised — status returned to HEALTHY.", node_id=node_id)

        # ── STEP 4: Escalate to QUARANTINE if overall score still high ─────────
        elif node.status in (NodeStatus.HEALTHY, NodeStatus.SUSPICIOUS):
            if node.anomaly_score >= config.ANOMALY_THRESHOLD:
                logger.attack_detected(node_id, node.anomaly_score)
                self._store.mark_quarantined(node_id)
                self._send_command(node_id, RESPONSE_QUARANTINE)

    def _send_command(self, node_id: str, command: str) -> None:
        topic = f"{config.MQTT_TOPIC_ROOT}/{node_id}/command"
        if self._publish:
            try:
                self._publish(topic, command)
                logger.mqtt_tx(node_id, command)
            except Exception as exc:
                logger.error(f"Failed to publish {command!r}: {exc}", node_id=node_id)
        else:
            logger.info(f"[No MQTT publish] Would send {command!r} → {topic}", node_id=node_id)
