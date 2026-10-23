# =============================================================================
# GhostNet — sensors/ids_sim.py
# Generates realistic Suricata EVE JSON events (alerts, flows, DNS, HTTP, TLS)
# Allows GhostNet to run as a full IDS dashboard without a live Suricata daemon.
# =============================================================================
from __future__ import annotations

import argparse
import datetime
import json
import os
import random
import threading
import time
from pathlib import Path
from typing import Any, Dict, List, Optional


DEVICES = [
    {"ip": "192.168.1.10", "role": "Smart Thermostat", "proto": "TCP", "port": 1883},
    {"ip": "192.168.1.20", "role": "Security Camera", "proto": "TCP", "port": 554},
    {"ip": "192.168.1.30", "role": "Smart Plug Relay", "proto": "UDP", "port": 5683},
    {"ip": "192.168.1.40", "role": "Environment Sensor", "proto": "TCP", "port": 1883},
    {"ip": "192.168.1.50", "role": "Edge Gateway / Broker", "proto": "TCP", "port": 1883},
    {"ip": "192.168.1.105", "role": "Rogue Attacker Laptop", "proto": "TCP", "port": 4444},
]

GATEWAY_IP = "192.168.1.50"
ATTACKER_IP = "192.168.1.105"

ALERT_SCENARIOS = [
    {
        "signature": "ET GHOSTNET IoT MQTT Connect Flood Attempt",
        "category": "Attempted Denial of Service",
        "severity": 1,
        "signature_id": 1000001,
        "src_ip": ATTACKER_IP,
        "dest_ip": GATEWAY_IP,
        "dest_port": 1883,
        "proto": "TCP",
    },
    {
        "signature": "ET GHOSTNET IoT MQTT Wildcard Subscribe Abuse (+ or #)",
        "category": "Information Leak / Abuse",
        "severity": 2,
        "signature_id": 1000002,
        "src_ip": ATTACKER_IP,
        "dest_ip": GATEWAY_IP,
        "dest_port": 1883,
        "proto": "TCP",
    },
    {
        "signature": "ET GHOSTNET IoT Device Repeated Auth Failures",
        "category": "Authentication Failure",
        "severity": 2,
        "signature_id": 1000003,
        "src_ip": "192.168.1.10",
        "dest_ip": GATEWAY_IP,
        "dest_port": 1883,
        "proto": "TCP",
    },
    {
        "signature": "ET SCAN Potential MQTT/CoAP Reconnaissance Scan",
        "category": "Reconnaissance / Scan",
        "severity": 3,
        "signature_id": 1000004,
        "src_ip": ATTACKER_IP,
        "dest_ip": "192.168.1.30",
        "dest_port": 5683,
        "proto": "UDP",
    },
    {
        "signature": "ET DNS Query to Suspicious Dynamic DNS / DGA Domain",
        "category": "Suspicious Domain Activity",
        "severity": 2,
        "signature_id": 1000005,
        "src_ip": "192.168.1.20",
        "dest_ip": "1.1.1.1",
        "dest_port": 53,
        "proto": "UDP",
    },
    {
        "signature": "ET POLICY IoT Device Outbound Telnet/SSH Connection Attempt",
        "category": "Policy Violation",
        "severity": 1,
        "signature_id": 1000006,
        "src_ip": "192.168.1.30",
        "dest_ip": "198.51.100.77",
        "dest_port": 23,
        "proto": "TCP",
    },
    {
        "signature": "ET INFO IoT Routine Device Keep-Alive / Info",
        "category": "Informational",
        "severity": 3,
        "signature_id": 1000007,
        "src_ip": "192.168.1.40",
        "dest_ip": GATEWAY_IP,
        "dest_port": 1883,
        "proto": "TCP",
    },
]


class IDSSimulator:
    """
    Background worker that continuously appends realistic EVE events to eve.json.
    """

    def __init__(
        self,
        output_path: str | Path = "data/eve.json",
        interval: float = 1.0,
        alert_probability: float = 0.35,
    ) -> None:
        self.output_path = Path(output_path)
        self.interval = interval
        self.alert_probability = alert_probability

        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self._flow_id_counter = 100000

    def start(self) -> None:
        self.output_path.parent.mkdir(parents=True, exist_ok=True)
        if self._thread and self._thread.is_alive():
            return
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._run_loop, name="IDSSimulator", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=3.0)
            self._thread = None

    def _now_iso(self) -> str:
        return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "+0000"

    def generate_flow_event(self) -> Dict[str, Any]:
        self._flow_id_counter += 1
        dev = random.choice(DEVICES[:-1])  # pick non-attacker mostly
        b_srv = random.randint(300, 4800)
        b_cli = random.randint(200, 3200)
        if dev["ip"] == "192.168.1.20":  # Camera higher throughput
            b_srv = random.randint(15000, 65000)
            b_cli = random.randint(800, 2400)

        p_srv = max(2, b_srv // 500)
        p_cli = max(2, b_cli // 500)

        return {
            "timestamp": self._now_iso(),
            "flow_id": self._flow_id_counter,
            "event_type": "flow",
            "src_ip": dev["ip"],
            "src_port": random.randint(32768, 61000),
            "dest_ip": GATEWAY_IP,
            "dest_port": dev["port"],
            "proto": dev["proto"],
            "flow": {
                "pkts_toserver": p_srv,
                "pkts_toclient": p_cli,
                "bytes_toserver": b_srv,
                "bytes_toclient": b_cli,
                "start": self._now_iso(),
                "end": self._now_iso(),
                "age": random.randint(1, 30),
                "state": "established",
            },
        }

    def generate_alert_event(self) -> Dict[str, Any]:
        self._flow_id_counter += 1
        scenario = random.choice(ALERT_SCENARIOS)
        return {
            "timestamp": self._now_iso(),
            "flow_id": self._flow_id_counter,
            "event_type": "alert",
            "src_ip": scenario["src_ip"],
            "src_port": random.randint(32768, 61000),
            "dest_ip": scenario["dest_ip"],
            "dest_port": scenario["dest_port"],
            "proto": scenario["proto"],
            "alert": {
                "action": "allowed",
                "gid": 1,
                "signature_id": scenario["signature_id"],
                "rev": 1,
                "signature": scenario["signature"],
                "category": scenario["category"],
                "severity": scenario["severity"],
                "metadata": {"updated_at": ["2026_10_23"]},
            },
        }

    def generate_dns_or_http_event(self) -> Dict[str, Any]:
        self._flow_id_counter += 1
        if random.random() < 0.5:
            # DNS event
            domain = random.choice(["pool.ntp.org", "iot-cloud.net", "c2.ghostnet-attack.net", "update.internal.local"])
            return {
                "timestamp": self._now_iso(),
                "flow_id": self._flow_id_counter,
                "event_type": "dns",
                "src_ip": random.choice(["192.168.1.10", "192.168.1.20", "192.168.1.40"]),
                "src_port": random.randint(32768, 61000),
                "dest_ip": "1.1.1.1",
                "dest_port": 53,
                "proto": "UDP",
                "dns": {
                    "type": "query",
                    "id": random.randint(1000, 9999),
                    "rrname": domain,
                    "rrtype": "A",
                    "rcode": "NOERROR",
                },
            }
        else:
            # HTTP event
            return {
                "timestamp": self._now_iso(),
                "flow_id": self._flow_id_counter,
                "event_type": "http",
                "src_ip": "192.168.1.20",
                "src_port": random.randint(32768, 61000),
                "dest_ip": GATEWAY_IP,
                "dest_port": 80,
                "proto": "TCP",
                "http": {
                    "hostname": GATEWAY_IP,
                    "url": "/api/v1/telemetry",
                    "http_user_agent": "IoT-Device/3.1 (Camera)",
                    "http_method": "POST",
                    "protocol": "HTTP/1.1",
                    "status": 200,
                },
            }

    def _run_loop(self) -> None:
        while not self._stop_event.is_set():
            events_to_write: List[Dict[str, Any]] = []

            # Always write 1-2 flow events
            events_to_write.append(self.generate_flow_event())
            if random.random() < 0.6:
                events_to_write.append(self.generate_flow_event())

            # Maybe write DNS/HTTP event
            if random.random() < 0.3:
                events_to_write.append(self.generate_dns_or_http_event())

            # Probabilistically write an alert event
            if random.random() < self.alert_probability:
                events_to_write.append(self.generate_alert_event())

            try:
                with open(str(self.output_path), "a", encoding="utf-8") as f:
                    for ev in events_to_write:
                        f.write(json.dumps(ev) + "\n")
                    f.flush()
            except Exception:
                pass

            self._stop_event.wait(self.interval)


def main() -> None:
    parser = argparse.ArgumentParser(description="GhostNet EVE JSON Event Simulator")
    parser.add_argument("--output", default="data/eve.json", help="Path to write eve.json")
    parser.add_argument("--interval", type=float, default=1.0, help="Interval in seconds between batches")
    parser.add_argument("--rate", type=float, default=0.35, help="Alert probability per cycle")
    args = parser.parse_args()

    print(f"[GhostNet IDS Simulator] Writing events to {args.output} every {args.interval}s...")
    sim = IDSSimulator(output_path=args.output, interval=args.interval, alert_probability=args.rate)
    sim.start()
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nStopping simulator...")
        sim.stop()


if __name__ == "__main__":
    main()
