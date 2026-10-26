# =============================================================================
# GhostNet — api/main.py (Network-Only IDS Edition)
# FastAPI REST + WebSocket live event feed + PCAP packet inspection
# =============================================================================
from __future__ import annotations

import asyncio
import os
import queue
import re
import shutil
import subprocess
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, Header, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from ghostnet import config, logger
from ghostnet.storage.state_store import DeviceStatus, StateStore

# ── Alert buffer & WebSocket dispatch ─────────────────────────────────────────
_alert_buffer: List[dict] = []
_ALERT_CAPACITY = 1000
_ALERT_TAGS = {"ATTACK", "QUARANTINE", "RECOVERED", "OFFLINE", "ONLINE", "WARN", "PROTECT"}

_ws_queues: List[queue.SimpleQueue] = []


def _on_log_event(event: dict) -> None:
    tag = event.get("tag") or ""
    if tag in _ALERT_TAGS or tag.startswith("THREAT"):
        _alert_buffer.append(event)
        if len(_alert_buffer) > _ALERT_CAPACITY:
            _alert_buffer.pop(0)
    for q in list(_ws_queues):
        try:
            q.put_nowait(event)
        except Exception:
            pass


logger.subscribe(_on_log_event)

# ── App Definition ────────────────────────────────────────────────────────────
app = FastAPI(
    title="GhostNet Network IDS",
    description="Network-only Intrusion Detection Dashboard powered by Suricata EVE telemetry.",
    version="3.0.0",
)

def _cors_origins() -> List[str]:
    raw = os.environ.get("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
    origins = [item.strip() for item in raw.split(",") if item.strip()]
    return origins or ["http://localhost:5173", "http://127.0.0.1:5173"]


class EnvCORSMiddleware(CORSMiddleware):
    def is_allowed_origin(self, origin: str) -> bool:
        return origin in _cors_origins()


app.add_middleware(
    EnvCORSMiddleware,
    allow_origins=[],
    allow_methods=["*"],
    allow_headers=["*"],
)

_state_store: Optional[StateStore] = None


def set_state_store(store: StateStore) -> None:
    global _state_store
    _state_store = store


def get_store() -> StateStore:
    if _state_store is None:
        raise HTTPException(503, "GhostNet state store is initializing...")
    return _state_store


def _verify_device_key(device_key: Optional[str]) -> None:
    configured_key = config.ESP_DEVICE_KEY.strip()
    if configured_key and device_key != configured_key:
        raise HTTPException(401, "Invalid or missing ESP device key.")


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/", tags=["Health"])
def health() -> Dict[str, Any]:
    return {
        "status": "GhostNet Network IDS is running",
        "version": "3.0.0",
        "eve_log_path": config.EVE_LOG_PATH,
    }


# ── IDS Alert & Statistics Endpoints ──────────────────────────────────────────
@app.get("/ids/alerts", tags=["IDS"])
def get_ids_alerts(
    limit: int = Query(100, ge=1, le=1000),
    severity: Optional[int] = Query(None, ge=1, le=3),
    ip: Optional[str] = None,
    signature: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Returns normalized Suricata alerts with optional filters."""
    store = get_store()
    return store.get_alerts(limit=limit, severity=severity, ip=ip, signature=signature)


@app.get("/ids/stats", tags=["IDS"])
def get_ids_stats() -> Dict[str, Any]:
    """Returns aggregated IDS statistics (severity counts, throughput, top signatures)."""
    store = get_store()
    return store.get_ids_stats()


class ESPTelemetry(BaseModel):
    node_id: str
    ip: Optional[str] = None
    name: Optional[str] = None
    mac: Optional[str] = None
    firmware: Optional[str] = None
    rssi: Optional[int] = None
    uptime_ms: Optional[int] = None
    heap_free: Optional[int] = None
    packet_rate: Optional[float] = None
    anomaly_score: Optional[float] = None
    quarantined: Optional[bool] = None


class CommandAcknowledgement(BaseModel):
    command_id: str


@app.post("/esp/telemetry", tags=["ESP32"])
def ingest_esp_telemetry(
    telemetry: ESPTelemetry,
    x_device_key: Optional[str] = Header(None),
) -> Dict[str, Any]:
    """Receives ESP32 health data without treating it as a security alert."""
    _verify_device_key(x_device_key)
    device = get_store().record_esp_telemetry(telemetry.node_id, telemetry.model_dump(exclude_none=True))
    return {"status": "ok", "device_id": device.ip, "node_id": telemetry.node_id, "device_status": device.status}


@app.get("/esp/{node_id}/command", tags=["ESP32"])
def get_esp_command(node_id: str, x_device_key: Optional[str] = Header(None)) -> Dict[str, Any]:
    """Returns the next unacknowledged quarantine or release command for an ESP32."""
    _verify_device_key(x_device_key)
    command = get_store().next_command(node_id)
    return {"command": command}


@app.post("/esp/{node_id}/command/ack", tags=["ESP32"])
def acknowledge_esp_command(
    node_id: str,
    acknowledgement: CommandAcknowledgement,
    x_device_key: Optional[str] = Header(None),
) -> Dict[str, bool]:
    _verify_device_key(x_device_key)
    return {"acknowledged": get_store().acknowledge_command(node_id, acknowledgement.command_id)}


# ── Device Management ─────────────────────────────────────────────────────────
@app.get("/devices", tags=["Devices"])
def list_devices() -> List[Dict[str, Any]]:
    """Returns all discovered network devices with status and traffic rates."""
    store = get_store()
    return store.all_devices_dict()


@app.get("/devices/{ip}", tags=["Devices"])
def get_device(ip: str) -> Dict[str, Any]:
    """Returns detailed telemetry, flow metrics, and alert history for a device."""
    store = get_store()
    dev = store.get_device(ip)
    if dev is None:
        raise HTTPException(404, f"Device with IP '{ip}' not found.")
    return dev.to_dict()


@app.post("/devices/{ip}/quarantine", tags=["Devices"])
def quarantine_device(
    ip: str,
    reason: str = "Manual operator quarantine",
    x_api_key: Optional[str] = Header(None),
    api_key: Optional[str] = Query(None),
) -> Dict[str, str]:
    """Manually quarantines a device by IP."""
    _verify_api_key(x_api_key, api_key)
    store = get_store()
    store.manual_quarantine(ip, reason=reason)
    return {"result": f"Device {ip} quarantined.", "status": DeviceStatus.QUARANTINED}


@app.post("/devices/{ip}/release", tags=["Devices"])
def release_device(
    ip: str,
    x_api_key: Optional[str] = Header(None),
    api_key: Optional[str] = Query(None),
) -> Dict[str, str]:
    """Manually releases a quarantined device back to HEALTHY status."""
    _verify_api_key(x_api_key, api_key)
    store = get_store()
    store.mark_recovered(ip)
    return {"result": f"Device {ip} released.", "status": DeviceStatus.HEALTHY}


# ── Legacy /nodes & /alerts Compatibility ─────────────────────────────────────
@app.get("/nodes", tags=["Nodes"])
def list_nodes() -> List[Dict[str, Any]]:
    """Backward compatibility: maps network devices onto the legacy /nodes format."""
    store = get_store()
    return store.all_nodes_dict()


@app.get("/nodes/{node_id}", tags=["Nodes"])
def get_node(node_id: str) -> Dict[str, Any]:
    """Backward compatibility: maps device {ip} to node."""
    store = get_store()
    node = store.get(node_id)
    if node is None:
        raise HTTPException(404, f"Node '{node_id}' not found.")
    return node.to_dict()


@app.post("/nodes/{node_id}/release", tags=["Nodes"])
def legacy_release(node_id: str) -> Dict[str, str]:
    """Backward compatibility: releases quarantined device."""
    store = get_store()
    store.mark_recovered(node_id)
    return {"result": f"Node '{node_id}' released."}


@app.get("/alerts", tags=["Alerts"])
def get_legacy_alerts(limit: int = 100) -> List[dict]:
    """Backward compatibility: returns last N security alerts for UI toast history."""
    limit = min(limit, _ALERT_CAPACITY)
    return _alert_buffer[-limit:]


# ── Live Event Stream WebSocket ────────────────────────────────────────────────
@app.websocket("/ws/events")
async def websocket_events(ws: WebSocket) -> None:
    """Streams live GhostNet alerts, flow summaries, and recovery events."""
    await ws.accept()
    q: queue.SimpleQueue = queue.SimpleQueue()
    _ws_queues.append(q)
    logger.info("Client connected to GhostNet live event feed.")
    try:
        while True:
            try:
                event = q.get_nowait()
                await ws.send_json(event)
            except queue.Empty:
                await asyncio.sleep(0.05)
    except WebSocketDisconnect:
        pass
    finally:
        if q in _ws_queues:
            _ws_queues.remove(q)


# ── Packet Capture & Tshark Drill-down ─────────────────────────────────────────
def _verify_api_key(api_key_header: Optional[str], api_key_query: Optional[str]) -> None:
    configured_key = config.API_KEY.strip()
    if not configured_key:
        return  # No key configured; open access in local dev
    provided = api_key_header or api_key_query
    if not provided or provided != configured_key:
        raise HTTPException(401, "Invalid or missing API key.")


def _sanitize_pcap_path(filename: str) -> Path:
    """Guards against directory traversal attacks."""
    if not filename or ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(400, "Invalid filename or path traversal detected.")

    pcap_dir = Path(config.PCAP_DIR).resolve()
    target_path = (pcap_dir / filename).resolve()

    # Verify that target stays strictly within PCAP_DIR
    try:
        target_path.relative_to(pcap_dir)
    except ValueError:
        raise HTTPException(400, "Path traversal attempt blocked.")

    return target_path


@app.get("/capture/files", tags=["Capture"])
def list_capture_files(
    x_api_key: Optional[str] = Header(None),
    api_key: Optional[str] = Query(None),
) -> List[Dict[str, Any]]:
    """Lists available packet captures (.pcap, .pcapng)."""
    _verify_api_key(x_api_key, api_key)
    pcap_dir = Path(config.PCAP_DIR).resolve()
    if not pcap_dir.exists():
        return []

    files = []
    for item in pcap_dir.iterdir():
        if item.is_file() and item.suffix.lower() in (".pcap", ".pcapng", ".cap"):
            stat = item.stat()
            files.append({
                "filename": item.name,
                "size_bytes": stat.st_size,
                "modified": stat.st_mtime,
            })
    return files


@app.get("/capture/download/{name}", tags=["Capture"])
def download_capture_file(
    name: str,
    x_api_key: Optional[str] = Header(None),
    api_key: Optional[str] = Query(None),
) -> FileResponse:
    """Securely downloads a PCAP capture file."""
    _verify_api_key(x_api_key, api_key)
    target_file = _sanitize_pcap_path(name)
    if not target_file.exists():
        raise HTTPException(404, f"Capture file '{name}' not found.")

    return FileResponse(
        path=str(target_file),
        filename=target_file.name,
        media_type="application/vnd.tcpdump.pcap",
    )


class PacketDrillDownRequest(BaseModel):
    filename: str
    filter: Optional[str] = None
    limit: int = 50


def _validate_display_filter(dfilter: str) -> bool:
    """Validates that a Wireshark display filter does not contain shell injection characters."""
    forbidden = [";", "`", "$", "\n", "\r", "\t", "&", "|"]
    for char in forbidden:
        if char in dfilter:
            return False
    safe_pattern = re.compile(r"^[a-zA-Z0-9_\.\-\:\s\=\!\<\>\(\)\"\'\/]+$")
    return bool(safe_pattern.match(dfilter))


@app.post("/capture/packets", tags=["Capture"])
def inspect_packets(
    req: PacketDrillDownRequest,
    x_api_key: Optional[str] = Header(None),
    api_key: Optional[str] = Query(None),
) -> Dict[str, Any]:
    """
    On-demand packet drill-down powered by tshark.
    Uses argument lists (shell=False) and validates filters.
    Degrades gracefully if tshark is not installed.
    """
    _verify_api_key(x_api_key, api_key)
    target_file = _sanitize_pcap_path(req.filename)
    if not target_file.exists():
        raise HTTPException(404, f"Capture file '{req.filename}' not found.")

    tshark_bin = shutil.which(config.TSHARK_PATH) or shutil.which("tshark")
    if not tshark_bin:
        return {
            "tshark_available": False,
            "packets": [],
            "message": "tshark is not installed or not in PATH. Full capture download is available via /capture/download.",
        }

    cmd = [
        tshark_bin,
        "-r", str(target_file),
        "-c", str(min(max(1, req.limit), 200)),
        "-T", "fields",
        "-e", "frame.number",
        "-e", "frame.time_relative",
        "-e", "ip.src",
        "-e", "ip.dst",
        "-e", "_ws.col.Protocol",
        "-e", "frame.len",
        "-e", "_ws.col.Info",
        "-E", "separator=\t",
    ]

    if req.filter and req.filter.strip():
        f = req.filter.strip()
        if not _validate_display_filter(f):
            raise HTTPException(400, "Invalid characters in display filter.")
        cmd.extend(["-Y", f])

    try:
        res = subprocess.run(cmd, shell=False, capture_output=True, text=True, timeout=12)
        if res.returncode != 0:
            return {
                "tshark_available": True,
                "packets": [],
                "error": res.stderr.strip() or "tshark returned non-zero exit code",
            }

        packets = []
        for line in res.stdout.strip().split("\n"):
            line = line.strip()
            if not line:
                continue
            parts = line.split("\t")
            packets.append({
                "frame": parts[0] if len(parts) > 0 else "",
                "time": parts[1] if len(parts) > 1 else "",
                "src": parts[2] if len(parts) > 2 else "",
                "dst": parts[3] if len(parts) > 3 else "",
                "proto": parts[4] if len(parts) > 4 else "",
                "len": parts[5] if len(parts) > 5 else "",
                "info": parts[6] if len(parts) > 6 else "",
            })

        return {
            "tshark_available": True,
            "filename": req.filename,
            "filter": req.filter,
            "count": len(packets),
            "packets": packets,
        }
    except subprocess.TimeoutExpired:
        raise HTTPException(504, "tshark packet inspection timed out.")
    except Exception as e:
        return {
            "tshark_available": True,
            "packets": [],
            "error": str(e),
        }
