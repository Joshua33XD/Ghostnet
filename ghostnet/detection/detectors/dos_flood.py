# =============================================================================
# GhostNet — detection/detectors/dos_flood.py
# Threat 1: DoS / Traffic Flood
# Detect: message rate far above normal
# Protect: QUARANTINE
# Heal: score drops → RELEASE
# =============================================================================
from __future__ import annotations
from ghostnet import config
from .base import ThreatResult, RESPONSE_QUARANTINE, RESPONSE_RELEASE


def detect(node) -> ThreatResult:
    rate = node.current_rate()
    limit = config.RATE_LIMIT_MSG_PER_SEC

    if rate <= 0:
        return ThreatResult("dos_flood", False)

    ratio = rate / limit
    if ratio >= 3.0:
        return ThreatResult(
            name="dos_flood", triggered=True, severity="critical",
            message=f"Message rate {rate:.1f} msg/s is {ratio:.1f}x above limit ({limit} msg/s). DoS flood detected.",
            score_contribution=min((ratio - 1) / 4.0, 1.0),
            response=RESPONSE_QUARANTINE,
            heal_response=RESPONSE_RELEASE,
        )
    if ratio >= 2.0:
        return ThreatResult(
            name="dos_flood", triggered=True, severity="high",
            message=f"Message rate {rate:.1f} msg/s is {ratio:.1f}x above limit. Possible flood.",
            score_contribution=min((ratio - 1) / 5.0, 0.75),
            response=RESPONSE_QUARANTINE,
            heal_response=RESPONSE_RELEASE,
        )
    if ratio >= 1.2:
        return ThreatResult(
            name="dos_flood", triggered=True, severity="medium",
            message=f"Message rate {rate:.1f} msg/s slightly above limit.",
            score_contribution=0.25,
        )
    return ThreatResult("dos_flood", False)
