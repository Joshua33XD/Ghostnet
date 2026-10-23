# =============================================================================
# GhostNet — logger.py
# Central transparent logger and WebSocket event publisher
# =============================================================================
from __future__ import annotations

import threading
from datetime import datetime
from typing import Any, Callable, List, Optional

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


def _print(icon: str, color: str, tag: str, message: str, node_id: str | None = None, extra: dict | None = None) -> None:
    ts = datetime.now().strftime("%H:%M:%S.%f")[:-3]
    line = Text()
    line.append(f"[{ts}] ", style="dim white")
    line.append(f" {icon} ", style=f"bold {color}")
    line.append(f"[{tag}]", style=f"bold {color}")
    if node_id:
        line.append(f" [{node_id}]", style="bold cyan")
    line.append(f"  {message}", style="white")
    try:
        console.print(line)
    except Exception:
        pass

    evt = {"ts": ts, "tag": tag, "node_id": node_id, "message": message}
    if extra:
        evt.update(extra)
    _notify(evt)


# ── Public log functions ───────────────────────────────────────────────────────

def info(message: str, node_id: str | None = None, tag: str = "INFO", **kwargs: Any) -> None:
    _print("ℹ", "blue", tag, message, node_id, extra=kwargs)

def warn(message: str, node_id: str | None = None, tag: str = "WARN", **kwargs: Any) -> None:
    _print("⚡", "yellow", tag, message, node_id, extra=kwargs)

warning = warn

def error(message: str, node_id: str | None = None, tag: str = "ERROR", **kwargs: Any) -> None:
    _print("💥", "bold red", tag, message, node_id, extra=kwargs)

def threat_detected(node_id: str, threat_label: str, severity: str, detail: str) -> None:
    """A threat detector fired on this node."""
    sev_color = {"low": "yellow", "medium": "orange3", "high": "red", "critical": "bold red"}.get(severity, "red")
    _print("🚨", sev_color, f"THREAT:{severity.upper()}", f"[{threat_label}] {detail}", node_id,
           extra={"severity": severity, "threat": threat_label, "detail": detail})

def threat_cleared(node_id: str, threat_label: str) -> None:
    """A previously active threat is no longer detected."""
    _print("✔", "green", "THREAT-CLEAR", f"[{threat_label}] threat condition cleared.", node_id)

def attack_detected(node_id: str, score: float) -> None:
    _print("⚠️ ", "bold red", "ATTACK",
           f"Anomaly score {score:.3f} exceeded threshold → initiating quarantine!", node_id,
           extra={"score": score})

def protect_action(node_id: str, action: str, reason: str) -> None:
    _print("🛡️ ", "bold magenta", "PROTECT", f"Action={action!r}  Reason: {reason}", node_id,
           extra={"action": action, "reason": reason})

def quarantine_start(node_id: str) -> None:
    _print("🔒", "bold red", "QUARANTINE", "Node ISOLATED — publishing QUARANTINE command.", node_id)

def recovery(node_id: str) -> None:
    _print("✅", "bold green", "RECOVERED",
           "Node behaviour returned to normal — RELEASED from quarantine.", node_id)
