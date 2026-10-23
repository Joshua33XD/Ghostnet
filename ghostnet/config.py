# =============================================================================
# GhostNet — config.py (Network-Only IDS Edition)
# =============================================================================
import os
from typing import Dict

# ── API ───────────────────────────────────────────────────────────────────────
API_HOST: str = os.environ.get("HOST", "0.0.0.0")
# Railway injects $PORT; fall back to 8000 for local dev
API_PORT: int = int(os.environ.get("PORT", 8000))

# ── Suricata EVE & IDS Settings ───────────────────────────────────────────────
EVE_LOG_PATH: str = os.environ.get("EVE_LOG_PATH", "data/eve.json")
ALERT_WINDOW_SECS: float = float(os.environ.get("ALERT_WINDOW_SECS", 60.0))
CLEAN_WINDOW_SECS: float = float(os.environ.get("CLEAN_WINDOW_SECS", 60.0))

# Friendly names for devices: e.g. "192.168.1.10=Smart Thermostat,192.168.1.20=Security Camera"
DEVICE_NAMES_RAW: str = os.environ.get("DEVICE_NAMES", "")

def parse_device_names(raw: str = None) -> Dict[str, str]:
    if raw is None:
        raw = DEVICE_NAMES_RAW
    names: Dict[str, str] = {}
    if not raw:
        return names
    for item in raw.split(","):
        item = item.strip()
        if "=" in item:
            ip, name = item.split("=", 1)
            names[ip.strip()] = name.strip()
    return names

DEVICE_NAMES: Dict[str, str] = parse_device_names()

# ── Packet Drill-Down & Capture ───────────────────────────────────────────────
PCAP_DIR: str = os.environ.get("PCAP_DIR", "sensors/suricata/pcaps")
API_KEY: str = os.environ.get("GHOSTNET_API_KEY", "")
TSHARK_PATH: str = os.environ.get("TSHARK_PATH", "tshark")

# ── Quarantine & Recovery ─────────────────────────────────────────────────────
DETECTION_INTERVAL_SECS: float = 2.0
RECOVERY_WINDOW: int = 3
ANOMALY_THRESHOLD: float = 0.75
RECOVERY_THRESHOLD: float = 0.30
