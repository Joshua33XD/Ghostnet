# =============================================================================
# GhostNet — logger.py  (full threat-expansion edition)
# Every action GhostNet takes is logged here — fully transparent.
# =============================================================================
from __future__ import annotations

import threading
from datetime import datetime
from typing import Callable, List

from rich.console import Console
from rich.text import Text

console = Console()

_lock: threading.Lock = threading.Lock()
_subscribers: List[Callable[[dict], None]] = []


def subscribe(callback: Callable[[dict], None]) -> None:
    with _lock:
        _subscribers.append(callback)


def unsubscribe(callback: Callable[[dict], None]) -> None:
    with _lock:
        if callback in _subscribers:
            _subscribers.remove(callback)


def _notify(event: dict) -> None:
    with _lock:
        subs = list(_subscribers)
    for cb in subs:
        try:
            cb(event)
        except Exception:
            pass


def _print(icon: str, color: str, tag: str, message: str, node_id: str | None = None) -> None:
    ts = datetime.now().strftime("%H:%M:%S.%f")[:-3]
    line = Text()
    line.append(f"[{ts}] ", style="dim white")
    line.append(f" {icon} ", style=f"bold {color}")
    line.append(f"[{tag}]", style=f"bold {color}")
    if node_id:
        line.append(f" [{node_id}]", style="bold cyan")
    line.append(f"  {message}", style="white")
    console.print(line)
    _notify({"ts": ts, "tag": tag, "node_id": node_id, "message": message})


# ── Public log functions ───────────────────────────────────────────────────────

def info(message: str, node_id: str | None = None) -> None:
    _print("ℹ", "blue", "INFO", message, node_id)

def mqtt_rx(node_id: str, topic: str, payload_len: int) -> None:
    _print("📡", "bright_blue", "MQTT-RX", f"topic={topic}  payload={payload_len}B", node_id)

def mqtt_tx(node_id: str, command: str) -> None:
    _print("📤", "magenta", "MQTT-TX", f"command={command!r}", node_id)

def heartbeat(node_id: str, elapsed: float) -> None:
    _print("💓", "green", "HEARTBEAT", f"elapsed since last={elapsed:.1f}s", node_id)

def node_online(node_id: str) -> None:
    _print("🟢", "green", "ONLINE", "Node is online and healthy.", node_id)

def node_offline(node_id: str, elapsed: float) -> None:
    _print("🔴", "red", "OFFLINE", f"No heartbeat for {elapsed:.1f}s — marking OFFLINE.", node_id)

def score_update(node_id: str, old_score: float, new_score: float, rate_dev: float, payload_dev: float) -> None:
    arrow = "▲" if new_score > old_score else "▼"
    _print("🔬", "yellow", "SCORE",
           f"score {old_score:.3f} → {new_score:.3f} {arrow}", node_id)

def threat_detected(node_id: str, threat_label: str, severity: str, detail: str) -> None:
    """A threat detector fired for the first time on this node."""
    sev_color = {"low": "yellow", "medium": "orange3", "high": "red", "critical": "bold red"}.get(severity, "red")
    _print("🚨", sev_color, f"THREAT:{severity.upper()}", f"[{threat_label}] {detail}", node_id)

def threat_cleared(node_id: str, threat_label: str) -> None:
    """A previously active threat is no longer detected."""
    _print("✔", "green", "THREAT-CLEAR", f"[{threat_label}] threat condition cleared.", node_id)

def attack_detected(node_id: str, score: float) -> None:
    _print("⚠️ ", "bold red", "ATTACK",
           f"Anomaly score {score:.3f} exceeded threshold → initiating quarantine!", node_id)

def protect_action(node_id: str, action: str, reason: str) -> None:
    """GhostNet is applying a protection response."""
    _print("🛡️ ", "bold magenta", "PROTECT", f"Action={action!r}  Reason: {reason}", node_id)

def quarantine_start(node_id: str) -> None:
    _print("🔒", "bold red", "QUARANTINE", "Node ISOLATED — publishing QUARANTINE command.", node_id)

def quarantine_check(node_id: str, score: float, clean_streak: int, required: int) -> None:
    _print("🔍", "orange3", "RECOVERY-CHECK",
           f"score={score:.3f}  clean_streak={clean_streak}/{required}", node_id)

def recovery(node_id: str) -> None:
    _print("✅", "bold green", "RECOVERED",
           "Node behaviour returned to normal — RELEASED from quarantine.", node_id)

def self_heal(node_id: str, action: str) -> None:
    """Self-healing action sent to the device."""
    _print("💊", "bold green", "SELF-HEAL", f"Sending heal command={action!r} to device.", node_id)

def warn(message: str, node_id: str | None = None) -> None:
    _print("⚡", "yellow", "WARN", message, node_id)

def error(message: str, node_id: str | None = None) -> None:
    _print("💥", "bold red", "ERROR", message, node_id)
