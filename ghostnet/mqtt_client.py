# =============================================================================
# GhostNet — mqtt_client.py  (updated — passes topic + telemetry to store)
# =============================================================================
from __future__ import annotations
import json
import paho.mqtt.client as mqtt
from ghostnet import config, logger
from ghostnet.adapters.base import DeviceAdapter
from ghostnet.storage.state_store import StateStore


class MQTTClient(DeviceAdapter):
    def __init__(self, store: StateStore) -> None:
        self._store  = store
        self._client = mqtt.Client(client_id="ghostnet-server")
        self._client.on_connect    = self._on_connect
        self._client.on_message    = self._on_message
        self._client.on_disconnect = self._on_disconnect

    def connect(self) -> None:
        logger.info(f"MQTT connecting to {config.MQTT_BROKER_HOST}:{config.MQTT_BROKER_PORT} …")
        self._client.connect(config.MQTT_BROKER_HOST, config.MQTT_BROKER_PORT, keepalive=60)
        self._client.loop_start()

    def disconnect(self) -> None:
        self._client.loop_stop()
        self._client.disconnect()
        logger.info("MQTT client disconnected.")

    def publish(self, topic: str, payload: str) -> None:
        self._client.publish(topic, payload, qos=1)

    def _on_connect(self, client, userdata, flags, rc) -> None:
        if rc == 0:
            logger.info(f"MQTT connected. Subscribing to '{config.MQTT_SUBSCRIBE_PATTERN}'.")
            client.subscribe(config.MQTT_SUBSCRIBE_PATTERN, qos=1)
        else:
            logger.error(f"MQTT connection failed (rc={rc}).")

    def _on_disconnect(self, client, userdata, rc) -> None:
        if rc != 0:
            logger.warn(f"Unexpected MQTT disconnect (rc={rc}). Auto-reconnecting …")
        else:
            logger.info("MQTT disconnected cleanly.")

    def _on_message(self, client, userdata, msg) -> None:
        topic: str   = msg.topic
        raw: bytes   = msg.payload
        payload_len  = len(raw)

        parts = topic.split("/")
        if len(parts) < 3 or parts[0] != config.MQTT_TOPIC_ROOT:
            logger.warn(f"Ignoring unexpected topic: {topic!r}")
            return

        node_id   = parts[1]
        sub_topic = parts[2]
        logger.mqtt_rx(node_id, topic, payload_len)

        if sub_topic == "heartbeat":
            self._store.record_heartbeat(node_id)

        elif sub_topic == "telemetry":
            telemetry = None
            try:
                telemetry = json.loads(raw.decode())
                logger.info(f"Telemetry: {telemetry}", node_id=node_id)
            except Exception:
                logger.info(f"Telemetry (raw {payload_len}B).", node_id=node_id)
            self._store.record_message(node_id, payload_len, topic=topic, telemetry=telemetry)

        elif sub_topic == "command":
            pass   # outbound only

        else:
            logger.info(f"Unknown sub-topic '{sub_topic}' — recording as generic.", node_id=node_id)
            self._store.record_message(node_id, payload_len, topic=topic)
