import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from ghostnet import config
from ghostnet.detection.detectors.base import (
    RESPONSE_QUARANTINE,
    RESPONSE_REJECT_MESSAGES,
    RESPONSE_RELEASE,
    RESPONSE_RESTORE_CONFIG,
    RESPONSE_RESUME_MESSAGES,
)
from ghostnet.response.quarantine_manager import QuarantineManager
from ghostnet.storage.state_store import NodeStatus, StateStore


def make_manager():
    sent = []

    def publish(topic, command):
        sent.append((topic, command))

    store = StateStore()
    manager = QuarantineManager(store, publish_fn=publish)
    return store, manager, sent


def test_containment_threat_quarantines_node():
    store, manager, sent = make_manager()
    node = store.get_or_create("node-1")
    node.active_threats = {"dos_flood"}
    node.anomaly_score = config.ANOMALY_THRESHOLD

    manager._evaluate_node("node-1")

    assert node.status == NodeStatus.QUARANTINED
    assert sent[-1] == ("ghostnet/node-1/command", RESPONSE_QUARANTINE)


def test_traffic_filter_threat_rejects_then_resumes_messages():
    old_window = config.RECOVERY_WINDOW
    config.RECOVERY_WINDOW = 1
    try:
        store, manager, sent = make_manager()
        node = store.get_or_create("node-2")
        node.active_threats = {"replay_anomaly"}

        manager._evaluate_node("node-2")
        node.active_threats = set()
        manager._evaluate_node("node-2")

        commands = [command for _, command in sent]
        assert commands == [RESPONSE_REJECT_MESSAGES, RESPONSE_RESUME_MESSAGES]
        assert node.status == NodeStatus.HEALTHY
    finally:
        config.RECOVERY_WINDOW = old_window


def test_integrity_threat_requests_restore_then_resumes_messages():
    old_window = config.RECOVERY_WINDOW
    config.RECOVERY_WINDOW = 1
    try:
        store, manager, sent = make_manager()
        node = store.get_or_create("node-3")
        node.active_threats = {"config_tamper"}

        manager._evaluate_node("node-3")
        node.active_threats = set()
        manager._evaluate_node("node-3")

        commands = [command for _, command in sent]
        assert commands == [RESPONSE_RESTORE_CONFIG, RESPONSE_RESUME_MESSAGES]
    finally:
        config.RECOVERY_WINDOW = old_window


def test_quarantined_node_releases_after_clean_window():
    old_window = config.RECOVERY_WINDOW
    config.RECOVERY_WINDOW = 1
    try:
        store, manager, sent = make_manager()
        node = store.get_or_create("node-4")
        node.active_threats = {"network_anomaly"}
        node.anomaly_score = config.ANOMALY_THRESHOLD

        manager._evaluate_node("node-4")
        node.active_threats = set()
        node.anomaly_score = 0.0
        manager._evaluate_node("node-4")

        commands = [command for _, command in sent]
        assert commands == [RESPONSE_QUARANTINE, RESPONSE_RELEASE]
        assert node.status == NodeStatus.HEALTHY
    finally:
        config.RECOVERY_WINDOW = old_window
