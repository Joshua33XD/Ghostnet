# =============================================================================
# GhostNet — sensors/eve_tailer.py
# Tails Suricata's eve.json in real time with rotation & malformed line recovery.
# Normalizes alert, flow, dns, http, and tls events into structured records.
# =============================================================================
from __future__ import annotations

import datetime
import json
import os
import threading
import time
from pathlib import Path
from typing import Any, Callable, Dict, Optional


def parse_timestamp(ts_val: Any) -> tuple[float, str]:
    """Parse Suricata timestamp string into (epoch_seconds, iso_string)."""
    now = time.time()
    if not ts_val:
        return now, datetime.datetime.fromtimestamp(now, datetime.timezone.utc).isoformat()

    if isinstance(ts_val, (int, float)):
        return float(ts_val), datetime.datetime.fromtimestamp(float(ts_val), datetime.timezone.utc).isoformat()

    ts_str = str(ts_val).strip()
    try:
        # Standard Suricata timestamp format: 2026-10-23T15:23:45.123456+0000
        # Replace "+0000" with "+00:00" if needed for fromisoformat
        clean_ts = ts_str
        if len(clean_ts) >= 5 and (clean_ts[-5] in ("+", "-")) and (":" not in clean_ts[-5:]):
            clean_ts = clean_ts[:-2] + ":" + clean_ts[-2:]
        dt = datetime.datetime.fromisoformat(clean_ts)
        return dt.timestamp(), ts_str
    except Exception:
        return now, ts_str


def normalize_eve_event(raw: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalizes a raw Suricata EVE record into a clean, uniform dictionary.
    Handles 'alert', 'flow', 'dns', 'http', 'tls' events.
    """
    event_type = str(raw.get("event_type", "unknown")).lower()
    ts_epoch, ts_iso = parse_timestamp(raw.get("timestamp"))

    src_ip = raw.get("src_ip") or raw.get("source_ip") or "0.0.0.0"
    dest_ip = raw.get("dest_ip") or raw.get("destination_ip") or "0.0.0.0"
    src_port = raw.get("src_port") or raw.get("source_port")
    dest_port = raw.get("dest_port") or raw.get("destination_port")
    proto = str(raw.get("proto", "TCP")).upper()

    normalized: Dict[str, Any] = {
        "timestamp": ts_epoch,
        "timestamp_iso": ts_iso,
        "event_type": event_type,
        "src_ip": str(src_ip),
        "src_port": int(src_port) if src_port is not None else None,
        "dest_ip": str(dest_ip),
        "dest_port": int(dest_port) if dest_port is not None else None,
        "proto": proto,
        "raw": raw,
    }

    if event_type == "alert":
        raw_alert = raw.get("alert", {})
        severity = raw_alert.get("severity", 3)
        try:
            severity = int(severity)
        except (ValueError, TypeError):
            severity = 3

        normalized["alert"] = {
            "signature": raw_alert.get("signature", "Unknown Security Alert"),
            "signature_id": raw_alert.get("signature_id") or raw_alert.get("gid", 0),
            "severity": severity,
            "category": raw_alert.get("category", "Potentially Malicious Traffic"),
            "action": raw_alert.get("action", "allowed"),
            "rev": raw_alert.get("rev", 1),
        }

    elif event_type == "flow":
        raw_flow = raw.get("flow", {})
        bytes_toserver = int(raw_flow.get("bytes_toserver", 0))
        bytes_toclient = int(raw_flow.get("bytes_toclient", 0))
        pkts_toserver = int(raw_flow.get("pkts_toserver", 0))
        pkts_toclient = int(raw_flow.get("pkts_toclient", 0))
        age = float(raw_flow.get("age", 0))

        normalized["flow"] = {
            "bytes_toserver": bytes_toserver,
            "bytes_toclient": bytes_toclient,
            "pkts_toserver": pkts_toserver,
            "pkts_toclient": pkts_toclient,
            "bytes_total": bytes_toserver + bytes_toclient,
            "pkts_total": pkts_toserver + pkts_toclient,
            "age": age,
            "state": raw_flow.get("state", "established"),
        }

    elif event_type == "dns":
        raw_dns = raw.get("dns", {})
        normalized["dns"] = {
            "type": raw_dns.get("type", "query"),
            "rrname": raw_dns.get("rrname", ""),
            "rrtype": raw_dns.get("rrtype", "A"),
            "rcode": raw_dns.get("rcode", "NOERROR"),
            "id": raw_dns.get("id"),
        }

    elif event_type == "http":
        raw_http = raw.get("http", {})
        normalized["http"] = {
            "hostname": raw_http.get("hostname", dest_ip),
            "url": raw_http.get("url", "/"),
            "http_method": raw_http.get("http_method", "GET"),
            "status": int(raw_http.get("status", 200)) if raw_http.get("status") else 200,
            "user_agent": raw_http.get("http_user_agent", ""),
            "protocol": raw_http.get("protocol", "HTTP/1.1"),
        }

    elif event_type == "tls":
        raw_tls = raw.get("tls", {})
        normalized["tls"] = {
            "sni": raw_tls.get("sni", ""),
            "version": raw_tls.get("version", ""),
            "fingerprint": raw_tls.get("fingerprint", "") or raw_tls.get("ja3", {}).get("hash", ""),
            "subject": raw_tls.get("subject", ""),
        }

    return normalized


class EveTailer:
    """
    Live file tailer for eve.json.
    Features:
    - Waits for file to exist without crashing
    - Detects file truncation or inode replacement (log rotation)
    - Re-reads from beginning if rotated
    - Recovers from partial/malformed JSON lines gracefully
    - Dispatches normalized events to callback listeners
    """

    def __init__(
        self,
        filepath: str | Path,
        callback: Optional[Callable[[Dict[str, Any]], None]] = None,
        from_beginning: bool = False,
        poll_interval: float = 0.25,
    ) -> None:
        self.filepath = Path(filepath)
        self.callback = callback
        self.from_beginning = from_beginning
        self.poll_interval = poll_interval

        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self._file_handle = None
        self._last_inode: Optional[int] = None
        self._last_size: int = 0
        self._line_buffer = ""

    def start(self) -> None:
        """Starts the tailer thread."""
        if self._thread and self._thread.is_alive():
            return
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._tail_loop, name="EveTailer", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        """Stops the tailer thread and closes file handle."""
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=3.0)
            self._thread = None
        if self._file_handle:
            try:
                self._file_handle.close()
            except Exception:
                pass
            self._file_handle = None

    def _open_file(self) -> bool:
        """Attempts to open the target file, positioning seek offset."""
        if not self.filepath.exists():
            return False

        try:
            stat_info = os.stat(str(self.filepath))
            self._file_handle = open(str(self.filepath), "r", encoding="utf-8", errors="replace")
            self._last_inode = getattr(stat_info, "st_ino", None)
            self._last_size = stat_info.st_size

            if not self.from_beginning:
                # Seek to end on initial start unless requested otherwise
                self._file_handle.seek(0, os.SEEK_END)
            return True
        except Exception:
            self._file_handle = None
            return False

    def _check_rotation(self) -> bool:
        """
        Detects if the file was truncated or replaced (rotated).
        Returns True if reopened/reset.
        """
        if not self.filepath.exists():
            return False

        try:
            current_stat = os.stat(str(self.filepath))
            current_inode = getattr(current_stat, "st_ino", None)
            current_size = current_stat.st_size

            # Inode changed (Unix log rotation)
            if current_inode is not None and self._last_inode is not None and current_inode != self._last_inode:
                if self._file_handle:
                    self._file_handle.close()
                self._open_file()
                if self._file_handle:
                    self._file_handle.seek(0, os.SEEK_SET)
                return True

            # File size shrank (truncated / copytruncate rotation)
            if self._file_handle:
                current_pos = self._file_handle.tell()
                if current_size < current_pos:
                    self._file_handle.seek(0, os.SEEK_SET)
                    self._last_size = current_size
                    return True

            self._last_size = current_size
            return False
        except Exception:
            return False

    def _tail_loop(self) -> None:
        """Continuous polling loop."""
        while not self._stop_event.is_set():
            if self._file_handle is None:
                if not self._open_file():
                    time.sleep(self.poll_interval)
                    continue

            self._check_rotation()

            try:
                line = self._file_handle.readline()
                if not line:
                    time.sleep(self.poll_interval)
                    continue

                # Check if line was completed with a newline
                if not line.endswith("\n"):
                    # Partial line; rewind to retry after writer flushes
                    self._file_handle.seek(self._file_handle.tell() - len(line))
                    time.sleep(self.poll_interval)
                    continue

                line_str = line.strip()
                if not line_str:
                    continue

                try:
                    raw_data = json.loads(line_str)
                    if isinstance(raw_data, dict):
                        norm = normalize_eve_event(raw_data)
                        if self.callback:
                            self.callback(norm)
                except json.JSONDecodeError:
                    # Skip malformed line gracefully
                    continue
            except Exception:
                time.sleep(self.poll_interval)
