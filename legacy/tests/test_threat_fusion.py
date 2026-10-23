# =============================================================================
# GhostNet v3 — tests/test_threat_fusion.py
# =============================================================================
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from ghostnet.detection.threat_fusion import ThreatFusion, FusionResult
from ghostnet.detection.ml_detector import MLResult
from ghostnet.osi.mapper import OSIResult
from ghostnet.detection.detectors.base import ThreatResult


def make_ml(warmup=False, score=0.0, anomaly=False, confidence=0.5):
    return MLResult(
        node_id="n1", ml_score=score, ml_anomaly=anomaly,
        ml_confidence=confidence, warmup=warmup, sample_count=100,
        top_features=[("msg_rate", 5.0), ("avg_payload", 200.0)],
    )

def make_det(triggered=True, score=0.8):
    return ThreatResult("dos_flood", triggered=triggered,
                        severity="high", score_contribution=score)

def make_osi(layer=3, cat="DoS", conf=0.9):
    return OSIResult(layer, "Network", cat, conf, ["rate 20 msg/s"])


fusion = ThreatFusion()


def test_fusion_during_ml_warmup():
    """During warmup, ML weight = 0, det weight = 1."""
    ml  = make_ml(warmup=True, score=0.9)  # warmup: should be ignored
    det = make_det(triggered=True, score=0.5)
    osi = make_osi()
    result = fusion.fuse(None, [det], ml, [osi])
    # Final score should equal det score (ML ignored)
    assert abs(result.final_score - 0.5) < 0.01
    assert result.ml_warmup is True


def test_fusion_weights_det_over_ml():
    """Deterministic detectors have 70% weight, ML 30%."""
    import ghostnet.config as cfg
    cfg.FUSION_WEIGHT_DET = 0.70
    cfg.FUSION_WEIGHT_ML  = 0.30
    ml  = make_ml(warmup=False, score=0.0)
    det = make_det(triggered=True, score=1.0)
    osi = make_osi()
    result = fusion.fuse(None, [det], ml, [osi])
    # With det=1.0 and ml=0.0: final = 0.70*1.0 + 0.30*0.0 = 0.70
    assert abs(result.final_score - 0.70) < 0.02


def test_fusion_no_detectors_triggered():
    ml  = make_ml(warmup=False, score=0.1)
    result = fusion.fuse(None, [make_det(triggered=False, score=0.0)], ml, [])
    assert result.det_score == 0.0
    assert result.triggered_detectors == []


def test_memory_match_boosts_confidence():
    from ghostnet.detection.threat_fusion import MemoryMatch
    ml  = make_ml(warmup=False, score=0.5)
    det = make_det()
    osi = make_osi()
    match = MemoryMatch(1, 0.95, "DoS", 3, "Network", 0.0, "n1")
    result = fusion.fuse(None, [det], ml, [osi], memory_matches=[match])
    assert len(result.memory_matches) == 1
    assert result.confidence > 0.0


def test_fusion_result_to_dict():
    ml  = make_ml(warmup=False, score=0.5)
    det = make_det()
    osi = make_osi()
    result = fusion.fuse(None, [det], ml, [osi])
    d = result.to_dict()
    assert "fusion_score" in d
    assert "osi_layer" in d
    assert "triggered_detectors" in d
    assert "memory_matches" in d
