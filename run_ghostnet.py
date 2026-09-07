from __future__ import annotations

import argparse
import os
import shutil
import signal
import subprocess
import sys
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parent
DASHBOARD = ROOT / "dashboard"
API_URL = "http://127.0.0.1:8000"
DASHBOARD_URL = "http://127.0.0.1:5173"


def _python() -> str:
    return sys.executable or "python"


def _npm() -> str:
    npm = shutil.which("npm")
    if not npm:
        raise RuntimeError("npm was not found. Install Node.js first, then rerun this file.")
    return npm


def _has_dashboard_deps() -> bool:
    return (DASHBOARD / "node_modules").exists()


def _start(name: str, cmd: list[str], cwd: Path) -> subprocess.Popen:
    print(f"[GhostNet] starting {name}: {' '.join(cmd)}")
    return subprocess.Popen(cmd, cwd=str(cwd))


def _wait_for_api(timeout: float = 20.0) -> bool:
    import urllib.request

    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(f"{API_URL}/", timeout=1) as response:
                return response.status == 200
        except Exception:
            time.sleep(0.5)
    return False


def run_api_only() -> None:
    import uvicorn

    from ghostnet import config, logger
    from ghostnet.adapters.http_adapter import HTTPAdapter
    from ghostnet.adapters.ws_adapter import WSAdapter
    from ghostnet.api.main import app, set_state_store, set_v3_components
    from ghostnet.detection.heartbeat_monitor import HeartbeatMonitor
    from ghostnet.detection.threat_detector import ThreatDetector
    from ghostnet.response.quarantine_manager import QuarantineManager
    from ghostnet.storage.state_store import StateStore

    store = StateStore()
    set_state_store(store)

    http_adapter = HTTPAdapter(store, app)
    http_adapter.connect()

    ws_adapter = WSAdapter(store, app)
    ws_adapter.connect()

    threat_detector = ThreatDetector(store)
    threat_detector.start()

    heartbeat_monitor = HeartbeatMonitor(store)
    heartbeat_monitor.start()

    def publish_command(topic: str, command: str) -> None:
        logger.info(f"[Demo mode] Would send {command!r} -> {topic}")

    quarantine_manager = QuarantineManager(
        store,
        publish_fn=publish_command,
        immune_memory=threat_detector.immune_memory,
    )
    quarantine_manager.start()

    set_v3_components(
        ml_detector=threat_detector._ml,
        immune_memory=threat_detector.immune_memory,
    )

    try:
        uvicorn.run(app, host="127.0.0.1", port=config.API_PORT, log_level="warning")
    finally:
        quarantine_manager.stop()
        heartbeat_monitor.stop()
        threat_detector.stop()


def run_everything(args: argparse.Namespace) -> int:
    processes: list[subprocess.Popen] = []

    if args.install:
        subprocess.check_call([_python(), "-m", "pip", "install", "-r", "requirements.txt"], cwd=str(ROOT))
        subprocess.check_call([_npm(), "install"], cwd=str(DASHBOARD))

    if not _has_dashboard_deps():
        print("[GhostNet] dashboard dependencies are missing.")
        print("[GhostNet] run once with: python run_ghostnet.py --install")
        return 1

    backend_cmd = [_python(), str(Path(__file__).resolve()), "--api-only"]
    if args.mqtt:
        backend_cmd = [_python(), "engine.py"]

    try:
        processes.append(_start("backend", backend_cmd, ROOT))
        if not _wait_for_api():
            print("[GhostNet] backend did not become ready on http://127.0.0.1:8000")
            return 1

        processes.append(_start("dashboard", [_npm(), "run", "dev", "--", "--host", "127.0.0.1"], DASHBOARD))

        if args.simulator:
            sim_cmd = [
                _python(),
                "-m",
                "ghostnet.simulator.fake_node",
                "--connection",
                "http",
                "--mode",
                args.mode,
                "--api-url",
                API_URL,
            ]
            processes.append(_start("HTTP simulator", sim_cmd, ROOT))

        print()
        print("[GhostNet] running")
        print(f"[GhostNet] API docs:  {API_URL}/docs")
        print(f"[GhostNet] dashboard: {DASHBOARD_URL}")
        print("[GhostNet] press Ctrl+C here to stop everything")

        while True:
            for proc in processes:
                if proc.poll() is not None:
                    print(f"[GhostNet] a process exited with code {proc.returncode}; stopping.")
                    return proc.returncode or 0
            time.sleep(1)

    except KeyboardInterrupt:
        print("\n[GhostNet] stopping...")
        return 0
    finally:
        for proc in reversed(processes):
            if proc.poll() is None:
                proc.terminate()
        for proc in reversed(processes):
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run GhostNet backend, dashboard, and simulator.")
    parser.add_argument("--api-only", action="store_true", help=argparse.SUPPRESS)
    parser.add_argument("--install", action="store_true", help="Install Python and dashboard dependencies first.")
    parser.add_argument("--mqtt", action="store_true", help="Use engine.py with MQTT instead of API-only demo mode.")
    parser.add_argument("--no-simulator", dest="simulator", action="store_false", help="Do not start the fake node.")
    parser.add_argument(
        "--mode",
        default="normal",
        choices=[
            "normal",
            "dos",
            "mqtt-abuse",
            "replay",
            "exfiltration",
            "resource",
            "crash",
            "firmware-tamper",
            "config-tamper",
            "brute-force",
            "anomaly",
            "flap",
        ],
        help="Simulator mode to run.",
    )
    parser.set_defaults(simulator=True)
    return parser.parse_args()


def main() -> int:
    if os.name == "nt":
        signal.signal(signal.SIGBREAK, signal.SIG_IGN)

    args = parse_args()
    if args.api_only:
        run_api_only()
        return 0
    return run_everything(args)


if __name__ == "__main__":
    raise SystemExit(main())
