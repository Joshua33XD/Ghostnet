# =============================================================================
# GhostNet — engine.py (Network-Only IDS Edition)
# Connects: Suricata EveTailer -> StateStore -> QuarantineManager -> FastAPI
# =============================================================================
from __future__ import annotations

import signal
import sys
import threading
from pathlib import Path

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
from ghostnet.response.quarantine_manager import QuarantineManager
from ghostnet.storage.state_store import StateStore
from sensors.eve_tailer import EveTailer

console = Console()


def print_banner() -> None:
    b = Text()
    b.append("GhostNet IDS v3\n", style="bold bright_cyan")
    b.append("Network-Only Intrusion Detection System\n\n", style="bold white")
    b.append(f"  Suricata EVE Log  -> {config.EVE_LOG_PATH}\n", style="dim white")
    b.append(f"  Alert Window      -> {config.ALERT_WINDOW_SECS}s (Clean window recovery)\n\n", style="dim white")
    b.append(f"  API docs          -> http://localhost:{config.API_PORT}/docs\n", style="cyan")
    b.append(f"  Devices           -> http://localhost:{config.API_PORT}/devices\n", style="cyan")
    b.append(f"  IDS Alerts        -> http://localhost:{config.API_PORT}/ids/alerts\n", style="cyan")
    b.append(f"  IDS Stats         -> http://localhost:{config.API_PORT}/ids/stats\n", style="cyan")
    b.append(f"  Capture Files     -> http://localhost:{config.API_PORT}/capture/files\n", style="cyan")
    b.append(f"  WS Live Feed      -> ws://localhost:{config.API_PORT}/ws/events\n", style="cyan")
    console.print(Panel(b, title="[bold bright_cyan]GhostNet IDS[/]", border_style="bright_cyan"))


def main() -> None:
    print_banner()

    logger.info("Initialising GhostNet state store...")
    store = StateStore()
    set_state_store(store)

    # ── 1. Quarantine & Recovery Manager ───────────────────────────────────────
    logger.info("Starting Quarantine Manager...")
    qm = QuarantineManager(store)
    qm.start()

    # ── 2. Suricata EVE Tailer ─────────────────────────────────────────────────
    eve_path = Path(config.EVE_LOG_PATH)
    logger.info(f"Connecting EveTailer to {eve_path}...")
    # Tail from beginning if file already contains replay data, or end
    tailer = EveTailer(eve_path, callback=store.ingest_event, from_beginning=True)
    tailer.start()

    # ── Graceful shutdown ──────────────────────────────────────────────────────
    stop_event = threading.Event()

    def _shutdown(sig, frame) -> None:
        logger.info("Shutdown signal received — stopping GhostNet...")
        stop_event.set()

    signal.signal(signal.SIGINT, _shutdown)
    signal.signal(signal.SIGTERM, _shutdown)

    logger.info(f"Starting API server on {config.API_HOST}:{config.API_PORT}...")
    server_config = uvicorn.Config(app, host=config.API_HOST, port=config.API_PORT, log_level="warning")
    server = uvicorn.Server(server_config)
    api_thread = threading.Thread(target=server.run, daemon=True, name="UvicornServer")
    api_thread.start()

    logger.info("GhostNet Network IDS operational. Press Ctrl+C to stop.")
    stop_event.wait()

    logger.info("Stopping components...")
    tailer.stop()
    qm.stop()
    server.should_exit = True
    api_thread.join(timeout=4)
    logger.info("GhostNet stopped.")
    sys.exit(0)


if __name__ == "__main__":
    main()
