# =============================================================================
# GhostNet — detection/detectors/mqtt_abuse.py
# Threat 2: MQTT Abuse
# Detect: publishing to unexpected/wildcard topics outside baseline
# Protect: QUARANTINE
# Heal: topic behavior normalises → RELEASE
# =============================================================================
from __future__ import annotations
from ghostnet import config
from .base import ThreatResult, RESPONSE_QUARANTINE, RESPONSE_RELEASE


def detect(node) -> ThreatResult:
    # Still in baseline learning phase
    if node.message_count < config.MQTT_TOPIC_BASELINE_MSGS:
        return ThreatResult("mqtt_abuse", False,
                            message=f"Learning baseline topics ({node.message_count}/{config.MQTT_TOPIC_BASELINE_MSGS} msgs).")

    n_topics = len(node.seen_topics)
    limit = config.MQTT_MAX_UNIQUE_TOPICS

    if n_topics > limit * 2:
        return ThreatResult(
            name="mqtt_abuse", triggered=True, severity="critical",
            message=f"Node is publishing to {n_topics} unique topics (limit {limit}). Possible MQTT topic abuse or wildcard attack.",
            score_contribution=0.85,
            response=RESPONSE_QUARANTINE,
            heal_response=RESPONSE_RELEASE,
        )
    if n_topics > limit:
        return ThreatResult(
            name="mqtt_abuse", triggered=True, severity="high",
            message=f"Node publishing to {n_topics} topics — exceeds expected {limit}. Monitoring for abuse.",
            score_contribution=0.50,
            response=RESPONSE_QUARANTINE,
            heal_response=RESPONSE_RELEASE,
        )
    return ThreatResult("mqtt_abuse", False)
