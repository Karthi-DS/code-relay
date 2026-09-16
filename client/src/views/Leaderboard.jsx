import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { socket, registerUser } from "../socket/leaderboard";
import { getUser } from "../services/auth";
import { fetchWithAuth } from "../services/api";
import ProfileDropdown from "../components/ProfileDropdown";

export default function Leaderboard() {
  const navigate = useNavigate();
  const user = getUser();
  const [activeTab, setActiveTab] = useState("rankings"); // "rankings" | "timeline"

  const [leaderboard, setLeaderboard] = useState([]);
  const [mySubmissions, setMySubmissions] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [viewedCode, setViewedCode] = useState(null);

  // Sorting & Filtering State for Submission Timeline
  const [sortBy, setSortBy] = useState("time_desc"); // "time_desc", "time_asc", "score_desc", "score_asc", "team_asc", "title_asc"
  const [filterRound, setFilterRound] = useState("all");
  const [filterTeam, setFilterTeam] = useState("all");
  const [filterProblem, setFilterProblem] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const fetchMySubmissions = async () => {
    try {
      const data = await fetchWithAuth("/submit/my-submissions");
      setMySubmissions(data.submissions || []);
    } catch (err) {
      console.error("Failed to fetch my submissions:", err);
    }
  };

  const fetchTimeline = async () => {
    try {
      const data = await fetchWithAuth("/submit/timeline");
      setTimeline(data.timeline || []);
    } catch (err) {
      console.error("Failed to fetch submission timeline:", err);
    }
  };

  useEffect(() => {
    registerUser(user.username, user.role);

    socket.on("leaderboard:update", (data) => {
      setLeaderboard(data);
      fetchMySubmissions();
      fetchTimeline();
    });

    fetchMySubmissions();
    fetchTimeline();

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

  // Unique list of teams and questions for dropdown filters
  const uniqueTeams = Array.from(new Set(timeline.map((item) => item.teamName).filter(Boolean))).sort();
  const uniqueProblems = Array.from(new Set(timeline.map((item) => item.problemTitle).filter(Boolean))).sort();

  // Process timeline items based on search, filters, and sorting
  const processedTimeline = () => {
    let list = [...timeline];

    if (filterRound !== "all") {
      list = list.filter((item) => item.round === Number(filterRound));
    }

    if (filterTeam !== "all") {
      list = list.filter((item) => (item.teamName || "").toLowerCase() === filterTeam.toLowerCase());
    }

    if (filterProblem !== "all") {
      list = list.filter((item) => item.problemTitle === filterProblem || item.problemId === filterProblem);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(
        (item) =>
          (item.teamName && item.teamName.toLowerCase().includes(q)) ||
          (item.username && item.username.toLowerCase().includes(q)) ||
          (item.problemTitle && item.problemTitle.toLowerCase().includes(q)) ||
          (item.problemId && item.problemId.toLowerCase().includes(q))
      );
    }

    list.sort((a, b) => {
      if (sortBy === "time_desc") return b.timestamp - a.timestamp;
      if (sortBy === "time_asc") return a.timestamp - b.timestamp;
      if (sortBy === "score_desc") return b.score - a.score;
      if (sortBy === "score_asc") return a.score - b.score;
      if (sortBy === "team_asc") return (a.teamName || "").localeCompare(b.teamName || "");
      if (sortBy === "title_asc") return (a.problemTitle || "").localeCompare(b.problemTitle || "");
      return 0;
    });

    return list;
  };

  const formattedTime = (ts) => {
    if (!ts) return "—";
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) + " (" + date.toLocaleDateString() + ")";
  };

  const getRelativeTime = (ts) => {
    if (!ts) return "";
    const diffSec = Math.floor((Date.now() - ts) / 1000);
    if (diffSec < 10) return "Just now";
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    return `${diffHr}h ago`;
  };

  const filteredTimeline = processedTimeline();

  return (
    <div style={styles.container}>
      {/* Top Bar */}
      <div style={styles.topBar}>
        <div style={styles.logoBadge}>
          <span style={{ fontSize: "18px" }}>⚡</span>
          <span style={styles.logoText}>CODE <span style={{ color: "#38bdf8" }}>RELAY</span></span>
        </div>
        <span className="badge-indigo">LIVE ARENA LEADERBOARD</span>
        <ProfileDropdown />
      </div>

      {/* Main Content */}
      <div style={styles.content}>
        {/* Title */}
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <h1 style={styles.title}>CODE RELAY ARENA LEADERBOARD</h1>
          <p style={styles.subtitle}>Real-time rankings and submission timeline across all teams and questions</p>
        </div>

        {/* Tab Navigation Controls */}
        <div style={{ display: "flex", gap: "12px", marginBottom: "28px", width: "100%", justifyContent: "center" }}>
          <button
            onClick={() => setActiveTab("rankings")}
            style={{
              padding: "12px 28px",
              borderRadius: "12px",
              fontWeight: "800",
              fontSize: "13px",
              cursor: "pointer",
              border: activeTab === "rankings" ? "1px solid #4f46e5" : "1px solid #e2e8f0",
              background: activeTab === "rankings" ? "#4f46e5" : "#ffffff",
              color: activeTab === "rankings" ? "#ffffff" : "#64748b",
              boxShadow: activeTab === "rankings" ? "0 4px 16px rgba(79, 70, 229, 0.25)" : "0 2px 6px rgba(0,0,0,0.03)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span>🏆</span>
            <span>LIVE RANKINGS & SCORES</span>
          </button>

          <button
            onClick={() => setActiveTab("timeline")}
            style={{
              padding: "12px 28px",
              borderRadius: "12px",
              fontWeight: "800",
              fontSize: "13px",
              cursor: "pointer",
              border: activeTab === "timeline" ? "1px solid #0284c7" : "1px solid #e2e8f0",
              background: activeTab === "timeline" ? "#0284c7" : "#ffffff",
              color: activeTab === "timeline" ? "#ffffff" : "#64748b",
              boxShadow: activeTab === "timeline" ? "0 4px 16px rgba(2, 132, 199, 0.25)" : "0 2px 6px rgba(0,0,0,0.03)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span>⏱️</span>
            <span>SUBMISSION TIMELINE ({timeline.length})</span>
          </button>
        </div>

        {/* ─── TAB 1: LIVE RANKINGS ─── */}
        {activeTab === "rankings" && (
          <>
            {/* Top 3 Podium Cards */}
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

            {/* Full Leaderboard Table */}
            <div style={styles.tableWrapper}>
              <div style={styles.tableHeader}>
                <span style={{ width: "80px", textAlign: "center" }}>RANK</span>
                <span style={{ flex: 1 }}>COMPETITOR / TEAM</span>
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
                    <span style={{ flex: 1, fontWeight: entry.username === user.username ? "700" : "500", color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                      {entry.username}
                      {entry.username === user.username && <span className="badge-indigo" style={{ fontSize: "9px" }}>YOU</span>}
                    </span>
                    <span style={{ width: "100px", textAlign: "center", color: entry.round1 > 0 ? "#059669" : "#64748b", fontFamily: "'JetBrains Mono', monospace" }}>
                      {entry.round1}
                    </span>
                    <span style={{ width: "100px", textAlign: "center", color: entry.round2 > 0 ? "#059669" : "#64748b", fontFamily: "'JetBrains Mono', monospace" }}>
                      {entry.round2}
                    </span>
                    <span style={{ width: "120px", textAlign: "right", color: "#0284c7", fontWeight: "800", fontSize: "16px", fontFamily: "'JetBrains Mono', monospace" }}>
                      {entry.total}
                      {entry.violationPenalty > 0 && (
                        <span style={{ color: "#be123c", fontSize: "10px", display: "block" }}>(-{entry.violationPenalty} pts)</span>
                      )}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* My Submissions Section */}
            {mySubmissions.length > 0 && (
              <div style={styles.tableWrapper}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", fontWeight: "700", color: "#4f46e5", fontSize: "14px" }}>
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
                    <span style={{ width: "80px", color: "#4f46e5", fontWeight: "700" }}>LEG {sub.round}</span>
                    <span style={{ flex: 1 }}>
                      {sub.status === "pending" ? (
                        <span className="badge-amber">⏳ AWAITING EVALUATION</span>
                      ) : sub.status === "ai_pending" ? (
                        <span className="badge-cyan">🤖 AI EVALUATED (PENDING REVIEW)</span>
                      ) : (
                        <span className="badge-emerald">✓ EVALUATED & FINALIZED</span>
                      )}
                    </span>
                    <span style={{ width: "120px", textAlign: "center", color: "#059669", fontWeight: "800", fontFamily: "'JetBrains Mono', monospace" }}>
                      {sub.status !== "pending" ? `${sub.result?.finalScore || 0} PTS` : "—"}
                    </span>
                    <span style={{ width: "120px", textAlign: "right" }}>
                      <button onClick={() => setViewedCode(sub)} className="badge-indigo" style={{ cursor: "pointer" }}>VIEW CODE</button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ─── TAB 2: SUBMISSION TIMELINE ─── */}
        {activeTab === "timeline" && (
          <div style={{ width: "100%" }}>
            {/* Sorting & Filtering Toolbar */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "16px",
                padding: "20px",
                marginBottom: "24px",
                boxShadow: "0 4px 20px rgba(0, 0, 0, 0.04)",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                <div style={{ fontWeight: "800", color: "#0f172a", fontSize: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>🎛️ TIMELINE FILTERS & SORTING</span>
                  <span style={{ fontSize: "12px", color: "#64748b", fontWeight: "normal" }}>({filteredTimeline.length} entries shown)</span>
                </div>
                <button
                  onClick={fetchTimeline}
                  style={{
                    background: "#f1f5f9",
                    border: "1px solid #cbd5e1",
                    color: "#475569",
                    padding: "6px 14px",
                    borderRadius: "8px",
                    fontWeight: "700",
                    fontSize: "11px",
                    cursor: "pointer",
                  }}
                >
                  🔄 REFRESH TIMELINE
                </button>
              </div>

              {/* Filter Controls Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
                {/* Search Bar */}
                <div>
                  <label style={styles.filterLabel}>🔍 SEARCH</label>
                  <input
                    type="text"
                    placeholder="Search Team, User, Question..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={styles.filterSelect}
                  />
                </div>

                {/* Sort By Dropdown */}
                <div>
                  <label style={styles.filterLabel}>🔃 SORT BY</label>
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={styles.filterSelect}>
                    <option value="time_desc">⏱️ Submission Time (Newest First)</option>
                    <option value="time_asc">⏱️ Submission Time (Oldest First)</option>
                    <option value="score_desc">⭐ Score (Highest First)</option>
                    <option value="score_asc">⭐ Score (Lowest First)</option>
                    <option value="team_asc">👥 Team Name (A - Z)</option>
                    <option value="title_asc">📝 Question Title (A - Z)</option>
                  </select>
                </div>

                {/* Round / Leg Filter */}
                <div>
                  <label style={styles.filterLabel}>⚡ RELAY LEG</label>
                  <select value={filterRound} onChange={(e) => setFilterRound(e.target.value)} style={styles.filterSelect}>
                    <option value="all">All Relay Legs</option>
                    <option value="1">Leg 1</option>
                    <option value="2">Leg 2</option>
                  </select>
                </div>

                {/* Team Filter */}
                <div>
                  <label style={styles.filterLabel}>👥 TEAM</label>
                  <select value={filterTeam} onChange={(e) => setFilterTeam(e.target.value)} style={styles.filterSelect}>
                    <option value="all">All Teams</option>
                    {uniqueTeams.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                {/* Question Filter */}
                <div>
                  <label style={styles.filterLabel}>📚 QUESTION</label>
                  <select value={filterProblem} onChange={(e) => setFilterProblem(e.target.value)} style={styles.filterSelect}>
                    <option value="all">All Questions</option>
                    {uniqueProblems.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Timeline Feed Container */}
            <div style={styles.tableWrapper}>
              <div style={styles.tableHeader}>
                <span style={{ width: "160px" }}>SUBMISSION TIME</span>
                <span style={{ width: "140px" }}>TEAM / COMPETITOR</span>
                <span style={{ flex: 1 }}>QUESTION / PROBLEM</span>
                <span style={{ width: "100px", textAlign: "center" }}>LANG</span>
                <span style={{ width: "100px", textAlign: "center" }}>SCORE</span>
                <span style={{ width: "100px", textAlign: "right" }}>ACTION</span>
              </div>

              {filteredTimeline.length === 0 ? (
                <div style={styles.empty}>
                  <p style={{ margin: 0, fontWeight: "700" }}>No matching submissions found in timeline</p>
                  <p style={{ fontSize: "12px", color: "#64748b", marginTop: "6px" }}>
                    Try clearing your search query or adjusting your filters.
                  </p>
                </div>
              ) : (
                filteredTimeline.map((item, idx) => (
                  <div
                    key={item.submissionKey || item.id || idx}
                    style={{
                      ...styles.row,
                      background: item.username === user.username || item.teamName === user.teamName ? "rgba(2, 132, 199, 0.05)" : "transparent",
                    }}
                  >
                    {/* Timestamp */}
                    <div style={{ width: "160px", display: "flex", flexDirection: "column" }}>
                      <span style={{ color: "#0f172a", fontSize: "12px", fontWeight: "700", fontFamily: "'JetBrains Mono', monospace" }}>
                        {formattedTime(item.timestamp)}
                      </span>
                      <span style={{ color: "#0284c7", fontSize: "10px", fontWeight: "600" }}>
                        {getRelativeTime(item.timestamp)}
                      </span>
                    </div>

                    {/* Team & User */}
                    <div style={{ width: "140px", display: "flex", flexDirection: "column" }}>
                      <span style={{ color: "#4f46e5", fontWeight: "800", fontSize: "13px" }}>
                        👥 {item.teamName}
                      </span>
                      <span style={{ color: "#64748b", fontSize: "11px" }}>
                        👤 {item.username}
                      </span>
                    </div>

                    {/* Question / Problem */}
                    <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "8px" }}>
                      <span className="badge-indigo" style={{ fontSize: "9px" }}>LEG {item.round}</span>
                      <span style={{ color: "#0f172a", fontWeight: "700", fontSize: "13px" }}>
                        {item.problemTitle}
                      </span>
                    </div>

                    {/* Language */}
                    <div style={{ width: "100px", textAlign: "center" }}>
                      <span style={{ color: "#475569", fontSize: "11px", fontWeight: "700", textTransform: "uppercase" }}>
                        {item.language}
                      </span>
                    </div>

                    {/* Score */}
                    <div style={{ width: "100px", textAlign: "center" }}>
                      <span
                        style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontWeight: "800",
                          fontSize: "14px",
                          color: item.score >= 80 ? "#059669" : item.score > 0 ? "#d97706" : "#be123c",
                        }}
                      >
                        {item.score} PTS
                      </span>
                    </div>

                    {/* Action */}
                    <div style={{ width: "100px", textAlign: "right" }}>
                      <button
                        onClick={() => setViewedCode(item)}
                        className="badge-indigo"
                        style={{ cursor: "pointer", fontSize: "10px", padding: "4px 10px" }}
                      >
                        VIEW CODE
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Code View Modal */}
      {viewedCode && (
        <div style={styles.modalOverlay} onClick={() => setViewedCode(null)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={{ margin: 0, color: "#4f46e5", fontWeight: "800" }}>
                SUBMISSION CODE: {viewedCode.teamName?.toUpperCase() || viewedCode.username?.toUpperCase()} (LEG {viewedCode.round})
              </h3>
              <button onClick={() => setViewedCode(null)} style={styles.closeBtn}>✕</button>
            </div>

            <div style={{ padding: "20px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ color: "#0f172a", fontWeight: "800", fontSize: "15px" }}>
                  {viewedCode.problemTitle}
                </span>
                <span style={{ color: "#059669", fontSize: "16px", fontWeight: "800", fontFamily: "'JetBrains Mono', monospace" }}>
                  SCORE: {viewedCode.score} PTS
                </span>
              </div>

              <div style={{ display: "flex", gap: "12px", fontSize: "11px", color: "#64748b" }}>
                <span>👤 Submitted by: <strong>{viewedCode.username}</strong></span>
                <span>⏱️ Time: <strong>{formattedTime(viewedCode.timestamp)}</strong></span>
                <span>💻 Lang: <strong>{viewedCode.language?.toUpperCase()}</strong></span>
              </div>

              {viewedCode.result?.feedback && Array.isArray(viewedCode.result.feedback) && (
                <div style={{ marginTop: "12px", background: "#ffffff", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
                  <div style={{ fontSize: "11px", fontWeight: "700", color: "#475569", marginBottom: "4px" }}>FEEDBACK / RESULTS:</div>
                  {viewedCode.result.feedback.map((f, i) => (
                    <div key={i} style={{ color: "#334155", fontSize: "12px", margin: "2px 0" }}>{f}</div>
                  ))}
                </div>
              )}
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
    maxWidth: "1050px",
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
    alignItems: "center",
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
  filterLabel: {
    display: "block",
    color: "#475569",
    fontSize: "10px",
    fontWeight: "700",
    letterSpacing: "0.5px",
    marginBottom: "4px",
  },
  filterSelect: {
    width: "100%",
    padding: "8px 12px",
    background: "#ffffff",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    color: "#0f172a",
    fontSize: "12px",
    outline: "none",
    boxSizing: "border-box",
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
