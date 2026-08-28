# =============================================================================
# GhostNet — simulator/fake_node.py  (full 10-threat edition)
#
# Usage:
#   python ghostnet/simulator/fake_node.py --mode <MODE> --connection <TYPE>
#
# Modes:          normal | dos | mqtt-abuse | replay | exfiltration |
#                 resource | crash | firmware-tamper | config-tamper |
#                 brute-force | anomaly | flap
#
# Connections:    mqtt | http | ws
# =============================================================================
from __future__ import annotations

import argparse
import hashlib
import json
import random
import sys
import threading
import time

import paho.mqtt.client as mqtt
from rich.console import Console
from rich.text import Text

from ghostnet import config

console = Console()

# ── CLI ────────────────────────────────────────────────────────────────────────
parser = argparse.ArgumentParser(description="GhostNet multi-threat simulator")
parser.add_argument("--node-id",    default="sim-node-01")
parser.add_argument("--broker",     default=config.MQTT_BROKER_HOST)
parser.add_argument("--port",       default=config.MQTT_BROKER_PORT, type=int)
parser.add_argument("--connection", default="mqtt", choices=["mqtt", "http", "ws"],
                    help="Connection type: mqtt | http | ws")
parser.add_argument("--mode", default="normal",
                    choices=[
                        "normal", "dos", "mqtt-abuse", "replay",
                        "exfiltration", "resource", "crash",
                        "firmware-tamper", "config-tamper",
                        "brute-force", "anomaly", "flap",
                    ])
parser.add_argument("--api-url", default=f"http://localhost:{config.API_PORT}",
                    help="GhostNet API base URL (for http/ws connection types)")
args = parser.parse_args()

NODE_ID = args.node_id
ROOT    = config.MQTT_TOPIC_ROOT

# ── Rich logging ───────────────────────────────────────────────────────────────
def _log(icon: str, color: str, tag: str, msg: str) -> None:
    ts = time.strftime("%H:%M:%S")
    line = Text()
    line.append(f"[{ts}] ", style="dim white")
    line.append(f" {icon} [{tag}]", style=f"bold {color}")
    line.append(f"  {msg}", style="white")
    console.print(line)

def pub(topic: str, info: str) -> None:
    _log("📤", "cyan", "PUBLISH", f"{topic!r}  {info}")

def rx(topic: str, payload: str) -> None:
    _log("📥", "bold red", "COMMAND", f"{topic!r}  {payload!r}")

# ── State ──────────────────────────────────────────────────────────────────────
quarantined   = False
locked_out    = False
reject_msgs   = False
seq           = 0
reboot_count  = 0
auth_fails    = 0

GOOD_FW_HASH  = hashlib.sha256(b"firmware-v1.0").hexdigest()
TAMPERED_FW   = hashlib.sha256(b"firmware-EVIL").hexdigest()
GOOD_CFG_HASH = hashlib.sha256(b"config-v1.0").hexdigest()
TAMPERED_CFG  = hashlib.sha256(b"config-EVIL").hexdigest()

# ── Connection backend ─────────────────────────────────────────────────────────

class MQTTBackend:
    def __init__(self):
        self.client = mqtt.Client(client_id=f"ghostnet-sim-{NODE_ID}")
        self.client.on_connect = self._on_connect
        self.client.on_message = self._on_message

    def _on_connect(self, c, ud, flags, rc):
        if rc == 0:
            _log("🟢", "green", "MQTT", f"Connected to {args.broker}:{args.port}")
            c.subscribe(f"{ROOT}/{NODE_ID}/command", qos=1)
        else:
            _log("🔴", "red", "MQTT", f"Connection failed rc={rc}")

    def _on_message(self, c, ud, msg):
        _handle_command(msg.topic, msg.payload.decode())

    def start(self):
        self.client.connect(args.broker, args.port, keepalive=60)
        self.client.loop_start()
        time.sleep(1)

    def stop(self):
        self.client.loop_stop()
        self.client.disconnect()

    def send_telemetry(self, payload: dict):
        topic = f"{ROOT}/{NODE_ID}/telemetry"
        raw   = json.dumps(payload)
        pub(topic, f"(size={len(raw)}B)")
        self.client.publish(topic, raw, qos=0)

    def send_heartbeat(self, payload: dict):
        topic = f"{ROOT}/{NODE_ID}/heartbeat"
        raw   = json.dumps(payload)
        pub(topic, "(heartbeat)")
        self.client.publish(topic, raw, qos=1)

    def send_to_topic(self, topic: str, payload: dict):
        raw = json.dumps(payload)
        pub(topic, f"(size={len(raw)}B)")
        self.client.publish(topic, raw, qos=0)


class HTTPBackend:
    def __init__(self):
        import urllib.request
        self._url = args.api_url
        self._req = urllib.request

    def start(self):
        _log("🟢", "green", "HTTP", f"Using HTTP ingest at {self._url}/ingest/")

    def stop(self): pass

    def _post(self, path: str, data: dict):
        import urllib.request, urllib.error
        raw = json.dumps(data).encode()
        req = urllib.request.Request(
            f"{self._url}{path}", data=raw,
            headers={"Content-Type": "application/json"}, method="POST"
        )
        try:
            resp = urllib.request.urlopen(req, timeout=2)
            pub(path, f"HTTP {resp.status}")
        except Exception as e:
            _log("💥", "red", "HTTP-ERR", str(e))

    def send_telemetry(self, payload: dict):
        self._post("/ingest/telemetry", payload)

    def send_heartbeat(self, payload: dict):
        self._post("/ingest/heartbeat", payload)

    def send_to_topic(self, topic: str, payload: dict):
        self.send_telemetry(payload)


class WSBackend:
    def __init__(self):
        import websocket as _ws
        self._ws_url = args.api_url.replace("http://", "ws://").replace("https://", "wss://") + "/ingest/ws"
        self._ws = None
        self._lock = threading.Lock()

    def start(self):
        import websocket
        self._ws = websocket.create_connection(self._ws_url, timeout=5)
        _log("🟢", "green", "WS", f"Connected to {self._ws_url}")

    def stop(self):
        if self._ws:
            self._ws.close()

    def _send(self, data: dict):
        import websocket
        raw = json.dumps(data)
        with self._lock:
            try:
                self._ws.send(raw)
                pub("/ingest/ws", f"(size={len(raw)}B)")
            except Exception as e:
                _log("💥", "red", "WS-ERR", str(e))

    def send_telemetry(self, payload: dict):
        self._send({**payload, "type": "telemetry"})

    def send_heartbeat(self, payload: dict):
        self._send({**payload, "type": "heartbeat"})

    def send_to_topic(self, topic: str, payload: dict):
        self.send_telemetry(payload)


def _handle_command(topic: str, cmd: str) -> None:
    global quarantined, locked_out, reject_msgs, reboot_count
    rx(topic, cmd)
    if cmd == "QUARANTINE":
        quarantined = True
        _log("🔒", "bold red", "QUARANTINE", "Received QUARANTINE — stopping transmissions!")
    elif cmd == "RELEASE":
        quarantined = False
        _log("✅", "bold green", "RELEASE", "Received RELEASE — resuming normal operation!")
    elif cmd == "LOCKOUT":
        locked_out = True
        _log("🔐", "bold red", "LOCKOUT", "Authentication locked out!")
    elif cmd == "UNLOCK":
        locked_out = False
        _log("🔓", "bold green", "UNLOCK", "Authentication restored!")
    elif cmd == "REJECT_MESSAGES":
        reject_msgs = True
        _log("⛔", "red", "REJECT", "Messages being rejected (replay protection).")
    elif cmd == "RESUME_MESSAGES":
        reject_msgs = False
        _log("▶", "green", "RESUME", "Message transmission resumed.")
    elif cmd == "RESTORE_FIRMWARE":
        _log("💾", "bold cyan", "RESTORE_FW", "Restoring trusted firmware baseline…")
        time.sleep(0.5)
        _log("✅", "bold green", "RESTORE_FW", "Firmware restored to baseline hash.")
    elif cmd == "RESTORE_CONFIG":
        _log("⚙️ ", "bold cyan", "RESTORE_CFG", "Restoring known-good configuration…")
        time.sleep(0.5)
        _log("✅", "bold green", "RESTORE_CFG", "Configuration restored.")
    elif cmd == "RESTART_SERVICE":
        reboot_count += 1
        _log("🔄", "bold yellow", "RESTART", f"Managed restart executed. reboot_count={reboot_count}")


# ── Telemetry builders ─────────────────────────────────────────────────────────

def base_payload(override: dict | None = None) -> dict:
    global seq
    seq += 1
    p = {
        "node_id":        NODE_ID,
        "seq":            seq,
        "ts":             time.time(),
        "temperature":    round(random.uniform(20, 35), 2),
        "humidity":       round(random.uniform(40, 70), 2),
        "cpu_percent":    round(random.uniform(10, 30), 1),
        "ram_percent":    round(random.uniform(20, 40), 1),
        "storage_percent":round(random.uniform(10, 30), 1),
        "reboot_count":   reboot_count,
        "auth_fails":     0,
        "firmware_hash":  GOOD_FW_HASH,
        "config_hash":    GOOD_CFG_HASH,
    }
    if override:
        p.update(override)
    return p

def hb_payload() -> dict:
    return {"node_id": NODE_ID, "ts": time.time()}


# ── Simulator modes ────────────────────────────────────────────────────────────

def run_normal(backend):
    _log("ℹ", "blue", "MODE", "normal — 1 msg/2s, heartbeat/10s")
    t = 0
    while True:
        if not quarantined and not reject_msgs:
            backend.send_telemetry(base_payload())
        t += 2
        if t >= 10:
            backend.send_heartbeat(hb_payload()); t = 0
        time.sleep(2)

def run_dos(backend):
    _log("⚠️ ", "bold red", "MODE", "dos — flooding at 10 msg/s (2x rate limit)")
    t = 0
    while True:
        if not quarantined:
            backend.send_telemetry(base_payload({"padding": "x" * 50}))
        t += 0.1
        if t >= 10:
            backend.send_heartbeat(hb_payload()); t = 0
        time.sleep(0.1)

def run_mqtt_abuse(backend):
    _log("⚠️ ", "bold red", "MODE", "mqtt-abuse — publishing to 10 different random topics")
    t = 0
    extra_topics = [f"{ROOT}/{NODE_ID}/sensor/{i}" for i in range(10)]
    i = 0
    while True:
        if not quarantined:
            topic = extra_topics[i % len(extra_topics)]
            if hasattr(backend, "send_to_topic"):
                backend.send_to_topic(topic, base_payload())
            i += 1
        t += 1
        if t >= 10:
            backend.send_heartbeat(hb_payload()); t = 0
        time.sleep(1)

def run_replay(backend):
    _log("⚠️ ", "bold red", "MODE", "replay — sending old timestamps and duplicate seq IDs")
    t = 0
    old_ts = time.time() - 60  # 60 seconds in the past
    dup_seq = 5
    while True:
        if not reject_msgs:
            p = base_payload({"ts": old_ts, "seq": dup_seq})  # stale + duplicate
            backend.send_telemetry(p)
        t += 2
        if t >= 10:
            backend.send_heartbeat(hb_payload()); t = 0
        time.sleep(2)

def run_exfiltration(backend):
    _log("⚠️ ", "bold red", "MODE", "exfiltration — sending 3KB payloads (6x normal)")
    t = 0
    while True:
        if not quarantined:
            p = base_payload({"data_dump": "x" * 3000})
            backend.send_telemetry(p)
        t += 1
        if t >= 10:
            backend.send_heartbeat(hb_payload()); t = 0
        time.sleep(1)

def run_resource(backend):
    _log("⚠️ ", "bold red", "MODE", "resource — CPU 95%, RAM 92%, Storage 95%")
    t = 0
    while True:
        if not reject_msgs:
            p = base_payload({
                "cpu_percent":    random.uniform(93, 98),
                "ram_percent":    random.uniform(90, 95),
                "storage_percent":random.uniform(93, 97),
            })
            backend.send_telemetry(p)
        t += 2
        if t >= 10:
            backend.send_heartbeat(hb_payload()); t = 0
        time.sleep(2)

def run_crash(backend):
    _log("⚠️ ", "bold red", "MODE", "crash — rebooting every 5 seconds (crash loop)")
    global reboot_count
    t = 0
    next_reboot = time.time() + 5
    while True:
        if time.time() >= next_reboot:
            reboot_count += 1
            _log("💥", "bold red", "REBOOT", f"Simulated crash! reboot_count={reboot_count}")
            next_reboot = time.time() + 5
        if not reject_msgs:
            p = base_payload({"reboot_count": reboot_count})
            backend.send_telemetry(p)
        t += 2
        if t >= 10:
            backend.send_heartbeat(hb_payload()); t = 0
        time.sleep(2)

def run_firmware_tamper(backend):
    _log("⚠️ ", "bold red", "MODE", "firmware-tamper — sending changed firmware hash")
    t = 0
    while True:
        if not reject_msgs:
            p = base_payload({"firmware_hash": TAMPERED_FW})
            backend.send_telemetry(p)
        t += 2
        if t >= 10:
            backend.send_heartbeat(hb_payload()); t = 0
        time.sleep(2)

def run_config_tamper(backend):
    _log("⚠️ ", "bold red", "MODE", "config-tamper — sending changed config hash")
    t = 0
    while True:
        if not reject_msgs:
            p = base_payload({"config_hash": TAMPERED_CFG})
            backend.send_telemetry(p)
        t += 2
        if t >= 10:
            backend.send_heartbeat(hb_payload()); t = 0
        time.sleep(2)

def run_brute_force(backend):
    _log("⚠️ ", "bold red", "MODE", "brute-force — incrementing auth_fails rapidly")
    global auth_fails
    t = 0
    while True:
        if not locked_out:
            auth_fails += 1
            p = base_payload({"auth_fails": auth_fails})
            backend.send_telemetry(p)
        t += 0.5
        if t >= 10:
            backend.send_heartbeat(hb_payload()); t = 0
        time.sleep(0.5)

def run_anomaly(backend):
    _log("⚠️ ", "bold red", "MODE", "anomaly — combination of high rate + large payload (multi-signal)")
    t = 0
    while True:
        if not quarantined:
            p = base_payload({"padding": "x" * 600})
            backend.send_telemetry(p)
        t += 0.3
        if t >= 10:
            backend.send_heartbeat(hb_payload()); t = 0
        time.sleep(0.3)

def run_flap(backend):
    _log("ℹ", "blue", "MODE", "flap — alternates between normal and dos every 30s")
    cycle = 0
    while True:
        if cycle % 2 == 0:
            _log("🔵", "blue", "FLAP", "Phase: NORMAL (30s)")
            end = time.time() + 30
            t = 0
            while time.time() < end:
                if not quarantined and not reject_msgs:
                    backend.send_telemetry(base_payload())
                t += 2
                if t >= 10:
                    backend.send_heartbeat(hb_payload()); t = 0
                time.sleep(2)
        else:
            _log("🔴", "red", "FLAP", "Phase: ATTACK-dos (30s)")
            end = time.time() + 30
            t = 0
            while time.time() < end:
                if not quarantined:
                    backend.send_telemetry(base_payload({"padding": "x" * 50}))
                t += 0.1
                if t >= 10:
                    backend.send_heartbeat(hb_payload()); t = 0
                time.sleep(0.1)
        cycle += 1


# ── Entry point ────────────────────────────────────────────────────────────────
MODE_MAP = {
    "normal":          run_normal,
    "dos":             run_dos,
    "mqtt-abuse":      run_mqtt_abuse,
    "replay":          run_replay,
    "exfiltration":    run_exfiltration,
    "resource":        run_resource,
    "crash":           run_crash,
    "firmware-tamper": run_firmware_tamper,
    "config-tamper":   run_config_tamper,
    "brute-force":     run_brute_force,
    "anomaly":         run_anomaly,
    "flap":            run_flap,
}

if __name__ == "__main__":
    # Choose backend
    if args.connection == "mqtt":
        backend = MQTTBackend()
    elif args.connection == "http":
        backend = HTTPBackend()
    elif args.connection == "ws":
        try:
            import websocket  # noqa
        except ImportError:
            _log("💥", "red", "ERROR", "websocket-client not installed. Run: pip install websocket-client")
            sys.exit(1)
        backend = WSBackend()
    else:
        backend = MQTTBackend()

    backend.start()
    _log("🚀", "bold cyan", "START",
         f"node={NODE_ID!r}  mode={args.mode!r}  connection={args.connection!r}")

    # Send 3 normal messages first to establish baselines
    _log("ℹ", "blue", "BASELINE",
         "Sending 3 normal messages to establish firmware/config hash baselines …")
    for _ in range(3):
        backend.send_telemetry(base_payload())
        backend.send_heartbeat(hb_payload())
        time.sleep(1)

    _log("🎯", "bold yellow", "ATTACK-START", f"Starting attack mode: {args.mode!r}")

    try:
        MODE_MAP[args.mode](backend)
    except KeyboardInterrupt:
        _log("👋", "dim", "STOP", "Simulator stopped by user.")
    finally:
        backend.stop()
