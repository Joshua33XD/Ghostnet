# =============================================================================
# GhostNet — sensors/suricata/generate_sample_pcap.py
# Pure-Python PCAP generator for IoT attack traffic replay (no external deps).
# Generates realistic Ethernet / IPv4 / TCP packets for:
#   1. MQTT Connect Flood (port 1883)
#   2. MQTT Wildcard '#' subscribe
#   3. MQTT Auth failure response
#   4. Normal telemetry packets
# =============================================================================
from __future__ import annotations

import struct
import time
from pathlib import Path

PCAP_PATH = Path(__file__).resolve().parent / "pcaps" / "sample_iot_traffic.pcap"


def ip_checksum(data: bytes) -> int:
    if len(data) % 2 == 1:
        data += b"\x00"
    s = sum(struct.unpack(f"!{len(data)//2}H", data))
    while (s >> 16) > 0:
        s = (s & 0xFFFF) + (s >> 16)
    return ~s & 0xFFFF


def make_ipv4_packet(src_ip: str, dst_ip: str, proto: int, payload: bytes) -> bytes:
    src_bytes = bytes(map(int, src_ip.split(".")))
    dst_bytes = bytes(map(int, dst_ip.split(".")))
    total_len = 20 + len(payload)
    ident = 0x1234
    flags_frag = 0x4000  # DF
    ttl = 64

    # Header without checksum
    hdr = struct.pack(
        "!BBHHHBBH4s4s",
        0x45,  # Version 4, IHL 5
        0x00,  # DSCP/ECN
        total_len,
        ident,
        flags_frag,
        ttl,
        proto,
        0,  # checksum placeholder
        src_bytes,
        dst_bytes,
    )
    chk = ip_checksum(hdr)
    hdr = struct.pack(
        "!BBHHHBBH4s4s",
        0x45,
        0x00,
        total_len,
        ident,
        flags_frag,
        ttl,
        proto,
        chk,
        src_bytes,
        dst_bytes,
    )
    return hdr + payload


def make_tcp_packet(src_port: int, dst_port: int, seq: int, ack: int, flags: int, data: bytes = b"") -> bytes:
    offset_res = (5 << 4)  # 5 * 4 = 20 bytes header
    window = 8192
    chk = 0  # optional/simplified for pcap replay
    urg_ptr = 0
    hdr = struct.pack("!HHIIBBHHH", src_port, dst_port, seq, ack, offset_res, flags, window, chk, urg_ptr)
    return hdr + data


def make_eth_frame(src_mac: bytes, dst_mac: bytes, ethertype: int, payload: bytes) -> bytes:
    return dst_mac + src_mac + struct.pack("!H", ethertype) + payload


def generate_pcap(filepath: Path = PCAP_PATH) -> None:
    filepath.parent.mkdir(parents=True, exist_ok=True)

    # Standard libpcap global header
    # magic 0xa1b2c3d4, version 2.4, thiszone 0, sigfigs 0, snaplen 65535, network 1 (Ethernet)
    global_hdr = struct.pack("!IHHiIII", 0xA1B2C3D4, 2, 4, 0, 0, 65535, 1)

    src_mac = b"\x00\x11\x22\x33\x44\x55"
    dst_mac = b"\xaa\xbb\xcc\xdd\xee\xff"

    packets = []
    base_ts = time.time() - 30.0

    # 1. Normal MQTT CONNECT and Telemetry
    # MQTT CONNECT payload starts with 0x10
    mqtt_connect = b"\x10\x12\x00\x04MQTT\x04\x02\x00\x3c\x00\x06device"
    tcp = make_tcp_packet(src_port=49152, dst_port=1883, seq=1001, ack=1, flags=0x18, data=mqtt_connect)
    ip = make_ipv4_packet("192.168.1.10", "192.168.1.50", 6, tcp)
    packets.append((base_ts + 0.1, make_eth_frame(src_mac, dst_mac, 0x0800, ip)))

    # 2. MQTT Wildcard Subscribe Abuse (+ or #)
    # MQTT SUBSCRIBE starting with 0x82, topic with '#'
    mqtt_sub_wildcard = b"\x82\x0a\x00\x01\x00\x05iot/#\x00"
    tcp_sub = make_tcp_packet(src_port=54321, dst_port=1883, seq=2001, ack=1, flags=0x18, data=mqtt_sub_wildcard)
    ip_sub = make_ipv4_packet("192.168.1.105", "192.168.1.50", 6, tcp_sub)
    packets.append((base_ts + 1.2, make_eth_frame(src_mac, dst_mac, 0x0800, ip_sub)))

    # 3. MQTT Auth Failures (CONNACK with return code 0x04)
    mqtt_auth_fail = b"\x20\x02\x00\x04"
    for i in range(6):
        tcp_fail = make_tcp_packet(src_port=1883, dst_port=50000 + i, seq=3000 + i, ack=1, flags=0x18, data=mqtt_auth_fail)
        ip_fail = make_ipv4_packet("192.168.1.50", "192.168.1.10", 6, tcp_fail)
        packets.append((base_ts + 2.0 + (i * 0.2), make_eth_frame(dst_mac, src_mac, 0x0800, ip_fail)))

    # 4. MQTT Connect Flood (22 CONNECT packets within 2 seconds)
    for i in range(22):
        flood_payload = b"\x10\x10\x00\x04MQTT\x04\x02\x00\x1e\x00\x04test"
        tcp_flood = make_tcp_packet(src_port=40000 + i, dst_port=1883, seq=5000 + (i * 20), ack=1, flags=0x18, data=flood_payload)
        ip_flood = make_ipv4_packet("192.168.1.105", "192.168.1.50", 6, tcp_flood)
        packets.append((base_ts + 5.0 + (i * 0.05), make_eth_frame(src_mac, dst_mac, 0x0800, ip_flood)))

    with open(filepath, "wb") as f:
        f.write(global_hdr)
        for ts, pkt_bytes in packets:
            sec = int(ts)
            usec = int((ts - sec) * 1000000)
            pkt_len = len(pkt_bytes)
            # Packet header: ts_sec, ts_usec, incl_len, orig_len
            pkt_hdr = struct.pack("!IIII", sec, usec, pkt_len, pkt_len)
            f.write(pkt_hdr)
            f.write(pkt_bytes)

    print(f"[PCAP GENERATED] Written {len(packets)} packets to {filepath} ({filepath.stat().st_size} bytes)")


if __name__ == "__main__":
    generate_pcap()
