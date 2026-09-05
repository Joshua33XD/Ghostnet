# =============================================================================
# GhostNet v3 — detection/ml_detector.py
#
# Lightweight, CPU-only ML anomaly detector using sklearn IsolationForest.
# One model per node, lazy-initialized after ML_N_WARMUP clean samples.
#
# Design principles:
#   - Safe cold-start: returns score=0, confidence=0 during warmup
#   - No online retraining: models are retrained only on explicit API call
#   - Models persisted to disk as .pkl files (reproducible, reversible)
#   - Feature vector built entirely from existing NodeState fields
# =============================================================================
from __future__ import annotations

import os
import pickle
import time
import threading
from dataclasses import dataclass, field
from typing import Dict, List, Optional

from ghostnet import config, logger

# Feature names — order matters; must stay stable for saved models
FEATURE_NAMES = [
    "msg_rate",         # current message rate (msg/s)
    "avg_payload",      # average payload size (bytes)
    "topic_count",      # unique MQTT topics seen
    "auth_fail_rate",   # auth failures in last 60s
    "cpu_pct",          # last reported CPU %
    "ram_pct",          # last reported RAM %
    "storage_pct",      # last reported storage %
    "reboot_rate",      # reboots in last 60s
    "ewma_rate",        # EWMA-smoothed message rate
    "ewma_payload",     # EWMA-smoothed payload bytes
    "dup_seq_rate",     # duplicate sequence IDs observed
]

N_FEATURES = len(FEATURE_NAMES)


@dataclass
class MLResult:
    """
    Output of the ML anomaly detector for one node.

    Fields
    ------
    node_id       : str
    ml_score      : float  — anomaly score 0–1 (0=normal, 1=highly anomalous)
    ml_anomaly    : bool   — True if model predicts anomaly
    ml_confidence : float  — 0 during warmup; rises as model matures
    top_features  : list   — [(feature_name, value), ...] most influential features
    warmup        : bool   — True while still collecting baseline samples
    sample_count  : int    — number of samples collected so far
    """
    node_id: str
    ml_score: float = 0.0
    ml_anomaly: bool = False
    ml_confidence: float = 0.0
    top_features: List[tuple] = field(default_factory=list)
    warmup: bool = True
    sample_count: int = 0

    def to_dict(self) -> dict:
        return {
            "ml_score":       round(self.ml_score, 4),
            "ml_anomaly":     self.ml_anomaly,
            "ml_confidence":  round(self.ml_confidence, 3),
            "ml_warmup":      self.warmup,
            "ml_sample_count": self.sample_count,
            "ml_top_features": [{"name": n, "value": round(v, 3)} for n, v in self.top_features],
        }


class _NodeMLState:
    """Per-node state: sample buffer + fitted IsolationForest."""

    def __init__(self, node_id: str) -> None:
        self.node_id     = node_id
        self.samples: List[List[float]] = []
        self.model       = None          # sklearn IsolationForest or None
        self.trained_at  = 0.0
        self.lock        = threading.Lock()

    def add_sample(self, vec: List[float]) -> None:
        with self.lock:
            self.samples.append(vec)
            # Keep a rolling window of samples for retraining
            if len(self.samples) > 2000:
                self.samples = self.samples[-1000:]

    def is_warm(self) -> bool:
        return len(self.samples) >= config.ML_N_WARMUP

    def fit(self) -> None:
        """Train / retrain the IsolationForest on current samples."""
        try:
            from sklearn.ensemble import IsolationForest
            import numpy as np
        except ImportError:
            return

        with self.lock:
            if len(self.samples) < config.ML_N_WARMUP:
                return
            X = np.array(self.samples)

        model = IsolationForest(
            n_estimators=config.ML_N_ESTIMATORS,
            contamination=config.ML_CONTAMINATION,
            random_state=42,
            n_jobs=1,
        )
        model.fit(X)
        with self.lock:
            self.model = model
            self.trained_at = time.time()

    def score_sample(self, vec: List[float]) -> tuple[float, bool]:
        """
        Returns (anomaly_score 0–1, is_anomaly).
        Score 0 = normal, 1 = most anomalous.
        """
        with self.lock:
            if self.model is None:
                return 0.0, False
            try:
                import numpy as np
                X = np.array([vec])
                # decision_function: negative = anomaly, positive = normal
                raw = float(self.model.decision_function(X)[0])
                pred = int(self.model.predict(X)[0])  # -1=anomaly, 1=normal
                # Normalise raw score to 0–1: IF scores typically in [-0.5, 0.5]
                normalised = max(0.0, min(1.0, (-raw + 0.5) / 1.0))
                is_anomaly = pred == -1
                return normalised, is_anomaly
            except Exception:
                return 0.0, False


class MLAnomalyDetector:
    """
    Manages per-node IsolationForest models.

    Lifecycle
    ---------
    1. Collect warmup samples (score=0, confidence=0)
    2. Auto-fit model after ML_N_WARMUP samples
    3. Score each subsequent sample
    4. Explicit retrain via retrain(node_id) — safe, reproducible
    5. Save/load models from ML_MODEL_DIR
    """

    def __init__(self) -> None:
        self._states: Dict[str, _NodeMLState] = {}
        self._lock = threading.Lock()
        os.makedirs(config.ML_MODEL_DIR, exist_ok=True)

    def _get_state(self, node_id: str) -> _NodeMLState:
        with self._lock:
            if node_id not in self._states:
                state = _NodeMLState(node_id)
                # Try loading a previously saved model
                self._load_model(state)
                self._states[node_id] = state
            return self._states[node_id]

    # ── Feature extraction ─────────────────────────────────────────────────────

    @staticmethod
    def extract_features(node) -> List[float]:
        """Extract feature vector from a NodeState. Order must match FEATURE_NAMES."""
        now = time.time()

        msg_rate      = node.current_rate()
        avg_payload   = node.avg_payload()
        topic_count   = float(len(node.seen_topics))
        auth_fail_rate= float(len([t for t in node.auth_fail_timestamps if now - t < 60]))
        cpu_pct       = float(node.last_cpu_pct   or 0.0)
        ram_pct       = float(node.last_ram_pct   or 0.0)
        storage_pct   = float(node.last_storage_pct or 0.0)
        reboot_rate   = float(len([t for t in node.reboot_timestamps if now - t < 60]))
        ewma_rate     = float(node.ewma_rate)
        ewma_payload  = float(node.ewma_payload)
        dup_seq_rate  = float(node.duplicate_seq_count)

        return [
            msg_rate, avg_payload, topic_count, auth_fail_rate,
            cpu_pct, ram_pct, storage_pct, reboot_rate,
            ewma_rate, ewma_payload, dup_seq_rate,
        ]

    # ── Top feature evidence ───────────────────────────────────────────────────

    @staticmethod
    def _top_features(vec: List[float], n: int = 3) -> List[tuple]:
        """Return the n features with highest absolute value (most influential)."""
        pairs = list(zip(FEATURE_NAMES, vec))
        pairs.sort(key=lambda p: abs(p[1]), reverse=True)
        return pairs[:n]

    # ── Public API ─────────────────────────────────────────────────────────────

    def score(self, node) -> MLResult:
        """
        Score a node. Adds the feature vector to the sample buffer,
        fits the model once warmup is complete, then returns an MLResult.
        """
        node_id = node.node_id
        state   = self._get_state(node_id)
        vec     = self.extract_features(node)
        state.add_sample(vec)

        sample_count = len(state.samples)

        # Auto-fit once we cross the warmup threshold (first time only)
        if state.is_warm() and state.model is None:
            state.fit()
            if state.model is not None:
                self._save_model(state)
                logger.info(
                    f"[ML] IsolationForest fitted on {sample_count} samples.",
                    node_id=node_id,
                )

        if not state.is_warm():
            return MLResult(
                node_id=node_id,
                ml_score=0.0,
                ml_anomaly=False,
                ml_confidence=0.0,
                top_features=self._top_features(vec),
                warmup=True,
                sample_count=sample_count,
            )

        ml_score, ml_anomaly = state.score_sample(vec)

        # Confidence grows with sample count (asymptotically approaches 0.95)
        confidence = min(0.95, (sample_count - config.ML_N_WARMUP) / 200.0 + 0.50)

        return MLResult(
            node_id=node_id,
            ml_score=ml_score,
            ml_anomaly=ml_anomaly,
            ml_confidence=confidence,
            top_features=self._top_features(vec),
            warmup=False,
            sample_count=sample_count,
        )

    def retrain(self, node_id: str) -> bool:
        """
        Explicit, safe retrain for a node.
        Returns True if retrain succeeded.
        Only call via explicit API request — never from detection loop.
        """
        state = self._get_state(node_id)
        if len(state.samples) < config.ML_N_WARMUP:
            logger.info(f"[ML] Retrain skipped — only {len(state.samples)} samples.", node_id=node_id)
            return False
        state.fit()
        if state.model is not None:
            self._save_model(state)
            logger.info(f"[ML] Explicit retrain complete on {len(state.samples)} samples.", node_id=node_id)
            return True
        return False

    def status(self) -> dict:
        """Summary status of all node ML models."""
        with self._lock:
            return {
                node_id: {
                    "sample_count": len(s.samples),
                    "warmup": not s.is_warm(),
                    "model_fitted": s.model is not None,
                    "trained_at": s.trained_at,
                }
                for node_id, s in self._states.items()
            }

    # ── Persistence ────────────────────────────────────────────────────────────

    def _model_path(self, node_id: str) -> str:
        safe = node_id.replace("/", "_").replace(":", "_")
        return os.path.join(config.ML_MODEL_DIR, f"{safe}.pkl")

    def _save_model(self, state: _NodeMLState) -> None:
        path = self._model_path(state.node_id)
        try:
            with open(path, "wb") as f:
                pickle.dump({"model": state.model, "samples": state.samples[-500:]}, f)
        except Exception as exc:
            logger.error(f"[ML] Failed to save model: {exc}", node_id=state.node_id)

    def _load_model(self, state: _NodeMLState) -> None:
        path = self._model_path(state.node_id)
        if not os.path.exists(path):
            return
        try:
            with open(path, "rb") as f:
                data = pickle.load(f)
            state.model   = data.get("model")
            state.samples = data.get("samples", [])
            logger.info(f"[ML] Loaded saved model ({len(state.samples)} samples).", node_id=state.node_id)
        except Exception as exc:
            logger.error(f"[ML] Failed to load model: {exc}", node_id=state.node_id)
