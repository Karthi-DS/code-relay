import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { socket, registerUser } from "../socket/leaderboard";
import { getUser } from "../services/auth";
import { fetchWithAuth } from "../services/api";
import ProfileDropdown from "../components/ProfileDropdown";

export default function AdminLeaderboard() {
  const navigate = useNavigate();
  const user = getUser();
  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    if (user.role !== "admin") {
      navigate("/");
      return;
    }

    registerUser(user.username, user.role);

    const fetchState = async () => {
      try {
        const data = await fetchWithAuth("/admin/state");
        setLeaderboard(data.leaderboard || []);
      } catch (err) {
        console.error("Failed to fetch state:", err);
      }
    };
    fetchState();

    socket.on("leaderboard:update", (lb) => {
      setLeaderboard(lb);
    });

    return () => {
      socket.off("leaderboard:update");
    };
  }, [navigate, user.role, user.username]);

  return (
    <div style={styles.container}>
      {/* Top Bar */}
      <div style={styles.topBar}>
        <div style={styles.topLeft}>
          <button onClick={() => navigate("/admin")} style={styles.backBtn}>
            ← ADMIN DASHBOARD
          </button>
          <div style={styles.logoBadge}>
            <span style={{ fontSize: "18px" }}>⚡</span>
            <span style={styles.logoText}>CODE <span style={{ color: "#38bdf8" }}>RELAY</span></span>
          </div>
        </div>
        <span className="badge-indigo">ADMIN RANKINGS AUDIT</span>
        <ProfileDropdown />
      </div>

      {/* Main Content */}
      <div style={styles.content}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <h1 style={styles.title}>CODE RELAY OFFICIAL STANDINGS</h1>
          <p style={styles.subtitle}>Verified Scores and Penalty Deductions Audit</p>
        </div>

        {/* Podium Display */}
        {leaderboard.length >= 2 && (
          <div style={styles.podium}>
            {/* Runner-up */}
            <div style={styles.podiumCard}>
              <div style={{ fontSize: "36px" }}>🥈</div>
              <div style={styles.podiumName}>{leaderboard[1]?.username}</div>
              <div style={styles.podiumScore2}>{leaderboard[1]?.total} PTS</div>
              <span className="badge-cyan" style={{ fontSize: "10px" }}>RUNNER-UP</span>
            </div>

            {/* Winner */}
            <div style={{ ...styles.podiumCard, ...styles.podiumWinner }}>
              <div style={{ fontSize: "48px" }}>🥇</div>
              <div style={{ ...styles.podiumName, color: "#facc15", fontSize: "18px" }}>
                {leaderboard[0]?.username}
              </div>
              <div style={styles.podiumScore1}>{leaderboard[0]?.total} PTS</div>
              <span className="badge-emerald" style={{ background: "rgba(234, 179, 8, 0.2)", color: "#facc15", borderColor: "rgba(234, 179, 8, 0.4)", fontSize: "10px" }}>EVENT WINNER</span>
            </div>

            {/* 3rd Place */}
            {leaderboard.length >= 3 && (
              <div style={styles.podiumCard}>
                <div style={{ fontSize: "32px" }}>🥉</div>
                <div style={styles.podiumName}>{leaderboard[2]?.username}</div>
                <div style={styles.podiumScore3}>{leaderboard[2]?.total} PTS</div>
                <span className="badge-indigo" style={{ fontSize: "10px" }}>3RD PLACE</span>
              </div>
            )}
          </div>
        )}

        {/* Full Table */}
        <div style={styles.tableWrapper}>
          <div style={styles.tableHeader}>
            <span style={{ width: "100px", textAlign: "center" }}>RANK</span>
            <span style={{ flex: 1 }}>COMPETITOR</span>
            <span style={{ width: "100px", textAlign: "center" }}>LEG 1</span>
            <span style={{ width: "100px", textAlign: "center" }}>LEG 2</span>
            <span style={{ width: "120px", textAlign: "right" }}>TOTAL PTS</span>
            <span style={{ width: "140px", textAlign: "center" }}>STATUS</span>
          </div>

          {leaderboard.length === 0 ? (
            <div style={styles.empty}>
              <p style={{ margin: 0 }}>No scores recorded yet</p>
            </div>
          ) : (
            leaderboard.map((entry) => (
              <div
                key={entry.username}
                style={{
                  ...styles.row,
                  background: entry.rank === 1 ? "rgba(234, 179, 8, 0.06)" : entry.rank === 2 ? "rgba(192, 192, 192, 0.06)" : "transparent",
                }}
              >
                <span style={{ width: "100px", textAlign: "center", fontWeight: "800", color: entry.rank <= 2 ? "#facc15" : "#94a3b8" }}>
                  #{entry.rank}
                </span>
                <span style={{ flex: 1, fontWeight: entry.rank <= 2 ? "700" : "500", color: "#f8fafc" }}>
                  {entry.username}
                </span>
                <span style={{ width: "100px", textAlign: "center", color: entry.round1 > 0 ? "#34d399" : "#64748b", fontFamily: "'JetBrains Mono', monospace" }}>
                  {entry.round1}
                </span>
                <span style={{ width: "100px", textAlign: "center", color: entry.round2 > 0 ? "#34d399" : "#64748b", fontFamily: "'JetBrains Mono', monospace" }}>
                  {entry.round2}
                </span>
                <span style={{ width: "120px", textAlign: "right", color: entry.rank <= 2 ? "#facc15" : "#38bdf8", fontWeight: "800", fontSize: "16px", fontFamily: "'JetBrains Mono', monospace" }}>
                  {entry.total}
                </span>
                <span style={{ width: "140px", textAlign: "center" }}>
                  {entry.rank === 1 && <span className="badge-emerald" style={{ background: "rgba(234, 179, 8, 0.2)", color: "#facc15" }}>🥇 WINNER</span>}
                  {entry.rank === 2 && <span className="badge-cyan">🥈 RUNNER-UP</span>}
                  {entry.rank > 2 && <span style={{ color: "#64748b", fontSize: "11px", fontWeight: "600" }}>PARTICIPANT</span>}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    backgroundColor: "#f8fafc",
    backgroundImage: "radial-gradient(circle at 50% 15%, rgba(79, 70, 229, 0.08) 0%, transparent 50%)",
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    display: "flex",
    flexDirection: "column",
  },
  topBar: {
    height: "64px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 24px",
    background: "rgba(255, 255, 255, 0.9)",
    backdropFilter: "blur(16px)",
    borderBottom: "1px solid #e2e8f0",
    flexShrink: 0,
  },
  topLeft: { display: "flex", alignItems: "center", gap: "16px" },
  backBtn: {
    background: "rgba(79, 70, 229, 0.08)",
    border: "1px solid rgba(79, 70, 229, 0.25)",
    color: "#4f46e5",
    padding: "6px 14px",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "700",
  },
  logoBadge: { display: "flex", alignItems: "center", gap: "8px" },
  logoText: {
    color: "#4f46e5",
    fontWeight: "800",
    letterSpacing: "2px",
    fontSize: "16px",
  },
  content: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "40px 24px",
    maxWidth: "950px",
    margin: "0 auto",
    width: "100%",
    boxSizing: "border-box",
  },
  title: {
    fontSize: "26px",
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: "2px",
    margin: 0,
  },
  subtitle: {
    color: "#475569",
    fontSize: "13px",
    marginTop: "6px",
  },
  podium: {
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-end",
    gap: "16px",
    width: "100%",
    marginBottom: "36px",
  },
  podiumCard: {
    flex: 1,
    maxWidth: "240px",
    background: "#ffffff",
    backdropFilter: "blur(16px)",
    borderRadius: "16px",
    border: "1px solid #e2e8f0",
    padding: "20px",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.04)",
  },
  podiumWinner: {
    border: "1px solid rgba(234, 179, 8, 0.4)",
    background: "rgba(234, 179, 8, 0.08)",
    transform: "scale(1.05)",
    boxShadow: "0 12px 40px rgba(234, 179, 8, 0.15)",
  },
  podiumName: {
    fontWeight: "700",
    fontSize: "15px",
    color: "#0f172a",
  },
  podiumScore1: {
    color: "#d97706",
    fontSize: "28px",
    fontWeight: "800",
    fontFamily: "'JetBrains Mono', monospace",
  },
  podiumScore2: {
    color: "#0284c7",
    fontSize: "22px",
    fontWeight: "800",
    fontFamily: "'JetBrains Mono', monospace",
  },
  podiumScore3: {
    color: "#4f46e5",
    fontSize: "20px",
    fontWeight: "800",
    fontFamily: "'JetBrains Mono', monospace",
  },
  tableWrapper: {
    width: "100%",
    background: "#ffffff",
    backdropFilter: "blur(16px)",
    border: "1px solid #e2e8f0",
    borderRadius: "16px",
    overflow: "hidden",
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.04)",
  },
  tableHeader: {
    display: "flex",
    padding: "16px 20px",
    borderBottom: "1px solid #e2e8f0",
    background: "#f8fafc",
    color: "#64748b",
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "1px",
  },
  row: {
    display: "flex",
    padding: "16px 20px",
    borderBottom: "1px solid #f1f5f9",
    alignItems: "center",
    fontSize: "14px",
    color: "#0f172a",
  },
  empty: {
    textAlign: "center",
    color: "#64748b",
    padding: "48px 20px",
  },
};
