# =============================================================================
# GhostNet v3 — memory/immune_memory.py
#
# ImmuneMemory: SQLite-backed store of confirmed security incidents.
# Analogous to immunological memory — stores attack signatures so similar
# future attacks can be recognised faster with higher confidence.
#
# Storage: plain sqlite3 (stdlib) in data/immune_memory.db
# No external database, no cloud services.
#
# Schema
# ------
# incidents table:
#   id, timestamp, node_id, osi_layer, osi_layer_name, attack_category,
#   triggered_detectors (JSON), ml_score, final_score,
#   feature_vector (JSON), response, recovered
# =============================================================================
from __future__ import annotations

import json
import math
import os
import sqlite3
import threading
import time
from typing import List, Optional

from ghostnet import config, logger
from ghostnet.detection.threat_fusion import MemoryMatch

# Schema version — increment to trigger migration
_SCHEMA_VERSION = 1

_CREATE_TABLE = """
CREATE TABLE IF NOT EXISTS incidents (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    schema_version      INTEGER NOT NULL DEFAULT 1,
    timestamp           REAL    NOT NULL,
    node_id             TEXT    NOT NULL,
    osi_layer           INTEGER,
    osi_layer_name      TEXT    NOT NULL DEFAULT 'Unknown',
    attack_category     TEXT    NOT NULL DEFAULT 'Undetermined',
    triggered_detectors TEXT    NOT NULL DEFAULT '[]',
    ml_score            REAL    NOT NULL DEFAULT 0.0,
    final_score         REAL    NOT NULL DEFAULT 0.0,
    feature_vector      TEXT    NOT NULL DEFAULT '[]',
    response            TEXT    NOT NULL DEFAULT '',
    recovered           INTEGER NOT NULL DEFAULT 0
);
"""

_CREATE_IDX = """
CREATE INDEX IF NOT EXISTS idx_incidents_node ON incidents(node_id);
CREATE INDEX IF NOT EXISTS idx_incidents_ts   ON incidents(timestamp);
"""


class ImmuneMemory:
    """
    Persistent immune memory for GhostNet.

    Records confirmed incidents and supports similarity queries to
    detect recurring attack patterns ("adaptive immunity").
    """

    def __init__(self, db_path: Optional[str] = None) -> None:
        self._db_path = db_path or config.MEMORY_DB_PATH
        os.makedirs(os.path.dirname(self._db_path) or ".", exist_ok=True)
        self._lock = threading.Lock()
        self._init_db()

    # ── DB setup ───────────────────────────────────────────────────────────────

    def _connect(self) -> sqlite3.Connection:
        con = sqlite3.connect(self._db_path, check_same_thread=False)
        con.row_factory = sqlite3.Row
        return con

    def _init_db(self) -> None:
        with self._lock, self._connect() as con:
            con.executescript(_CREATE_TABLE)
            con.executescript(_CREATE_IDX)

    # ── Record incident ────────────────────────────────────────────────────────

    def record_incident(
        self,
        node_id: str,
        osi_result,         # OSIResult
        det_results: list,  # List[ThreatResult]
        ml_result,          # MLResult
        fusion_result,      # FusionResult
        response: str,
        recovered: bool,
    ) -> int:
        """
        Persist a confirmed incident to the database.
        Returns the new incident ID.
        """
        triggered = [r.name for r in det_results if r.triggered]
        feature_vec = ml_result.top_features  # list of (name, value) tuples

        row = (
            time.time(),
            node_id,
            osi_result.osi_layer,
            osi_result.osi_layer_name,
            osi_result.attack_category,
            json.dumps(triggered),
            ml_result.ml_score,
            fusion_result.final_score,
            json.dumps(feature_vec),
            response,
            int(recovered),
        )
        sql = """
            INSERT INTO incidents
              (timestamp, node_id, osi_layer, osi_layer_name, attack_category,
               triggered_detectors, ml_score, final_score, feature_vector,
               response, recovered)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        with self._lock, self._connect() as con:
            cur = con.execute(sql, row)
            incident_id = cur.lastrowid

        logger.info(
            f"[Memory] Incident #{incident_id} recorded — "
            f"{osi_result.attack_category} @ L{osi_result.osi_layer}",
            node_id=node_id,
        )
        return incident_id

    # ── Similarity search ──────────────────────────────────────────────────────

    def find_similar(
        self,
        node_id: str,
        feature_vector: list,   # list of (name, value) tuples from MLResult.top_features
        top_k: Optional[int] = None,
    ) -> List[MemoryMatch]:
        """
        Query immune memory for historical incidents similar to the current
        feature vector. Uses cosine similarity.

        Returns matches above MEMORY_SIMILARITY_THRESHOLD, sorted by similarity.
        """
        k         = top_k or config.MEMORY_TOP_K
        threshold = config.MEMORY_SIMILARITY_THRESHOLD

        # Build a simple flat vector from (name, value) pairs
        query_vec = [v for _, v in feature_vector] if feature_vector else []
        if not query_vec:
            return []

        with self._lock, self._connect() as con:
            rows = con.execute(
                "SELECT id, timestamp, node_id, osi_layer, osi_layer_name, "
                "attack_category, feature_vector FROM incidents ORDER BY timestamp DESC LIMIT 500"
            ).fetchall()

        matches: List[MemoryMatch] = []
        for row in rows:
            try:
                stored_pairs = json.loads(row["feature_vector"])
                stored_vec   = [v for _, v in stored_pairs] if stored_pairs else []
                sim          = _cosine_similarity(query_vec, stored_vec)
                if sim >= threshold:
                    matches.append(MemoryMatch(
                        incident_id=row["id"],
                        similarity=sim,
                        attack_category=row["attack_category"],
                        osi_layer=row["osi_layer"],
                        osi_layer_name=row["osi_layer_name"],
                        timestamp=row["timestamp"],
                        node_id=row["node_id"],
                    ))
            except Exception:
                continue

        matches.sort(key=lambda m: m.similarity, reverse=True)
        return matches[:k]

    # ── Query API ──────────────────────────────────────────────────────────────

    def get_incidents(self, node_id: Optional[str] = None, limit: int = 100) -> List[dict]:
        """Return recent incidents, optionally filtered by node_id."""
        sql = "SELECT * FROM incidents"
        params: tuple = ()
        if node_id:
            sql += " WHERE node_id = ?"
            params = (node_id,)
        sql += " ORDER BY timestamp DESC LIMIT ?"
        params = params + (limit,)

        with self._lock, self._connect() as con:
            rows = con.execute(sql, params).fetchall()

        return [_row_to_dict(row) for row in rows]

    def count(self) -> int:
        with self._lock, self._connect() as con:
            return con.execute("SELECT COUNT(*) FROM incidents").fetchone()[0]


# ── Helpers ────────────────────────────────────────────────────────────────────

def _cosine_similarity(a: list, b: list) -> float:
    """Cosine similarity between two numeric lists (truncates to shorter length)."""
    n = min(len(a), len(b))
    if n == 0:
        return 0.0
    dot  = sum(a[i] * b[i] for i in range(n))
    na   = math.sqrt(sum(x ** 2 for x in a[:n]))
    nb   = math.sqrt(sum(x ** 2 for x in b[:n]))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


def _row_to_dict(row: sqlite3.Row) -> dict:
    d = dict(row)
    for field in ("triggered_detectors", "feature_vector"):
        try:
            d[field] = json.loads(d[field])
        except Exception:
            d[field] = []
    d["recovered"] = bool(d["recovered"])
    return d
