import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import ArenaTopBar from "../components/ArenaTopBar";
import CodeEditor from "../components/CodeEditor";
import FullscreenLockdown from "../components/FullscreenLockdown";
import {
  submitCode,
  runTestCode,
  fetchTeamCode,
  fetchRoundProblems,
  fetchRoundSubmissions,
} from "../services/submit";
import { socket, registerUser } from "../socket/leaderboard";
import { getUser } from "../services/auth";
import { getStarterCode } from "../services/starterCode";

export default function CodingArena() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const user = getUser();
  const ROUND = Number(params.get("round")) || 1;

  const [timeLeft, setTimeLeft] = useState("--:--:--");
  const [endTime, setEndTime] = useState(null);
  
  // ─── Problem Management & Switching State ───
  const [problemsList, setProblemsList] = useState([]);
  const [currentProblemIndex, setCurrentProblemIndex] = useState(0);
  const [problem, setProblem] = useState(null);
  
  // Code editor state
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("python");

  // Submissions & Drafts maps keyed by problemId
  // submissionsMap: { [problemId]: { code, language, result, timestamp, submittedBy } }
  const [submissionsMap, setSubmissionsMap] = useState({});
  // draftsMap: { [problemId]: { code, language } }
  const [draftsMap, setDraftsMap] = useState({});

  const [submitting, setSubmitting] = useState(false);
  const [runningTest, setRunningTest] = useState(false);
  const [result, setResult] = useState(null);
  const [editorLocked, setEditorLocked] = useState(false);
  const [roundActive, setRoundActive] = useState(true);
  const [isFocusMode, setIsFocusMode] = useState(false);

  // ─── Code Relay Member Turn State (Auto-switched by Server Timer) ───
  const [activeMember, setActiveMember] = useState(1);
  const [myMemberRole, setMyMemberRole] = useState(() => {
    return user.memberRole || Number(localStorage.getItem("memberRole")) || 1;
  });
  const [turnSecondsLeft, setTurnSecondsLeft] = useState(300);

  const isMyTurn = myMemberRole === activeMember;
  // Note: Competitors can resubmit as long as round is active and it's their turn!
  const isEffectiveLocked = editorLocked || !isMyTurn || !roundActive;

  const isMyTurnRef = useRef(isMyTurn);
  isMyTurnRef.current = isMyTurn;

  const codeRef = useRef(code);
  const languageRef = useRef(language);
  const problemRef = useRef(problem);
  codeRef.current = code;
  languageRef.current = language;
  problemRef.current = problem;

  // Keyboard shortcut for Zen Mode
  useEffect(() => {
    const handleKeydown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        setIsFocusMode((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  // Auto-dismiss submission/result card after 6 seconds
  useEffect(() => {
    if (!result) return;
    const timer = setTimeout(() => {
      setResult(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [result]);

  // Load round problems and existing submissions on mount / round change
  useEffect(() => {
    let isMounted = true;

    async function initArenaData() {
      try {
        const [probsData, subsData] = await Promise.all([
          fetchRoundProblems(ROUND).catch(() => ({ problems: [] })),
          fetchRoundSubmissions(ROUND).catch(() => ({ submissions: {} })),
        ]);

        if (!isMounted) return;

        const probs = probsData?.problems || [];
        setProblemsList(probs);

        const subs = subsData?.submissions || {};
        setSubmissionsMap(subs);

        if (probs.length > 0) {
          const firstProb = probs[0];
          setCurrentProblemIndex(0);
          setProblem(firstProb);

          // Check if first problem was ALREADY SUBMITTED
          if (subs[firstProb.id]) {
            const sub = subs[firstProb.id];
            setCode(sub.code || "");
            if (sub.language) setLanguage(sub.language);
            if (sub.result) setResult(sub.result);
          } else {
            // Check team draft code or fallback to starter code
            fetchTeamCode(ROUND, firstProb.id)
              .then((data) => {
                if (!isMounted) return;
                if (data && data.code) {
                  setCode(data.code);
                  if (data.language) setLanguage(data.language);
                } else {
                  setCode(getStarterCode(firstProb, "python"));
                }
                if (data && data.activeMember !== undefined) setActiveMember(data.activeMember);
                if (data && data.turnSecondsLeft !== undefined) setTurnSecondsLeft(data.turnSecondsLeft);
              })
              .catch(() => {
                if (isMounted) setCode(getStarterCode(firstProb, "python"));
              });
          }
        }
      } catch (err) {
        console.warn("Failed to initialize arena data:", err);
      }
    }

    initArenaData();

    return () => {
      isMounted = false;
    };
  }, [ROUND]);

  // Problem Switcher logic (unrestricted for both team members)
  const handleSwitchProblem = useCallback((newIdx, isRemote = false) => {
    if (!problemsList || !problemsList[newIdx]) return;

    const currentProb = problemsList[currentProblemIndex];
    if (currentProb) {
      // Save current working code into draftsMap before switching
      setDraftsMap((prev) => ({
        ...prev,
        [currentProb.id]: { code, language },
      }));
    }

    const nextProb = problemsList[newIdx];
    setCurrentProblemIndex(newIdx);
    setProblem(nextProb);
    setResult(null);

    // Broadcast problem switch to teammate via socket if triggered locally
    if (!isRemote && user.teamName) {
      socket.emit("relay:problem_switch", {
        teamName: user.teamName,
        problemIndex: newIdx,
        problemId: nextProb.id,
        username: user.username,
      });
    }

    // 1. FIRST PRIORITY: If code was ALREADY SUBMITTED for this problem, retrieve submitted code!
    if (submissionsMap[nextProb.id]) {
      const sub = submissionsMap[nextProb.id];
      setCode(sub.code || "");
      setLanguage(sub.language || "python");
      if (sub.result) setResult(sub.result);
      return;
    }

    // 2. SECOND PRIORITY: If local draft exists for this problem
    if (draftsMap[nextProb.id] && draftsMap[nextProb.id].code !== undefined) {
      setCode(draftsMap[nextProb.id].code);
      setLanguage(draftsMap[nextProb.id].language || "python");
      return;
    }

    // 3. THIRD PRIORITY: Fetch team relay draft from server or fallback to starter code
    fetchTeamCode(ROUND, nextProb.id)
      .then((data) => {
        if (data && data.code) {
          setCode(data.code);
          if (data.language) setLanguage(data.language);
        } else {
          setCode(getStarterCode(nextProb, language || "python"));
        }
      })
      .catch(() => {
        setCode(getStarterCode(nextProb, language || "python"));
      });
  }, [currentProblemIndex, problemsList, code, language, submissionsMap, draftsMap, user.teamName, user.username, ROUND]);

  // Register on socket and listen for events
  useEffect(() => {
    registerUser(user.username, user.role, user.teamName, user.memberRole);

    socket.on("round:start", (data) => {
      if (data.round !== ROUND) {
        navigate(`/arena?round=${data.round}`);
      }
      setEndTime(data.endTime);
      setRoundActive(true);
      setEditorLocked(false);
      setResult(null);
    });

    socket.on("problem:assigned", (data) => {
      if (data.problem) {
        setProblem(data.problem);
      }
    });

    socket.on("round:end", () => {
      setRoundActive(false);
      setEditorLocked(true);
      const activePId = problemRef.current?.id;
      if (activePId && !submissionsMap[activePId] && codeRef.current.trim()) {
        autoSubmit();
      }
    });

    socket.on("user:removed", () => {
      localStorage.clear();
      navigate("/");
    });

    socket.on("state:sync", (state) => {
      if (state.memberRole) {
        setMyMemberRole(state.memberRole);
        sessionStorage.setItem("memberRole", String(state.memberRole));
        localStorage.setItem("memberRole", String(state.memberRole));
      }

      if (state.activeMember !== undefined) {
        setActiveMember(state.activeMember);
      }
      if (state.turnSecondsLeft !== undefined) {
        setTurnSecondsLeft(state.turnSecondsLeft);
      }

      if (state.roundStatus === "active" && state.currentRound > 0) {
        setEndTime(state.roundEndTime);
        setRoundActive(true);
      } else if (state.roundStatus === "ended") {
        setRoundActive(false);
        setEditorLocked(true);
      } else if (state.currentRound === 0 && state.roundStatus === "waiting") {
        navigate("/waiting");
      }
    });

    socket.on("event:reset", () => {
      navigate("/waiting");
    });

    return () => {
      socket.off("round:start");
      socket.off("problem:assigned");
      socket.off("round:end");
      socket.off("user:removed");
      socket.off("state:sync");
      socket.off("event:reset");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, ROUND, user.username, user.role]);

  // Round Timer
  useEffect(() => {
    if (!endTime) return;

    const tick = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((endTime - now) / 1000));

      if (diff <= 0) {
        setTimeLeft("00:00:00");
        setRoundActive(false);
        setEditorLocked(true);
        return;
      }

      const h = String(Math.floor(diff / 3600)).padStart(2, "0");
      const m = String(Math.floor((diff % 3600) / 60)).padStart(2, "0");
      const s = String(diff % 60).padStart(2, "0");
      setTimeLeft(`${h}:${m}:${s}`);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [endTime]);

  // Handle code change by active typist & broadcast to teammate + MongoDB
  const handleCodeChange = (newCode) => {
    setCode(newCode);

    // Save into draftsMap for active problem
    if (problem?.id) {
      setDraftsMap((prev) => ({
        ...prev,
        [problem.id]: { code: newCode, language },
      }));
    }

    if (isMyTurn && user.teamName) {
      socket.emit("relay:code_change", {
        teamName: user.teamName,
        code: newCode,
        language,
        username: user.username,
        problemId: problem?.id || "",
      });
    }
  };

  // Listen for real-time code sync, problem switch, & turn switch from server / active teammate
  useEffect(() => {
    const handleRemoteCodeSync = (data) => {
      if (!isMyTurnRef.current) {
        if (!data.problemId || data.problemId === problem?.id) {
          if (data.code !== undefined) setCode(data.code);
          if (data.language && data.language !== language) setLanguage(data.language);
        }
      }
    };

    const handleRemoteTurnSwitch = (data) => {
      if (data.activeMember !== undefined) setActiveMember(data.activeMember);
      if (data.turnSecondsLeft !== undefined) setTurnSecondsLeft(data.turnSecondsLeft);
      if (!data.problemId || data.problemId === problem?.id) {
        if (data.code !== undefined) setCode(data.code);
        if (data.language) setLanguage(data.language);
      }
    };

    const handleRemoteProblemSwitch = (data) => {
      if (data.problemIndex !== undefined && data.problemIndex !== currentProblemIndex) {
        handleSwitchProblem(data.problemIndex, true);
      }
    };

    const handleRemoteTeamSubmitted = (data) => {
      if (data.round === ROUND && data.problemId) {
        const subEntry = {
          problemId: data.problemId,
          code: data.code,
          language: data.language,
          result: data.result,
          timestamp: Date.now(),
          submittedBy: data.submittedBy,
        };
        setSubmissionsMap((prev) => ({
          ...prev,
          [data.problemId]: subEntry,
        }));

        if (data.problemId === problem?.id) {
          if (data.code !== undefined) setCode(data.code);
          if (data.language) setLanguage(data.language);
          if (data.result) setResult(data.result);
        }
      }
    };

    socket.on("relay:code_sync", handleRemoteCodeSync);
    socket.on("relay:turn_switch", handleRemoteTurnSwitch);
    socket.on("relay:problem_switch", handleRemoteProblemSwitch);
    socket.on("relay:team_submitted", handleRemoteTeamSubmitted);

    if (user.teamName) {
      socket.on(`relay:code_sync:${user.teamName}`, handleRemoteCodeSync);
      socket.on(`relay:turn_switch:${user.teamName}`, handleRemoteTurnSwitch);
      socket.on(`relay:problem_switch:${user.teamName}`, handleRemoteProblemSwitch);
      socket.on(`relay:team_submitted:${user.teamName}`, handleRemoteTeamSubmitted);
    }

    return () => {
      socket.off("relay:code_sync", handleRemoteCodeSync);
      socket.off("relay:turn_switch", handleRemoteTurnSwitch);
      socket.off("relay:problem_switch", handleRemoteProblemSwitch);
      socket.off("relay:team_submitted", handleRemoteTeamSubmitted);
      if (user.teamName) {
        socket.off(`relay:code_sync:${user.teamName}`, handleRemoteCodeSync);
        socket.off(`relay:turn_switch:${user.teamName}`, handleRemoteTurnSwitch);
        socket.off(`relay:problem_switch:${user.teamName}`, handleRemoteProblemSwitch);
        socket.off(`relay:team_submitted:${user.teamName}`, handleRemoteTeamSubmitted);
      }
    };
  }, [user.teamName, language, ROUND, problem, currentProblemIndex, handleSwitchProblem]);

  // Handle language selection change
  const handleLanguageChange = (newLang) => {
    setLanguage(newLang);
    if (problem) {
      if (!code || code === getStarterCode(problem, language)) {
        const starter = getStarterCode(problem, newLang);
        setCode(starter);
        if (isMyTurn && user.teamName) {
          socket.emit("relay:code_change", {
            teamName: user.teamName,
            code: starter,
            language: newLang,
            username: user.username,
            problemId: problem.id,
          });
        }
      }
    }
  };

  // Member 5-Min Turn Countdown Timer
  useEffect(() => {
    if (!roundActive) return;
    const interval = setInterval(() => {
      setTurnSecondsLeft((prev) => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [roundActive]);

  const memberTimeFormatted = `${String(Math.floor(turnSecondsLeft / 60)).padStart(2, "0")}:${String(turnSecondsLeft % 60).padStart(2, "0")}`;

  const autoSubmit = async () => {
    if (!problemRef.current) return;
    try {
      const res = await submitCode(codeRef.current, languageRef.current, ROUND, problemRef.current.id);
      setResult(res);
      setSubmissionsMap((prev) => ({
        ...prev,
        [problemRef.current.id]: {
          problemId: problemRef.current.id,
          code: codeRef.current,
          language: languageRef.current,
          result: res,
          timestamp: Date.now(),
          submittedBy: user.username,
        },
      }));
    } catch {
      // Silent fail
    }
  };

  const handleRunTest = useCallback(async () => {
    if (runningTest || !code.trim() || !problem) return;
    setRunningTest(true);
    try {
      const res = await runTestCode(code, language, ROUND, problem.id);
      setResult(res);
    } catch (err) {
      setResult({ errorType: "Error", feedback: [err.message], score: 0 });
    } finally {
      setRunningTest(false);
    }
  }, [code, language, ROUND, problem, runningTest]);

  const handleSubmit = useCallback(async () => {
    if (submitting || runningTest || !code.trim() || !problem) return;
    setSubmitting(true);

    try {
      const res = await submitCode(code, language, ROUND, problem.id);
      setResult(res);

      const subEntry = {
        problemId: problem.id,
        code,
        language,
        result: res,
        timestamp: Date.now(),
        submittedBy: user.username,
      };

      setSubmissionsMap((prev) => ({
        ...prev,
        [problem.id]: subEntry,
      }));
    } catch (err) {
      setResult({ errorType: "Error", feedback: [err.message], score: 0 });
    } finally {
      setSubmitting(false);
    }
  }, [code, language, ROUND, problem, submitting, runningTest, user.username]);

  const isCurrentProblemSubmitted = problem && !!submissionsMap[problem.id];

  return (
    <FullscreenLockdown roundActive={roundActive}>
      <div style={styles.container}>
        <ArenaTopBar
          time={timeLeft}
          score={result?.score}
          round={ROUND}
          activeMember={activeMember}
          memberTimeLeft={memberTimeFormatted}
        />

        <div style={styles.content}>
          {/* ─── Problem Panel ─── */}
          {!isFocusMode && (
            <div style={styles.problemPanel}>
              {/* Problem Switcher Tabs */}
              {problemsList.length > 1 && (
                <div style={styles.problemSelectorBar}>
                  {problemsList.map((p, idx) => {
                    const isActive = idx === currentProblemIndex;
                    const sub = submissionsMap[p.id];
                    return (
                      <button
                        key={p.id || idx}
                        onClick={() => handleSwitchProblem(idx)}
                        style={{
                          ...styles.problemTabBtn,
                          ...(isActive ? styles.problemTabBtnActive : {}),
                        }}
                      >
                        <span>{`Q${idx + 1}: ${p.title}`}</span>
                        {sub && (
                          <span
                            style={{
                              ...styles.tabSubmittedBadge,
                              ...(isActive ? styles.tabSubmittedBadgeActive : {}),
                            }}
                          >
                            ✓ {sub.result?.score !== undefined ? `${sub.result.score} PTS` : "SUBMITTED"}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              <div style={styles.problemHeader}>
                <div>
                  <div style={{ color: "#64748b", fontSize: "10px", fontWeight: "700", letterSpacing: "1px", marginBottom: "4px" }}>
                    LEG {ROUND} &nbsp;•&nbsp; QUESTION {currentProblemIndex + 1} OF {problemsList.length || 1}
                  </div>
                  <h2 style={styles.problemTitle}>
                    {problem?.title || `Round ${ROUND} Problem`}
                  </h2>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <span className="badge-indigo">{problem?.difficulty || "Easy"}</span>
                  <span className="badge-emerald">{problem?.points || 100} PTS</span>
                </div>
              </div>

              <div style={styles.problemBody}>
                <div style={styles.problemText}>
                  {problem?.description || "Waiting for problem to load..."}
                </div>

                {problem?.sampleTestCase && (
                  <div style={styles.sampleBox}>
                    <div style={{ color: "#38bdf8", fontSize: "11px", fontWeight: "700", marginBottom: "8px" }}>VISIBLE SAMPLE TEST CASE</div>
                    <div style={{ marginBottom: "6px" }}>
                      <span style={{ color: "#94a3b8", fontSize: "10px" }}>INPUT:</span>
                      <pre style={styles.codeSnippet}>{problem.sampleTestCase.input || ""}</pre>
                    </div>
                    <div>
                      <span style={{ color: "#94a3b8", fontSize: "10px" }}>EXPECTED OUTPUT:</span>
                      <pre style={styles.codeSnippet}>{problem.sampleTestCase.output || problem.sampleTestCase.expectedOutput || ""}</pre>
                    </div>
                  </div>
                )}
              </div>

              <div style={styles.problemFooter}>
                <button
                  onClick={() => setIsFocusMode(true)}
                  style={styles.focusBtn}
                  title="Shortcut: Ctrl+F"
                >
                  🧘 ZEN EDITOR MODE
                </button>
              </div>
            </div>
          )}

          {/* ─── Editor Panel ─── */}
          <div style={{ ...styles.editorPanel, position: 'relative' }}>
            {isFocusMode && (
              <button
                onClick={() => setIsFocusMode(false)}
                style={styles.exitFocusBtn}
              >
                ✕ EXIT ZEN MODE
              </button>
            )}

            {/* Toolbar */}
            <div style={styles.editorToolbar}>
              <div style={styles.toolbarLeft}>
                <select
                  value={language}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  style={{ ...styles.langSelect, opacity: isEffectiveLocked ? 0.5 : 1 }}
                  disabled={isEffectiveLocked}
                >
                  <option value="python">Python</option>
                  <option value="javascript">JavaScript</option>
                  <option value="java">Java</option>
                  <option value="cpp">C++</option>
                  <option value="c">C</option>
                </select>

                <span className="badge-cyan" style={{ fontSize: "10px" }}>
                  {ROUND === 1 ? "BLUR PHASE" : "BLACKOUT PHASE"}
                </span>

                {isCurrentProblemSubmitted && (
                  <span style={{
                    background: "#dcfce7",
                    color: "#166534",
                    fontSize: "11px",
                    fontWeight: "800",
                    padding: "4px 10px",
                    borderRadius: "6px",
                    border: "1px solid #86efac",
                  }}>
                    ✓ CODE SUBMITTED & RETRIEVED
                  </span>
                )}
              </div>

              <div style={styles.toolbarRight}>
                {roundActive && (
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={handleRunTest}
                      disabled={runningTest || submitting || !code.trim() || !isMyTurn}
                      style={{
                        background: "#0284c7",
                        color: "#ffffff",
                        border: "none",
                        padding: "8px 16px",
                        fontWeight: "700",
                        fontSize: "12px",
                        borderRadius: "8px",
                        cursor: "pointer",
                        boxShadow: "0 2px 8px rgba(2, 132, 199, 0.25)",
                        opacity: runningTest || submitting || !code.trim() || !isMyTurn ? 0.5 : 1,
                      }}
                    >
                      {runningTest ? "⏳ TESTING..." : "▶️ RUN TEST CASES"}
                    </button>

                    <button
                      onClick={handleSubmit}
                      disabled={submitting || runningTest || !code.trim() || !isMyTurn}
                      style={{
                        ...styles.submitBtn,
                        opacity: submitting || runningTest || !code.trim() || !isMyTurn ? 0.5 : 1,
                      }}
                    >
                      {submitting ? "⏳ SUBMITTING..." : isCurrentProblemSubmitted ? "🔄 RE-SUBMIT CODE" : "🚀 SUBMIT CODE"}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Code Editor Component */}
            <div style={styles.editorWrapper}>
              {isCurrentProblemSubmitted && (
                <div style={{
                  background: "#065f46",
                  color: "#a7f3d0",
                  padding: "8px 16px",
                  fontSize: "12px",
                  fontWeight: "800",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderBottom: "1px solid #047857",
                  boxShadow: "0 2px 6px rgba(0, 0, 0, 0.2)",
                  zIndex: 20,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "14px" }}>✅</span>
                    <span>RETRIEVED SUBMITTED CODE: Previously submitted code for "{problem?.title}" is loaded into editor. You can edit and re-submit anytime before the round ends.</span>
                  </div>
                  {submissionsMap[problem.id]?.result?.score !== undefined && (
                    <span style={{
                      background: "#047857",
                      color: "#ffffff",
                      padding: "3px 10px",
                      borderRadius: "6px",
                      fontFamily: "'JetBrains Mono', monospace",
                    }}>
                      Score: {submissionsMap[problem.id].result.score} PTS
                    </span>
                  )}
                </div>
              )}

              {!isMyTurn && roundActive && (
                <div style={{
                  background: "#1e293b",
                  color: "#38bdf8",
                  padding: "8px 16px",
                  fontSize: "12px",
                  fontWeight: "700",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderBottom: "1px solid #334155",
                  boxShadow: "0 2px 6px rgba(0, 0, 0, 0.2)",
                  zIndex: 20,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "14px" }}>👁️</span>
                    <span>READ-ONLY VIEW: Member {activeMember} is currently typing. You will be able to type when the turn switches.</span>
                  </div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", color: "#fbbf24", fontWeight: "800" }}>
                    ⏱️ YOUR TURN IN: {memberTimeFormatted}
                  </div>
                </div>
              )}

              <CodeEditor
                language={language}
                locked={isEffectiveLocked}
                onCodeChange={handleCodeChange}
                code={code}
                round={ROUND}
              />
            </div>

            {/* Result Panel */}
            {result && (
              <div
                style={{
                  ...styles.resultPanel,
                  borderColor:
                    result.errorType === "Accepted" ? "rgba(16, 185, 129, 0.4)" : "rgba(244, 63, 94, 0.4)",
                }}
              >
                <div style={styles.resultHeader}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span
                      className={result.errorType === "Accepted" ? "badge-emerald" : "badge-rose"}
                      style={{ fontSize: "12px", padding: "6px 14px" }}
                    >
                      {result.errorType.toUpperCase()}
                    </span>
                    <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "600" }}>
                      (auto-hides in 6s)
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={styles.resultScore}>
                      {result.score} <span style={{ fontSize: '12px', opacity: 0.6 }}>/ {problem?.points || 100} PTS</span>
                    </span>
                    <button
                      onClick={() => setResult(null)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#94a3b8",
                        fontSize: "16px",
                        fontWeight: "bold",
                        cursor: "pointer",
                        padding: "0 4px",
                      }}
                      title="Dismiss"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {result.passedCases !== undefined && (
                  <div style={styles.testProgress}>
                    <div style={styles.testBar}>
                      <div
                        style={{
                          ...styles.testFill,
                          width: `${result.totalCases > 0 ? (result.passedCases / result.totalCases) * 100 : 0}%`,
                          background:
                            result.passedCases === result.totalCases
                              ? "linear-gradient(90deg, #10b981, #34d399)"
                              : "linear-gradient(90deg, #f59e0b, #fbbf24)",
                        }}
                      />
                    </div>
                    <span style={styles.testText}>
                      {result.passedCases} OF {result.totalCases} TEST CASES PASSED
                    </span>
                  </div>
                )}

                {result.feedback && (
                  <div style={styles.feedbackContainer}>
                    {result.feedback.map((f, i) => (
                      <p key={i} style={styles.feedbackText}>
                        {f}
                      </p>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => navigate("/leaderboard")}
                  style={styles.leaderboardBtn}
                >
                  VIEW LIVE LEADERBOARD →
                </button>
              </div>
            )}

            {/* Round Ended Overlay */}
            {!roundActive && (
              <div style={styles.roundEndOverlay}>
                <div style={styles.roundEndIcon}>⏳</div>
                <h2 style={{ color: "#fb7185", margin: "0 0 8px 0", fontWeight: '800' }}>
                  LEG EXPIRED
                </h2>
                <p style={{ color: "#94a3b8", marginTop: "4px", fontSize: "13px" }}>
                  Submissions are closed for this round.
                </p>
                <button
                  onClick={() => navigate("/leaderboard")}
                  style={styles.leaderboardBtn}
                >
                  GO TO RANKINGS →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </FullscreenLockdown>
  );
}

const styles = {
  container: {
    height: "100vh",
    backgroundColor: "#f8fafc",
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    color: "#0f172a",
  },
  content: {
    display: "flex",
    flex: 1,
    marginTop: "64px",
    overflow: "hidden",
    position: 'relative',
  },
  problemPanel: {
    width: "36%",
    minWidth: "360px",
    borderRight: "1px solid #e2e8f0",
    display: "flex",
    flexDirection: "column",
    backgroundColor: "#ffffff",
    boxShadow: "1px 0 10px rgba(0, 0, 0, 0.02)",
    zIndex: 5,
  },
  problemSelectorBar: {
    display: "flex",
    gap: "6px",
    padding: "10px 14px",
    background: "#f1f5f9",
    borderBottom: "1px solid #cbd5e1",
    overflowX: "auto",
  },
  problemTabBtn: {
    padding: "6px 12px",
    fontSize: "11px",
    fontWeight: "700",
    borderRadius: "6px",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#334155",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    whiteSpace: "nowrap",
    transition: "all 0.2s ease",
  },
  problemTabBtnActive: {
    border: "1px solid #4f46e5",
    background: "#4f46e5",
    color: "#ffffff",
    boxShadow: "0 2px 6px rgba(79, 70, 229, 0.3)",
  },
  tabSubmittedBadge: {
    background: "#dcfce7",
    color: "#166534",
    fontSize: "10px",
    padding: "2px 6px",
    borderRadius: "4px",
    fontWeight: "800",
  },
  tabSubmittedBadgeActive: {
    background: "rgba(255, 255, 255, 0.25)",
    color: "#ffffff",
  },
  problemHeader: {
    padding: "16px 24px",
    borderBottom: "1px solid #e2e8f0",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
  problemTitle: {
    color: "#0f172a",
    fontSize: "18px",
    margin: 0,
    fontWeight: "800",
  },
  problemBody: {
    padding: "24px",
    flex: 1,
    overflowY: "auto",
  },
  problemText: {
    color: "#334155",
    fontSize: "14px",
    lineHeight: "1.7",
    whiteSpace: "pre-wrap",
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    margin: 0,
  },
  sampleBox: {
    marginTop: "20px",
    background: "#f8fafc",
    border: "1px solid #cbd5e1",
    borderRadius: "10px",
    padding: "14px",
  },
  codeSnippet: {
    background: "#f1f5f9",
    padding: "8px 12px",
    borderRadius: "6px",
    color: "#0f172a",
    border: "1px solid #cbd5e1",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "12px",
    margin: "4px 0 0 0",
    whiteSpace: "pre-wrap",
  },
  problemFooter: {
    padding: "16px 24px",
    borderTop: "1px solid #e2e8f0",
    backgroundColor: "#f8fafc",
  },
  focusBtn: {
    width: "100%",
    padding: "10px",
    background: "#e0e7ff",
    border: "1px solid #c7d2fe",
    color: "#3730a3",
    fontSize: "12px",
    fontWeight: "700",
    cursor: "pointer",
    borderRadius: "8px",
  },
  editorPanel: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    background: "#ffffff",
  },
  exitFocusBtn: {
    position: "absolute",
    top: "16px",
    right: "16px",
    zIndex: 100,
    padding: "8px 16px",
    background: "#ffe4e6",
    border: "1px solid #fecdd3",
    color: "#9f1239",
    fontWeight: "700",
    fontSize: "12px",
    cursor: "pointer",
    borderRadius: "8px",
  },
  editorToolbar: {
    height: "52px",
    padding: "0 20px",
    borderBottom: "1px solid #e2e8f0",
    background: "#f8fafc",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  toolbarLeft: { display: "flex", alignItems: "center", gap: "12px" },
  langSelect: {
    padding: "6px 14px",
    background: "#ffffff",
    border: "1px solid #cbd5e1",
    color: "#3730a3",
    fontSize: "12px",
    fontWeight: "700",
    borderRadius: "8px",
  },
  toolbarRight: { display: "flex", alignItems: "center" },
  submitBtn: {
    background: "linear-gradient(135deg, #4f46e5, #3730a3)",
    color: "#ffffff",
    border: "none",
    padding: "8px 20px",
    fontWeight: "700",
    fontSize: "12px",
    borderRadius: "8px",
    cursor: "pointer",
    boxShadow: "0 2px 10px rgba(79, 70, 229, 0.25)",
  },
  editorWrapper: { flex: 1, position: "relative" },
  resultPanel: {
    position: "absolute",
    bottom: "20px",
    left: "20px",
    right: "20px",
    background: "#ffffff",
    backdropFilter: "blur(20px)",
    border: "1px solid #cbd5e1",
    borderRadius: "14px",
    padding: "20px",
    zIndex: 90,
    boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
    animation: "slideUp 0.4s ease-out",
  },
  resultHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px",
  },
  resultScore: {
    fontSize: "18px",
    fontWeight: "800",
    color: "#059669",
  },
  testProgress: { marginBottom: "12px" },
  testBar: {
    height: "6px",
    background: "#e2e8f0",
    borderRadius: "3px",
    overflow: "hidden",
    marginBottom: "6px",
  },
  testFill: { height: "100%", borderRadius: "3px", transition: "width 0.5s ease" },
  testText: { color: "#64748b", fontSize: "11px", fontWeight: "700" },
  feedbackContainer: { marginBottom: "12px" },
  feedbackText: { color: "#334155", fontSize: "13px", margin: "4px 0" },
  leaderboardBtn: {
    width: "100%",
    padding: "10px",
    background: "linear-gradient(135deg, #059669, #047857)",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    fontWeight: "700",
    fontSize: "12px",
    cursor: "pointer",
    boxShadow: "0 2px 10px rgba(5, 150, 105, 0.25)",
  },
  roundEndOverlay: {
    position: "absolute",
    inset: 0,
    background: "rgba(248, 250, 252, 0.95)",
    backdropFilter: "blur(12px)",
    zIndex: 100,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
  },
  roundEndIcon: { fontSize: "40px", marginBottom: "12px" },
};
