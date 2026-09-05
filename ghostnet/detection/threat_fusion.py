# =============================================================================
# GhostNet v3 — detection/threat_fusion.py
#
# ThreatFusion combines:
#   • deterministic detector scores  (weight: FUSION_WEIGHT_DET = 0.70)
#   • ML anomaly score               (weight: FUSION_WEIGHT_ML  = 0.30)
#   • immune memory similarity boost  (read-only, additive confidence)
#
# ML cannot override deterministic rules. During ML warmup, ML weight drops
# to 0 and the full weight falls on deterministic detectors.
# =============================================================================
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional

from ghostnet import config
from ghostnet.detection.ml_detector import MLResult
from ghostnet.osi.mapper import OSIResult


@dataclass
class MemoryMatch:
    """A similar historical incident found in ImmuneMemory."""
    incident_id: int
    similarity: float           # cosine similarity 0–1
    attack_category: str
    osi_layer: Optional[int]
    osi_layer_name: str
    timestamp: float
    node_id: str

    def to_dict(self) -> dict:
        return {
            "incident_id":    self.incident_id,
            "similarity":     round(self.similarity, 3),
            "attack_category": self.attack_category,
            "osi_layer":      self.osi_layer,
            "osi_layer_name": self.osi_layer_name,
            "timestamp":      self.timestamp,
            "node_id":        self.node_id,
        }


@dataclass
class FusionResult:
    """
    Final fused threat assessment for one node evaluation cycle.

    Fields
    ------
    final_score         : float  — 0-1, used to replace node.anomaly_score
    det_score           : float  — contribution from 10 deterministic detectors
    ml_score            : float  — contribution from IsolationForest
    osi_layer           : int    — primary OSI layer (from most-confident OSIResult)
    osi_layer_name      : str
    attack_category     : str    — primary attack category
    confidence          : float  — overall confidence in the assessment
    triggered_detectors : list   — detector names that fired
    memory_matches      : list   — similar historical incidents
    ml_warmup           : bool   — True while ML is still collecting baseline
    """
    final_score: float
    det_score: float
    ml_score: float
    osi_layer: Optional[int]
    osi_layer_name: str
    attack_category: str
    confidence: float
    triggered_detectors: List[str] = field(default_factory=list)
    memory_matches: List[MemoryMatch] = field(default_factory=list)
    ml_warmup: bool = True

    def to_dict(self) -> dict:
        return {
            "fusion_score":          round(self.final_score, 4),
            "det_score":             round(self.det_score, 4),
            "ml_score":              round(self.ml_score, 4),
            "osi_layer":             self.osi_layer,
            "osi_layer_name":        self.osi_layer_name,
            "attack_category":       self.attack_category,
            "fusion_confidence":     round(self.confidence, 3),
            "triggered_detectors":   self.triggered_detectors,
            "memory_matches":        [m.to_dict() for m in self.memory_matches],
            "ml_warmup":             self.ml_warmup,
        }


class ThreatFusion:
    """
    Fuse deterministic detector results with ML anomaly score and OSI context
    into a single FusionResult.

    Weights
    -------
    FUSION_WEIGHT_DET = 0.70  (from config, adjustable)
    FUSION_WEIGHT_ML  = 0.30  (from config, adjustable)

    ML weight collapses to 0 during warmup (safe fallback).
    """

    def fuse(
        self,
        node,
        det_results: list,          # List[ThreatResult]
        ml_result: MLResult,
        osi_results: List[OSIResult],
        memory_matches: Optional[List[MemoryMatch]] = None,
    ) -> FusionResult:

        # ── 1. Deterministic score (max contribution, existing behavior) ──────
        triggered = [r for r in det_results if r.triggered]
        det_score = max((r.score_contribution for r in triggered), default=0.0)
        triggered_names = [r.name for r in triggered]

        # ── 2. ML score (0 during warmup) ─────────────────────────────────────
        ml_weight = 0.0 if ml_result.warmup else config.FUSION_WEIGHT_ML
        det_weight = 1.0 if ml_result.warmup else config.FUSION_WEIGHT_DET

        # Normalise weights in case config values don't sum to 1
        total_w = det_weight + ml_weight
        if total_w > 0:
            det_weight /= total_w
            ml_weight  /= total_w

        final_score = det_weight * det_score + ml_weight * ml_result.ml_score

        # ── 3. OSI primary result ──────────────────────────────────────────────
        if osi_results:
            primary = max(osi_results, key=lambda r: r.confidence)
        else:
            from ghostnet.osi.mapper import _INDETERMINATE
            primary = _INDETERMINATE

        # ── 4. Confidence ─────────────────────────────────────────────────────
        # Base confidence from OSI primary
        base_conf = primary.confidence if osi_results else 0.0
        # Boost if ML agrees with deterministic detectors
        if not ml_result.warmup and ml_result.ml_anomaly and triggered:
            base_conf = min(1.0, base_conf + 0.10)
        # Reduce confidence if no deterministic detectors triggered
        if not triggered:
            base_conf = min(base_conf, 0.30)

        # ── 5. Memory match confidence boost ──────────────────────────────────
        matches = memory_matches or []
        if matches:
            top_sim = max(m.similarity for m in matches)
            base_conf = min(1.0, base_conf + 0.10 * top_sim)

        return FusionResult(
            final_score=min(1.0, final_score),
            det_score=det_score,
            ml_score=ml_result.ml_score,
            osi_layer=primary.osi_layer,
            osi_layer_name=primary.osi_layer_name,
            attack_category=primary.attack_category if osi_results else "None",
            confidence=base_conf,
            triggered_detectors=triggered_names,
            memory_matches=matches,
            ml_warmup=ml_result.warmup,
        )
