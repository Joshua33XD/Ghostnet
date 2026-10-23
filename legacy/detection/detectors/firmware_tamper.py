# =============================================================================
# GhostNet — detection/detectors/firmware_tamper.py
# Threat 7: Firmware Tampering
# Detect: firmware hash in telemetry changes from known-good baseline
# Protect: RESTORE_FIRMWARE command
# Heal: hash returns to baseline → RESUME_MESSAGES
# =============================================================================
from __future__ import annotations
from .base import ThreatResult, RESPONSE_RESTORE_FIRMWARE, RESPONSE_RESUME_MESSAGES


def detect(node) -> ThreatResult:
    current = node.last_firmware_hash
    baseline = node.baseline_firmware_hash

    if current is None or baseline is None:
        # Haven't established baseline yet
        return ThreatResult("firmware_tamper", False,
                            message="Waiting for firmware hash baseline.")

    if current != baseline:
        return ThreatResult(
            name="firmware_tamper", triggered=True, severity="critical",
            message=(
                f"Firmware hash changed! "
                f"Baseline: {baseline[:12]}… → Current: {current[:12]}… "
                f"Possible firmware tampering or unauthorised OTA update."
            ),
            score_contribution=0.95,
            response=RESPONSE_RESTORE_FIRMWARE,
            heal_response=RESPONSE_RESUME_MESSAGES,
        )
    return ThreatResult("firmware_tamper", False)
