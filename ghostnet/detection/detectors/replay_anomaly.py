# =============================================================================
# GhostNet — detection/detectors/replay_anomaly.py
# Threat 3: Replay Anomaly
# Detect: stale timestamps OR duplicate sequence IDs
# Protect: REJECT_MESSAGES
# Heal: fresh messages for N cycles → RESUME_MESSAGES
# =============================================================================
from __future__ import annotations
import time
from ghostnet import config
from .base import ThreatResult, RESPONSE_REJECT_MESSAGES, RESPONSE_RESUME_MESSAGES


def detect(node) -> ThreatResult:
    issues = []

    # ── Stale timestamp check ─────────────────────────────────────────────────
    if node.last_message_ts is not None:
        age = time.time() - node.last_message_ts
        if age > config.REPLAY_MAX_AGE_SECS and node.message_count > 5:
            issues.append(f"last message timestamp is {age:.1f}s stale (limit {config.REPLAY_MAX_AGE_SECS}s)")

    # ── Duplicate seq ID check ────────────────────────────────────────────────
    if node.duplicate_seq_count > 0:
        issues.append(f"{node.duplicate_seq_count} duplicate sequence IDs detected in window")

    if not issues:
        return ThreatResult("replay_anomaly", False)

    severity = "critical" if node.duplicate_seq_count > 3 else "high"
    return ThreatResult(
        name="replay_anomaly", triggered=True, severity=severity,
        message=f"Replay attack indicators: {'; '.join(issues)}.",
        score_contribution=0.70,
        response=RESPONSE_REJECT_MESSAGES,
        heal_response=RESPONSE_RESUME_MESSAGES,
    )
