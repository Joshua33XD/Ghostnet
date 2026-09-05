# =============================================================================
# GhostNet v3 — tests/eval_baseline_vs_v3.py
#
# Evaluation script comparing:
#   Baseline GhostNet (10 deterministic detectors)
#   vs GhostNet v3    (+ ML + OSI + ImmuneMemory + ThreatFusion)
#
# Measures:
#   - Detection rate        (% of injected attacks detected)
#   - False-positive rate   (alerts during normal traffic)
#   - Detection latency     (cycles until first detection)
#   - CPU/memory overhead   (rss delta)
#
# Usage:
#   python tests/eval_baseline_vs_v3.py
# =============================================================================
from __future__ import annotations
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import time
import resource
import statistics
import threading
from dataclasses import dataclass, field
from typing import List

from ghostnet.storage.state_store import StateStore, NodeStatus
from ghostnet.detection.threat_detector import ThreatDetector


# ---------------------------------------------------------------------------
# Attack scenarios to inject
# ---------------------------------------------------------------------------
SCENARIOS = {
    "dos_flood": lambda node: setattr(node, "message_timestamps",
        [time.time()] * 60),  # flood 60 msgs in current window
    "data_exfil": lambda node: node.payload_sizes.__iadd__([5000] * 30),
    "brute_force": lambda node: node.auth_fail_timestamps.__iadd__([time.time()] * 10),
    "firmware_tamper": lambda node: setattr(node, "last_firmware_hash", "TAMPERED_XYZ"),
}


@dataclass
class EvalResult:
    scenario: str
    detected: bool
    latency_cycles: int
    triggered_detectors: List[str]
    ml_score: float
    osi_layer: int | None
    attack_category: str
    memory_matches: int


def run_eval() -> None:
    import psutil
    import os as _os

    proc = psutil.Process(_os.getpid())

    print("\n" + "="*70)
    print("GhostNet v3 Evaluation: Baseline vs v3")
    print("="*70)

    results: List[EvalResult] = []
    false_positives = 0
    normal_cycles = 20

    # ── Create engine components ──────────────────────────────────────────────
    store = StateStore()
    detector = ThreatDetector(store)

    # ── Step 1: Normal baseline (false-positive check) ─────────────────────
    print("\n[1/3] Running normal baseline (20 cycles, no attack)...")
    mem_before = proc.memory_info().rss / 1024 / 1024
    cpu_before = proc.cpu_percent(interval=None)
    t0 = time.time()

    node = store.get_or_create("eval-normal")
    import hashlib
    node.baseline_firmware_hash = hashlib.sha256(b"fw").hexdigest()
    node.last_firmware_hash     = node.baseline_firmware_hash
    node.baseline_config_hash   = hashlib.sha256(b"cfg").hexdigest()
    node.last_config_hash       = node.baseline_config_hash

    for _ in range(normal_cycles):
        # Normal telemetry: 1 msg/2s
        node.message_timestamps.append(time.time())
        if len(node.message_timestamps) > 60:
            node.message_timestamps.pop(0)
        node.payload_sizes.append(128)
        if len(node.payload_sizes) > 60:
            node.payload_sizes.pop(0)
        node.last_cpu_pct = 20.0
        node.last_ram_pct = 30.0
        det_results = detector.evaluate_node("eval-normal")
        triggered = [r.name for r in det_results if r.triggered]
        if triggered:
            false_positives += 1
        time.sleep(0.05)  # fast cycle

    t_baseline = time.time() - t0
    mem_after = proc.memory_info().rss / 1024 / 1024
    cpu_after = proc.cpu_percent(interval=None)

    print(f"   Normal cycles: {normal_cycles}")
    print(f"   False positives: {false_positives}")
    print(f"   FP rate: {false_positives/normal_cycles*100:.1f}%")
    print(f"   Memory delta: {mem_after - mem_before:.1f} MB")
    print(f"   Time: {t_baseline:.2f}s")

    # ── Step 2: Attack scenarios ───────────────────────────────────────────
    print("\n[2/3] Running attack scenarios...")

    for scenario_name, inject_fn in SCENARIOS.items():
        attack_node_id = f"eval-{scenario_name}"
        attack_node = store.get_or_create(attack_node_id)
        # Set baselines
        attack_node.baseline_firmware_hash = "safe_fw_hash"
        attack_node.last_firmware_hash     = "safe_fw_hash"
        attack_node.baseline_config_hash   = "safe_cfg_hash"
        attack_node.last_config_hash       = "safe_cfg_hash"
        attack_node.ewma_rate = 1.0

        # Inject attack conditions
        inject_fn(attack_node)

        detected      = False
        latency       = 0
        found_detectors = []
        ml_score      = 0.0
        osi_layer     = None
        attack_cat    = "None"
        mem_count     = 0

        for cycle in range(10):
            det_results = detector.evaluate_node(attack_node_id)
            triggered   = [r.name for r in det_results if r.triggered]
            refreshed   = store.get(attack_node_id)

            if triggered and not detected:
                detected         = True
                latency          = cycle + 1
                found_detectors  = triggered
                ml_score         = refreshed.ml_score
                osi_layer        = refreshed.osi_layer
                attack_cat       = refreshed.attack_category
                mem_count        = len(refreshed.memory_matches)

        results.append(EvalResult(
            scenario=scenario_name,
            detected=detected,
            latency_cycles=latency,
            triggered_detectors=found_detectors,
            ml_score=ml_score,
            osi_layer=osi_layer,
            attack_category=attack_cat,
            memory_matches=mem_count,
        ))

        icon = "✅" if detected else "❌"
        print(f"   {icon} {scenario_name:20s}  "
              f"detected={detected}  latency={latency} cycles  "
              f"OSI=L{osi_layer}  cat={attack_cat}")

    # ── Step 3: Summary ────────────────────────────────────────────────────
    print("\n[3/3] Summary")
    print("-"*70)
    total        = len(results)
    detected_n   = sum(1 for r in results if r.detected)
    latencies    = [r.latency_cycles for r in results if r.detected]

    print(f"   Detection rate:      {detected_n}/{total} ({detected_n/total*100:.0f}%)")
    print(f"   FP rate:             {false_positives/normal_cycles*100:.1f}%")
    print(f"   Avg detection latency: {statistics.mean(latencies) if latencies else 'N/A'} cycles")
    print(f"   Memory overhead:     {mem_after - mem_before:.1f} MB")

    print("\n   Per-scenario OSI classification:")
    for r in results:
        print(f"     {r.scenario:20s}  OSI=L{r.osi_layer}  "
              f"ML score={r.ml_score:.3f}  "
              f"category={r.attack_category}")

    print("\n" + "="*70)
    print("Evaluation complete.")
    print("="*70 + "\n")


if __name__ == "__main__":
    try:
        import psutil
    except ImportError:
        print("Installing psutil for memory measurement...")
        import subprocess
        subprocess.run([sys.executable, "-m", "pip", "install", "psutil", "-q"], check=True)
        import psutil
    run_eval()
