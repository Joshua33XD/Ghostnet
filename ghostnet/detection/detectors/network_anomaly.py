# =============================================================================
# GhostNet — detection/detectors/network_anomaly.py
# Threat 10: Network Anomaly
# Detect: sudden multi-signal EWMA deviation (composite)
# Protect: QUARANTINE
# Heal: EWMA returns to baseline → RELEASE
# =============================================================================
from __future__ import annotations
from ghostnet import config
from .base import ThreatResult, RESPONSE_QUARANTINE, RESPONSE_RELEASE


def detect(node) -> ThreatResult:
    """
    Combines rate and payload EWMA deviations into a single network-anomaly
    score using a configurable sigma multiplier.  This catches gradual or
    sudden behavioural drifts that don't individually breach their thresholds.
    """
    rate    = node.ewma_rate
    payload = node.ewma_payload
    rate_lim    = config.RATE_LIMIT_MSG_PER_SEC
    payload_lim = config.MAX_NORMAL_PAYLOAD_BYTES

    if rate_lim <= 0 or payload_lim <= 0:
        return ThreatResult("network_anomaly", False)

    rate_dev    = rate    / rate_lim
    payload_dev = payload / payload_lim

    # Composite deviation score
    composite = 0.5 * rate_dev + 0.5 * payload_dev
    sigma     = config.NETWORK_ANOMALY_SIGMA   # e.g. 2.5

    # Normalised: 1.0 means composite == sigma × expected
    normalised = min(composite / sigma, 1.0)

    if normalised >= 0.85:
        return ThreatResult(
            name="network_anomaly", triggered=True, severity="critical",
            message=(
                f"Multi-signal network anomaly: rate_dev={rate_dev:.2f}, "
                f"payload_dev={payload_dev:.2f}, composite={composite:.2f} "
                f"(sigma threshold={sigma})."
            ),
            score_contribution=normalised,
            response=RESPONSE_QUARANTINE,
            heal_response=RESPONSE_RELEASE,
        )
    if normalised >= 0.55:
        return ThreatResult(
            name="network_anomaly", triggered=True, severity="medium",
            message=f"Network traffic pattern deviating (composite={composite:.2f}).",
            score_contribution=normalised * 0.6,
        )
    return ThreatResult("network_anomaly", False)
