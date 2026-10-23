# GhostNet Network IDS

**GhostNet** is a high-performance network-only Intrusion Detection System (IDS) dashboard. It consumes Suricata's `eve.json` as its single live data source and provides real-time device health evaluation, traffic statistics, alert telemetry, and on-demand packet drill-down.

---

## Architecture Diagram

```mermaid
flowchart TD
    subgraph Network Data Sources
        SURI[Suricata IDS Engine] -->|Live Wire Capture| EVE[(eve.json)]
        PCAP[PCAP Replay Mode\nsuricata -r sample.pcap] --> EVE
        SIM[sensors/ids_sim.py\n--ids-sim demo generator] --> EVE
    end

    subgraph Backend Pipeline
        EVE -->|Rotation & Tail| TAIL[sensors/eve_tailer.py\nNormalizer]
        TAIL --> STORE[StateStore\nIP-based Device Registry\nFlow Bps/Pps Rates]
        
        STORE --> RULE{Deterministic Status Rule\nNo ML}
        RULE -->|Severity 1 or 2 in last 60s| QUAR[QUARANTINED]
        RULE -->|Severity 3 in last 60s| SUSP[SUSPICIOUS]
        RULE -->|Clean window elapsed| HLTH[HEALTHY]

        QM[Quarantine Manager] -->|Clean window recovery| STORE
        LOG[logger.py] -->|Broadcasts| WS[/ws/events]
    end

    subgraph FastAPI REST & Capture API
        STORE --> API[FastAPI /ids/stats, /ids/alerts, /devices]
        PCAP_DIR[sensors/suricata/pcaps] --> CAP[/capture/files & /capture/download]
        TSHARK[tshark CLI\nshell=False] --> DRILL[/capture/packets Drill-Down]
    end

    subgraph Modern UI Dashboard
        API --> UI[React IDS Dashboard]
        WS --> UI
        DRILL --> UI
        
        UI --> V1[1. Overview View\nDevice Cards, Alerts/Min, Severity Breakdown, Live Feed]
        UI --> V2[2. Alerts View\nFilterable Table, Expandable Raw JSON, Device Links]
        UI --> V3[3. Devices View\nIP Cards, Bps/Pps Sparklines, Release & Quarantine Actions]
    end
```

---

## Quickstart & Demo Path

### 1. Zero-Dependency Standalone Demo (Recommended)
GhostNet includes a built-in realistic IoT IDS simulator that generates live Suricata EVE alerts and flow records:

```bash
# Start backend, Vite dashboard, and EVE simulator together
python run_ghostnet.py --ids-sim
```

- **Dashboard:** [http://127.0.0.1:5173](http://127.0.0.1:5173)
- **API Documentation:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **Live WebSocket:** `ws://127.0.0.1:8000/ws/events`

### 2. Live Suricata Mode
To run against your live Suricata daemon:

```bash
# Set path to your Suricata eve.json
export EVE_LOG_PATH=/var/log/suricata/eve.json    # Linux
# or in PowerShell:
$env:EVE_LOG_PATH="C:\ProgramData\Suricata\log\eve.json"

python run_ghostnet.py --no-ids-sim
```

### 3. PCAP Replay Mode
Replay the included IoT attack capture through Suricata:

```bash
suricata -c sensors/suricata/suricata.yaml \
         -S sensors/suricata/rules/ghostnet_iot.rules \
         -r sensors/suricata/pcaps/sample_iot_traffic.pcap \
         -l data/
```
GhostNet immediately tails `data/eve.json` and updates device statuses live. For detailed Windows, Linux, and Raspberry Pi replay instructions, see [sensors/suricata/PCAP_REPLAY.md](sensors/suricata/PCAP_REPLAY.md).

---

## Key Features

1. **Deterministic Status Rules (No ML)**:
   - Any Suricata **Severity 1 or 2 alert** within the alert window (default 60s) transitions the device to **`QUARANTINED`**.
   - Any Suricata **Severity 3 alert** marks the device as **`SUSPICIOUS`**.
   - Devices automatically return to **`HEALTHY`** once the clean window expires without new alerts, or upon manual operator release.
   - Status is broadcast via WebSocket to drive real-time dashboard notifications.

2. **Flow-Based Traffic Indicators**:
   - Live Bytes per Second (Bps) and Packets per Second (Pps) calculated per device.
   - Real-time SVG sparklines in the Devices view.

3. **Accessible 3-View Dashboard**:
   - **Overview:** High-level status metric cards, alerts-per-minute histogram, severity breakdown (with explicit icons + text badges — never color alone), top signatures, and live WebSocket alert feed.
   - **Alerts:** Filterable and searchable table with severity toggles, source/dest IPs, protocols, and expandable raw EVE JSON inspector with one-click copy.
   - **Devices:** Detailed IP device cards, friendly names, live flow sparklines, recent alert lists, and immediate Release / Quarantine actions.
   - Three curated themes: **Dark (default)**, **Clean (light)**, and **Colorful**.

4. **On-Demand Packet Drill-Down**:
   - PCAP listing (`/capture/files`) and secure download (`/capture/download/{name}`).
   - Safe Wireshark display filter queries via tshark with argument lists (never `shell=True`).
   - Degrades gracefully when tshark is not installed.

5. **Legacy Modules Preserved**:
   - All legacy detectors, machine learning (Isolation Forest), immune memory, OSI 7-layer mapper, and threat fusion modules are preserved in `/legacy/`.

---

## Test Suite

Run unit and integration tests:

```bash
python -m pytest tests
```

Tests cover:
- `test_eve_parser.py`: Suricata EVE alert, flow, DNS, HTTP, and TLS record normalization and log rotation handling.
- `test_status_rules.py`: Severity 1-2 quarantine rules, severity 3 suspicious transitions, and clean-window recovery.
- `test_security_sanitization.py`: Directory traversal prevention and Wireshark display filter injection blocking.
- `test_api_endpoints.py`: All FastAPI endpoints and backwards-compatible `/nodes` mapping.
