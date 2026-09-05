# =============================================================================
# GhostNet v3 — tests/test_osi_mapper.py
# =============================================================================
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from ghostnet.osi.mapper import OSIMapper, OSIResult


class FakeNode:
    node_id = "test-node"
    def current_rate(self): return 0.0
    def avg_payload(self): return 0.0
    seen_topics = set()
    auth_fail_timestamps = []
    reboot_timestamps = []
    duplicate_seq_count = 0
    last_message_ts = None
    last_cpu_pct = None
    last_ram_pct = None
    last_storage_pct = None
    last_firmware_hash = None
    baseline_firmware_hash = None
    last_config_hash = None
    baseline_config_hash = None
    ewma_rate = 0.0
    ewma_payload = 0.0


mapper = OSIMapper()


def test_dos_flood_maps_l3():
    node = FakeNode()
    node.current_rate = lambda: 20.0
    node.ewma_rate = 18.0
    result = mapper.classify("dos_flood", node)
    assert result.osi_layer == 3
    assert "Network" in result.osi_layer_name
    assert result.confidence > 0.5


def test_brute_force_maps_l7():
    import time
    node = FakeNode()
    node.auth_fail_timestamps = [time.time()] * 10
    result = mapper.classify("brute_force", node)
    assert result.osi_layer == 7
    assert result.attack_category == "Brute-Force / Auth Attack"
    assert len(result.evidence) > 0


def test_firmware_tamper_maps_l7():
    node = FakeNode()
    node.last_firmware_hash = "abc123"
    node.baseline_firmware_hash = "xyz789"
    result = mapper.classify("firmware_tamper", node)
    assert result.osi_layer == 7
    assert "Firmware" in result.attack_category
    assert result.confidence >= 0.9


def test_unknown_threat_returns_indeterminate():
    node = FakeNode()
    result = mapper.classify("totally_unknown_threat", node)
    assert result.osi_layer is None
    assert result.confidence == 0.0


def test_no_evidence_reduces_confidence():
    node = FakeNode()  # no telemetry
    result = mapper.classify("dos_flood", node)
    # No rate data -> reduced confidence
    assert result.confidence < 0.9


def test_classify_all_returns_list():
    node = FakeNode()
    results = mapper.classify_all(["dos_flood", "brute_force"], node)
    assert len(results) == 2


def test_primary_returns_highest_confidence():
    r1 = OSIResult(3, "Network", "DoS", 0.9, [])
    r2 = OSIResult(7, "Application", "Brute-Force", 0.5, [])
    primary = mapper.primary([r1, r2])
    assert primary.osi_layer == 3


def test_primary_empty_returns_indeterminate():
    result = mapper.primary([])
    assert result.osi_layer is None
