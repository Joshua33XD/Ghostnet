import pytest
from fastapi import HTTPException
from ghostnet.api.main import _sanitize_pcap_path, _validate_display_filter


def test_sanitize_pcap_path_valid():
    filename = "sample_iot_traffic.pcap"
    path = _sanitize_pcap_path(filename)
    assert path.name == "sample_iot_traffic.pcap"


def test_sanitize_pcap_path_traversal_blocked():
    with pytest.raises(HTTPException) as exc:
        _sanitize_pcap_path("../../../etc/passwd")
    assert exc.value.status_code == 400

    with pytest.raises(HTTPException) as exc:
        _sanitize_pcap_path("..\\..\\windows\\system32\\cmd.exe")
    assert exc.value.status_code == 400

    with pytest.raises(HTTPException) as exc:
        _sanitize_pcap_path("sub/folder.pcap")
    assert exc.value.status_code == 400


def test_validate_display_filter_safe():
    assert _validate_display_filter("tcp.port == 1883") is True
    assert _validate_display_filter("mqtt.topic == 'sensors/temp'") is True
    assert _validate_display_filter("ip.addr == 192.168.1.10 and tcp.flags.syn == 1") is True
    assert _validate_display_filter("dns or http or tls") is True


def test_validate_display_filter_command_injection_blocked():
    assert _validate_display_filter("tcp.port == 1883; cat /etc/passwd") is False
    assert _validate_display_filter("ip.addr == 192.168.1.1 | rm -rf /") is False
    assert _validate_display_filter("`whoami`") is False
    assert _validate_display_filter("$(calc.exe)") is False
