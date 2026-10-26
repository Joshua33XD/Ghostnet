#include <WiFi.h>
#include <HTTPClient.h>

// Replace these before uploading. The server address must be reachable by the ESP32.
const char *WIFI_SSID = "YOUR_WIFI_SSID";
const char *WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char *GHOSTNET_API_URL = "http://192.168.1.100:8000";
const char *GHOSTNET_DEVICE_KEY = "CHANGE_ME";
const char *NODE_ID = "esp32-lab-01";
const char *NODE_NAME = "Lab ESP32";

const int SAFE_MODE_PIN = LED_BUILTIN;
const unsigned long TELEMETRY_INTERVAL_MS = 10000;
const unsigned long COMMAND_INTERVAL_MS = 3000;

bool quarantined = false;
unsigned long lastTelemetryAt = 0;
unsigned long lastCommandCheckAt = 0;

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
  }
}

String jsonValue(const String &payload, const String &key) {
  String marker = "\"" + key + "\":\"";
  int start = payload.indexOf(marker);
  if (start < 0) return "";
  start += marker.length();
  int end = payload.indexOf('"', start);
  return end < 0 ? "" : payload.substring(start, end);
}

bool request(const char *path, const char *method, const String &body, String *response) {
  if (WiFi.status() != WL_CONNECTED) return false;

  HTTPClient http;
  http.begin(String(GHOSTNET_API_URL) + path);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", GHOSTNET_DEVICE_KEY);
  int status = String(method) == "POST" ? http.POST(body) : http.GET();
  if (status > 0 && response) *response = http.getString();
  http.end();
  return status >= 200 && status < 300;
}

void sendTelemetry() {
  String body = "{\"node_id\":\"" + String(NODE_ID) +
                "\",\"name\":\"" + String(NODE_NAME) +
                "\",\"ip\":\"" + WiFi.localIP().toString() +
                "\",\"mac\":\"" + WiFi.macAddress() +
                "\",\"firmware\":\"ghostnet-esp32-1.0\"" +
                ",\"rssi\":" + String(WiFi.RSSI()) +
                ",\"uptime_ms\":" + String(millis()) +
                ",\"heap_free\":" + String(ESP.getFreeHeap()) +
                ",\"quarantined\":" + String(quarantined ? "true" : "false") + "}";
  request("/esp/telemetry", "POST", body, nullptr);
}

void acknowledgeCommand(const String &commandId) {
  request(("/esp/" + String(NODE_ID) + "/command/ack").c_str(), "POST",
          "{\"command_id\":\"" + commandId + "\"}", nullptr);
}

void pollCommand() {
  String response;
  if (!request(("/esp/" + String(NODE_ID) + "/command").c_str(), "GET", "", &response)) return;

  String commandId = jsonValue(response, "id");
  String action = jsonValue(response, "action");
  if (commandId.length() == 0 || action.length() == 0) return;

  if (action == "QUARANTINE") {
    quarantined = true;
    digitalWrite(SAFE_MODE_PIN, HIGH);
  } else if (action == "RELEASE") {
    quarantined = false;
    digitalWrite(SAFE_MODE_PIN, LOW);
  }
  acknowledgeCommand(commandId);
}

void setup() {
  pinMode(SAFE_MODE_PIN, OUTPUT);
  digitalWrite(SAFE_MODE_PIN, LOW);
  connectWiFi();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) connectWiFi();

  unsigned long now = millis();
  if (now - lastTelemetryAt >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryAt = now;
    sendTelemetry();
  }
  if (now - lastCommandCheckAt >= COMMAND_INTERVAL_MS) {
    lastCommandCheckAt = now;
    pollCommand();
  }
}
