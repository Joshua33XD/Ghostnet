# =============================================================================
# GhostNet — detection/detectors/resource_exhaustion.py
# Threat 5: Resource Exhaustion
# Detect: CPU / RAM / storage metrics in telemetry spike above thresholds
# Protect: RESTART_SERVICE command
# Heal: metrics normalise → RESUME_MESSAGES
# =============================================================================
from __future__ import annotations
from ghostnet import config
from .base import ThreatResult, RESPONSE_RESTART_SERVICE, RESPONSE_RESUME_MESSAGES


def detect(node) -> ThreatResult:
    cpu  = node.last_cpu_pct
    ram  = node.last_ram_pct
    stor = node.last_storage_pct

    breaches = []
    if cpu  is not None and cpu  >= config.CPU_THRESHOLD_PCT:
        breaches.append(f"CPU {cpu:.0f}% (limit {config.CPU_THRESHOLD_PCT}%)")
    if ram  is not None and ram  >= config.RAM_THRESHOLD_PCT:
        breaches.append(f"RAM {ram:.0f}% (limit {config.RAM_THRESHOLD_PCT}%)")
    if stor is not None and stor >= config.STORAGE_THRESHOLD_PCT:
        breaches.append(f"Storage {stor:.0f}% (limit {config.STORAGE_THRESHOLD_PCT}%)")

    if not breaches:
        return ThreatResult("resource_exhaustion", False)

    severity = "critical" if len(breaches) >= 2 else "high"
    return ThreatResult(
        name="resource_exhaustion", triggered=True, severity=severity,
        message=f"Resource exhaustion: {', '.join(breaches)}.",
        score_contribution=0.65,
        response=RESPONSE_RESTART_SERVICE,
        heal_response=RESPONSE_RESUME_MESSAGES,
    )
