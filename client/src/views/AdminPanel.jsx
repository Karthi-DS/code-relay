import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { socket, registerUser } from "../socket/leaderboard";
import { getUser } from "../services/auth";
import { fetchWithAuth } from "../services/api";
import ProfileDropdown from "../components/ProfileDropdown";
import { evaluateCodeLocally } from "../services/aiEvaluation";

export default function AdminPanel() {
  const navigate = useNavigate();
  const user = getUser();

  const [gameState, setGameState] = useState({
    currentRound: 0,
    roundStatus: "waiting",
    onlineUsers: [],
    leaderboard: [],
    removedUsers: [],
    violations: {},
    tabKicked: [],
  });
  const [loading, setLoading] = useState({});
  const [message, setMessage] = useState("");
  const [submissions, setSubmissions] = useState([]);
  const [viewedCode, setViewedCode] = useState(null);
  const [overrideScore, setOverrideScore] = useState("");
  const [manualFeedback, setManualFeedback] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterTeam, setFilterTeam] = useState("all");
  const [sortSubmissionsBy, setSortSubmissionsBy] = useState("newest");

  // ─── Problem & Solution Management State ───
  const [problems, setProblems] = useState([]);
  const [selectedRoundFilter, setSelectedRoundFilter] = useState(1);
  const [showProblemModal, setShowProblemModal] = useState(false);
  const [editingProblem, setEditingProblem] = useState(null);
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [sampleInputLines, setSampleInputLines] = useState([""]);

  // ─── Teams Management State ───
  const [teamsList, setTeamsList] = useState([]);

  // Problem form state
  const [probForm, setProbForm] = useState({
    id: "",
    round: 1,
    title: "",
    difficulty: "Easy",
    points: 100,
    timeLimit: 2000,
    description: "",
    solution: "",
    sampleInput: "",
    sampleOutput: "",
    testCases: [],
  });

  useEffect(() => {
    if (user.role !== "admin") {
      navigate("/");
      return;
    }

    registerUser(user.username, user.role);
    fetchState();
    fetchProblems();
    fetchTeamsList();

    socket.on("users:update", (users) => {
      setGameState((prev) => ({ ...prev, onlineUsers: users }));
      fetchTeamsList();
    });

    socket.on("leaderboard:update", (lb) => {
      setGameState((prev) => ({ ...prev, leaderboard: lb }));
    });

    socket.on("violation:update", ({ username, count, fullscreen, tabSwitch, type, kicked }) => {
      setGameState((prev) => ({
        ...prev,
        violations: { ...prev.violations, [username]: { count, fullscreen: fullscreen || 0, tabSwitch: tabSwitch || 0, kicked: kicked || false } },
      }));
    });

    socket.on("user:tab_kicked", ({ username, timestamp }) => {
      setGameState((prev) => ({
        ...prev,
        tabKicked: [...(prev.tabKicked || []), { username, timestamp }],
      }));
    });

    return () => {
      socket.off("users:update");
      socket.off("leaderboard:update");
      socket.off("violation:update");
      socket.off("user:tab_kicked");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, user.role, user.username]);

  const fetchTeamsList = async () => {
    try {
      const data = await fetchWithAuth("/admin/teams");
      if (data.teams) setTeamsList(data.teams);
    } catch (err) {
      console.error("Failed to fetch teams list:", err);
    }
  };

  const handleBlockTeam = async (teamName) => {
    if (!window.confirm(`Are you sure you want to block Team "${teamName}" and all its members from the arena?`)) return;
    try {
      const res = await fetchWithAuth("/admin/block-team", {
        method: "POST",
        body: JSON.stringify({ teamName }),
      });
      setMessage(res.message);
      fetchState();
      fetchTeamsList();
    } catch (err) {
      setMessage("Failed to block team: " + err.message);
    }
  };

  const handleUnblockTeam = async (teamName) => {
    try {
      const res = await fetchWithAuth("/admin/unblock-team", {
        method: "POST",
        body: JSON.stringify({ teamName }),
      });
      setMessage(res.message);
      fetchState();
      fetchTeamsList();
    } catch (err) {
      setMessage("Failed to unblock team: " + err.message);
    }
  };

  const fetchState = async () => {
    try {
      const data = await fetchWithAuth("/admin/state");
      setGameState(data);

      const subData = await fetchWithAuth("/admin/submissions");
      if (subData.submissions) setSubmissions(subData.submissions);
    } catch (err) {
      if (err.message.includes("Unauthorized")) {
        console.error("Session expired. Redirecting to login.");
        return;
      }
      console.error("Failed to fetch state:", err);
    }
  };

  const fetchProblems = async () => {
    try {
      const res = await fetchWithAuth("/admin/problems");
      if (res.problems) setProblems(res.problems);
    } catch (err) {
      console.error("Failed to fetch problems:", err);
    }
  };

  const showMessage = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(""), 3500);
  };

  const startRound = async (round) => {
    setLoading((prev) => ({ ...prev, [`start${round}`]: true }));
    try {
      await fetchWithAuth("/admin/start-round", {
        method: "POST",
        body: JSON.stringify({ round }),
      });
      showMessage(`Relay Leg ${round} started successfully!`);
      fetchState();
    } catch (err) {
      if (err.message.includes("Unauthorized")) {
        console.error("Session expired. Redirecting to login.");
        return;
      }
      showMessage(`Error: ${err.message}`);
    } finally {
      setLoading((prev) => ({ ...prev, [`start${round}`]: false }));
    }
  };

  const endRound = async () => {
    setLoading((prev) => ({ ...prev, endRound: true }));
    try {
      await fetchWithAuth("/admin/end-round", { method: "POST" });
      showMessage("Relay Leg ended!");
      fetchState();
    } catch (err) {
      showMessage(`Error: ${err.message}`);
    } finally {
      setLoading((prev) => ({ ...prev, endRound: false }));
    }
  };

  const removeUser = async (username) => {
    if (!window.confirm(`Remove ${username} from the event?`)) return;
    try {
      await fetchWithAuth("/admin/remove-user", {
        method: "POST",
        body: JSON.stringify({ username }),
      });
      showMessage(`${username} has been removed`);
      fetchState();
    } catch (err) {
      showMessage(`Error: ${err.message}`);
    }
  };

  // Reset Modal state
  const [showResetModal, setShowResetModal] = useState(false);

  const resetEvent = () => {
    setShowResetModal(true);
  };

  const handleExecuteReset = async (keepExistingData) => {
    setShowResetModal(false);
    try {
      const res = await fetchWithAuth("/admin/reset", {
        method: "POST",
        body: JSON.stringify({ keepExistingData }),
      });
      showMessage(res.message || "Event has been reset!");
      fetchState();
    } catch (err) {
      showMessage(`Error: ${err.message}`);
    }
  };

  // eslint-disable-next-line no-unused-vars
  const revokeKick = async (username) => {
    if (!window.confirm(`Revoke kick for ${username}? They will be able to rejoin.`)) return;
    try {
      await fetchWithAuth("/admin/revoke-kick", {
        method: "POST",
        body: JSON.stringify({ username }),
      });
      showMessage(`Kick revoked for ${username}. They can rejoin now.`);
      fetchState();
    } catch (err) {
      showMessage(`Error: ${err.message}`);
    }
  };

  const evaluateAll = async () => {
    setLoading((prev) => ({ ...prev, evaluate: true }));
    try {
      const subData = await fetchWithAuth("/admin/submissions");
      const pendingSubs = subData.submissions?.filter(s => s.status === "pending") || [];

      if (pendingSubs.length === 0) {
        showMessage("No pending submissions to evaluate.");
        setLoading((prev) => ({ ...prev, evaluate: false }));
        return;
      }

      showMessage(`Evaluating ${pendingSubs.length} submissions locally...`);

      const results = [];
      let encounteredError = null;

      for (const sub of pendingSubs) {
        try {
          const problem = sub.problem || { description: "Solve the problem." };
          const scoring = await evaluateCodeLocally(sub.code, sub.language, problem);
          results.push({
            submissionKey: sub.submissionKey,
            scoring
          });
        } catch (err) {
          console.error(`Failed to evaluate ${sub.username}:`, err);
          encounteredError = err;
        }
      }

      if (encounteredError && results.length < pendingSubs.length) {
        alert(`Warning: Failed to evaluate some submissions:\n\n${encounteredError.message}\n\nMake sure Ollama is running: ollama serve && ollama run qwen2.5:7b-instruct`);
      }

      const res = await fetchWithAuth("/admin/save-evaluations", {
        method: "POST",
        body: JSON.stringify({ results })
      });

      showMessage(res.message);
      fetchState();
    } catch (err) {
      showMessage(`Error: ${err.message}`);
    } finally {
      setLoading((prev) => ({ ...prev, evaluate: false }));
    }
  };

  // eslint-disable-next-line no-unused-vars
  const approveEvaluation = async (submissionKey, finalScore) => {
    setLoading((prev) => ({ ...prev, [`approve_${submissionKey}`]: true }));
    try {
      const res = await fetchWithAuth("/admin/approve-evaluation", {
        method: "POST",
        body: JSON.stringify({ submissionKey, finalScore }),
      });
      showMessage(res.message);
      setViewedCode(null);
      fetchState();
    } catch (err) {
      showMessage(`Error: ${err.message}`);
    } finally {
      setLoading((prev) => ({ ...prev, [`approve_${submissionKey}`]: false }));
    }
  };

  const manualEvaluate = async (submissionKey, score, feedback) => {
    setLoading((prev) => ({ ...prev, [`manual_${submissionKey}`]: true }));
    try {
      const res = await fetchWithAuth("/admin/manual-evaluate", {
        method: "POST",
        body: JSON.stringify({ submissionKey, score, feedback }),
      });
      showMessage(res.message);
      setViewedCode(null);
      setOverrideScore("");
      setManualFeedback("");
      fetchState();
    } catch (err) {
      showMessage(`Error: ${err.message}`);
    } finally {
      setLoading((prev) => ({ ...prev, [`manual_${submissionKey}`]: false }));
    }
  };

  // eslint-disable-next-line no-unused-vars
  const evaluateOne = async (sub) => {
    const key = sub.submissionKey;
    setLoading((prev) => ({ ...prev, [`aiOne_${key}`]: true }));
    try {
      const res = await fetchWithAuth("/admin/evaluate-one", {
        method: "POST",
        body: JSON.stringify({ submissionKey: key }),
      });
      showMessage(res.message);
      const subData = await fetchWithAuth("/admin/submissions");
      if (subData.submissions) {
        setSubmissions(subData.submissions);
        const updated = subData.submissions.find(s => s.submissionKey === key);
        if (updated) setViewedCode(updated);
      }
    } catch (err) {
      showMessage(`Error: ${err.message}`);
    } finally {
      setLoading((prev) => ({ ...prev, [`aiOne_${key}`]: false }));
    }
  };

  // Sample Input line helpers
  const addSampleInputLine = () => {
    setSampleInputLines((prev) => [...prev, ""]);
  };

  const removeSampleInputLine = (idx) => {
    setSampleInputLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateSampleInputLine = (idx, value) => {
    setSampleInputLines((prev) => {
      const updated = [...prev];
      updated[idx] = value;
      return updated;
    });
  };

  // Test case input line helpers
  const addTestCaseInputLine = (tcIdx) => {
    setProbForm((prev) => {
      const updated = [...prev.testCases];
      const lines = (updated[tcIdx].input !== undefined && updated[tcIdx].input !== null)
        ? String(updated[tcIdx].input).split("\n")
        : [""];
      lines.push("");
      updated[tcIdx] = { ...updated[tcIdx], input: lines.join("\n") };
      return { ...prev, testCases: updated };
    });
  };

  const removeTestCaseInputLine = (tcIdx, lineIdx) => {
    setProbForm((prev) => {
      const updated = [...prev.testCases];
      const lines = (updated[tcIdx].input !== undefined && updated[tcIdx].input !== null)
        ? String(updated[tcIdx].input).split("\n").filter((_, i) => i !== lineIdx)
        : [""];
      updated[tcIdx] = { ...updated[tcIdx], input: lines.join("\n") };
      return { ...prev, testCases: updated };
    });
  };

  const updateTestCaseInputLine = (tcIdx, lineIdx, val) => {
    setProbForm((prev) => {
      const updated = [...prev.testCases];
      const lines = (updated[tcIdx].input !== undefined && updated[tcIdx].input !== null)
        ? String(updated[tcIdx].input).split("\n")
        : [""];
      lines[lineIdx] = val;
      updated[tcIdx] = { ...updated[tcIdx], input: lines.join("\n") };
      return { ...prev, testCases: updated };
    });
  };

  // Problem management modal handlers
  const openNewProblemModal = (round = 1) => {
    setEditingProblem(null);
    setSampleInputLines([""]);
    setProbForm({
      id: `r${round}p_${Date.now().toString().slice(-4)}`,
      round: round,
      title: "",
      difficulty: "Easy",
      points: 100,
      timeLimit: 2000,
      description: "",
      solution: "",
      sampleInput: "",
      sampleOutput: "",
      testCases: [{ input: "", expectedOutput: "", isSample: false }],
      starterCode: {
        python: "def solution():\n    pass\n",
        java: "public class Solution {\n    public void solution() {\n        \n    }\n}\n",
        c: "#include <stdio.h>\n\nvoid solution() {\n    \n}\n",
      },
    });
    setShowProblemModal(true);
  };

  const openEditProblemModal = (p) => {
    setEditingProblem(p.id);
    const sample = p.sampleTestCase || p.sample_test_case || {};
    const sampleInStr = (sample.input !== undefined && sample.input !== null) ? String(sample.input) : "";
    const sampleOutStr = (sample.output !== undefined && sample.output !== null) ? String(sample.output) : (sample.expectedOutput !== undefined && sample.expectedOutput !== null ? String(sample.expectedOutput) : "");
    const sc = p.starterCode || p.starter_code || {};

    const formattedTestCases = (p.testCases && p.testCases.length > 0)
      ? p.testCases.map(tc => ({
          ...tc,
          input: tc.input !== undefined && tc.input !== null ? String(tc.input) : "",
          expectedOutput: tc.expectedOutput !== undefined && tc.expectedOutput !== null ? String(tc.expectedOutput) : (tc.output !== undefined && tc.output !== null ? String(tc.output) : ""),
        }))
      : [{ input: "", expectedOutput: "", isSample: false }];

    setSampleInputLines(sampleInStr ? sampleInStr.split("\n") : [""]);
    setProbForm({
      id: p.id,
      round: p.round,
      title: p.title,
      difficulty: p.difficulty || "Easy",
      points: p.points || 100,
      timeLimit: p.timeLimit || p.time_limit || 2000,
      description: p.description || "",
      solution: p.solution || "",
      sampleInput: sampleInStr,
      sampleOutput: sampleOutStr,
      testCases: formattedTestCases,
      starterCode: {
        python: sc.python || "",
        java: sc.java || "",
        c: sc.c || "",
      },
    });
    setShowProblemModal(true);
  };

  const handleSaveProblem = async (e) => {
    e.preventDefault();
    if (!probForm.title || !probForm.description) {
      alert("Title and description are required!");
      return;
    }

    try {
      const sampleInputStr = sampleInputLines.join("\n");
      const payload = {
        id: probForm.id,
        round: probForm.round,
        title: probForm.title,
        difficulty: probForm.difficulty,
        points: probForm.points,
        timeLimit: probForm.timeLimit,
        description: probForm.description,
        solution: probForm.solution,
        sampleTestCase: sampleInputStr.trim() ? { input: sampleInputStr, output: probForm.sampleOutput } : null,
        testCases: probForm.testCases.filter(tc => tc.input || tc.expectedOutput),
        starterCode: probForm.starterCode || {},
      };

      const url = editingProblem ? `/admin/problems/${editingProblem}` : "/admin/problems";
      const method = editingProblem ? "PUT" : "POST";

      const res = await fetchWithAuth(url, {
        method,
        body: JSON.stringify(payload),
      });

      showMessage(res.message);
      setShowProblemModal(false);
      fetchProblems();
    } catch (err) {
      alert(`Error saving problem: ${err.message}`);
    }
  };

  const handleDeleteProblem = async (problemId) => {
    if (!window.confirm(`Delete problem ${problemId}?`)) return;
    try {
      const res = await fetchWithAuth(`/admin/problems/${problemId}`, { method: "DELETE" });
      showMessage(res.message);
      fetchProblems();
    } catch (err) {
      alert(`Error deleting problem: ${err.message}`);
    }
  };

  const handleBulkUploadJson = async () => {
    try {
      let parsed;
      try {
        parsed = JSON.parse(jsonText);
      } catch (e) {
        alert("Invalid JSON format. Please check your syntax.");
        return;
      }

      const res = await fetchWithAuth("/admin/problems/upload-json", {
        method: "POST",
        body: JSON.stringify(parsed),
      });

      showMessage(res.message);
      setShowJsonModal(false);
      setJsonText("");
      fetchProblems();
    } catch (err) {
      alert(`Upload failed: ${err.message}`);
    }
  };

  const addTestCaseField = () => {
    setProbForm(prev => ({
      ...prev,
      testCases: [...prev.testCases, { input: "", expectedOutput: "", isSample: false }]
    }));
  };

  const removeTestCaseField = (idx) => {
    setProbForm(prev => ({
      ...prev,
      testCases: prev.testCases.filter((_, i) => i !== idx)
    }));
  };

  const updateTestCaseField = (idx, field, val) => {
    setProbForm(prev => {
      const updated = [...prev.testCases];
      updated[idx] = { ...updated[idx], [field]: val };
      return { ...prev, testCases: updated };
    });
  };

  return (
    <div style={styles.container}>
      {/* Top Bar */}
      <div style={styles.topBar}>
        <div style={styles.logoBadge}>
          <span style={{ fontSize: "18px" }}>⚡</span>
          <span style={styles.logoText}>CODE <span style={{ color: "#38bdf8" }}>RELAY</span></span>
        </div>
        <span className="badge-rose">⚡ ADMIN CONTROL CENTER</span>
        <ProfileDropdown />
      </div>

      {/* Toast Message */}
      {message && <div style={styles.toast}>{message}</div>}

      <div style={styles.content}>
        {/* ─── Event Status ─── */}
        <div style={styles.glassCard}>
          <h3 style={styles.cardSectionTitle}>RELAY STATUS DASHBOARD</h3>
          <div style={styles.statusGrid}>
            <div style={styles.statusTile}>
              <span style={styles.statusLabel}>CURRENT LEG</span>
              <span style={styles.statusValue}>{gameState.currentRound || "—"}</span>
            </div>
            <div style={styles.statusTile}>
              <span style={styles.statusLabel}>STATUS</span>
              <span
                style={{
                  ...styles.statusValue,
                  color: gameState.roundStatus === "active" ? "#34d399" : gameState.roundStatus === "ended" ? "#fbbf24" : "#94a3b8",
                  fontSize: "20px",
                }}
              >
                ● {gameState.roundStatus.toUpperCase()}
              </span>
            </div>
            <div style={styles.statusTile}>
              <span style={styles.statusLabel}>ACTIVE COMPETITORS</span>
              <span style={{ ...styles.statusValue, color: "#38bdf8" }}>
                {gameState.onlineUsers.length}
              </span>
            </div>
          </div>
        </div>

        {/* ─── Controls ─── */}
        <div style={styles.glassCard}>
          <h3 style={styles.cardSectionTitle}>RELAY LEG CONTROLS</h3>
          <div style={styles.controlGrid}>
            <button
              onClick={() => startRound(1)}
              disabled={gameState.roundStatus === "active"}
              style={{ ...styles.controlBtn, ...styles.indigoBtn }}
            >
              ▶ START LEG 1
            </button>
            <button
              onClick={() => startRound(2)}
              disabled={gameState.roundStatus === "active" || gameState.currentRound < 1}
              style={{ ...styles.controlBtn, ...styles.cyanBtn }}
            >
              ▶ START LEG 2
            </button>
            <button
              onClick={endRound}
              disabled={gameState.roundStatus !== "active"}
              style={{ ...styles.controlBtn, ...styles.amberBtn }}
            >
              ■ END CURRENT LEG
            </button>
            <button
              onClick={resetEvent}
              style={{ ...styles.controlBtn, ...styles.roseBtn }}
            >
              ⟲ RESET ENTIRE EVENT
            </button>
            <button
              onClick={evaluateAll}
              style={{ ...styles.controlBtn, ...styles.emeraldBtn }}
            >
              {loading.evaluate ? "EVALUATING..." : "🤖 AI EVALUATE ALL PENDING"}
            </button>
          </div>

          {/* Ollama Config */}
          <div style={styles.ollamaBox}>
            <div style={{ color: "#818cf8", fontSize: "11px", fontWeight: "700", marginBottom: "10px" }}>🦙 LOCAL AI OLLAMA CONFIG</div>
            <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
              <input
                type="text"
                placeholder="URL (default: http://localhost:11434)"
                defaultValue={localStorage.getItem("OLLAMA_URL") || ""}
                style={styles.formInput}
                onChange={(e) => {
                  if (e.target.value) localStorage.setItem("OLLAMA_URL", e.target.value);
                  else localStorage.removeItem("OLLAMA_URL");
                }}
              />
              <input
                type="text"
                placeholder="Model (default: qwen2.5:7b-instruct)"
                defaultValue={localStorage.getItem("OLLAMA_MODEL") || ""}
                style={styles.formInput}
                onChange={(e) => {
                  if (e.target.value) localStorage.setItem("OLLAMA_MODEL", e.target.value);
                  else localStorage.removeItem("OLLAMA_MODEL");
                }}
              />
            </div>
          </div>
        </div>

        {/* ─── Problem & Solution & Test Case Management Section ─── */}
        <div style={{ ...styles.glassCard, border: "1px solid rgba(99, 102, 241, 0.4)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h3 style={{ ...styles.cardSectionTitle, color: "#818cf8", margin: 0 }}>
                📚 PROBLEM, SOLUTION & TEST CASE MANAGER
              </h3>
              <p style={{ color: "#94a3b8", fontSize: "12px", margin: "4px 0 0 0" }}>
                Stored in PostgreSQL Database
              </p>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => openNewProblemModal(selectedRoundFilter)}
                style={{ ...styles.controlBtn, ...styles.indigoBtn, padding: "8px 16px", fontSize: "11px" }}
              >
                + ADD PROBLEM
              </button>
              <button
                onClick={() => setShowJsonModal(true)}
                style={{ ...styles.controlBtn, ...styles.cyanBtn, padding: "8px 16px", fontSize: "11px" }}
              >
                📤 BULK IMPORT JSON
              </button>
            </div>
          </div>

          {/* Round Filter Tabs */}
          <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
            <button
              onClick={() => setSelectedRoundFilter(1)}
              className={selectedRoundFilter === 1 ? "badge-indigo" : ""}
              style={{
                padding: "8px 20px",
                background: selectedRoundFilter === 1 ? "rgba(99, 102, 241, 0.25)" : "transparent",
                border: `1px solid ${selectedRoundFilter === 1 ? "#6366f1" : "rgba(255, 255, 255, 0.1)"}`,
                color: selectedRoundFilter === 1 ? "#a5b4fc" : "#64748b",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "700",
                fontSize: "12px",
              }}
            >
              LEG 1 PROBLEMS ({problems.filter(p => p.round === 1).length})
            </button>
            <button
              onClick={() => setSelectedRoundFilter(2)}
              className={selectedRoundFilter === 2 ? "badge-indigo" : ""}
              style={{
                padding: "8px 20px",
                background: selectedRoundFilter === 2 ? "rgba(99, 102, 241, 0.25)" : "transparent",
                border: `1px solid ${selectedRoundFilter === 2 ? "#6366f1" : "rgba(255, 255, 255, 0.1)"}`,
                color: selectedRoundFilter === 2 ? "#a5b4fc" : "#64748b",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "700",
                fontSize: "12px",
              }}
            >
              LEG 2 PROBLEMS ({problems.filter(p => p.round === 2).length})
            </button>
          </div>

          {/* Problem List */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {problems.filter(p => p.round === selectedRoundFilter).length === 0 ? (
              <p style={styles.emptyText}>No problems configured for Leg {selectedRoundFilter} in PostgreSQL yet.</p>
            ) : (
              problems.filter(p => p.round === selectedRoundFilter).map((p) => (
                <div key={p.id} style={styles.problemCard}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                      <span style={{ color: "#f8fafc", fontWeight: "700", fontSize: "16px" }}>{p.title}</span>
                      <span className="badge-indigo" style={{ fontSize: "10px" }}>ID: {p.id}</span>
                      <span className="badge-cyan" style={{ fontSize: "10px" }}>{p.difficulty}</span>
                      <span className="badge-emerald" style={{ fontSize: "10px" }}>{p.points || 100} PTS</span>
                    </div>

                    <div style={{ color: "#cbd5e1", fontSize: "13px", lineHeight: "1.6", maxHeight: "80px", overflow: "hidden", textOverflow: "ellipsis", marginBottom: "10px" }}>
                      {p.description}
                    </div>

                    <div style={{ display: "flex", gap: "16px", fontSize: "11px", color: "#94a3b8", flexWrap: "wrap" }}>
                      <span>💡 Solution: {p.solution ? "Available ✅" : "None ❌"}</span>
                      <span>🧪 Test Cases: {(p.testCases || []).filter(tc => !tc.isSample).length} Hidden | {(p.testCases || []).filter(tc => tc.isSample).length + (p.sampleTestCase ? 1 : 0)} Sample</span>
                      <span>
                        💻 Starter Code: {
                          (p.starterCode || p.starter_code) ? (
                            <>
                              {(p.starterCode || p.starter_code).python ? "PY ✅ " : "PY ❌ "}
                              {(p.starterCode || p.starter_code).java ? "JAVA ✅ " : "JAVA ❌ "}
                              {(p.starterCode || p.starter_code).c ? "C ✅" : "C ❌"}
                            </>
                          ) : "Default Stubs"
                        }
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={() => openEditProblemModal(p)} style={styles.editBtn}>✏️ EDIT</button>
                    <button onClick={() => handleDeleteProblem(p.id)} style={styles.deleteBtn}>🗑️ DELETE</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ─── Bottom Grid: Users + Leaderboard ─── */}
        <div style={styles.bottomGrid}>
          {/* Online Users */}
          <div style={styles.glassCard}>
            <h3 style={styles.cardSectionTitle}>ONLINE COMPETITORS ({gameState.onlineUsers.length})</h3>
            <div style={styles.list}>
              {gameState.onlineUsers.length === 0 ? (
                <p style={styles.emptyText}>No competitors online</p>
              ) : (
                gameState.onlineUsers.map((u) => (
                  <div key={u} style={styles.userRow}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={styles.userDot} />
                      <span style={{ color: "#0f172a", fontSize: "14px", fontWeight: "600" }}>{u}</span>
                    </div>
                    <button onClick={() => removeUser(u)} style={styles.deleteBtn}>REMOVE</button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Leaderboard */}
          <div style={styles.glassCard}>
            <h3 style={styles.cardSectionTitle}>LIVE LEADERBOARD SUMMARY</h3>
            <div style={styles.list}>
              {gameState.leaderboard.length === 0 ? (
                <p style={styles.emptyText}>No scores recorded yet</p>
              ) : (
                <>
                  {gameState.leaderboard.slice(0, 5).map((entry) => (
                    <div key={entry.username} style={styles.lbRow}>
                      <span style={{ color: "#4f46e5", fontWeight: "800", width: "36px" }}>#{entry.rank}</span>
                      <span style={{ color: "#0f172a", flex: 1, fontWeight: "600" }}>{entry.username}</span>
                      <span style={{ color: "#0284c7", fontWeight: "800", fontFamily: "'JetBrains Mono', monospace" }}>{entry.total} PTS</span>
                    </div>
                  ))}
                  <button onClick={() => navigate("/admin/leaderboard")} style={styles.indigoBtn}>
                    VIEW FULL LEADERBOARD →
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ─── Registered Teams & Arena Blocking ─── */}
        <div style={styles.glassCard}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
            <h3 style={{ ...styles.cardSectionTitle, margin: 0 }}>REGISTERED TEAMS & ARENA BLOCKING ({teamsList.length})</h3>
            <button onClick={fetchTeamsList} style={styles.editBtn}>🔄 REFRESH TEAMS</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
            {teamsList.length === 0 ? (
              <p style={styles.emptyText}>No teams registered yet.</p>
            ) : (
              teamsList.map((t) => (
                <div
                  key={t.id || t.teamName}
                  style={{
                    background: t.isBlocked ? "#ffe4e6" : "#f8fafc",
                    border: t.isBlocked ? "1px solid #fecdd3" : "1px solid #e2e8f0",
                    borderRadius: "10px",
                    padding: "16px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: "12px",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <span style={{ color: "#0f172a", fontWeight: "800", fontSize: "15px" }}>👥 {t.teamName}</span>
                      <span className={t.memberCount >= 2 ? "badge-indigo" : "badge-cyan"}>
                        {t.memberCount}/2 MEMBERS
                      </span>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "4px", margin: "8px 0" }}>
                      {t.members.length === 0 ? (
                        <span style={{ color: "#64748b", fontSize: "12px" }}>No members registered yet</span>
                      ) : (
                        t.members.map((m) => (
                          <div key={m.userId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "12px" }}>
                            <span style={{ color: m.isBlocked ? "#9f1239" : "#334155", fontWeight: "600" }}>
                              👤 {m.username} {m.isBlocked ? "(BLOCKED ⛔)" : ""}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div>
                    {t.isBlocked || t.hasBlockedMember ? (
                      <button
                        onClick={() => handleUnblockTeam(t.teamName)}
                        style={{
                          width: "100%",
                          padding: "8px",
                          background: "#d1fae5",
                          border: "1px solid #a7f3d0",
                          color: "#065f46",
                          fontWeight: "700",
                          fontSize: "11px",
                          borderRadius: "6px",
                          cursor: "pointer",
                        }}
                      >
                        ✅ UNBLOCK TEAM
                      </button>
                    ) : (
                      <button
                        onClick={() => handleBlockTeam(t.teamName)}
                        style={{
                          width: "100%",
                          padding: "8px",
                          background: "#ffe4e6",
                          border: "1px solid #fecdd3",
                          color: "#9f1239",
                          fontWeight: "700",
                          fontSize: "11px",
                          borderRadius: "6px",
                          cursor: "pointer",
                        }}
                      >
                        ⛔ BLOCK TEAM FROM ARENA
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ─── Submissions Panel ─── */}
        {(() => {
          const uniqueSubmissionTeams = Array.from(
            new Set([
              ...teamsList.map((t) => t.teamName).filter(Boolean),
              ...submissions.map((s) => s.teamName).filter(Boolean),
            ])
          ).sort();

          const processedSubmissions = () => {
            let list = [...submissions];

            if (filterStatus !== "all") {
              list = list.filter((s) => s.status === filterStatus);
            }

            if (filterTeam !== "all") {
              list = list.filter((s) => (s.teamName || "").toLowerCase() === filterTeam.toLowerCase());
            }

            list.sort((a, b) => {
              if (sortSubmissionsBy === "newest") return (b.timestamp || 0) - (a.timestamp || 0);
              if (sortSubmissionsBy === "oldest") return (a.timestamp || 0) - (b.timestamp || 0);
              if (sortSubmissionsBy === "team_asc") return (a.teamName || "").localeCompare(b.teamName || "");
              if (sortSubmissionsBy === "team_desc") return (b.teamName || "").localeCompare(a.teamName || "");
              if (sortSubmissionsBy === "score_desc") {
                const scoreA = Number(a.result?.finalScore ?? a.result?.score ?? 0);
                const scoreB = Number(b.result?.finalScore ?? b.result?.score ?? 0);
                return scoreB - scoreA;
              }
              return 0;
            });

            return list;
          };

          const displaySubs = processedSubmissions();

          return (
            <div style={styles.glassCard}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <h3 style={{ ...styles.cardSectionTitle, margin: 0 }}>SUBMISSIONS & TIMELINE ({displaySubs.length})</h3>
                  <button
                    onClick={fetchState}
                    style={{
                      background: "rgba(99, 102, 241, 0.15)",
                      border: "1px solid rgba(99, 102, 241, 0.4)",
                      color: "#818cf8",
                      padding: "4px 10px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      fontWeight: "700",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                    title="Refresh Submissions"
                  >
                    🔄 REFRESH
                  </button>
                </div>

                <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                  {/* Team Filter Dropdown */}
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <label style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "700" }}>TEAM:</label>
                    <select
                      value={filterTeam}
                      onChange={(e) => setFilterTeam(e.target.value)}
                      style={{
                        background: "rgba(15, 23, 42, 0.6)",
                        border: "1px solid rgba(255, 255, 255, 0.15)",
                        color: "#f8fafc",
                        padding: "5px 10px",
                        borderRadius: "6px",
                        fontSize: "11px",
                        fontWeight: "600",
                        cursor: "pointer",
                      }}
                    >
                      <option value="all" style={{ background: "#0f172a" }}>👥 All Teams</option>
                      {uniqueSubmissionTeams.map((t) => (
                        <option key={t} value={t} style={{ background: "#0f172a" }}>
                          👥 {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Sort Dropdown */}
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <label style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "700" }}>SORT BY:</label>
                    <select
                      value={sortSubmissionsBy}
                      onChange={(e) => setSortSubmissionsBy(e.target.value)}
                      style={{
                        background: "rgba(15, 23, 42, 0.6)",
                        border: "1px solid rgba(255, 255, 255, 0.15)",
                        color: "#f8fafc",
                        padding: "5px 10px",
                        borderRadius: "6px",
                        fontSize: "11px",
                        fontWeight: "600",
                        cursor: "pointer",
                      }}
                    >
                      <option value="newest" style={{ background: "#0f172a" }}>⏱️ Newest First</option>
                      <option value="oldest" style={{ background: "#0f172a" }}>⏱️ Oldest First</option>
                      <option value="team_asc" style={{ background: "#0f172a" }}>👥 Team Name (A - Z)</option>
                      <option value="team_desc" style={{ background: "#0f172a" }}>👥 Team Name (Z - A)</option>
                      <option value="score_desc" style={{ background: "#0f172a" }}>⭐ Highest Score</option>
                    </select>
                  </div>

                  {/* Status Filter Buttons */}
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {[
                      { key: "all",       label: "ALL",      cls: "badge-indigo" },
                      { key: "pending",   label: "⏳ PENDING", cls: "badge-amber" },
                      { key: "ai_pending",label: "🟡 REVIEW",  cls: "badge-cyan" },
                      { key: "evaluated", label: "🟢 DONE",    cls: "badge-emerald" },
                    ].map(({ key, label, cls }) => (
                      <button
                        key={key}
                        onClick={() => setFilterStatus(key)}
                        className={filterStatus === key ? cls : ""}
                        style={{
                          padding: "4px 12px",
                          background: filterStatus === key ? "rgba(99, 102, 241, 0.2)" : "transparent",
                          border: `1px solid ${filterStatus === key ? "#6366f1" : "rgba(255, 255, 255, 0.1)"}`,
                          color: filterStatus === key ? "#f8fafc" : "#64748b",
                          borderRadius: "6px",
                          fontSize: "11px",
                          cursor: "pointer",
                          fontWeight: "600",
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div style={styles.list}>
                {displaySubs.length === 0 ? (
                  <p style={styles.emptyText}>No submissions found matching selected filters.</p>
                ) : (
                  displaySubs.map((sub, idx) => (
                    <div key={sub.submissionKey || idx} style={styles.userRow}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                          <span style={{ color: "#818cf8", fontWeight: "800", fontSize: "14px" }}>
                            👥 {sub.teamName || "No Team"}
                          </span>
                          <span style={{ color: "#94a3b8", fontWeight: "600", fontSize: "12px" }}>
                            (👤 {sub.username})
                          </span>
                        </div>
                        <div style={{ color: "#64748b", fontSize: "12px", display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                          <span className="badge-indigo" style={{ fontSize: "9px" }}>LEG {sub.round}</span>
                          <span>·</span>
                          <span style={{ textTransform: "uppercase", fontWeight: "700" }}>{sub.language}</span>
                          {sub.problem && (
                            <>
                              <span>·</span>
                              <span style={{ color: "#cbd5e1", fontWeight: "600" }}>{sub.problem.title}</span>
                            </>
                          )}
                          {sub.timestamp && (
                            <>
                              <span>·</span>
                              <span style={{ color: "#64748b", fontFamily: "'JetBrains Mono', monospace", fontSize: "11px" }}>
                                ⏱️ {new Date(sub.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <span style={{ fontSize: "13px", color: sub.status === "evaluated" ? "#34d399" : "#fbbf24", fontWeight: "800", fontFamily: "'JetBrains Mono', monospace" }}>
                          {sub.result?.finalScore ?? sub.result?.score ?? 0} PTS
                        </span>
                        <button onClick={() => { setViewedCode(sub); setOverrideScore(""); setManualFeedback(""); }} style={styles.editBtn}>
                          VIEW & EVALUATE
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })()}

        {/* ─── Add/Edit Problem Modal ─── */}
        {showProblemModal && (
          <div style={styles.modalOverlay} onClick={() => setShowProblemModal(false)}>
            <div style={{ ...styles.modalContent, maxWidth: "720px" }} onClick={(e) => e.stopPropagation()}>
              <div style={styles.modalHeader}>
                <h3 style={{ margin: 0, color: "#4f46e5", fontWeight: "800" }}>
                  {editingProblem ? "EDIT PROBLEM" : "ADD NEW PROBLEM"}
                </h3>
                <button onClick={() => setShowProblemModal(false)} style={styles.closeBtn}>✕</button>
              </div>

              <form onSubmit={handleSaveProblem} style={{ padding: "24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ display: "flex", gap: "12px" }}>
                  <div style={{ flex: 1 }}>
                    <label style={styles.formLabel}>ROUND LEG</label>
                    <select
                      value={probForm.round}
                      onChange={(e) => setProbForm({ ...probForm, round: parseInt(e.target.value, 10) })}
                      style={styles.formInput}
                    >
                      <option value={1}>Leg 1</option>
                      <option value={2}>Leg 2</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={styles.formLabel}>PROBLEM ID</label>
                    <input
                      type="text"
                      value={probForm.id}
                      onChange={(e) => setProbForm({ ...probForm, id: e.target.value })}
                      placeholder="e.g. r1p1"
                      style={styles.formInput}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", gap: "12px" }}>
                  <div style={{ flex: 2 }}>
                    <label style={styles.formLabel}>TITLE</label>
                    <input
                      type="text"
                      value={probForm.title}
                      onChange={(e) => setProbForm({ ...probForm, title: e.target.value })}
                      placeholder="Problem Title"
                      required
                      style={styles.formInput}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={styles.formLabel}>DIFFICULTY</label>
                    <select
                      value={probForm.difficulty}
                      onChange={(e) => setProbForm({ ...probForm, difficulty: e.target.value })}
                      style={styles.formInput}
                    >
                      <option value="Easy">Easy</option>
                      <option value="Medium">Medium</option>
                      <option value="Hard">Hard</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "12px" }}>
                  <div style={{ flex: 1 }}>
                    <label style={styles.formLabel}>POINTS</label>
                    <input
                      type="number"
                      value={probForm.points}
                      onChange={(e) => setProbForm({ ...probForm, points: parseInt(e.target.value, 10) })}
                      style={styles.formInput}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={styles.formLabel}>TIME LIMIT (MS)</label>
                    <input
                      type="number"
                      value={probForm.timeLimit}
                      onChange={(e) => setProbForm({ ...probForm, timeLimit: parseInt(e.target.value, 10) })}
                      style={styles.formInput}
                    />
                  </div>
                </div>

                <div>
                  <label style={styles.formLabel}>PROBLEM DESCRIPTION</label>
                  <textarea
                    rows={6}
                    value={probForm.description}
                    onChange={(e) => setProbForm({ ...probForm, description: e.target.value })}
                    placeholder="Enter problem statement, input/output specifications, constraints..."
                    required
                    style={{ ...styles.formInput, fontFamily: "'JetBrains Mono', monospace" }}
                  />
                </div>

                <div>
                  <label style={styles.formLabel}>REFERENCE SOLUTION (OPTIONAL)</label>
                  <textarea
                    rows={4}
                    value={probForm.solution}
                    onChange={(e) => setProbForm({ ...probForm, solution: e.target.value })}
                    placeholder="Enter reference solution code (Python, C++, Java, etc.)..."
                    style={{ ...styles.formInput, fontFamily: "'JetBrains Mono', monospace" }}
                  />
                </div>

                {/* Starter Code Section */}
                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px" }}>
                  <div style={{ color: "#059669", fontSize: "12px", fontWeight: "800", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                    💻 STARTER CODE PER LANGUAGE (INITIAL FUNCTION SIGNATURES)
                  </div>
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div>
                      <label style={{ ...styles.formLabel, color: "#059669" }}>🐍 PYTHON STARTER CODE</label>
                      <textarea
                        rows={3}
                        value={probForm.starterCode?.python || ""}
                        onChange={(e) => setProbForm({
                          ...probForm,
                          starterCode: { ...probForm.starterCode, python: e.target.value }
                        })}
                        placeholder="def solution():\n    pass"
                        style={{ ...styles.formInput, fontFamily: "'JetBrains Mono', monospace", fontSize: "12px" }}
                      />
                    </div>

                    <div>
                      <label style={{ ...styles.formLabel, color: "#0284c7" }}>☕ JAVA STARTER CODE</label>
                      <textarea
                        rows={4}
                        value={probForm.starterCode?.java || ""}
                        onChange={(e) => setProbForm({
                          ...probForm,
                          starterCode: { ...probForm.starterCode, java: e.target.value }
                        })}
                        placeholder="public class Solution {\n    public void solution() {\n        \n    }\n}"
                        style={{ ...styles.formInput, fontFamily: "'JetBrains Mono', monospace", fontSize: "12px" }}
                      />
                    </div>

                    <div>
                      <label style={{ ...styles.formLabel, color: "#d97706" }}>⚡ C STARTER CODE</label>
                      <textarea
                        rows={4}
                        value={probForm.starterCode?.c || ""}
                        onChange={(e) => setProbForm({
                          ...probForm,
                          starterCode: { ...probForm.starterCode, c: e.target.value }
                        })}
                        placeholder="#include <stdio.h>\n\nvoid solution() {\n    \n}"
                        style={{ ...styles.formInput, fontFamily: "'JetBrains Mono', monospace", fontSize: "12px" }}
                      />
                    </div>
                  </div>
                </div>

                {/* Visible Sample Test Case */}
                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px" }}>
                  <div style={{ color: "#4f46e5", fontSize: "12px", fontWeight: "800", marginBottom: "12px" }}>
                    VISIBLE SAMPLE TEST CASE
                  </div>
                  <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                    {/* Separate Input Line / Param Boxes */}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                        <label style={styles.formLabel}>SAMPLE INPUT PARAMETERS / LINES</label>
                        <button
                          type="button"
                          onClick={addSampleInputLine}
                          style={{ ...styles.editBtn, padding: "2px 8px", fontSize: "10px" }}
                        >
                          + ADD PARAMETER
                        </button>
                      </div>

                      {sampleInputLines.map((line, lIdx) => (
                        <div key={lIdx} style={{ display: "flex", gap: "8px", marginBottom: "8px", alignItems: "center" }}>
                          <span style={{ fontSize: "11px", color: "#64748b", fontWeight: "700", width: "65px", flexShrink: 0 }}>
                            Param {lIdx + 1}:
                          </span>
                          <input
                            type="text"
                            placeholder={`Input Param ${lIdx + 1} (e.g. ${lIdx === 0 ? "2 7 11 15" : "9"})`}
                            value={line}
                            onChange={(e) => updateSampleInputLine(lIdx, e.target.value)}
                            style={{ ...styles.formInput, flex: 1 }}
                          />
                          {sampleInputLines.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeSampleInputLine(lIdx)}
                              style={{ ...styles.deleteBtn, padding: "4px 8px", fontSize: "11px" }}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Expected Output */}
                    <div style={{ flex: 1 }}>
                      <label style={styles.formLabel}>EXPECTED OUTPUT</label>
                      <textarea
                        rows={Math.max(2, sampleInputLines.length * 1.5)}
                        value={probForm.sampleOutput}
                        onChange={(e) => setProbForm({ ...probForm, sampleOutput: e.target.value })}
                        placeholder="e.g. 0 1"
                        style={styles.formInput}
                      />
                    </div>
                  </div>
                </div>

                {/* Evaluation Test Cases */}
                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <div style={{ color: "#d97706", fontSize: "12px", fontWeight: "800" }}>EVALUATION & SAMPLE TEST CASES</div>
                    <button type="button" onClick={addTestCaseField} style={styles.editBtn}>+ ADD TEST CASE</button>
                  </div>

                  {probForm.testCases.map((tc, idx) => {
                    const tcLines = (tc.input !== undefined && tc.input !== null) ? String(tc.input).split("\n") : [""];
                    return (
                      <div key={idx} style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "8px", padding: "12px", marginBottom: "12px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                          <span style={{ fontSize: "11px", fontWeight: "800", color: "#4f46e5" }}>TEST CASE #{idx + 1}</span>
                          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                            <label style={{ fontSize: "11px", fontWeight: "700", color: tc.isSample ? "#0284c7" : "#d97706", display: "flex", alignItems: "center", gap: "4px", cursor: "pointer", userSelect: "none" }}>
                              <input
                                type="checkbox"
                                checked={!!tc.isSample}
                                onChange={(e) => updateTestCaseField(idx, "isSample", e.target.checked)}
                              />
                              {tc.isSample ? "SAMPLE" : "HIDDEN"}
                            </label>
                            <button type="button" onClick={() => removeTestCaseField(idx)} style={{ ...styles.deleteBtn, padding: "2px 8px", fontSize: "11px" }}>
                              🗑️ REMOVE
                            </button>
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                          {/* Input Lines / Param Boxes */}
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                              <span style={{ fontSize: "10px", fontWeight: "700", color: "#64748b" }}>INPUT PARAMS / LINES</span>
                              <button
                                type="button"
                                onClick={() => addTestCaseInputLine(idx)}
                                style={{ ...styles.editBtn, padding: "2px 6px", fontSize: "10px" }}
                              >
                                + Add Param
                              </button>
                            </div>

                            {tcLines.map((line, lIdx) => (
                              <div key={lIdx} style={{ display: "flex", gap: "6px", marginBottom: "6px", alignItems: "center" }}>
                                <span style={{ fontSize: "10px", color: "#94a3b8", fontWeight: "700", width: "50px", flexShrink: 0 }}>Param {lIdx + 1}:</span>
                                <input
                                  type="text"
                                  placeholder={`Input param ${lIdx + 1}`}
                                  value={line}
                                  onChange={(e) => updateTestCaseInputLine(idx, lIdx, e.target.value)}
                                  style={{ ...styles.formInput, padding: "6px 10px", fontSize: "12px" }}
                                />
                                {tcLines.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removeTestCaseInputLine(idx, lIdx)}
                                    style={{ ...styles.deleteBtn, padding: "2px 6px", fontSize: "10px" }}
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>

                          {/* Expected Output */}
                          <div style={{ flex: 1 }}>
                            <span style={{ fontSize: "10px", fontWeight: "700", color: "#64748b", display: "block", marginBottom: "6px" }}>EXPECTED OUTPUT</span>
                            <textarea
                              rows={Math.max(2, tcLines.length)}
                              placeholder="Expected Output"
                              value={tc.expectedOutput || ""}
                              onChange={(e) => updateTestCaseField(idx, "expectedOutput", e.target.value)}
                              style={{ ...styles.formInput, fontSize: "12px" }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "12px" }}>
                  <button type="button" onClick={() => setShowProblemModal(false)} style={styles.cancelBtn}>CANCEL</button>
                  <button type="submit" style={{ ...styles.controlBtn, ...styles.indigoBtn, padding: "10px 28px" }}>SAVE PROBLEM</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── Bulk JSON Import Modal ─── */}
        {showJsonModal && (
          <div style={styles.modalOverlay} onClick={() => setShowJsonModal(false)}>
            <div style={{ ...styles.modalContent, maxWidth: "700px" }} onClick={(e) => e.stopPropagation()}>
              <div style={styles.modalHeader}>
                <h3 style={{ margin: 0, color: "#0284c7", fontWeight: "800" }}>
                  BULK UPLOAD PROBLEMS & TEST CASES (JSON)
                </h3>
                <button onClick={() => setShowJsonModal(false)} style={styles.closeBtn}>✕</button>
              </div>

              <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <p style={{ color: "#475569", fontSize: "13px", margin: 0 }}>
                  Paste a JSON payload containing problem statements, solutions, and testcases below.
                </p>
                <textarea
                  rows={12}
                  value={jsonText}
                  onChange={(e) => setJsonText(e.target.value)}
                  placeholder={`{\n  "problems": [\n    {\n      "id": "r1p1",\n      "round": 1,\n      "title": "Sum of Array",\n      "difficulty": "Easy",\n      "description": "Calculate sum...",\n      "solution": "def sumArr(arr): return sum(arr)",\n      "points": 100,\n      "testCases": [\n        { "input": "3\\n1 2 3", "expectedOutput": "6" }\n      ]\n    }\n  ]\n}`}
                  style={{ ...styles.formInput, fontFamily: "'JetBrains Mono', monospace", fontSize: "12px" }}
                />
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                  <button onClick={() => setShowJsonModal(false)} style={styles.cancelBtn}>CANCEL</button>
                  <button onClick={handleBulkUploadJson} style={{ ...styles.controlBtn, ...styles.cyanBtn, padding: "10px 28px" }}>UPLOAD JSON</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Code View Modal */}
        {viewedCode && (
          <div style={styles.modalOverlay} onClick={() => setViewedCode(null)}>
            <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <div style={styles.modalHeader}>
                <h3 style={{ margin: 0, color: "#4f46e5", fontWeight: "800" }}>
                  {viewedCode.username.toUpperCase()}'S CODE (LEG {viewedCode.round})
                </h3>
                <button onClick={() => setViewedCode(null)} style={styles.closeBtn}>✕</button>
              </div>

              <div style={{ padding: "20px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                <div style={{ marginBottom: "12px" }}>
                  <span className={viewedCode.status === "evaluated" ? "badge-emerald" : "badge-amber"}>
                    {viewedCode.status === "evaluated" ? "✓ FINALIZED" : "⏳ AWAITING REVIEW"}
                  </span>
                  <span style={{ color: "#475569", fontSize: "12px", marginLeft: "12px", fontWeight: "700" }}>{viewedCode.language?.toUpperCase()}</span>
                </div>

                {viewedCode.result?.feedback && viewedCode.result.feedback.map((f, i) => (
                  <div key={i} style={{ color: "#334155", fontSize: "13px", margin: "4px 0" }}>{f}</div>
                ))}

                {/* Score Input */}
                <div style={{ marginTop: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
                  <input
                    type="number" min="0" max="100"
                    placeholder="0–100"
                    value={overrideScore}
                    onChange={(e) => setOverrideScore(e.target.value)}
                    style={{ width: "90px", padding: "8px", background: "#ffffff", border: "1px solid #cbd5e1", color: "#0f172a", fontFamily: "'JetBrains Mono', monospace", fontSize: "16px", fontWeight: "bold", textAlign: "center", borderRadius: "8px" }}
                  />
                  <span style={{ color: "#64748b" }}>/ 100 PTS</span>
                  <button
                    onClick={() => manualEvaluate(viewedCode.submissionKey, overrideScore !== "" ? Number(overrideScore) : 0, manualFeedback)}
                    disabled={overrideScore === ""}
                    style={{ ...styles.controlBtn, ...styles.indigoBtn, padding: "8px 20px", fontSize: "11px" }}
                  >
                    SET MANUAL SCORE
                  </button>
                </div>
              </div>

              <div style={{ padding: "20px", flex: 1, overflow: "auto" }}>
                <pre style={{ margin: 0, color: "#0f172a", fontFamily: "'JetBrains Mono', monospace", fontSize: "13px", whiteSpace: "pre-wrap" }}>
                  {viewedCode.code}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* ─── Reset Event Choice Modal ─── */}
        {showResetModal && (
          <div style={styles.modalOverlay} onClick={() => setShowResetModal(false)}>
            <div style={{ ...styles.modalContent, maxWidth: "520px", border: "1px solid #e11d48", padding: "24px" }} onClick={(e) => e.stopPropagation()}>
              <h3 style={{ color: "#be123c", fontSize: "18px", fontWeight: "800", marginTop: 0, marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                ⚠️ RESTART / RESET EVENT DATA
              </h3>
              <p style={{ color: "#334155", fontSize: "13px", lineHeight: "1.6", marginBottom: "20px" }}>
                Do you want to keep existing participant data (submissions, saved code, and scores/points) in the database when restarting the event?
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
                <button
                  onClick={() => handleExecuteReset(true)}
                  style={{
                    padding: "14px 16px",
                    background: "#ecfdf5",
                    border: "1px solid #10b981",
                    color: "#047857",
                    borderRadius: "10px",
                    fontWeight: "700",
                    fontSize: "13px",
                    cursor: "pointer",
                    textAlign: "left",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  <span>✅ KEEP EXISTING DATA & RESET ROUND</span>
                  <span style={{ fontSize: "11px", color: "#059669", fontWeight: "normal" }}>
                    Preserves submissions, code history, and participant points in DB while resetting the round timer to waiting mode.
                  </span>
                </button>

                <button
                  onClick={() => handleExecuteReset(false)}
                  style={{
                    padding: "14px 16px",
                    background: "#fff1f2",
                    border: "1px solid #f43f5e",
                    color: "#be123c",
                    borderRadius: "10px",
                    fontWeight: "700",
                    fontSize: "13px",
                    cursor: "pointer",
                    textAlign: "left",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  <span>🗑️ DELETE ALL DATA & RESET</span>
                  <span style={{ fontSize: "11px", color: "#e11d48", fontWeight: "normal" }}>
                    Permanently deletes all submissions, participant code, and points from the database and memory.
                  </span>
                </button>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  onClick={() => setShowResetModal(false)}
                  style={{
                    padding: "8px 18px",
                    background: "#f1f5f9",
                    border: "1px solid #cbd5e1",
                    color: "#475569",
                    borderRadius: "8px",
                    fontWeight: "700",
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                >
                  CANCEL
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    backgroundColor: "#f8fafc",
    backgroundImage: "radial-gradient(circle at 50% 10%, rgba(79, 70, 229, 0.08) 0%, transparent 50%)",
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
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
  },
  logoBadge: { display: "flex", alignItems: "center", gap: "8px" },
  logoText: {
    color: "#4f46e5",
    fontWeight: "800",
    letterSpacing: "2px",
    fontSize: "16px",
  },
  toast: {
    position: "fixed",
    top: "76px",
    left: "50%",
    transform: "translateX(-50%)",
    background: "#ffffff",
    backdropFilter: "blur(16px)",
    border: "1px solid rgba(5, 150, 105, 0.4)",
    color: "#047857",
    padding: "12px 28px",
    borderRadius: "30px",
    zIndex: 2000,
    fontSize: "13px",
    fontWeight: "700",
    boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
  },
  content: {
    padding: "32px 24px",
    maxWidth: "1100px",
    margin: "0 auto",
  },
  glassCard: {
    background: "#ffffff",
    backdropFilter: "blur(16px)",
    border: "1px solid #e2e8f0",
    borderRadius: "16px",
    padding: "24px",
    marginBottom: "24px",
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.04)",
  },
  cardSectionTitle: {
    color: "#64748b",
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "1.5px",
    margin: "0 0 16px 0",
  },
  statusGrid: {
    display: "flex",
    gap: "16px",
  },
  statusTile: {
    flex: 1,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    padding: "20px",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  statusLabel: {
    color: "#64748b",
    fontSize: "10px",
    fontWeight: "700",
    letterSpacing: "1px",
  },
  statusValue: {
    color: "#4f46e5",
    fontSize: "24px",
    fontWeight: "800",
  },
  controlGrid: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
  },
  controlBtn: {
    padding: "12px 24px",
    border: "none",
    borderRadius: "10px",
    fontWeight: "700",
    fontSize: "12px",
    cursor: "pointer",
    letterSpacing: "0.5px",
  },
  indigoBtn: {
    background: "linear-gradient(135deg, #4f46e5, #4338ca)",
    color: "#ffffff",
    boxShadow: "0 4px 16px rgba(79, 70, 229, 0.25)",
  },
  cyanBtn: {
    background: "linear-gradient(135deg, #0284c7, #0369a1)",
    color: "#ffffff",
    boxShadow: "0 4px 16px rgba(2, 132, 199, 0.25)",
  },
  emeraldBtn: {
    background: "linear-gradient(135deg, #059669, #047857)",
    color: "#ffffff",
    boxShadow: "0 4px 16px rgba(5, 150, 105, 0.25)",
  },
  amberBtn: {
    background: "linear-gradient(135deg, #d97706, #b45309)",
    color: "#ffffff",
  },
  roseBtn: {
    background: "rgba(225, 29, 72, 0.08)",
    border: "1px solid rgba(225, 29, 72, 0.25)",
    color: "#be123c",
  },
  ollamaBox: {
    marginTop: "16px",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    padding: "16px",
  },
  problemCard: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    padding: "16px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
  },
  editBtn: {
    background: "rgba(79, 70, 229, 0.08)",
    border: "1px solid rgba(79, 70, 229, 0.25)",
    color: "#4f46e5",
    padding: "6px 14px",
    borderRadius: "8px",
    fontSize: "11px",
    fontWeight: "700",
    cursor: "pointer",
  },
  deleteBtn: {
    background: "rgba(225, 29, 72, 0.08)",
    border: "1px solid rgba(225, 29, 72, 0.25)",
    color: "#be123c",
    padding: "6px 14px",
    borderRadius: "8px",
    fontSize: "11px",
    fontWeight: "700",
    cursor: "pointer",
  },
  cancelBtn: {
    background: "#f1f5f9",
    border: "1px solid #cbd5e1",
    color: "#475569",
    padding: "10px 24px",
    borderRadius: "8px",
    fontWeight: "700",
    cursor: "pointer",
    fontSize: "12px",
  },
  bottomGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "24px",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    maxHeight: "320px",
    overflowY: "auto",
  },
  userRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 16px",
    background: "#f8fafc",
    borderRadius: "10px",
    border: "1px solid #e2e8f0",
    color: "#0f172a",
  },
  userDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: "#059669",
    boxShadow: "0 0 8px #059669",
  },
  lbRow: {
    display: "flex",
    alignItems: "center",
    padding: "12px 16px",
    background: "#f8fafc",
    borderRadius: "10px",
    border: "1px solid #e2e8f0",
    color: "#0f172a",
  },
  emptyText: {
    color: "#64748b",
    fontSize: "13px",
    textAlign: "center",
    padding: "24px",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.4)",
    backdropFilter: "blur(12px)",
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
    boxShadow: "0 20px 60px rgba(0,0,0,0.12)",
    overflow: "hidden",
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
  formLabel: {
    display: "block",
    color: "#475569",
    fontSize: "11px",
    fontWeight: "700",
    marginBottom: "6px",
  },
  formInput: {
    width: "100%",
    padding: "10px 14px",
    background: "#ffffff",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    color: "#0f172a",
    fontSize: "13px",
    boxSizing: "border-box",
    outline: "none",
  },
};
