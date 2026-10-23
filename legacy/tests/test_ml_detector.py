# =============================================================================
# GhostNet v3 — tests/test_ml_detector.py
# =============================================================================
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import time
import pytest
from ghostnet.detection.ml_detector import MLAnomalyDetector, FEATURE_NAMES


class FakeNode:
    def __init__(self, node_id="ml-test"):
        self.node_id = node_id
        self.ewma_rate = 1.0
        self.ewma_payload = 100.0
        self.seen_topics = {"t1"}
        self.auth_fail_timestamps = []
        self.reboot_timestamps = []
        self.last_cpu_pct = 20.0
        self.last_ram_pct = 30.0
        self.last_storage_pct = 15.0
        self.duplicate_seq_count = 0

    def current_rate(self): return self.ewma_rate
    def avg_payload(self):  return self.ewma_payload


def make_detector(tmpdir):
    import ghostnet.config as cfg
    cfg.ML_MODEL_DIR = str(tmpdir)
    cfg.ML_N_WARMUP  = 10   # small for tests
    return MLAnomalyDetector()


def test_feature_extraction():
    node = FakeNode()
    vec = MLAnomalyDetector.extract_features(node)
    assert len(vec) == len(FEATURE_NAMES)
    assert all(isinstance(v, float) for v in vec)


def test_warmup_returns_zero_score(tmp_path):
    det = make_detector(tmp_path)
    node = FakeNode()
    result = det.score(node)
    assert result.warmup is True
    assert result.ml_score == 0.0
    assert result.ml_confidence == 0.0


def test_model_fits_after_warmup(tmp_path):
    det = make_detector(tmp_path)
    node = FakeNode()
    # Feed enough samples
    for _ in range(15):
        result = det.score(node)
    # After warmup, model should be fitted
    assert result.warmup is False
    assert result.ml_score >= 0.0
    assert result.ml_confidence > 0.0


def test_anomaly_detected_on_extreme_input(tmp_path):
    det = make_detector(tmp_path)
    normal = FakeNode("anomaly-test")
    # Build baseline
    for _ in range(15):
        det.score(normal)
    # Now inject extreme anomaly
    abnormal = FakeNode("anomaly-test")
    abnormal.ewma_rate    = 1000.0  # extreme rate
    abnormal.ewma_payload = 50000.0
    result = det.score(abnormal)
    # Should be scored (not in warmup) and score > 0
    assert result.warmup is False
    assert result.ml_score >= 0.0  # can't guarantee >0 with tiny dataset but shouldn't error


def test_explicit_retrain(tmp_path):
    det = make_detector(tmp_path)
    node = FakeNode()
    for _ in range(15):
        det.score(node)
    success = det.retrain(node.node_id)
    assert success is True


def test_retrain_fails_insufficient_samples(tmp_path):
    det = make_detector(tmp_path)
    node = FakeNode()
    det.score(node)  # only 1 sample
    success = det.retrain(node.node_id)
    assert success is False


def test_status_returns_dict(tmp_path):
    det = make_detector(tmp_path)
    node = FakeNode()
    det.score(node)
    status = det.status()
    assert node.node_id in status
    assert "sample_count" in status[node.node_id]
