import os
import time

from fastapi.testclient import TestClient

from ghostnet.api.main import _cors_origins, app, set_state_store
from ghostnet import config
from ghostnet.storage.state_store import StateStore


def _client_with_device():
    store = StateStore(alert_window_secs=10.0)
    set_state_store(store)
    now = time.time()
    store.ingest_event({
        "timestamp": now,
        "event_type": "alert",
        "src_ip": "192.168.1.105",
        "dest_ip": "192.168.1.50",
        "alert": {"signature": "MQTT Flood Attack", "severity": 1, "signature_id": 1000001, "category": "DoS"},
    })
    return TestClient(app), store


def test_cors_origins_default_and_env(monkeypatch):
    monkeypatch.delenv("CORS_ORIGINS", raising=False)
    assert _cors_origins() == ["http://localhost:5173"]

    monkeypatch.setenv("CORS_ORIGINS", "https://app.example.com, http://localhost:5173")
    assert _cors_origins() == ["https://app.example.com", "http://localhost:5173"]


def test_cors_allows_configured_origin_and_rejects_others(monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", "http://localhost:5173")
    client = TestClient(app)

    allowed = client.options(
        "/devices",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert allowed.status_code == 200
    assert allowed.headers.get("access-control-allow-origin") == "http://localhost:5173"

    denied = client.options(
        "/devices",
        headers={
            "Origin": "https://evil.example",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert denied.headers.get("access-control-allow-origin") is None


def test_quarantine_and_release_require_api_key(monkeypatch):
    monkeypatch.setattr(config, "API_KEY", "secret-test-key")
    client, store = _client_with_device()

    denied = client.post("/devices/192.168.1.105/release")
    assert denied.status_code == 401

    denied_q = client.post("/devices/10.0.0.8/quarantine")
    assert denied_q.status_code == 401

    released = client.post(
        "/devices/192.168.1.105/release",
        headers={"X-API-Key": "secret-test-key"},
    )
    assert released.status_code == 200
    assert released.json()["status"] == "HEALTHY"

    quarantined = client.post(
        "/devices/10.0.0.8/quarantine",
        headers={"X-API-Key": "secret-test-key"},
        params={"reason": "operator lock"},
    )
    assert quarantined.status_code == 200
    assert quarantined.json()["status"] == "QUARANTINED"
    assert store.get_device("10.0.0.8").status == "QUARANTINED"
