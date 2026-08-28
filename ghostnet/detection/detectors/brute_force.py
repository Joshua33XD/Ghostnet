# =============================================================================
# GhostNet — detection/detectors/brute_force.py
# Threat 9: Brute-force
# Detect: auth-fail counter in telemetry spikes within time window
# Protect: LOCKOUT command
# Heal: no auth fails for recovery window → UNLOCK
# =============================================================================
from __future__ import annotations
import time
from ghostnet import config
from .base import ThreatResult, RESPONSE_LOCKOUT, RESPONSE_UNLOCK


def detect(node) -> ThreatResult:
    if not node.auth_fail_timestamps:
        return ThreatResult("brute_force", False)

    now = time.time()
    window = config.AUTH_FAIL_WINDOW_SECS
    recent = [t for t in node.auth_fail_timestamps if now - t <= window]

    if len(recent) >= config.AUTH_FAIL_LIMIT:
        return ThreatResult(
            name="brute_force", triggered=True, severity="critical",
            message=(
                f"{len(recent)} authentication failures in {window:.0f}s "
                f"(limit {config.AUTH_FAIL_LIMIT}). Brute-force attack detected."
            ),
            score_contribution=0.85,
            response=RESPONSE_LOCKOUT,
            heal_response=RESPONSE_UNLOCK,
        )
    if len(recent) >= config.AUTH_FAIL_LIMIT - 2:
        return ThreatResult(
            name="brute_force", triggered=True, severity="high",
            message=f"{len(recent)} auth failures in window — approaching lockout threshold.",
            score_contribution=0.45,
        )
    return ThreatResult("brute_force", False)
