import os
import json
import random

class GhostNetOfflineManager:
    def __init__(self, data_path="data/eve.json"):
        self.data_path = data_path

    def get_fallback_telemetry(self):
        """Returns mock sample IoT traffic telemetry if backend storage is disconnected."""
        if os.path.exists(self.data_path):
            try:
                with open(self.data_path, "r") as f:
                    lines = f.readlines()
                    if lines:
                        return json.loads(random.choice(lines))
            except Exception:
                pass

        # Hardcoded sample fallback payload
        return {
            "timestamp": "2026-10-26T20:10:00Z",
            "event_type": "sample_fallback_intrusion_alert",
            "src_ip": "192.168.1.105",
            "dest_ip": "10.0.0.5",
            "alert": {
                "action": "allowed",
                "gid": 1,
                "signature_id": 202601,
                "rev": 1,
                "signature": "GhostNet Sample Brute-Force Detection (Offline Mode)",
                "category": "Potentially Bad Traffic",
                "severity": 2
            },
            "ml_score": 0.89,
            "device_status": "mock_active"
        }

if __name__ == "__main__":
    manager = GhostNetOfflineManager()
    print("Sample Fallback Data Loaded:", json.dumps(manager.get_fallback_telemetry(), indent=2))
