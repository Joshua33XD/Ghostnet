# =============================================================================
# GhostNet — adapters/http_adapter.py
# HTTP ingest adapter — IoT devices POST telemetry/heartbeat to REST endpoints.
# Connection type: HTTP
# =============================================================================
from __future__ import annotations
from typing import Any, Dict

from fastapi import Request
from ghostnet import logger
from ghostnet.adapters.base import DeviceAdapter
from ghostnet.storage.state_store import StateStore


class HTTPAdapter(DeviceAdapter):
    """
    Registers /ingest/telemetry and /ingest/heartbeat routes on the FastAPI app.
    Devices send HTTP POST requests instead of MQTT messages.
    """

    def __init__(self, store: StateStore, app) -> None:
        self._store = store
        self._publish_fn = None  # set by engine after MQTT client is ready
        self._register_routes(app)

    def connect(self) -> None:
        logger.info("HTTP ingest adapter active — devices can POST to /ingest/telemetry and /ingest/heartbeat")

    def disconnect(self) -> None:
        logger.info("HTTP ingest adapter stopped.")

    def publish(self, topic: str, payload: str) -> None:
        if self._publish_fn:
            self._publish_fn(topic, payload)

    def set_publish_fn(self, fn) -> None:
        self._publish_fn = fn

    def _register_routes(self, app) -> None:

        @app.post("/ingest/telemetry", tags=["Ingest (HTTP)"])
        async def http_telemetry(request: Request) -> Dict[str, Any]:
            """
            HTTP ingest endpoint for telemetry.
            Body (JSON): { "node_id": "...", "seq": 1, "ts": 1234.5, ... }
            """
            try:
                data: dict = await request.json()
            except Exception:
                return {"error": "Invalid JSON"}
            node_id = data.get("node_id", "unknown-http")
            logger.info(f"HTTP telemetry received: {data}", node_id=node_id)
            self._store.record_message(
                node_id, len(str(data)),
                topic=f"http/{node_id}/telemetry", telemetry=data,
            )
            return {"status": "ok", "node_id": node_id}

        @app.post("/ingest/heartbeat", tags=["Ingest (HTTP)"])
        async def http_heartbeat(request: Request) -> Dict[str, Any]:
            """
            HTTP ingest endpoint for heartbeat.
            Body (JSON): { "node_id": "..." }
            """
            try:
                data: dict = await request.json()
            except Exception:
                return {"error": "Invalid JSON"}
            node_id = data.get("node_id", "unknown-http")
            logger.info("HTTP heartbeat received.", node_id=node_id)
            self._store.record_heartbeat(node_id)
            return {"status": "ok", "node_id": node_id}

