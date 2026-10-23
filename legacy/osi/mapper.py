# =============================================================================
# GhostNet v3 — osi/mapper.py
#
# OSIMapper classifies each threat event against the OSI model.
# Prioritises L3 (Network), L4 (Transport), L7 (Application).
# Architecture is extensible to L1-L7 by adding entries to OSI_LAYER_MAP.
#
# Principle: never fabricate OSI information. Only assert a layer when the
# available telemetry / detector evidence genuinely supports it.
# =============================================================================
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional


# ---------------------------------------------------------------------------
# OSI layer registry  (extensible to L1-L7)
# ---------------------------------------------------------------------------
_LAYERS: dict[int, str] = {
    1: "Physical",
    2: "Data Link",
    3: "Network",
    4: "Transport",
    5: "Session",
    6: "Presentation",
    7: "Application",
}


@dataclass
class OSIResult:
    """
    OSI classification for a single detected threat.

    Fields
    ------
    osi_layer       : int or None — OSI layer number (1-7), None if indeterminate
    osi_layer_name  : str         — human-readable layer name
    attack_category : str         — high-level attack classification
    confidence      : float       — 0.0-1.0; 0 = indeterminate
    evidence        : list[str]   — facts from telemetry that justify the classification
    """
    osi_layer: Optional[int]
    osi_layer_name: str
    attack_category: str
    confidence: float
    evidence: List[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "osi_layer":       self.osi_layer,
            "osi_layer_name":  self.osi_layer_name,
            "attack_category": self.attack_category,
            "confidence":      round(self.confidence, 3),
            "evidence":        self.evidence,
        }


# ---------------------------------------------------------------------------
# Static mapping: threat_name → (osi_layer, attack_category, base_confidence)
#
# Confidence is "base" — it is lowered when the telemetry evidence is weak.
# Layer is None when the threat is indeterminate without deeper protocol data.
# ---------------------------------------------------------------------------
_THREAT_OSI: dict[str, tuple[Optional[int], str, float]] = {
    # Layer 3 — Network
    "dos_flood":           (3,    "Volumetric DoS",            0.90),
    "network_anomaly":     (3,    "Network Traffic Anomaly",   0.75),
    "data_exfiltration":   (3,    "Data Exfiltration",         0.80),

    # Layer 4 — Transport
    "replay_anomaly":      (4,    "Replay / Session Hijack",   0.85),

    # Layer 7 — Application
    "mqtt_abuse":          (7,    "MQTT Protocol Abuse",       0.90),
    "brute_force":         (7,    "Brute-Force / Auth Attack", 0.90),
    "firmware_tamper":     (7,    "Firmware Integrity Breach", 0.95),
    "config_tamper":       (7,    "Configuration Tampering",   0.95),

    # Application-level but resource-oriented (L7 / host)
    "resource_exhaustion": (7,    "Resource Exhaustion",       0.70),
    "crash_restart":       (7,    "Crash-Loop / Service Abuse",0.75),
}

# Evidence extractors: threat_name → callable(node) → list[str]
# Each extractor only adds evidence it can actually observe.
def _evidence_dos(node) -> List[str]:
    evid = []
    rate = node.current_rate()
    if rate > 0:
        evid.append(f"message rate {rate:.1f} msg/s")
    if node.ewma_rate > 0:
        evid.append(f"EWMA rate {node.ewma_rate:.2f} msg/s")
    return evid

def _evidence_exfil(node) -> List[str]:
    evid = []
    avg = node.avg_payload()
    if avg > 0:
        evid.append(f"avg payload {avg:.0f} B")
    if node.ewma_payload > 0:
        evid.append(f"EWMA payload {node.ewma_payload:.0f} B")
    return evid

def _evidence_replay(node) -> List[str]:
    evid = []
    if node.duplicate_seq_count > 0:
        evid.append(f"{node.duplicate_seq_count} duplicate seq IDs observed")
    if node.last_message_ts:
        import time
        age = time.time() - node.last_message_ts
        if age > 5:
            evid.append(f"last message timestamp {age:.0f}s old")
    return evid

def _evidence_mqtt(node) -> List[str]:
    evid = []
    n = len(node.seen_topics)
    if n > 0:
        evid.append(f"{n} unique MQTT topics observed")
    return evid

def _evidence_brute(node) -> List[str]:
    import time
    evid = []
    recent = [t for t in node.auth_fail_timestamps if time.time() - t < 60]
    if recent:
        evid.append(f"{len(recent)} auth failures in last 60s")
    return evid

def _evidence_firmware(node) -> List[str]:
    evid = []
    if node.last_firmware_hash and node.baseline_firmware_hash:
        if node.last_firmware_hash != node.baseline_firmware_hash:
            evid.append(
                f"firmware hash changed: "
                f"{node.baseline_firmware_hash[:8]}… → {node.last_firmware_hash[:8]}…"
            )
    return evid

def _evidence_config(node) -> List[str]:
    evid = []
    if node.last_config_hash and node.baseline_config_hash:
        if node.last_config_hash != node.baseline_config_hash:
            evid.append(
                f"config hash changed: "
                f"{node.baseline_config_hash[:8]}… → {node.last_config_hash[:8]}…"
            )
    return evid

def _evidence_resource(node) -> List[str]:
    evid = []
    if node.last_cpu_pct is not None:
        evid.append(f"CPU {node.last_cpu_pct:.1f}%")
    if node.last_ram_pct is not None:
        evid.append(f"RAM {node.last_ram_pct:.1f}%")
    if node.last_storage_pct is not None:
        evid.append(f"storage {node.last_storage_pct:.1f}%")
    return evid

def _evidence_crash(node) -> List[str]:
    import time
    evid = []
    recent = [t for t in node.reboot_timestamps if time.time() - t < 60]
    if recent:
        evid.append(f"{len(recent)} reboots in last 60s")
    return evid

def _evidence_network(node) -> List[str]:
    evid = []
    if node.ewma_rate > 0:
        evid.append(f"EWMA rate {node.ewma_rate:.2f} msg/s")
    if node.ewma_payload > 0:
        evid.append(f"EWMA payload {node.ewma_payload:.0f} B")
    return evid


_EVIDENCE_FNS: dict[str, callable] = {
    "dos_flood":           _evidence_dos,
    "network_anomaly":     _evidence_network,
    "data_exfiltration":   _evidence_exfil,
    "replay_anomaly":      _evidence_replay,
    "mqtt_abuse":          _evidence_mqtt,
    "brute_force":         _evidence_brute,
    "firmware_tamper":     _evidence_firmware,
    "config_tamper":       _evidence_config,
    "resource_exhaustion": _evidence_resource,
    "crash_restart":       _evidence_crash,
}

_INDETERMINATE = OSIResult(
    osi_layer=None,
    osi_layer_name="Unknown",
    attack_category="Undetermined",
    confidence=0.0,
    evidence=["Insufficient telemetry to determine OSI layer"],
)


class OSIMapper:
    """
    Maps GhostNet threat detector results to OSI model layers.

    Usage
    -----
    mapper = OSIMapper()
    result = mapper.classify("dos_flood", node)
    """

    def classify(self, threat_name: str, node) -> OSIResult:
        """
        Classify a single triggered threat into an OSI layer.

        Returns an OSIResult with layer, category, confidence, and evidence.
        Confidence is reduced if supporting telemetry is absent.
        """
        if threat_name not in _THREAT_OSI:
            return _INDETERMINATE

        osi_layer, attack_category, base_confidence = _THREAT_OSI[threat_name]

        # Extract evidence from live telemetry
        evid_fn = _EVIDENCE_FNS.get(threat_name)
        evidence = evid_fn(node) if evid_fn else []

        # Reduce confidence if no supporting evidence was found
        confidence = base_confidence if evidence else max(base_confidence - 0.30, 0.10)

        layer_name = _LAYERS.get(osi_layer, "Unknown") if osi_layer else "Unknown"

        return OSIResult(
            osi_layer=osi_layer,
            osi_layer_name=layer_name,
            attack_category=attack_category,
            confidence=confidence,
            evidence=evidence,
        )

    def classify_all(self, triggered_threat_names: list[str], node) -> list[OSIResult]:
        """Classify every triggered threat and return the list."""
        return [self.classify(name, node) for name in triggered_threat_names]

    def primary(self, results: list[OSIResult]) -> OSIResult:
        """
        Return the single most-confident OSI result from a list.
        Falls back to _INDETERMINATE if the list is empty.
        """
        if not results:
            return _INDETERMINATE
        return max(results, key=lambda r: r.confidence)

    @staticmethod
    def layer_name(layer: Optional[int]) -> str:
        return _LAYERS.get(layer, "Unknown") if layer else "Unknown"
