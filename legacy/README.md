# GhostNet Legacy Modules

This directory preserves the original multi-threat detectors, Machine Learning (Isolation Forest), Immune Memory incident storage, OSI 7-layer attack categorization, and Threat Fusion components from GhostNet v2/v3.

## Preserved Modules

- **detection/**:
  - `detectors/`: 10 rule-based threat detectors (`dos_flood`, `mqtt_abuse`, `replay_anomaly`, `data_exfiltration`, `resource_exhaustion`, `crash_restart`, `firmware_tamper`, `config_tamper`, `brute_force`, `network_anomaly`).
  - `ml_detector.py`: Scikit-learn Isolation Forest model training, warm-up, and anomaly inference.
  - `threat_fusion.py`: Multi-source anomaly scoring and threat fusion logic.
  - `anomaly_detector.py`: Rate and payload threshold detectors.
  - `heartbeat_monitor.py`: Periodic node heartbeat checks.
- **memory/**:
  - `immune_memory.py`: SQLite-backed persistent incident tracking and past mitigation recall.
- **osi/**:
  - `mapper.py`: OSI 7-layer and attack classification taxonomy.
- **tests/**:
  - Original test suite for ML, OSI mapper, immune memory, and threat fusion.
