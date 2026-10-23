# Suricata PCAP Replay Guide for GhostNet

This guide explains how to replay packet captures (`.pcap`) through Suricata so that alerts and flows are written to `eve.json` and visualized live in the GhostNet IDS Dashboard.

## Sample Capture Included
A pre-generated PCAP is available at:
`sensors/suricata/pcaps/sample_iot_traffic.pcap`

It contains real IoT traffic exhibiting:
1. MQTT Connect Flood (20+ CONNECTs in < 2 seconds) -> Triggers SID 1000001 (Severity 1)
2. MQTT Wildcard Subscribe (`iot/#`) -> Triggers SID 1000002 (Severity 2)
3. Repeated MQTT Authentication Failures -> Triggers SID 1000003 (Severity 2)
4. Baseline telemetry flow events.

---

## 1. Windows Setup & Replay

### Installation
1. Download the Suricata Windows MSI installer from [suricata.io](https://suricata.io/download/) or install via Chocolatey:
   ```powershell
   choco install suricata
   ```
2. Verify installation:
   ```powershell
   suricata -V
   ```

### Replay Command
Run Suricata in offline replay mode targeting the GhostNet rules and outputting `eve.json`:

```powershell
suricata -c sensors/suricata/suricata.yaml -S sensors/suricata/rules/ghostnet_iot.rules -r sensors/suricata/pcaps/sample_iot_traffic.pcap -l data/
```

Suricata will generate `data/eve.json`. GhostNet immediately tails this file and updates device statuses and alerts live!

---

## 2. Linux Setup & Replay (Ubuntu / Debian / CentOS)

### Installation
```bash
sudo add-apt-repository ppa:oisf/suricata-stable
sudo apt-get update
sudo apt-get install -y suricata
```

### Replay Command
```bash
suricata -c sensors/suricata/suricata.yaml \
         -S sensors/suricata/rules/ghostnet_iot.rules \
         -r sensors/suricata/pcaps/sample_iot_traffic.pcap \
         -l data/
```

To run continuously against a live network interface (e.g., `eth0` or `wlan0`):
```bash
sudo suricata -c sensors/suricata/suricata.yaml \
              -S sensors/suricata/rules/ghostnet_iot.rules \
              -i eth0 \
              -l data/
```

---

## 3. Raspberry Pi Setup (Raspberry Pi OS / ARM64)

Raspberry Pi acts as an ideal edge IDS gateway for IoT networks.

### Installation
```bash
sudo apt update && sudo apt install -y suricata
```

### Replay Command
```bash
suricata -c sensors/suricata/suricata.yaml \
         -S sensors/suricata/rules/ghostnet_iot.rules \
         -r sensors/suricata/pcaps/sample_iot_traffic.pcap \
         -l /var/log/suricata/
```

Then point GhostNet to the live EVE log on the Pi:
```bash
export EVE_LOG_PATH=/var/log/suricata/eve.json
python run_ghostnet.py
```

---

## 4. Standalone Mode (No Suricata Required)

If Suricata is not installed on your system, you can use GhostNet's built-in IDS simulator which emits identical EVE JSON records in real time:

```bash
python run_ghostnet.py --ids-sim
```
