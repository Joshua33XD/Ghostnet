import time
from fastapi.testclient import TestClient
from ghostnet.api.main import app, set_state_store
from ghostnet.storage.state_store import StateStore


def test_api_devices_and_alerts():
    store = StateStore(alert_window_secs=10.0)
    set_state_store(store)
    client = TestClient(app)

    # Ingest a flow and alert
    now = time.time()
    store.ingest_event({
        "timestamp": now,
        "event_type": "flow",
        "src_ip": "192.168.1.10",
        "dest_ip": "192.168.1.50",
        "flow": {"bytes_toserver": 1000, "bytes_toclient": 500, "pkts_toserver": 10, "pkts_toclient": 5},
    })
    store.ingest_event({
        "timestamp": now,
        "event_type": "alert",
        "src_ip": "192.168.1.105",
        "dest_ip": "192.168.1.50",
        "alert": {"signature": "MQTT Flood Attack", "severity": 1, "signature_id": 1000001, "category": "DoS"},
    })

    # Test /devices
    res = client.get("/devices")
    assert res.status_code == 200
    devices = res.json()
    assert len(devices) >= 2
    ips = [d["ip"] for d in devices]
    assert "192.168.1.10" in ips
    assert "192.168.1.105" in ips

    # Test /devices/{ip}
    res_dev = client.get("/devices/192.168.1.105")
    assert res_dev.status_code == 200
    assert res_dev.json()["status"] == "QUARANTINED"

    # Test /ids/alerts
    res_alerts = client.get("/ids/alerts")
    assert res_alerts.status_code == 200
    alerts = res_alerts.json()
    assert len(alerts) >= 1
    assert alerts[-1]["alert"]["signature"] == "MQTT Flood Attack"

    # Test /ids/stats
    res_stats = client.get("/ids/stats")
    assert res_stats.status_code == 200
    stats = res_stats.json()
    assert stats["total_alerts"] >= 1
    assert stats["severity_counts"]["1"] >= 1
    assert stats["active_quarantined"] >= 1

    # Test manual release
    res_rel = client.post("/devices/192.168.1.105/release")
    assert res_rel.status_code == 200
    assert res_rel.json()["status"] == "HEALTHY"

    # Test legacy /nodes
    res_nodes = client.get("/nodes")
    assert res_nodes.status_code == 200
    assert len(res_nodes.json()) >= 2


def test_api_capture_endpoints():
    store = StateStore()
    set_state_store(store)
    client = TestClient(app)

    # Test /capture/files
    res_files = client.get("/capture/files")
    assert res_files.status_code == 200
    files = res_files.json()
    filenames = [f["filename"] for f in files]
    assert "sample_iot_traffic.pcap" in filenames

    # Test /capture/download/{name}
    res_dl = client.get("/capture/download/sample_iot_traffic.pcap")
    assert res_dl.status_code == 200
    assert len(res_dl.content) > 100

    # Test /capture/packets
    res_pkts = client.post("/capture/packets", json={"filename": "sample_iot_traffic.pcap", "filter": "tcp.port == 1883"})
    assert res_pkts.status_code == 200
    data = res_pkts.json()
    assert "tshark_available" in data
