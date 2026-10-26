from fastapi.testclient import TestClient

from ghostnet import config
from ghostnet.api.main import app, set_state_store
from ghostnet.storage.state_store import DeviceStatus, StateStore


def test_esp_telemetry_and_control_commands(monkeypatch):
    monkeypatch.setattr(config, "ESP_DEVICE_KEY", "esp-test-key")
    store = StateStore()
    set_state_store(store)
    client = TestClient(app)
    headers = {"X-Device-Key": "esp-test-key"}

    denied = client.post("/esp/telemetry", json={"node_id": "lab-esp"})
    assert denied.status_code == 401

    reported = client.post(
        "/esp/telemetry",
        headers=headers,
        json={"node_id": "lab-esp", "ip": "192.168.1.77", "name": "Lab ESP", "rssi": -48},
    )
    assert reported.status_code == 200
    assert reported.json()["device_id"] == "192.168.1.77"

    device = store.get_device("192.168.1.77")
    assert device is not None
    assert device.device_type == "esp32"
    assert device.telemetry["rssi"] == -48

    store.manual_quarantine("192.168.1.77", "IDS decision")
    assert device.status == DeviceStatus.QUARANTINED

    command = client.get("/esp/lab-esp/command", headers=headers).json()["command"]
    assert command["action"] == "QUARANTINE"
    acknowledged = client.post(
        "/esp/lab-esp/command/ack", headers=headers, json={"command_id": command["id"]}
    )
    assert acknowledged.json()["acknowledged"] is True
    assert client.get("/esp/lab-esp/command", headers=headers).json()["command"] is None

    store.mark_recovered("192.168.1.77")
    assert client.get("/esp/lab-esp/command", headers=headers).json()["command"]["action"] == "RELEASE"
