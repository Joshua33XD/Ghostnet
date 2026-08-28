# =============================================================================
# GhostNet — detection/detectors/base.py
# Shared ThreatResult dataclass used by every detector.
# =============================================================================
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional


SEVERITY_SCORE = {"low": 0.25, "medium": 0.50, "high": 0.75, "critical": 1.0}

# Canonical response commands sent over MQTT to the device
RESPONSE_QUARANTINE         = "QUARANTINE"
RESPONSE_RELEASE            = "RELEASE"
RESPONSE_LOCKOUT            = "LOCKOUT"
RESPONSE_UNLOCK             = "UNLOCK"
RESPONSE_RESTORE_FIRMWARE   = "RESTORE_FIRMWARE"
RESPONSE_RESTORE_CONFIG     = "RESTORE_CONFIG"
RESPONSE_RESTART_SERVICE    = "RESTART_SERVICE"
RESPONSE_REJECT_MESSAGES    = "REJECT_MESSAGES"
RESPONSE_RESUME_MESSAGES    = "RESUME_MESSAGES"


@dataclass
class ThreatResult:
    name: str                       # e.g. "dos_flood"
    triggered: bool
    severity: str = "low"           # low | medium | high | critical
    message: str  = ""
    score_contribution: float = 0.0 # added to final anomaly score (0–1)
    response: Optional[str] = None  # command to send to the device
    heal_response: Optional[str] = None  # command when this threat clears
