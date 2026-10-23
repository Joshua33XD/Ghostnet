import time
from ghostnet.storage.state_store import DeviceState, DeviceStatus, StateStore


def test_status_rule_severity_1_quarantines():
    store = StateStore(alert_window_secs=10.0)
    dev = store.get_or_create_device("192.168.1.100")
    assert dev.status == DeviceStatus.HEALTHY

    now = time.time()
    alert_sev1 = {
        "timestamp": now,
        "event_type": "alert",
        "src_ip": "192.168.1.100",
        "dest_ip": "192.168.1.50",
        "alert": {"signature": "MQTT Flood", "severity": 1, "signature_id": 1000001},
    }
    store.ingest_event(alert_sev1)

    dev = store.get_device("192.168.1.100")
    assert dev.status == DeviceStatus.QUARANTINED
    assert "MQTT Flood" in dev.active_threats


def test_status_rule_severity_3_suspicious():
    store = StateStore(alert_window_secs=10.0)
    dev = store.get_or_create_device("192.168.1.101")
    assert dev.status == DeviceStatus.HEALTHY

    now = time.time()
    alert_sev3 = {
        "timestamp": now,
        "event_type": "alert",
        "src_ip": "192.168.1.101",
        "dest_ip": "192.168.1.50",
        "alert": {"signature": "Recon Scan", "severity": 3, "signature_id": 1000004},
    }
    store.ingest_event(alert_sev3)

    dev = store.get_device("192.168.1.101")
    assert dev.status == DeviceStatus.SUSPICIOUS
    assert "Recon Scan" in dev.active_threats


def test_status_rule_clean_window_recovery():
    store = StateStore(alert_window_secs=5.0)
    dev = store.get_or_create_device("192.168.1.102")

    # Incur an alert 10 seconds in the past
    past_time = time.time() - 10.0
    alert_old = {
        "timestamp": past_time,
        "event_type": "alert",
        "src_ip": "192.168.1.102",
        "dest_ip": "192.168.1.50",
        "alert": {"signature": "Old Exploit", "severity": 1, "signature_id": 1000001},
    }
    dev.add_alert(alert_old)
    dev.status = DeviceStatus.QUARANTINED

    # Evaluate at current time (>5s after alert)
    old_s, new_s, trig = dev.evaluate_status(time.time(), window_secs=5.0)
    assert new_s == DeviceStatus.HEALTHY
    assert dev.status == DeviceStatus.HEALTHY
    assert len(dev.active_threats) == 0


def test_manual_quarantine_and_release():
    store = StateStore(alert_window_secs=10.0)
    ip = "192.168.1.200"
    dev = store.get_or_create_device(ip)

    store.manual_quarantine(ip, reason="Security audit lockdown")
    assert dev.status == DeviceStatus.QUARANTINED
    assert dev.manually_quarantined is True

    # Even after clean window check, remains quarantined until manual release
    old_s, new_s, trig = dev.evaluate_status(time.time() + 100, window_secs=10.0)
    assert dev.status == DeviceStatus.QUARANTINED

    store.mark_recovered(ip)
    assert dev.status == DeviceStatus.HEALTHY
    assert dev.manually_quarantined is False
