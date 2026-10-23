# =============================================================================
# GhostNet v3 — tests/test_immune_memory.py
# =============================================================================
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import time
import pytest
from ghostnet.memory.immune_memory import ImmuneMemory, _cosine_similarity
from ghostnet.osi.mapper import OSIResult
from ghostnet.detection.ml_detector import MLResult
from ghostnet.detection.threat_fusion import FusionResult


def make_db(tmp_path):
    return ImmuneMemory(db_path=str(tmp_path / "test_memory.db"))


def make_osi(layer=3):
    return OSIResult(layer, "Network", "DoS", 0.9, ["rate 10 msg/s"])


class FakeML:
    ml_score      = 0.8
    ml_anomaly    = True
    ml_confidence = 0.75
    warmup        = False
    sample_count  = 100
    top_features  = [("msg_rate", 8.0), ("avg_payload", 512.0), ("cpu_pct", 15.0)]


class FakeFusion:
    final_score = 0.85
    confidence  = 0.90


def test_record_and_retrieve(tmp_path):
    mem = make_db(tmp_path)
    osi = make_osi()
    mid = mem.record_incident("node-1", osi, [], FakeML(), FakeFusion(), "QUARANTINE", True)
    assert mid > 0
    incidents = mem.get_incidents()
    assert len(incidents) == 1
    assert incidents[0]["node_id"] == "node-1"
    assert incidents[0]["recovered"] is True


def test_filter_by_node(tmp_path):
    mem = make_db(tmp_path)
    mem.record_incident("node-A", make_osi(), [], FakeML(), FakeFusion(), "QUARANTINE", True)
    mem.record_incident("node-B", make_osi(), [], FakeML(), FakeFusion(), "QUARANTINE", False)
    a = mem.get_incidents(node_id="node-A")
    b = mem.get_incidents(node_id="node-B")
    assert len(a) == 1
    assert len(b) == 1
    assert a[0]["node_id"] == "node-A"


def test_count(tmp_path):
    mem = make_db(tmp_path)
    assert mem.count() == 0
    mem.record_incident("node-1", make_osi(), [], FakeML(), FakeFusion(), "Q", True)
    assert mem.count() == 1


def test_cosine_similarity_identical():
    v = [1.0, 2.0, 3.0]
    assert abs(_cosine_similarity(v, v) - 1.0) < 1e-6


def test_cosine_similarity_orthogonal():
    v1 = [1.0, 0.0]
    v2 = [0.0, 1.0]
    assert abs(_cosine_similarity(v1, v2) - 0.0) < 1e-6


def test_cosine_similarity_zero_vector():
    assert _cosine_similarity([0.0, 0.0], [1.0, 2.0]) == 0.0


def test_find_similar_match(tmp_path):
    import ghostnet.config as cfg
    cfg.MEMORY_SIMILARITY_THRESHOLD = 0.70
    cfg.MEMORY_TOP_K = 3
    mem = make_db(tmp_path)
    # Record with known features
    mem.record_incident("node-1", make_osi(), [], FakeML(), FakeFusion(), "Q", True)
    # Query with same features
    matches = mem.find_similar("node-1", FakeML.top_features)
    assert len(matches) > 0
    assert matches[0].similarity >= 0.70


def test_find_similar_no_match_on_dissimilar(tmp_path):
    import ghostnet.config as cfg
    cfg.MEMORY_SIMILARITY_THRESHOLD = 0.99  # very high threshold
    mem = make_db(tmp_path)
    mem.record_incident("node-1", make_osi(), [], FakeML(), FakeFusion(), "Q", True)
    # Very different features
    features = [("msg_rate", 0.0), ("avg_payload", 0.0), ("cpu_pct", 0.0)]
    matches = mem.find_similar("node-1", features)
    assert len(matches) == 0
