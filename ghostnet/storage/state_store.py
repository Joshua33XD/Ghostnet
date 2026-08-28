# =============================================================================
# GhostNet — storage/state_store.py  (full threat-expansion edition)
# Thread-safe in-memory node state registry.
# Every new field required by the 10 threat detectors is added here.
# =============================================================================
from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set

from ghostnet import logger


class NodeStatus:
    HEALTHY    = "HEALTHY"
    SUSPICIOUS = "SUSPICIOUS"
    QUARANTINED = "QUARANTINED"
    OFFLINE    = "OFFLINE"


@dataclass
class NodeState:
    node_id: str

    # ── Timestamps ─────────────────────────────────────────────────────────────
    first_seen:      float = field(default_factory=time.time)
    last_seen:       float = field(default_factory=time.time)
    last_heartbeat:  float = field(default_factory=time.time)
    last_message_ts: Optional[float] = None   # payload-embedded timestamp

    # ── Message statistics ─────────────────────────────────────────────────────
    message_count:      int        = 0
    message_timestamps: List[float] = field(default_factory=list)
    payload_sizes:      List[int]   = field(default_factory=list)

    # ── EWMA ───────────────────────────────────────────────────────────────────
    ewma_rate:    float = 0.0
    ewma_payload: float = 0.0

    # ── Anomaly / status ───────────────────────────────────────────────────────
    anomaly_score:          float = 0.0
    status:                 str   = NodeStatus.HEALTHY
    quarantine_clean_streak: int  = 0
    active_threats:         Set[str] = field(default_factory=set)
    threat_history:         List[dict] = field(default_factory=list)

    # ── Per-threat state ───────────────────────────────────────────────────────
    # Threat 2 — MQTT abuse
    seen_topics:   Set[str] = field(default_factory=set)

    # Threat 3 — Replay
    seen_seq_ids:      Set[int] = field(default_factory=set)
    duplicate_seq_count: int    = 0

    # Threat 5 — Resource exhaustion
    last_cpu_pct:     Optional[float] = None
    last_ram_pct:     Optional[float] = None
    last_storage_pct: Optional[float] = None

    # Threat 6 — Crash/restart
    reboot_timestamps: List[float] = field(default_factory=list)

    # Threat 7 — Firmware tampering
    last_firmware_hash:     Optional[str] = None
    baseline_firmware_hash: Optional[str] = None

    # Threat 8 — Config tampering
    last_config_hash:     Optional[str] = None
    baseline_config_hash: Optional[str] = None

    # Threat 9 — Brute-force
    auth_fail_timestamps: List[float] = field(default_factory=list)

    # ── Meta ───────────────────────────────────────────────────────────────────
    quarantine_time: Optional[float] = None
    recovery_time:   Optional[float] = None
    offline_since:   Optional[float] = None

    # ── Threat-specific recovery clean-streak counters ────────────────────────
    threat_clean_streaks: Dict[str, int] = field(default_factory=dict)

    # Ring-buffer size
    _RING_SIZE: int = field(default=60, init=False, repr=False)

    def to_dict(self) -> dict:
        return {
            "node_id":            self.node_id,
            "status":             self.status,
            "anomaly_score":      round(self.anomaly_score, 4),
            "message_count":      self.message_count,
            "ewma_rate":          round(self.ewma_rate, 4),
            "ewma_payload":       round(self.ewma_payload, 2),
            "last_seen":          self.last_seen,
            "last_heartbeat":     self.last_heartbeat,
            "active_threats":     list(self.active_threats),
            "threat_history":     self.threat_history[-20:],
            "quarantine_time":    self.quarantine_time,
            "recovery_time":      self.recovery_time,
            "offline_since":      self.offline_since,
            "last_cpu_pct":       self.last_cpu_pct,
            "last_ram_pct":       self.last_ram_pct,
            "last_storage_pct":   self.last_storage_pct,
            "last_firmware_hash": self.last_firmware_hash,
            "last_config_hash":   self.last_config_hash,
            "seen_topics_count":  len(self.seen_topics),
        }

    # ── Ring-buffer helpers ────────────────────────────────────────────────────
    def push_message(self, payload_size: int, topic: str = "") -> None:
        now = time.time()
        self.last_seen = now
        self.message_count += 1

        self.message_timestamps.append(now)
        if len(self.message_timestamps) > self._RING_SIZE:
            self.message_timestamps.pop(0)

        self.payload_sizes.append(payload_size)
        if len(self.payload_sizes) > self._RING_SIZE:
            self.payload_sizes.pop(0)

        if topic:
            self.seen_topics.add(topic)

    def current_rate(self) -> float:
        now = time.time()
        window = [t for t in self.message_timestamps if now - t <= 10.0]
        if len(window) < 2:
            return 0.0
        return len(window) / (window[-1] - window[0] + 1e-9)

    def avg_payload(self) -> float:
        if not self.payload_sizes:
            return 0.0
        return sum(self.payload_sizes) / len(self.payload_sizes)

    def record_seq(self, seq_id: int) -> bool:
        """Returns True if this seq_id is a duplicate (replay)."""
        from ghostnet import config as _cfg
        if seq_id in self.seen_seq_ids:
            self.duplicate_seq_count += 1
            return True
        self.seen_seq_ids.add(seq_id)
        # Keep window bounded
        if len(self.seen_seq_ids) > _cfg.REPLAY_SEQ_WINDOW:
            self.seen_seq_ids.pop()
        return False


class StateStore:
    def __init__(self) -> None:
        self._lock  = threading.RLock()
        self._nodes: Dict[str, NodeState] = {}

    # ── Node lifecycle ─────────────────────────────────────────────────────────
    def get_or_create(self, node_id: str) -> NodeState:
        with self._lock:
            if node_id not in self._nodes:
                logger.info(f"New node registered.", node_id=node_id)
                self._nodes[node_id] = NodeState(node_id=node_id)
            return self._nodes[node_id]

    def get(self, node_id: str) -> Optional[NodeState]:
        with self._lock:
            return self._nodes.get(node_id)

    def all_nodes(self) -> List[NodeState]:
        with self._lock:
            return list(self._nodes.values())

    def all_nodes_dict(self) -> List[dict]:
        with self._lock:
            return [n.to_dict() for n in self._nodes.values()]

    # ── Message ingestion ──────────────────────────────────────────────────────
    def record_message(self, node_id: str, payload_size: int,
                       topic: str = "", telemetry: dict | None = None) -> NodeState:
        with self._lock:
            node = self.get_or_create(node_id)
            node.push_message(payload_size, topic)

            if telemetry:
                self._ingest_telemetry_fields(node, telemetry)
            return node

    def _ingest_telemetry_fields(self, node: NodeState, data: dict) -> None:
        """Extract threat-relevant fields from a decoded telemetry payload."""
        # Embedded message timestamp (for replay detection)
        if "ts" in data:
            node.last_message_ts = float(data["ts"])

        # Sequence ID (replay dedup)
        if "seq" in data:
            node.record_seq(int(data["seq"]))

        # Resource metrics
        if "cpu_percent"     in data: node.last_cpu_pct     = float(data["cpu_percent"])
        if "ram_percent"     in data: node.last_ram_pct     = float(data["ram_percent"])
        if "storage_percent" in data: node.last_storage_pct = float(data["storage_percent"])

        # Reboot counter — increment reboot_timestamps when counter increases
        if "reboot_count" in data:
            new_count = int(data["reboot_count"])
            prev = getattr(node, "_last_reboot_count", None)
            if prev is not None and new_count > prev:
                node.reboot_timestamps.append(time.time())
                if len(node.reboot_timestamps) > 30:
                    node.reboot_timestamps.pop(0)
                logger.warn(f"Reboot counter increased to {new_count}.", node_id=node.node_id)
            node._last_reboot_count = new_count  # type: ignore

        # Auth failures
        if "auth_fails" in data:
            new_fails = int(data["auth_fails"])
            prev_fails = getattr(node, "_last_auth_fails", 0)
            if new_fails > prev_fails:
                for _ in range(new_fails - prev_fails):
                    node.auth_fail_timestamps.append(time.time())
                if len(node.auth_fail_timestamps) > 50:
                    node.auth_fail_timestamps = node.auth_fail_timestamps[-50:]
            node._last_auth_fails = new_fails  # type: ignore

        # Firmware hash
        if "firmware_hash" in data:
            h = str(data["firmware_hash"])
            if node.baseline_firmware_hash is None:
                node.baseline_firmware_hash = h
                logger.info(f"Firmware hash baseline set: {h[:12]}…", node_id=node.node_id)
            node.last_firmware_hash = h

        # Config hash
        if "config_hash" in data:
            h = str(data["config_hash"])
            if node.baseline_config_hash is None:
                node.baseline_config_hash = h
                logger.info(f"Config hash baseline set: {h[:12]}…", node_id=node.node_id)
            node.last_config_hash = h

    def record_heartbeat(self, node_id: str) -> NodeState:
        with self._lock:
            node = self.get_or_create(node_id)
            elapsed = time.time() - node.last_heartbeat
            node.last_heartbeat = time.time()
            node.last_seen = node.last_heartbeat
            if node.status == NodeStatus.OFFLINE:
                node.status = NodeStatus.HEALTHY
                node.offline_since = None
                logger.node_online(node_id)
            logger.heartbeat(node_id, elapsed)
            return node

    # ── Score / status updates ─────────────────────────────────────────────────
    def update_ewma(self, node_id: str, new_rate: float, new_payload: float) -> None:
        with self._lock:
            node = self.get_or_create(node_id)
            node.ewma_rate    = new_rate
            node.ewma_payload = new_payload

    def update_score_only(self, node_id: str, new_score: float, old_score: float) -> None:
        with self._lock:
            node = self.get_or_create(node_id)
            node.anomaly_score = new_score
            if abs(new_score - old_score) > 0.005:
                logger.score_update(node_id, old_score, new_score, 0.0, 0.0)

    def set_anomaly_score(self, node_id: str, score: float,
                          old_score: float, rate_dev: float, payload_dev: float) -> None:
        with self._lock:
            node = self.get_or_create(node_id)
            node.anomaly_score = score
            logger.score_update(node_id, old_score, score, rate_dev, payload_dev)

    def update_active_threats(self, node_id: str, active: set) -> None:
        with self._lock:
            node = self.get_or_create(node_id)
            node.active_threats = active

    def set_status(self, node_id: str, status: str) -> None:
        with self._lock:
            node = self.get_or_create(node_id)
            node.status = status

    def mark_quarantined(self, node_id: str) -> None:
        with self._lock:
            node = self.get_or_create(node_id)
            node.status = NodeStatus.QUARANTINED
            node.quarantine_time = time.time()
            node.quarantine_clean_streak = 0
            logger.quarantine_start(node_id)

    def increment_clean_streak(self, node_id: str) -> int:
        with self._lock:
            node = self.get_or_create(node_id)
            node.quarantine_clean_streak += 1
            return node.quarantine_clean_streak

    def reset_clean_streak(self, node_id: str) -> None:
        with self._lock:
            node = self.get_or_create(node_id)
            node.quarantine_clean_streak = 0

    def mark_recovered(self, node_id: str) -> None:
        with self._lock:
            node = self.get_or_create(node_id)
            node.status = NodeStatus.HEALTHY
            node.recovery_time = time.time()
            node.quarantine_clean_streak = 0
            logger.recovery(node_id)

    def mark_offline(self, node_id: str, elapsed: float) -> None:
        with self._lock:
            node = self.get_or_create(node_id)
            node.status = NodeStatus.OFFLINE
            node.offline_since = time.time()
            logger.node_offline(node_id, elapsed)

    def add_threat_history(self, node_id: str, entry: dict) -> None:
        with self._lock:
            node = self.get_or_create(node_id)
            node.threat_history.append(entry)
            if len(node.threat_history) > 200:
                node.threat_history.pop(0)
