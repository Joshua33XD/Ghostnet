# =============================================================================
# GhostNet — detection/detectors/config_tamper.py
# Threat 8: Configuration Tampering
# Detect: config hash in telemetry changes from known-good baseline
# Protect: RESTORE_CONFIG command
# Heal: hash returns to baseline → RESUME_MESSAGES
# =============================================================================
from __future__ import annotations
from .base import ThreatResult, RESPONSE_RESTORE_CONFIG, RESPONSE_RESUME_MESSAGES


def detect(node) -> ThreatResult:
    current  = node.last_config_hash
    baseline = node.baseline_config_hash

    if current is None or baseline is None:
        return ThreatResult("config_tamper", False,
                            message="Waiting for config hash baseline.")

    if current != baseline:
        return ThreatResult(
            name="config_tamper", triggered=True, severity="critical",
            message=(
                f"Config hash changed! "
                f"Baseline: {baseline[:12]}… → Current: {current[:12]}… "
                f"Possible unauthorised configuration change."
            ),
            score_contribution=0.90,
            response=RESPONSE_RESTORE_CONFIG,
            heal_response=RESPONSE_RESUME_MESSAGES,
        )
    return ThreatResult("config_tamper", False)
