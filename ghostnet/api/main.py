# =============================================================================
# GhostNet — api/main.py  (full threat-expansion edition)
# FastAPI REST + WebSocket dashboard feed + ingest adapters
# =============================================================================
from __future__ import annotations
import asyncio
import queue
from typing import Any, Dict, List

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from ghostnet import logger

# ── Alert buffer ──────────────────────────────────────────────────────────────
_alert_buffer: List[dict] = []
_ALERT_CAPACITY = 500
_ALERT_TAGS = {
    "ATTACK", "QUARANTINE", "RECOVERED", "OFFLINE", "ONLINE",
    "WARN", "PROTECT", "SELF-HEAL",
}
# Include threat tags
_ALERT_TAGS.update({f"THREAT:{s}" for s in ("LOW", "MEDIUM", "HIGH", "CRITICAL")})
_ALERT_TAGS.add("THREAT-CLEAR")

_ws_queues: List[queue.SimpleQueue] = []


def _on_log_event(event: dict) -> None:
    if event.get("tag") in _ALERT_TAGS or (event.get("tag") or "").startswith("THREAT"):
        _alert_buffer.append(event)
        if len(_alert_buffer) > _ALERT_CAPACITY:
            _alert_buffer.pop(0)
    for q in list(_ws_queues):
        try:
            q.put_nowait(event)
        except Exception:
            pass


logger.subscribe(_on_log_event)

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="GhostNet API",
    description=(
        "IoT anomaly detection & self-healing system. "
        "REST endpoints for node state, alerts, threat history. "
        "WebSocket for live event streaming."
    ),
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_state_store = None


def set_state_store(store) -> None:
    global _state_store
    _state_store = store


# ── REST endpoints ─────────────────────────────────────────────────────────────

@app.get("/", tags=["Health"])
def health() -> Dict[str, str]:
    return {"status": "GhostNet is running", "version": "2.0.0"}


@app.get("/nodes", tags=["Nodes"])
def list_nodes() -> List[Dict[str, Any]]:
    if _state_store is None:
        return []
    return _state_store.all_nodes_dict()


@app.get("/nodes/{node_id}", tags=["Nodes"])
def get_node(node_id: str) -> Dict[str, Any]:
    if _state_store is None:
        raise HTTPException(503, "State store not ready.")
    node = _state_store.get(node_id)
    if node is None:
        raise HTTPException(404, f"Node '{node_id}' not found.")
    return node.to_dict()


@app.get("/nodes/{node_id}/threats", tags=["Nodes"])
def get_node_threats(node_id: str) -> Dict[str, Any]:
    """Returns active threats and threat history for a node."""
    if _state_store is None:
        raise HTTPException(503, "State store not ready.")
    node = _state_store.get(node_id)
    if node is None:
        raise HTTPException(404, f"Node '{node_id}' not found.")
    return {
        "node_id":       node_id,
        "active_threats": list(node.active_threats),
        "threat_history": node.threat_history[-50:],
    }


@app.get("/alerts", tags=["Alerts"])
def get_alerts(limit: int = 100) -> List[dict]:
    """Last N security alert events (attacks, quarantines, recoveries)."""
    limit = min(limit, _ALERT_CAPACITY)
    return _alert_buffer[-limit:]


@app.post("/nodes/{node_id}/release", tags=["Nodes"])
def manual_release(node_id: str) -> Dict[str, str]:
    """Manually release a quarantined node."""
    if _state_store is None:
        raise HTTPException(503, "State store not ready.")
    node = _state_store.get(node_id)
    if node is None:
        raise HTTPException(404, f"Node '{node_id}' not found.")
    logger.info("Manual release triggered via API.", node_id=node_id)
    _state_store.mark_recovered(node_id)
    return {"result": f"Node '{node_id}' released."}


# ── WebSocket live event feed ──────────────────────────────────────────────────
@app.websocket("/ws/events")
async def websocket_events(ws: WebSocket) -> None:
    """Streams every GhostNet log event to connected clients in real time."""
    await ws.accept()
    q: queue.SimpleQueue = queue.SimpleQueue()
    _ws_queues.append(q)
    logger.info("WebSocket client connected to live event feed.")
    try:
        while True:
            try:
                event = q.get_nowait()
                await ws.send_json(event)
            except queue.Empty:
                await asyncio.sleep(0.05)
    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected.")
    finally:
        if q in _ws_queues:
            _ws_queues.remove(q)
