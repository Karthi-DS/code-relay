import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { socket, registerUser } from "../socket/leaderboard";
import { getUser } from "../services/auth";
import { fetchWithAuth } from "../services/api";
import ProfileDropdown from "../components/ProfileDropdown";

export default function Leaderboard() {
  const navigate = useNavigate();
  const user = getUser();
  const [leaderboard, setLeaderboard] = useState([]);
  const [mySubmissions, setMySubmissions] = useState([]);
  const [viewedCode, setViewedCode] = useState(null);

  const fetchMySubmissions = async () => {
    try {
      const data = await fetchWithAuth("/submit/my-submissions");
      setMySubmissions(data.submissions || []);
    } catch (err) {
      console.error("Failed to fetch my submissions:", err);
    }
  };

  useEffect(() => {
    registerUser(user.username, user.role);

    socket.on("leaderboard:update", (data) => {
      setLeaderboard(data);
      fetchMySubmissions();
    });

    fetchMySubmissions();

    socket.on("user:removed", () => {
      localStorage.clear();
      navigate("/");
    });

    socket.on("round:start", (data) => {
      navigate(`/arena?round=${data.round}`);
    });

    return () => {
      socket.off("leaderboard:update");
      socket.off("user:removed");
      socket.off("round:start");
    };
  }, [navigate, user.username, user.role]);

  const top3 = leaderboard.slice(0, 3);
  const restLeaderboard = leaderboard.slice(3);

  return (
    <div style={styles.container}>
      {/* Top Bar */}
      <div style={styles.topBar}>
        <div style={styles.logoBadge}>
          <span style={{ fontSize: "18px" }}>⚡</span>
          <span style={styles.logoText}>CODE <span style={{ color: "#38bdf8" }}>RELAY</span></span>
        </div>
        <span className="badge-indigo">LIVE RANKINGS</span>
        <ProfileDropdown />
      </div>

      {/* Main Content */}
      <div style={styles.content}>
        {/* Title */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <h1 style={styles.title}>CODE RELAY LEADERBOARD</h1>
          <p style={styles.subtitle}>Real-time rankings based on Leg 1 and Leg 2 evaluations</p>
        </div>

        {/* ─── Top 3 Podium Cards ─── */}
        {top3.length > 0 && (
          <div style={styles.podiumGrid}>
            {/* 2nd Place */}
            {top3[1] && (
              <div style={{ ...styles.podiumCard, border: "1px solid rgba(192, 192, 192, 0.4)", transform: "scale(0.95)" }}>
                <div style={{ fontSize: "32px" }}>🥈</div>
                <div style={styles.podiumName}>{top3[1].username}</div>
                <span className="badge-cyan">RANK #2</span>
                <div style={styles.podiumScore}>{top3[1].total} PTS</div>
                <div style={styles.podiumBreakdown}>L1: {top3[1].round1} | L2: {top3[1].round2}</div>
              </div>
            )}

            {/* 1st Place */}
            {top3[0] && (
              <div style={{ ...styles.podiumCard, border: "1px solid rgba(234, 179, 8, 0.6)", background: "rgba(234, 179, 8, 0.08)", transform: "scale(1.05)", boxShadow: "0 12px 40px rgba(234, 179, 8, 0.2)" }}>
                <div style={{ fontSize: "40px" }}>🥇</div>
                <div style={{ ...styles.podiumName, color: "#facc15", fontSize: "18px" }}>{top3[0].username}</div>
                <span className="badge-emerald" style={{ background: "rgba(234, 179, 8, 0.2)", color: "#facc15", borderColor: "rgba(234, 179, 8, 0.4)" }}>CHAMPION #1</span>
                <div style={{ ...styles.podiumScore, color: "#facc15", fontSize: "28px" }}>{top3[0].total} PTS</div>
                <div style={styles.podiumBreakdown}>L1: {top3[0].round1} | L2: {top3[0].round2}</div>
              </div>
            )}

            {/* 3rd Place */}
            {top3[2] && (
              <div style={{ ...styles.podiumCard, border: "1px solid rgba(217, 119, 6, 0.4)", transform: "scale(0.95)" }}>
                <div style={{ fontSize: "32px" }}>🥉</div>
                <div style={styles.podiumName}>{top3[2].username}</div>
                <span className="badge-cyan">RANK #3</span>
                <div style={styles.podiumScore}>{top3[2].total} PTS</div>
                <div style={styles.podiumBreakdown}>L1: {top3[2].round1} | L2: {top3[2].round2}</div>
              </div>
            )}
          </div>
        )}

        {/* ─── Full Leaderboard Table ─── */}
        <div style={styles.tableWrapper}>
          <div style={styles.tableHeader}>
            <span style={{ width: "80px", textAlign: "center" }}>RANK</span>
            <span style={{ flex: 1 }}>COMPETITOR</span>
            <span style={{ width: "100px", textAlign: "center" }}>LEG 1</span>
            <span style={{ width: "100px", textAlign: "center" }}>LEG 2</span>
            <span style={{ width: "120px", textAlign: "right" }}>TOTAL PTS</span>
          </div>

          {leaderboard.length === 0 ? (
            <div style={styles.empty}>
              <p style={{ margin: 0, fontWeight: "700" }}>No scores recorded yet</p>
              <p style={{ fontSize: "12px", color: "#64748b", marginTop: "6px" }}>
                Scores will be published once relay legs are submitted and evaluated.
              </p>
            </div>
          ) : (
            (top3.length > 0 ? restLeaderboard : leaderboard).map((entry) => (
              <div
                key={entry.username}
                style={{
                  ...styles.row,
                  background: entry.username === user.username ? "rgba(99, 102, 241, 0.1)" : "transparent",
                  borderColor: entry.username === user.username ? "rgba(99, 102, 241, 0.3)" : "rgba(255, 255, 255, 0.05)",
                }}
              >
                <span style={{ width: "80px", textAlign: "center", fontWeight: "800", color: entry.rank <= 3 ? "#818cf8" : "#94a3b8" }}>
                  #{entry.rank}
                </span>
                <span style={{ flex: 1, fontWeight: entry.username === user.username ? "700" : "500", color: "#f8fafc", display: "flex", alignItems: "center", gap: "8px" }}>
                  {entry.username}
                  {entry.username === user.username && <span className="badge-indigo" style={{ fontSize: "9px" }}>YOU</span>}
                </span>
                <span style={{ width: "100px", textAlign: "center", color: entry.round1 > 0 ? "#34d399" : "#64748b", fontFamily: "'JetBrains Mono', monospace" }}>
                  {entry.round1}
                </span>
                <span style={{ width: "100px", textAlign: "center", color: entry.round2 > 0 ? "#34d399" : "#64748b", fontFamily: "'JetBrains Mono', monospace" }}>
                  {entry.round2}
                </span>
                <span style={{ width: "120px", textAlign: "right", color: "#38bdf8", fontWeight: "800", fontSize: "16px", fontFamily: "'JetBrains Mono', monospace" }}>
                  {entry.total}
                  {entry.violationPenalty > 0 && (
                    <span style={{ color: "#fb7185", fontSize: "10px", display: "block" }}>(-{entry.violationPenalty} pts)</span>
                  )}
                </span>
              </div>
            ))
          )}
        </div>

        {/* ─── My Submissions Section ─── */}
        {mySubmissions.length > 0 && (
          <div style={styles.tableWrapper}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", fontWeight: "700", color: "#818cf8", fontSize: "14px" }}>
              MY SUBMISSIONS & EVALUATION FEEDBACK
            </div>
            <div style={styles.tableHeader}>
              <span style={{ width: "80px" }}>LEG</span>
              <span style={{ flex: 1 }}>STATUS</span>
              <span style={{ width: "120px", textAlign: "center" }}>SCORE</span>
              <span style={{ width: "120px", textAlign: "right" }}>ACTION</span>
            </div>
            {mySubmissions.map((sub, idx) => (
              <div key={`mysub-${idx}`} style={styles.row}>
                <span style={{ width: "80px", color: "#818cf8", fontWeight: "700" }}>LEG {sub.round}</span>
                <span style={{ flex: 1 }}>
                  {sub.status === "pending" ? (
                    <span className="badge-amber">⏳ AWAITING EVALUATION</span>
                  ) : sub.status === "ai_pending" ? (
                    <span className="badge-cyan">🤖 AI EVALUATED (PENDING REVIEW)</span>
                  ) : (
                    <span className="badge-emerald">✓ EVALUATED & FINALIZED</span>
                  )}
                </span>
                <span style={{ width: "120px", textAlign: "center", color: "#34d399", fontWeight: "800", fontFamily: "'JetBrains Mono', monospace" }}>
                  {sub.status !== "pending" ? `${sub.result?.finalScore || 0} PTS` : "—"}
                </span>
                <span style={{ width: "120px", textAlign: "right" }}>
                  <button onClick={() => setViewedCode(sub)} className="badge-indigo" style={{ cursor: "pointer" }}>VIEW CODE</button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Code View Modal */}
      {viewedCode && (
        <div style={styles.modalOverlay} onClick={() => setViewedCode(null)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={{ margin: 0, color: "#4f46e5", fontWeight: "800" }}>
                MY LEG {viewedCode.round} CODE SUBMISSION
              </h3>
              <button onClick={() => setViewedCode(null)} style={styles.closeBtn}>✕</button>
            </div>

            <div style={{ padding: "20px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
              <div style={{ color: "#059669", fontSize: "16px", fontWeight: "800", marginBottom: "8px" }}>
                SCORE: {viewedCode.result?.finalScore || 0} / 100 PTS
              </div>
              {viewedCode.result?.feedback && viewedCode.result.feedback.map((f, i) => (
                <div key={i} style={{ color: "#334155", fontSize: "13px", margin: "4px 0" }}>{f}</div>
              ))}
            </div>

            <div style={{ padding: "20px", flex: 1, overflow: "auto" }}>
              <pre style={{ margin: 0, color: "#0f172a", fontFamily: "'JetBrains Mono', monospace", fontSize: "13px", whiteSpace: "pre-wrap" }}>
                {viewedCode.code}
              </pre>
            </div>
          </div>
        </div>
      )}
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
    maxWidth: "900px",
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
  podiumGrid: {
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
    border: "1px solid #e2e8f0",
    borderRadius: "16px",
    padding: "20px",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.04)",
    transition: "all 0.3s",
  },
  podiumName: {
    fontWeight: "700",
    fontSize: "15px",
    color: "#0f172a",
  },
  podiumScore: {
    fontSize: "22px",
    fontWeight: "800",
    color: "#0284c7",
    fontFamily: "'JetBrains Mono', monospace",
  },
  podiumBreakdown: {
    fontSize: "11px",
    color: "#64748b",
    fontWeight: "600",
  },
  tableWrapper: {
    width: "100%",
    background: "#ffffff",
    backdropFilter: "blur(16px)",
    border: "1px solid #e2e8f0",
    borderRadius: "16px",
    overflow: "hidden",
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.04)",
    marginBottom: "24px",
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
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.4)",
    backdropFilter: "blur(8px)",
    zIndex: 3000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
  },
  modalContent: {
    width: "100%",
    maxWidth: "800px",
    background: "#ffffff",
    border: "1px solid #cbd5e1",
    borderRadius: "16px",
    display: "flex",
    flexDirection: "column",
    maxHeight: "90vh",
    overflow: "hidden",
    boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
  },
  modalHeader: {
    padding: "20px",
    borderBottom: "1px solid #e2e8f0",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: "#0f172a",
    fontSize: "18px",
    cursor: "pointer",
  },
};
