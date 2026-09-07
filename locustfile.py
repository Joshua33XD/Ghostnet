"""
Real external load-testing attack against GhostNet.
Run with:  locust -f locustfile.py --host http://localhost:8000
Then open http://localhost:8089 to control it (set Users + spawn rate, click Start).
"""
import random
import time
from locust import HttpUser, task, between


class GhostNetAttacker(HttpUser):
    wait_time = between(0.01, 0.05)  # near-zero wait = flood behavior
    node_id = "locust-target-01"

    @task
    def send_telemetry(self):
        self.client.post(
            "/ingest/telemetry",
            json={
                "node_id": self.node_id,
                "seq": random.randint(1, 999999),
                "ts": time.time(),
            },
        )
