# GhostNet

**GhostNet** is a lightweight IoT monitoring and anomaly-response system designed to detect suspicious behavior from MQTT-connected nodes, monitor node availability, and automatically quarantine anomalous devices.

It provides:

* MQTT-based node monitoring
* Statistical anomaly detection
* Heartbeat/offline detection
* Automatic node quarantine and recovery
* Thread-safe in-memory state management
* FastAPI REST APIs
* WebSocket-based live dashboard updates
* A fake ESP32 node simulator for development and testing

## Architecture

```text
                         ┌─────────────────────┐
                         │     MQTT Broker      │
                         └──────────┬──────────┘
                                    │
                         MQTT messages / heartbeats
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │    mqtt_client.py   │
                         │  MQTT connection     │
                         │      wrapper         │
                         └──────────┬──────────┘
                                    │
                                    ▼
                    ┌──────────────────────────────┐
                    │       State Store             │
                    │ storage/state_store.py        │
                    │                               │
                    │ node state • timestamps       │
                    │ anomaly information           │
                    │ quarantine status              │
                    └──────────────┬───────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    ▼                             ▼
        ┌─────────────────────┐       ┌─────────────────────┐
        │ Anomaly Detector    │       │ Heartbeat Monitor   │
        │                     │       │                     │
        │ rate anomalies      │       │ missed heartbeat    │
        │ payload anomalies   │       │ offline detection   │
        │ EWMA scoring        │       │                     │
        └──────────┬──────────┘       └──────────┬──────────┘
                   │                             │
                   └──────────────┬──────────────┘
                                  ▼
                     ┌─────────────────────────┐
                     │  Quarantine Manager     │
                     │                         │
                     │ auto-isolation          │
                     │ recovery                 │
                     └────────────┬────────────┘
                                  │
                                  ▼
                     ┌─────────────────────────┐
                     │       FastAPI API        │
                     │                         │
                     │ REST endpoints          │
                     │ WebSocket feed          │
                     └────────────┬────────────┘
                                  │
                                  ▼
                            Dashboard / UI
```

## Project Structure

```text
ghostnet/
├── config.py
│   └── Application settings such as MQTT broker configuration
│       and anomaly/heartbeat thresholds.
│
├── mqtt_client.py
│   └── MQTT connection and message handling wrapper.
│
├── storage/
│   └── state_store.py
│       Thread-safe in-memory storage for node state.
│
├── detection/
│   ├── anomaly_detector.py
│   │   └── Statistical anomaly detection based on message rate,
│   │       payload behavior, and EWMA scoring.
│   │
│   └── heartbeat_monitor.py
│       └── Detects missed heartbeats and offline nodes.
│
├── response/
│   └── quarantine_manager.py
│       └── Automatically isolates suspicious nodes and manages
│           recovery.
│
├── api/
│   └── main.py
│       └── FastAPI REST API and WebSocket dashboard feed.
│
├── simulator/
│   └── fake_node.py
│       └── Simulates an ESP32 MQTT publisher for development
│           and testing.
│
├── engine.py
│   └── Application entrypoint that wires the MQTT client,
│       state store, detection, response, and API components.
│
└── requirements.txt
    └── Python dependencies.
```

## How GhostNet Works

### 1. Node publishes telemetry

An IoT device such as an ESP32 publishes messages to the MQTT broker.

```text
ESP32 → MQTT Broker → GhostNet
```

Messages can contain telemetry, status information, or heartbeat signals.

### 2. GhostNet tracks node state

The MQTT client receives messages and updates the thread-safe state store.

The state can contain information such as:

* Node ID
* Last-seen timestamp
* Message count
* Message rate
* Payload statistics
* Current anomaly score
* Heartbeat status
* Quarantine status

### 3. Anomaly detection

`anomaly_detector.py` evaluates node behavior using multiple signals.

Potential signals include:

* Unusual message frequency
* Abnormally large or unusual payloads
* Sudden behavioral changes
* EWMA-based deviations from normal activity

A node can receive an anomaly score based on these signals.

For example:

```text
Normal behavior
      │
      ▼
┌───────────────┐
│ Collect data  │
└───────┬───────┘
        ▼
┌───────────────┐
│ Calculate     │
│ anomaly score │
└───────┬───────┘
        ▼
   Score > limit?
      /      \
    No        Yes
    │          │
    ▼          ▼
 Normal    Quarantine
```

### 4. Heartbeat monitoring

`heartbeat_monitor.py` tracks the time since each node's last heartbeat.

If a node exceeds the configured heartbeat timeout, GhostNet can mark it as offline or suspicious.

### 5. Automatic quarantine

`quarantine_manager.py` handles the response when a node is considered anomalous.

A typical flow is:

```text
Anomaly detected
       │
       ▼
Check threshold
       │
       ▼
Quarantine node
       │
       ▼
Monitor node
       │
       ├── Still suspicious → Keep isolated
       │
       └── Healthy again   → Recover node
```

The exact isolation mechanism depends on how the MQTT infrastructure and network are configured.

### 6. API and dashboard feed

`api/main.py` exposes the current monitoring state through FastAPI.

REST endpoints can be used by a dashboard or external monitoring service, while WebSockets allow real-time updates without repeatedly polling the server.

## Configuration

Application configuration is centralized in:

```text
config.py
```

Typical settings include:

```python
MQTT_BROKER_HOST = "localhost"
MQTT_BROKER_PORT = 1883

ANOMALY_THRESHOLD = 0.8
HEARTBEAT_TIMEOUT = 30

MQTT_TOPIC = "ghostnet/#"
```

Adjust these values according to your MQTT environment and expected node behavior.

> The exact configuration variables depend on the implementation of `config.py`.

## Installation

### Requirements

* Python 3.10+
* An MQTT broker such as Mosquitto
* pip

Clone or copy the project:

```bash
git clone <your-repository-url>
cd ghostnet
```

Create a virtual environment:

```bash
python -m venv .venv
```

Activate it on Linux/macOS:

```bash
source .venv/bin/activate
```

On Windows:

```powershell
.venv\Scripts\activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

## Running GhostNet

Start your MQTT broker first.

For example, with Mosquitto:

```bash
mosquitto
```

Then start GhostNet:

```bash
python engine.py
```

If the FastAPI application is exposed through Uvicorn directly, you can also run:

```bash
uvicorn api.main:app --reload
```

The exact startup command depends on how `engine.py` initializes the application.

## Running the Fake ESP32 Node

The simulator provides a development-time MQTT publisher without requiring physical ESP32 hardware.

Run:

```bash
python simulator/fake_node.py
```

The simulated node can be used to test:

* Normal telemetry
* Heartbeats
* High message rates
* Abnormal payloads
* Offline behavior
* Quarantine triggers
* Recovery behavior

A typical development setup is:

```text
┌───────────────┐
│ Fake ESP32    │
└───────┬───────┘
        │ MQTT
        ▼
┌───────────────┐
│ MQTT Broker   │
└───────┬───────┘
        │
        ▼
┌───────────────┐
│ GhostNet      │
└───────┬───────┘
        │
        ▼
┌───────────────┐
│ API/Dashboard │
└───────────────┘
```

## API

The FastAPI application provides access to node monitoring information.

Typical API functionality may include:

| Endpoint               | Purpose                         |
| ---------------------- | ------------------------------- |
| `GET /`                | Health/status check             |
| `GET /nodes`           | List monitored nodes            |
| `GET /nodes/{node_id}` | Get a node's current state      |
| `GET /alerts`          | View anomaly/quarantine events  |
| WebSocket endpoint     | Receive live monitoring updates |

> These endpoints are examples based on the project architecture. Update this section to match the actual routes implemented in `api/main.py`.

FastAPI's automatically generated documentation is available when the server is running:

```text
/docs
```

and:

```text
/redoc
```

## Detection Strategy

GhostNet is designed around multiple detection signals rather than relying on a single rule.

### Message-rate anomaly

Detects nodes publishing significantly more or fewer messages than expected.

Example:

```text
Expected: 1 message / second
Observed: 50 messages / second
                    ↓
             Rate anomaly
```

### Payload anomaly

Detects unusual payload characteristics, such as unexpected size or statistical changes.

### EWMA

An Exponentially Weighted Moving Average gives more importance to recent observations while retaining historical context.

Conceptually:

```text
EWMAₜ = α × observationₜ + (1 - α) × EWMAₜ₋₁
```

This allows GhostNet to detect gradual or sudden changes in node behavior.

### Heartbeat anomaly

A node that stops sending heartbeats for longer than the configured timeout can be marked offline.

Combining these mechanisms reduces reliance on any single indicator.

## Thread Safety

`storage/state_store.py` maintains shared node state.

Because MQTT callbacks, monitoring tasks, API requests, and response logic can potentially access state concurrently, the store should provide synchronized access to shared data.

This prevents race conditions such as:

```text
MQTT callback ──────┐
                    ├──> State Store
Heartbeat monitor ──┤
                    │
API request ────────┘
```

## Testing

The simulator can be used as the primary development test source.

Recommended scenarios include:

### Normal node

```text
Heartbeat → Telemetry → Heartbeat → Telemetry
```

Expected result:

```text
Node = HEALTHY
```

### High-rate node

```text
Telemetry
Telemetry
Telemetry
Telemetry
... rapidly
```

Expected result:

```text
Anomaly score increases
        ↓
Quarantine threshold reached
        ↓
Node isolated
```

### Missing heartbeat

```text
Heartbeat
   ↓
   ↓
   X  heartbeat missing
   ↓
Timeout exceeded
```

Expected result:

```text
Node = OFFLINE
```

### Recovery

```text
Quarantined node
       ↓
Normal behavior resumes
       ↓
Recovery checks
       ↓
Node released
```

## Security Considerations

GhostNet should be treated as a monitoring and response component, not as a replacement for MQTT security.

For production deployments, consider:

* MQTT authentication
* TLS encryption
* Per-device credentials
* Topic-level authorization
* Network segmentation
* Restricted API access
* API authentication/authorization
* Secure secret management
* Audit logging
* Persistent event storage

Avoid storing credentials directly in source code. Environment variables or a dedicated secrets manager should be used for sensitive configuration.

## Development

A typical development workflow is:

```text
1. Start MQTT broker
       ↓
2. Start GhostNet
       ↓
3. Start fake node
       ↓
4. Observe node state
       ↓
5. Generate anomalous behavior
       ↓
6. Verify detection
       ↓
7. Verify quarantine
       ↓
8. Verify recovery
```

## Future Improvements

Potential extensions include:

* Persistent database-backed state
* Historical anomaly analytics
* Device authentication
* MQTT TLS support
* Multiple MQTT brokers
* Prometheus metrics
* Grafana integration
* Role-based API authentication
* Configurable detection strategies
* Machine-learning-based anomaly detection
* Event/audit logging
* Distributed GhostNet instances
* Production-grade quarantine integrations
* A dedicated web dashboard

## License

Add the project's license here, for example:

```text
MIT License
```

if the project is intended to use the MIT license.

## Disclaimer

GhostNet is intended for **authorized monitoring and testing of IoT infrastructure**. Only deploy quarantine or network-isolation functionality on devices and networks you own or are explicitly authorized to administer.
