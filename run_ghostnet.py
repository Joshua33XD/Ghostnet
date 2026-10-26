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


def run_api_only(ids_sim: bool = False) -> None:
    import uvicorn

    from ghostnet import config, logger
    from ghostnet.api.main import app, set_state_store
    from ghostnet.response.quarantine_manager import QuarantineManager
    from ghostnet.runtime import configure_event_loop
    from ghostnet.storage.state_store import StateStore
    from sensors.eve_tailer import EveTailer

    configure_event_loop()
    store = StateStore()
    set_state_store(store)

    qm = QuarantineManager(store)
    qm.start()

    eve_path = Path(config.EVE_LOG_PATH)
    tailer = EveTailer(eve_path, callback=store.ingest_event, from_beginning=True)
    tailer.start()

    sim = None
    if ids_sim:
        from sensors.ids_sim import IDSSimulator
        print(f"[GhostNet] Starting IDS Simulator emitting to {eve_path}...")
        sim = IDSSimulator(output_path=eve_path, interval=1.0, alert_probability=0.35)
        sim.start()

    try:
        uvicorn.run(app, host="127.0.0.1", port=config.API_PORT, log_level="warning")
    finally:
        if sim:
            sim.stop()
        tailer.stop()
        qm.stop()


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
    if args.ids_sim:
        backend_cmd.append("--ids-sim")

    try:
        processes.append(_start("backend", backend_cmd, ROOT))
        if not _wait_for_api():
            print("[GhostNet] backend did not become ready on http://127.0.0.1:8000")
            return 1

        processes.append(_start("dashboard", [_npm(), "run", "dev", "--", "--host", "127.0.0.1"], DASHBOARD))

        print()
        print("[GhostNet] Network IDS running")
        print(f"[GhostNet] API docs:   {API_URL}/docs")
        print(f"[GhostNet] dashboard:  {DASHBOARD_URL}")
        if args.ids_sim:
            print("[GhostNet] IDS simulator active: streaming realistic IoT EVE alerts & flows")
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
    parser = argparse.ArgumentParser(description="Run GhostNet Network IDS backend, dashboard, and simulator.")
    parser.add_argument("--api-only", action="store_true", help=argparse.SUPPRESS)
    parser.add_argument("--install", action="store_true", help="Install Python and dashboard dependencies first.")
    parser.add_argument(
        "--ids-sim",
        action="store_true",
        default=True,
        help="Run realistic Suricata EVE alert & flow simulator.",
    )
    parser.add_argument(
        "--no-ids-sim",
        dest="ids_sim",
        action="store_false",
        help="Do not start the IDS simulator (use live Suricata eve.json only).",
    )
    return parser.parse_args()


def main() -> int:
    if os.name == "nt":
        signal.signal(signal.SIGBREAK, signal.SIG_IGN)

    args = parse_args()
    if args.api_only:
        run_api_only(ids_sim=args.ids_sim)
        return 0
    return run_everything(args)


if __name__ == "__main__":
    raise SystemExit(main())
