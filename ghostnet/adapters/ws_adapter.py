# =============================================================================
# GhostNet — adapters/ws_adapter.py
# WebSocket ingest adapter — IoT devices connect via WebSocket and stream
# telemetry/heartbeat JSON messages.
# Connection type: WebSocket
# =============================================================================
from __future__ import annotations
import json
from ghostnet import logger
from ghostnet.adapters.base import DeviceAdapter
from ghostnet.storage.state_store import StateStore


class WSAdapter(DeviceAdapter):
    """
    Registers a /ingest/ws WebSocket endpoint on the FastAPI app.
    Devices connect via WebSocket and send JSON messages continuously.

    Message format:
      { "type": "telemetry", "node_id": "...", "seq": 1, "ts": 1234.5, ... }
      { "type": "heartbeat", "node_id": "..." }
    """

    def __init__(self, store: StateStore, app) -> None:
        self._store = store
        self._register_routes(app)

    def connect(self) -> None:
        logger.info("WebSocket ingest adapter active — devices can connect to ws://…/ingest/ws")

    def disconnect(self) -> None:
        logger.info("WebSocket ingest adapter stopped.")

    def publish(self, topic: str, payload: str) -> None:
        # Commands to WebSocket devices are sent via the same WS connection (not implemented here)
        pass

    def _register_routes(self, app) -> None:
        from fastapi import WebSocket, WebSocketDisconnect

        @app.websocket("/ingest/ws")
        async def ws_ingest(ws: WebSocket):
            """
            WebSocket ingest endpoint.
            Devices connect here and stream telemetry/heartbeat messages as JSON.
            """
            await ws.accept()
            node_id = "unknown-ws"
            logger.info(f"WebSocket device connected to ingest endpoint.")
            try:
                while True:
                    raw = await ws.receive_text()
                    try:
                        data = json.loads(raw)
                    except Exception:
                        await ws.send_text('{"error":"invalid json"}')
                        continue

                    msg_type = data.get("type", "telemetry")
                    node_id  = data.get("node_id", node_id)

                    if msg_type == "heartbeat":
                        logger.info(f"WS heartbeat received.", node_id=node_id)
                        self._store.record_heartbeat(node_id)
                        await ws.send_text('{"status":"ok","type":"heartbeat"}')
                    else:
                        logger.info(f"WS telemetry received: {data}", node_id=node_id)
                        self._store.record_message(node_id, len(raw), topic=f"ws/{node_id}/telemetry", telemetry=data)
                        await ws.send_text('{"status":"ok","type":"telemetry"}')

            except WebSocketDisconnect:
                logger.info(f"WebSocket device disconnected.", node_id=node_id)
