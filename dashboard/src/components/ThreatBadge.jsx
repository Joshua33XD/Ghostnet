// ThreatBadge — small coloured pill for each active threat
const THREAT_META = {
  dos_flood:           { label: "DoS Flood",        color: "var(--red)",    bg: "rgba(255,61,110,0.15)" },
  mqtt_abuse:          { label: "MQTT Abuse",        color: "var(--red)",    bg: "rgba(255,61,110,0.15)" },
  replay_anomaly:      { label: "Replay",            color: "var(--orange)", bg: "rgba(255,140,66,0.15)" },
  data_exfiltration:   { label: "Exfiltration",      color: "var(--red)",    bg: "rgba(255,61,110,0.15)" },
  resource_exhaustion: { label: "Resource",          color: "var(--orange)", bg: "rgba(255,140,66,0.15)" },
  crash_restart:       { label: "Crash Loop",        color: "var(--orange)", bg: "rgba(255,140,66,0.15)" },
  firmware_tamper:     { label: "FW Tamper",         color: "#c084fc",       bg: "rgba(192,132,252,0.15)" },
  config_tamper:       { label: "Cfg Tamper",        color: "#c084fc",       bg: "rgba(192,132,252,0.15)" },
  brute_force:         { label: "Brute-Force",       color: "var(--yellow)", bg: "rgba(255,209,102,0.15)" },
  network_anomaly:     { label: "Net Anomaly",       color: "var(--red)",    bg: "rgba(255,61,110,0.15)" },
}

export default function ThreatBadge({ threatName }) {
  const meta = THREAT_META[threatName] ?? { label: threatName, color: "var(--text-muted)", bg: "rgba(255,255,255,0.05)" }
  return (
    <span style={{
      display: "inline-block",
      fontSize: 9,
      fontWeight: 700,
      letterSpacing: "0.07em",
      textTransform: "uppercase",
      padding: "2px 7px",
      borderRadius: 10,
      background: meta.bg,
      color: meta.color,
      border: `1px solid ${meta.color}44`,
      fontFamily: "var(--font-mono)",
    }}>
      {meta.label}
    </span>
  )
}
