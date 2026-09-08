export default function ArenaHeader({ timeLeft, points }) {
  return (
    <div style={styles.header}>
      <div style={styles.left}>⚡ CODE RELAY ARENA</div>

      <div style={styles.center}>
        LEG TIME REMAINING: <span style={styles.time}>{timeLeft}</span>
      </div>

      <div style={styles.right}>
        POINTS: <span style={styles.points}>{points}</span>
      </div>
    </div>
  );
}

const styles = {
  header: {
    height: "50px",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    color: "#0f172a",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 24px",
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    borderBottom: "1px solid #e2e8f0",
  },
  left: {
    fontWeight: "800",
    letterSpacing: "2px",
    color: "#4f46e5",
  },
  center: {
    fontSize: "13px",
    fontWeight: "600",
    color: "#475569",
  },
  right: {
    fontSize: "13px",
    fontWeight: "600",
    color: "#475569",
  },
  time: {
    color: "#e11d48",
    fontWeight: "800",
    fontFamily: "'JetBrains Mono', monospace",
  },
  points: {
    color: "#059669",
    fontWeight: "800",
    fontFamily: "'JetBrains Mono', monospace",
  },
};
