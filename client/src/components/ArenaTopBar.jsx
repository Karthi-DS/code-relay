import ProfileDropdown from "./ProfileDropdown";

export default function ArenaTopBar({ time, score, round, activeMember = 1, memberTimeLeft = "05:00" }) {
  return (
    <div style={styles.bar}>
      <div style={styles.left}>
        <div style={styles.logoBadge}>
          <span style={{ fontSize: "16px" }}>⚡</span>
          <span style={styles.brandTitle}>CODE <span style={{ color: "#38bdf8" }}>RELAY</span></span>
        </div>
        {round && <span style={styles.round}>LEG {round}</span>}
      </div>

      <div style={styles.center}>
        <div style={{ display: "flex", gap: "24px", alignItems: "center" }}>
          {/* Total Leg Timer */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <span style={styles.timerLabel}>LEG TIME REMAINING</span>
            <span style={styles.time}>{time}</span>
          </div>

          {/* Member Relay Turn Widget */}
          <div style={styles.relayMemberWidget}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span className={`badge-${activeMember === 1 ? "indigo" : "emerald"}`} style={{ fontSize: "11px", fontWeight: "800" }}>
                👤 MEMBER {activeMember} TYPING
              </span>
              <span style={styles.memberTurnTimer}>⏱️ {memberTimeLeft}</span>
            </div>
          </div>
        </div>
      </div>

      <div style={styles.right}>
        {score !== undefined && (
          <div style={styles.scoreBox}>
            <span style={styles.scoreLabel}>SCORE</span>
            <span style={styles.score}>{score} PTS</span>
          </div>
        )}
        <ProfileDropdown />
      </div>
    </div>
  );
}

const styles = {
  bar: {
    height: "64px",
    width: "100%",
    background: "rgba(255, 255, 255, 0.9)",
    backdropFilter: "blur(16px)",
    borderBottom: "1px solid #e2e8f0",
    color: "#0f172a",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 24px",
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    position: "fixed",
    top: 0,
    left: 0,
    zIndex: 1000,
    boxSizing: "border-box",
    boxShadow: "0 2px 10px rgba(0, 0, 0, 0.03)",
  },
  left: { display: "flex", alignItems: "center", gap: "16px" },
  logoBadge: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  brandTitle: {
    fontWeight: "800",
    fontSize: "15px",
    letterSpacing: "2px",
    color: "#4f46e5",
  },
  round: {
    background: "rgba(79, 70, 229, 0.1)",
    border: "1px solid rgba(79, 70, 229, 0.25)",
    color: "#4338ca",
    padding: "4px 12px",
    borderRadius: "20px",
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "1px",
  },
  center: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  timerLabel: {
    fontSize: "9px",
    letterSpacing: "2px",
    color: "#64748b",
    fontWeight: "700",
  },
  time: {
    color: "#e11d48",
    fontWeight: "800",
    fontSize: "20px",
    fontFamily: "'JetBrains Mono', monospace",
    letterSpacing: "2px",
  },
  right: { display: "flex", alignItems: "center", gap: "20px" },
  scoreBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  scoreLabel: {
    fontSize: "9px",
    letterSpacing: "2px",
    color: "#64748b",
    fontWeight: "700",
  },
  score: {
    color: "#059669",
    fontWeight: "800",
    fontSize: "18px",
    fontFamily: "'JetBrains Mono', monospace",
  },
  relayMemberWidget: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    background: "#f1f5f9",
    padding: "6px 12px",
    borderRadius: "10px",
    border: "1px solid #cbd5e1",
  },
  memberTurnTimer: {
    fontFamily: "'JetBrains Mono', monospace",
    fontWeight: "800",
    fontSize: "15px",
    color: "#0284c7",
  },
};
