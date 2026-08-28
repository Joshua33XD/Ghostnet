# =============================================================================
# GhostNet — engine.py  (full threat-expansion edition)
# Wires: MQTT + HTTP + WS adapters -> StateStore -> ThreatDetector ->
#        HeartbeatMonitor -> QuarantineManager -> FastAPI
# =============================================================================
from __future__ import annotations
import signal
import sys
import threading

# Force UTF-8 output on Windows so Rich doesn't crash on box-drawing chars
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

import uvicorn
from rich.console import Console
from rich.panel import Panel
from rich.text import Text

from ghostnet import config, logger
from ghostnet.api.main import app, set_state_store
from ghostnet.detection.threat_detector import ThreatDetector
from ghostnet.detection.heartbeat_monitor import HeartbeatMonitor
from ghostnet.mqtt_client import MQTTClient
from ghostnet.response.quarantine_manager import QuarantineManager
from ghostnet.storage.state_store import StateStore
from ghostnet.adapters.http_adapter import HTTPAdapter
from ghostnet.adapters.ws_adapter import WSAdapter

console = Console()


def print_banner() -> None:
    b = Text()
    b.append("GhostNet v2\n", style="bold bright_cyan")
    b.append("IoT Multi-Threat Detection | Protection | Self-Healing\n\n", style="bold white")
    b.append("  10 Threat Detectors\n", style="dim white")
    b.append("  +-- DoS Flood | MQTT Abuse | Replay Anomaly\n", style="dim white")
    b.append("  +-- Data Exfil | Resource Exhaustion | Crash Loop\n", style="dim white")
    b.append("  +-- Firmware Tamper | Config Tamper | Brute-Force | Network Anomaly\n\n", style="dim white")
    b.append("  Connection Types: MQTT | HTTP | WebSocket\n\n", style="dim white")
    b.append(f"  API docs  -> http://localhost:{config.API_PORT}/docs\n", style="cyan")
    b.append(f"  Nodes     -> http://localhost:{config.API_PORT}/nodes\n", style="cyan")
    b.append(f"  Alerts    -> http://localhost:{config.API_PORT}/alerts\n", style="cyan")
    b.append(f"  WS events -> ws://localhost:{config.API_PORT}/ws/events\n", style="cyan")
    b.append(f"  HTTP in   -> POST http://localhost:{config.API_PORT}/ingest/telemetry\n", style="cyan")
    b.append(f"  WS in     -> ws://localhost:{config.API_PORT}/ingest/ws\n", style="cyan")
    console.print(Panel(b, title="[bold bright_cyan]GhostNet[/]", border_style="bright_cyan"))


def main() -> None:
    print_banner()

    logger.info("Initialising state store …")
    store = StateStore()

    # ── 1. Connection adapters ─────────────────────────────────────────────────
    logger.info("Starting MQTT adapter …")
    mqtt_client = MQTTClient(store)
    mqtt_client.connect()

    logger.info("Registering HTTP ingest adapter …")
    http_adapter = HTTPAdapter(store, app)
    http_adapter.set_publish_fn(mqtt_client.publish)
    http_adapter.connect()

    logger.info("Registering WebSocket ingest adapter …")
    ws_adapter = WSAdapter(store, app)
    ws_adapter.connect()

    # ── 2. Detection ───────────────────────────────────────────────────────────
    logger.info("Starting threat detector (10 threat types) …")
    threat_detector = ThreatDetector(store)
    threat_detector.start()

    logger.info("Starting heartbeat monitor …")
    hb_monitor = HeartbeatMonitor(store)
    hb_monitor.start()

    # ── 3. Response + self-healing ─────────────────────────────────────────────
    logger.info("Starting quarantine + self-heal manager …")
    qm = QuarantineManager(store, publish_fn=mqtt_client.publish)
    qm.start()

    # ── 4. API ────────────────────────────────────────────────────────────────
    set_state_store(store)

    # ── Graceful shutdown ──────────────────────────────────────────────────────
    stop_event = threading.Event()

    def _shutdown(sig, frame) -> None:
        logger.info("Shutdown signal — stopping all components …")
        stop_event.set()

    signal.signal(signal.SIGINT,  _shutdown)
    signal.signal(signal.SIGTERM, _shutdown)

    logger.info(f"Starting API server on {config.API_HOST}:{config.API_PORT} …")
    server_config = uvicorn.Config(app, host=config.API_HOST, port=config.API_PORT, log_level="warning")
    server = uvicorn.Server(server_config)
    api_thread = threading.Thread(target=server.run, daemon=True, name="UvicornServer")
    api_thread.start()

    logger.info("GhostNet fully operational — all 10 threat detectors running. Press Ctrl+C to stop.")
    stop_event.wait()

    logger.info("Stopping …")
    threat_detector.stop()
    hb_monitor.stop()
    qm.stop()
    mqtt_client.disconnect()
    server.should_exit = True
    api_thread.join(timeout=5)
    logger.info("GhostNet stopped.")
    sys.exit(0)


if __name__ == "__main__":
    main()
