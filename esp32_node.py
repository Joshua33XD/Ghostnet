import time
import ujson
import network
try:
    import urequests as requests
except ImportError:
    import requests

# Configuration
WIFI_SSID = "Your_SSID"
WIFI_PASS = "Your_PASSWORD"
BACKEND_URL = "http://192.168.1.100:5000/api/telemetry"
NODE_ID = "esp32-node-01"

def connect_wifi():
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    if not wlan.isconnected():
        print(f"Connecting to Wi-Fi SSID: {WIFI_SSID}...")
        wlan.connect(WIFI_SSID, WIFI_PASS)
        timeout = 10
        while not wlan.isconnected() and timeout > 0:
            time.sleep(1)
            timeout -= 1
    return wlan.isconnected()

def generate_sample_data():
    """Generates mock telemetry data when offline or as a sample payload."""
    return {
        "node_id": NODE_ID,
        "timestamp": time.time(),
        "status": "degraded_offline_fallback",
        "metrics": {
            "cpu_usage_pct": 24.5,
            "packet_rate": 120,
            "anomaly_score": 0.08,
            "quarantined": False
        }
    }

def run_node_loop():
    offline_buffer = []
    
    while True:
        connected = connect_wifi()
        payload = generate_sample_data()
        
        if connected:
            try:
                # Flush buffered offline sample data first if any exists
                while offline_buffer:
                    buffered_payload = offline_buffer.pop(0)
                    res = requests.post(BACKEND_URL, json=buffered_payload, timeout=5)
                    res.close()
                
                # Send current telemetry
                response = requests.post(BACKEND_URL, json=payload, timeout=5)
                print(f"[GhostNet ESP] Telemetry sent successfully. Status: {response.status_code}")
                response.close()
            except Exception as e:
                print(f"[GhostNet ESP] Backend unreachable ({e}). Switching to offline sample mode.")
                offline_buffer.append(payload)
        else:
            print("[GhostNet ESP] No Wi-Fi connection. Storing sample telemetry locally.")
            offline_buffer.append(payload)
            # Keep buffer size bounded
            if len(offline_buffer) > 50:
                offline_buffer.pop(0)
                
        time.sleep(10)

if __name__ == "__main__":
    run_node_loop()
