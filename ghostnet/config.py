# =============================================================================
# GhostNet — config.py  (v3: OSI-aware, ML-assisted, immune memory)
# =============================================================================
import os

# ── MQTT Broker ───────────────────────────────────────────────────────────────
MQTT_BROKER_HOST: str = "localhost"
MQTT_BROKER_PORT: int = 1883
MQTT_TOPIC_ROOT: str  = "ghostnet"
MQTT_SUBSCRIBE_PATTERN: str = "ghostnet/#"

# ── API ───────────────────────────────────────────────────────────────────────
API_HOST: str = "0.0.0.0"
# Railway injects $PORT; fall back to 8000 for local dev
API_PORT: int = int(os.environ.get("PORT", 8000))

# ── EWMA ─────────────────────────────────────────────────────────────────────
EWMA_ALPHA: float = 0.3

# ── Detection cycle ───────────────────────────────────────────────────────────
DETECTION_INTERVAL_SECS: float  = 2.0
HEARTBEAT_CHECK_INTERVAL_SECS: float = 5.0

# ── Heartbeat ─────────────────────────────────────────────────────────────────
HEARTBEAT_TIMEOUT_SECS: float = 30.0

# ── Quarantine / Recovery ─────────────────────────────────────────────────────
ANOMALY_THRESHOLD:    float = 0.75   # combined score → quarantine
RECOVERY_THRESHOLD:   float = 0.30   # score must drop below this
RECOVERY_WINDOW:      int   = 3      # consecutive clean cycles to release

# ══════════════════════════════════════════════════════════════════════════════
# Per-threat thresholds
# ══════════════════════════════════════════════════════════════════════════════

# 1. DoS / Traffic flood
RATE_LIMIT_MSG_PER_SEC: float = 5.0        # messages/s above this = suspicious

# 2. MQTT topic abuse
MQTT_TOPIC_BASELINE_MSGS: int = 10         # learn allowed topics in first N msgs
MQTT_MAX_UNIQUE_TOPICS:   int = 5          # more unique topics than this = abuse

# 3. Replay anomaly
REPLAY_MAX_AGE_SECS:      float = 10.0     # message older than this = stale
REPLAY_SEQ_WINDOW:        int   = 500      # dedup window for seq IDs

# 4. Data exfiltration
MAX_NORMAL_PAYLOAD_BYTES: int   = 512      # avg payload above this = suspicious
EXFIL_PAYLOAD_CRITICAL:   int   = 2048    # above this = high severity

# 5. Resource exhaustion
CPU_THRESHOLD_PCT:        float = 80.0
RAM_THRESHOLD_PCT:        float = 85.0
STORAGE_THRESHOLD_PCT:    float = 90.0

# 6. Repeated crashes / restarts
REBOOT_RATE_WINDOW_SECS:  float = 60.0    # window to count reboots
REBOOT_RATE_LIMIT:        int   = 3       # reboots within window = anomaly

# 7. Firmware tampering
FIRMWARE_HASH_CHANGES_ALLOWED: int = 0    # any change = alert

# 8. Configuration tampering
CONFIG_HASH_CHANGES_ALLOWED: int = 0

# 9. Brute-force
AUTH_FAIL_WINDOW_SECS:    float = 30.0
AUTH_FAIL_LIMIT:          int   = 5

# 10. Network anomaly (EWMA multi-signal)
NETWORK_ANOMALY_SIGMA:    float = 2.5     # std-dev multiplier for EWMA deviation

# ══════════════════════════════════════════════════════════════════════════════
# v3: Threat Fusion weights
# ══════════════════════════════════════════════════════════════════════════════
FUSION_WEIGHT_DET: float = float(os.environ.get("FUSION_WEIGHT_DET", 0.70))
FUSION_WEIGHT_ML:  float = float(os.environ.get("FUSION_WEIGHT_ML",  0.30))

# ══════════════════════════════════════════════════════════════════════════════
# v3: ML Anomaly Detector (Isolation Forest)
# ══════════════════════════════════════════════════════════════════════════════
ML_N_WARMUP:        int   = int(os.environ.get("ML_N_WARMUP", 50))    # samples before scoring
ML_N_ESTIMATORS:    int   = int(os.environ.get("ML_N_ESTIMATORS", 100))
ML_CONTAMINATION:   float = float(os.environ.get("ML_CONTAMINATION", 0.05))  # expected anomaly fraction
ML_MODEL_DIR:       str   = os.environ.get("ML_MODEL_DIR", "data/ml_models")

# ══════════════════════════════════════════════════════════════════════════════
# v3: Immune Memory
# ══════════════════════════════════════════════════════════════════════════════
MEMORY_DB_PATH:              str   = os.environ.get("MEMORY_DB_PATH", "data/immune_memory.db")
MEMORY_SIMILARITY_THRESHOLD: float = float(os.environ.get("MEMORY_SIMILARITY_THRESHOLD", 0.80))
MEMORY_TOP_K:                int   = int(os.environ.get("MEMORY_TOP_K", 3))
