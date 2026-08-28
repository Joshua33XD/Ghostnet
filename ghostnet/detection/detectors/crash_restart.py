# =============================================================================
# GhostNet — detection/detectors/crash_restart.py
# Threat 6: Repeated Crashes / Restarts
# Detect: reboot counter incrementing faster than threshold
# Protect: RESTART_SERVICE (managed restart)
# Heal: reboot rate drops → RESUME_MESSAGES
# =============================================================================
from __future__ import annotations
import time
from ghostnet import config
from .base import ThreatResult, RESPONSE_RESTART_SERVICE, RESPONSE_RESUME_MESSAGES


def detect(node) -> ThreatResult:
    if not node.reboot_timestamps:
        return ThreatResult("crash_restart", False)

    now = time.time()
    window = config.REBOOT_RATE_WINDOW_SECS
    recent = [t for t in node.reboot_timestamps if now - t <= window]

    if len(recent) >= config.REBOOT_RATE_LIMIT:
        return ThreatResult(
            name="crash_restart", triggered=True, severity="high",
            message=f"{len(recent)} reboots in {window:.0f}s window (limit {config.REBOOT_RATE_LIMIT}). Possible crash loop.",
            score_contribution=0.60,
            response=RESPONSE_RESTART_SERVICE,
            heal_response=RESPONSE_RESUME_MESSAGES,
        )
    if len(recent) >= config.REBOOT_RATE_LIMIT - 1:
        return ThreatResult(
            name="crash_restart", triggered=True, severity="medium",
            message=f"{len(recent)} reboots in {window:.0f}s — approaching crash-loop threshold.",
            score_contribution=0.30,
        )
    return ThreatResult("crash_restart", False)
