# =============================================================================
# GhostNet — detection/detectors/data_exfiltration.py
# Threat 4: Data Exfiltration
# Detect: abnormally large or rapidly growing average payload size
# Protect: QUARANTINE
# Heal: payload normalises → RELEASE
# =============================================================================
from __future__ import annotations
from ghostnet import config
from .base import ThreatResult, RESPONSE_QUARANTINE, RESPONSE_RELEASE


def detect(node) -> ThreatResult:
    avg = node.avg_payload()
    if avg <= 0:
        return ThreatResult("data_exfiltration", False)

    normal = config.MAX_NORMAL_PAYLOAD_BYTES
    critical = config.EXFIL_PAYLOAD_CRITICAL

    if avg >= critical:
        return ThreatResult(
            name="data_exfiltration", triggered=True, severity="critical",
            message=f"Average payload {avg:.0f}B far exceeds normal {normal}B. Possible data exfiltration.",
            score_contribution=0.90,
            response=RESPONSE_QUARANTINE,
            heal_response=RESPONSE_RELEASE,
        )
    if avg >= normal * 1.5:
        return ThreatResult(
            name="data_exfiltration", triggered=True, severity="high",
            message=f"Average payload {avg:.0f}B significantly above normal {normal}B.",
            score_contribution=0.60,
            response=RESPONSE_QUARANTINE,
            heal_response=RESPONSE_RELEASE,
        )
    if avg >= normal:
        return ThreatResult(
            name="data_exfiltration", triggered=True, severity="medium",
            message=f"Average payload {avg:.0f}B at or above normal limit {normal}B.",
            score_contribution=0.30,
        )
    return ThreatResult("data_exfiltration", False)
