import json
from sensors.eve_tailer import normalize_eve_event


def test_normalize_alert_event():
    raw_alert = {
        "timestamp": "2026-10-23T15:23:45.123456+0000",
        "flow_id": 998877,
        "event_type": "alert",
        "src_ip": "192.168.1.105",
        "src_port": 54321,
        "dest_ip": "192.168.1.50",
        "dest_port": 1883,
        "proto": "TCP",
        "alert": {
            "signature": "ET GHOSTNET IoT MQTT Connect Flood Attempt",
            "category": "Attempted Denial of Service",
            "severity": 1,
            "signature_id": 1000001,
            "action": "allowed",
            "rev": 1,
        },
    }
    norm = normalize_eve_event(raw_alert)
    assert norm["event_type"] == "alert"
    assert norm["src_ip"] == "192.168.1.105"
    assert norm["dest_ip"] == "192.168.1.50"
    assert norm["alert"]["signature"] == "ET GHOSTNET IoT MQTT Connect Flood Attempt"
    assert norm["alert"]["severity"] == 1
    assert norm["alert"]["signature_id"] == 1000001
    assert norm["timestamp"] > 0


def test_normalize_flow_event():
    raw_flow = {
        "timestamp": "2026-10-23T15:23:45.000000+0000",
        "event_type": "flow",
        "src_ip": "192.168.1.10",
        "src_port": 49123,
        "dest_ip": "192.168.1.50",
        "dest_port": 1883,
        "proto": "TCP",
        "flow": {
            "bytes_toserver": 4500,
            "bytes_toclient": 1200,
            "pkts_toserver": 15,
            "pkts_toclient": 8,
            "age": 12.5,
            "state": "established",
        },
    }
    norm = normalize_eve_event(raw_flow)
    assert norm["event_type"] == "flow"
    assert norm["flow"]["bytes_total"] == 5700
    assert norm["flow"]["pkts_total"] == 23
    assert norm["flow"]["age"] == 12.5


def test_normalize_dns_http_tls_events():
    raw_dns = {
        "timestamp": "2026-10-23T15:23:45.000000+0000",
        "event_type": "dns",
        "src_ip": "192.168.1.20",
        "dest_ip": "1.1.1.1",
        "dns": {"type": "query", "rrname": "c2.ghostnet-attack.net", "rrtype": "A"},
    }
    norm_dns = normalize_eve_event(raw_dns)
    assert norm_dns["dns"]["rrname"] == "c2.ghostnet-attack.net"

    raw_http = {
        "timestamp": "2026-10-23T15:23:45.000000+0000",
        "event_type": "http",
        "src_ip": "192.168.1.20",
        "dest_ip": "192.168.1.50",
        "http": {"hostname": "192.168.1.50", "url": "/snapshot", "http_method": "GET", "status": 200},
    }
    norm_http = normalize_eve_event(raw_http)
    assert norm_http["http"]["url"] == "/snapshot"
    assert norm_http["http"]["status"] == 200

    raw_tls = {
        "timestamp": "2026-10-23T15:23:45.000000+0000",
        "event_type": "tls",
        "src_ip": "192.168.1.30",
        "dest_ip": "104.244.42.1",
        "tls": {"sni": "cloud.iot.com", "version": "TLS 1.3"},
    }
    norm_tls = normalize_eve_event(raw_tls)
    assert norm_tls["tls"]["sni"] == "cloud.iot.com"
