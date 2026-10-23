# =============================================================================
# GhostNet — storage/state_store.py (Network-Only IDS Edition)
# Thread-safe in-memory device registry, flow metrics, and Suricata alerts.
# Status rule:
#   Severity 1-2 alert in last N seconds -> QUARANTINED
#   Severity 3 alert in last N seconds   -> SUSPICIOUS
#   Otherwise                           -> HEALTHY
# =============================================================================
from __future__ import annotations

import collections
import datetime
import threading
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set

from ghostnet import config, logger


class DeviceStatus:
    HEALTHY = "HEALTHY"
    SUSPICIOUS = "SUSPICIOUS"
    QUARANTINED = "QUARANTINED"


@dataclass
class DeviceState:
    ip: str
    name: str = ""
    status: str = DeviceStatus.HEALTHY
    first_seen: float = field(default_factory=time.time)
    last_seen: float = field(default_factory=time.time)

    # Manual quarantine override flag
    manually_quarantined: bool = False
    quarantined_at: Optional[float] = None
    recovered_at: Optional[float] = None

    # Alert tracking
    alert_count: int = 0
    recent_alerts: List[Dict[str, Any]] = field(default_factory=list)  # max 50
    active_threats: Set[str] = field(default_factory=set)

    # Flow and Traffic Statistics
    flow_count: int = 0
    bytes_in: int = 0
    bytes_out: int = 0
    bytes_total: int = 0
    pkts_in: int = 0
    pkts_out: int = 0
    pkts_total: int = 0

    # Rate indicators (bytes/sec, packets/sec)
    bps: float = 0.0
    pps: float = 0.0

    # Rolling window samples for rates: deque of (ts, total_bytes, total_pkts)
    rate_samples: collections.deque = field(default_factory=lambda: collections.deque(maxlen=20))
    history_bps: List[Dict[str, Any]] = field(default_factory=list)  # max 60 points
    history_pps: List[Dict[str, Any]] = field(default_factory=list)  # max 60 points

    def __post_init__(self):
        if not self.name:
            friendly = config.DEVICE_NAMES.get(self.ip)
            if friendly:
                self.name = friendly
            else:
                last_octet = self.ip.split(".")[-1] if "." in self.ip else self.ip
                self.name = f"Device-{last_octet}"

    def update_flow(self, is_inbound: bool, bytes_count: int, pkts_count: int, now: Optional[float] = None) -> None:
        """Updates device traffic metrics and computes rolling Bps/Pps."""
        if now is None:
            now = time.time()
        self.last_seen = now
        self.flow_count += 1

        if is_inbound:
            self.bytes_in += bytes_count
            self.pkts_in += pkts_count
        else:
            self.bytes_out += bytes_count
            self.pkts_out += pkts_count

        self.bytes_total = self.bytes_in + self.bytes_out
        self.pkts_total = self.pkts_in + self.pkts_out

        # Compute Bps and Pps using rolling rate samples
        self.rate_samples.append((now, self.bytes_total, self.pkts_total))
        if len(self.rate_samples) >= 2:
            oldest_ts, oldest_bytes, oldest_pkts = self.rate_samples[0]
            dt = now - oldest_ts
            if dt > 0.1:
                self.bps = round((self.bytes_total - oldest_bytes) / dt, 1)
                self.pps = round((self.pkts_total - oldest_pkts) / dt, 1)

        # Record history sparkline (sample at most once every 1.5 seconds)
        ts_ms = int(now * 1000)
        if not self.history_bps or (now - (self.history_bps[-1]["t"] / 1000.0) >= 1.5):
            self.history_bps.append({"t": ts_ms, "score": self.bps})
            self.history_pps.append({"t": ts_ms, "score": self.pps})
            if len(self.history_bps) > 60:
                self.history_bps.pop(0)
            if len(self.history_pps) > 60:
                self.history_pps.pop(0)

    def add_alert(self, alert_event: Dict[str, Any]) -> None:
        """Adds a normalized Suricata alert to the device's history."""
        self.last_seen = alert_event.get("timestamp", time.time())
        self.alert_count += 1
        self.recent_alerts.append(alert_event)
        if len(self.recent_alerts) > 50:
            self.recent_alerts.pop(0)

        sig = alert_event.get("alert", {}).get("signature")
        if sig:
            self.active_threats.add(sig)

    def evaluate_status(self, now: float, window_secs: float) -> tuple[str, str, Optional[Dict[str, Any]]]:
        """
        Deterministic status rule (no ML):
        - Any Suricata severity 1-2 alert in the last N seconds -> QUARANTINED
        - Severity 3 alert in the last N seconds -> SUSPICIOUS
        - Otherwise -> HEALTHY
        - Respects manual quarantine override
        Returns: (old_status, new_status, triggering_alert)
        """
        old_status = self.status
        if self.manually_quarantined:
            self.status = DeviceStatus.QUARANTINED
            return old_status, self.status, None

        # Filter alerts in active window
        active_alerts = [
            a for a in self.recent_alerts
            if (now - a.get("timestamp", 0)) <= window_secs
        ]

        # Update active threats set
        self.active_threats = {
            a.get("alert", {}).get("signature", "")
            for a in active_alerts if a.get("alert", {}).get("signature")
        }

        # Check for severity 1 or 2
        sev1_2 = [a for a in active_alerts if a.get("alert", {}).get("severity") in (1, 2)]
        sev3 = [a for a in active_alerts if a.get("alert", {}).get("severity") == 3]

        if sev1_2:
            self.status = DeviceStatus.QUARANTINED
            if old_status != DeviceStatus.QUARANTINED:
                self.quarantined_at = now
            return old_status, self.status, sev1_2[-1]
        elif sev3:
            self.status = DeviceStatus.SUSPICIOUS
            return old_status, self.status, sev3[-1]
        else:
            self.status = DeviceStatus.HEALTHY
            if old_status in (DeviceStatus.QUARANTINED, DeviceStatus.SUSPICIOUS):
                self.recovered_at = now
            return old_status, self.status, None

    def to_dict(self) -> Dict[str, Any]:
        """Clean dictionary representation for /devices endpoints."""
        return {
            "ip": self.ip,
            "name": self.name,
            "status": self.status,
            "first_seen": self.first_seen,
            "last_seen": self.last_seen,
            "manually_quarantined": self.manually_quarantined,
            "quarantined_at": self.quarantined_at,
            "recovered_at": self.recovered_at,
            "alert_count": self.alert_count,
            "active_threats": sorted(list(self.active_threats)),
            "recent_alerts": self.recent_alerts[-20:],
            "flow_count": self.flow_count,
            "bytes_in": self.bytes_in,
            "bytes_out": self.bytes_out,
            "bytes_total": self.bytes_total,
            "pkts_in": self.pkts_in,
            "pkts_out": self.pkts_out,
            "pkts_total": self.pkts_total,
            "bps": self.bps,
            "pps": self.pps,
            "history_bps": self.history_bps,
            "history_pps": self.history_pps,
        }

    def to_node_dict(self) -> Dict[str, Any]:
        """Maps device onto the legacy /nodes format for 100% backward compatibility."""
        score = 1.0 if self.status == DeviceStatus.QUARANTINED else (0.5 if self.status == DeviceStatus.SUSPICIOUS else 0.0)
        return {
            "node_id": self.ip,
            "ip": self.ip,
            "name": self.name,
            "status": self.status,
            "anomaly_score": score,
            "active_threats": sorted(list(self.active_threats)),
            "threat_history": [
                {
                    "threat": a.get("alert", {}).get("signature", "Alert"),
                    "severity": a.get("alert", {}).get("severity", 3),
                    "timestamp": a.get("timestamp", 0),
                    "description": a.get("alert", {}).get("category", "IDS Alert"),
                }
                for a in self.recent_alerts[-30:]
            ],
            "last_seen": self.last_seen,
            "first_seen": self.first_seen,
            "last_heartbeat": self.last_seen,
            "message_count": self.flow_count + self.alert_count,
            "ewma_rate": self.pps,
            "ewma_payload": round(self.bps / max(self.pps, 1.0), 1),
            "bps": self.bps,
            "pps": self.pps,
            "bytes_total": self.bytes_total,
            "pkts_total": self.pkts_total,
            "recent_alerts": self.recent_alerts[-10:],
            "quarantine_time": self.quarantined_at,
            "recovery_time": self.recovered_at,
        }


class StateStore:
    """Thread-safe state store for devices, live EVE alerts, and network statistics."""

    def __init__(self, alert_window_secs: Optional[float] = None) -> None:
        self._lock = threading.RLock()
        self._devices: Dict[str, DeviceState] = {}
        self._all_alerts: List[Dict[str, Any]] = []
        self._ALERT_CAPACITY = 2000
        self.alert_window_secs = alert_window_secs or config.ALERT_WINDOW_SECS
        self._minute_counts: collections.defaultdict[str, int] = collections.defaultdict(int)
        self._signature_counts: collections.defaultdict[str, Dict[str, Any]] = collections.defaultdict(
            lambda: {"count": 0, "severity": 3, "signature": ""}
        )

    # ── Device Management ───────────────────────────────────────────────────────
    def get_or_create_device(self, ip: str) -> DeviceState:
        with self._lock:
            if ip not in self._devices:
                self._devices[ip] = DeviceState(ip=ip)
            return self._devices[ip]

    def get_device(self, ip: str) -> Optional[DeviceState]:
        with self._lock:
            return self._devices.get(ip)

    def all_devices(self) -> List[DeviceState]:
        with self._lock:
            return list(self._devices.values())

    def all_devices_dict(self) -> List[Dict[str, Any]]:
        with self._lock:
            return [d.to_dict() for d in self._devices.values()]

    # Backward compatible /nodes methods
    def get(self, node_id: str) -> Optional[Any]:
        dev = self.get_device(node_id)
        if not dev:
            return None
        # Wrap in an object with to_dict method
        class NodeWrapper:
            def __init__(self, d: DeviceState):
                self._d = d
                self.node_id = d.ip
                self.status = d.status
                self.active_threats = d.active_threats
                self.threat_history = [
                    {"threat": a.get("alert", {}).get("signature", "Alert"), "timestamp": a.get("timestamp", 0)}
                    for a in d.recent_alerts
                ]
            def to_dict(self):
                return self._d.to_node_dict()
        return NodeWrapper(dev)

    def all_nodes_dict(self) -> List[Dict[str, Any]]:
        with self._lock:
            return [d.to_node_dict() for d in self._devices.values()]

    def all_nodes(self) -> List[Any]:
        with self._lock:
            return [self.get(ip) for ip in self._devices]

    # ── Event Ingestion ────────────────────────────────────────────────────────
    def ingest_event(self, event: Dict[str, Any]) -> None:
        """Processes a normalized EVE event (alert, flow, etc.) and updates state."""
        event_type = event.get("event_type")
        src_ip = event.get("src_ip")
        dest_ip = event.get("dest_ip")
        ts = event.get("timestamp", time.time())

        with self._lock:
            # Register IPs as devices (ignore 0.0.0.0 or empty)
            src_dev = None
            dst_dev = None
            if src_ip and src_ip not in ("0.0.0.0", ""):
                src_dev = self.get_or_create_device(src_ip)
            if dest_ip and dest_ip not in ("0.0.0.0", ""):
                dst_dev = self.get_or_create_device(dest_ip)

            if event_type == "flow":
                flow_data = event.get("flow", {})
                b_to_server = flow_data.get("bytes_toserver", 0)
                b_to_client = flow_data.get("bytes_toclient", 0)
                p_to_server = flow_data.get("pkts_toserver", 0)
                p_to_client = flow_data.get("pkts_toclient", 0)

                if src_dev:
                    src_dev.update_flow(is_inbound=False, bytes_count=b_to_server, pkts_count=p_to_server, now=ts)
                if dst_dev:
                    dst_dev.update_flow(is_inbound=True, bytes_count=b_to_client, pkts_count=p_to_client, now=ts)

            elif event_type == "alert":
                alert_info = event.get("alert", {})
                sig = alert_info.get("signature", "IDS Alert")
                sev = alert_info.get("severity", 3)

                # Store in central alert ledger
                self._all_alerts.append(event)
                if len(self._all_alerts) > self._ALERT_CAPACITY:
                    self._all_alerts.pop(0)

                # Minute bucket for time series (e.g. 2026-10-23T15:23:00)
                dt = datetime.datetime.fromtimestamp(ts, datetime.timezone.utc)
                minute_key = dt.strftime("%Y-%m-%dT%H:%M:00")
                self._minute_counts[minute_key] += 1

                # Signature aggregate
                entry = self._signature_counts[sig]
                entry["count"] += 1
                entry["signature"] = sig
                entry["severity"] = min(entry["severity"], sev)

                # Attach alert to involved device
                target_dev = src_dev or dst_dev
                if target_dev:
                    target_dev.add_alert(event)
                    old_status, new_status, trig = target_dev.evaluate_status(ts, self.alert_window_secs)
                    if old_status != new_status:
                        self._log_status_change(target_dev.ip, old_status, new_status, event)

    def _log_status_change(self, ip: str, old_status: str, new_status: str, alert_event: Optional[Dict[str, Any]] = None) -> None:
        """Logs a status transition through GhostNet's central logger for toast streaming."""
        sig = alert_event.get("alert", {}).get("signature", "") if alert_event else ""
        sev = alert_event.get("alert", {}).get("severity", 3) if alert_event else 3

        if new_status == DeviceStatus.QUARANTINED:
            logger.warning(
                f"Device {ip} QUARANTINED: Suricata alert '{sig}' (Severity {sev})",
                tag="QUARANTINE",
                node_id=ip,
                ip=ip,
                signature=sig,
                severity=sev,
            )
        elif new_status == DeviceStatus.SUSPICIOUS:
            logger.info(
                f"Device {ip} marked SUSPICIOUS: Suricata alert '{sig}' (Severity {sev})",
                tag="WARN",
                node_id=ip,
                ip=ip,
                signature=sig,
                severity=sev,
            )
        elif new_status == DeviceStatus.HEALTHY:
            logger.info(
                f"Device {ip} returned to HEALTHY after clean window.",
                tag="RECOVERED",
                node_id=ip,
                ip=ip,
            )

    # ── Periodic Status Evaluation ─────────────────────────────────────────────
    def evaluate_all_devices(self) -> List[tuple[str, str, str]]:
        """Periodic status update across all devices; recovers devices after clean window."""
        now = time.time()
        transitions = []
        with self._lock:
            for ip, dev in self._devices.items():
                old_status = dev.status
                old_s, new_s, trig = dev.evaluate_status(now, self.alert_window_secs)
                if old_s != new_s:
                    transitions.append((ip, old_s, new_s))
                    self._log_status_change(ip, old_s, new_s, trig)
        return transitions

    # ── Manual Quarantine / Release ────────────────────────────────────────────
    def manual_quarantine(self, ip: str, reason: str = "Manual operator quarantine") -> bool:
        with self._lock:
            dev = self.get_or_create_device(ip)
            dev.manually_quarantined = True
            dev.status = DeviceStatus.QUARANTINED
            dev.quarantined_at = time.time()
            logger.warning(
                f"Device {ip} manually QUARANTINED ({reason})",
                tag="QUARANTINE",
                node_id=ip,
                ip=ip,
                reason=reason,
            )
            return True

    def mark_recovered(self, ip: str) -> bool:
        """Manual release: clears quarantine and resets active alerts."""
        with self._lock:
            dev = self._devices.get(ip)
            if not dev:
                return False
            dev.manually_quarantined = False
            dev.status = DeviceStatus.HEALTHY
            dev.recovered_at = time.time()
            dev.active_threats.clear()
            logger.info(
                f"Device {ip} manually RELEASED to HEALTHY.",
                tag="RECOVERED",
                node_id=ip,
                ip=ip,
            )
            return True

    # ── IDS Alert & Metric Queries ─────────────────────────────────────────────
    def get_alerts(
        self,
        limit: int = 100,
        severity: Optional[int] = None,
        ip: Optional[str] = None,
        signature: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        with self._lock:
            res = self._all_alerts
            if severity is not None:
                res = [a for a in res if a.get("alert", {}).get("severity") == severity]
            if ip is not None:
                res = [a for a in res if a.get("src_ip") == ip or a.get("dest_ip") == ip]
            if signature is not None:
                sig_lower = signature.lower()
                res = [a for a in res if sig_lower in a.get("alert", {}).get("signature", "").lower()]
            return res[-limit:]

    def get_ids_stats(self) -> Dict[str, Any]:
        """Calculates aggregated IDS statistics for dashboard overviews."""
        with self._lock:
            now = time.time()
            sev_counts = {"1": 0, "2": 0, "3": 0}
            for a in self._all_alerts:
                sev = str(a.get("alert", {}).get("severity", 3))
                if sev in sev_counts:
                    sev_counts[sev] += 1

            # Top signatures
            top_sigs = sorted(
                self._signature_counts.values(),
                key=lambda x: x["count"],
                reverse=True
            )[:10]

            # Minutes time series (last 20 minutes)
            sorted_minutes = sorted(self._minute_counts.items(), key=lambda x: x[0])[-20:]
            alerts_per_minute = [{"minute": m, "count": c} for m, c in sorted_minutes]

            # Device counts
            quarantined = sum(1 for d in self._devices.values() if d.status == DeviceStatus.QUARANTINED)
            suspicious = sum(1 for d in self._devices.values() if d.status == DeviceStatus.SUSPICIOUS)
            healthy = sum(1 for d in self._devices.values() if d.status == DeviceStatus.HEALTHY)

            total_bytes = sum(d.bytes_total for d in self._devices.values())
            total_pkts = sum(d.pkts_total for d in self._devices.values())
            total_bps = round(sum(d.bps for d in self._devices.values()), 1)
            total_pps = round(sum(d.pps for d in self._devices.values()), 1)

            return {
                "total_alerts": len(self._all_alerts),
                "severity_counts": sev_counts,
                "alerts_per_minute": alerts_per_minute,
                "top_signatures": top_sigs,
                "total_devices": len(self._devices),
                "active_quarantined": quarantined,
                "active_suspicious": suspicious,
                "active_healthy": healthy,
                "total_bytes": total_bytes,
                "total_packets": total_pkts,
                "total_bps": total_bps,
                "total_pps": total_pps,
                "timestamp": now,
            }
