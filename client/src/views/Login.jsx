import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { loginUser, registerUser as registerUserAPI, fetchExistingTeams, isLoggedIn, getUser } from "../services/auth";

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [teamMode, setTeamMode] = useState("create"); // "create" | "join"
  const [teamName, setTeamName] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [existingTeams, setExistingTeams] = useState([]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (isLoggedIn()) {
      const user = getUser();
      navigate(user.role === "admin" ? "/admin" : "/waiting");
    }
  }, [navigate]);

  useEffect(() => {
    if (isRegister) {
      loadTeams();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRegister]);

  const loadTeams = async () => {
    const teams = await fetchExistingTeams();
    setExistingTeams(teams);
    // If there are available non-full teams, pre-select first non-full one
    const available = teams.find(t => !t.isFull);
    if (available && !selectedTeamId) {
      setSelectedTeamId(String(available.id));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (isRegister) {
      if (teamMode === "create") {
        if (!teamName.trim()) {
          setError("Team name is required");
          return;
        }
        if (teamName.trim().length < 2) {
          setError("Team name must be at least 2 characters");
          return;
        }
      } else {
        if (!selectedTeamId) {
          setError("Please select an existing team to join");
          return;
        }
        const chosen = existingTeams.find(t => String(t.id) === String(selectedTeamId));
        if (chosen && chosen.isFull) {
          setError(`Team "${chosen.teamName}" is full (2/2 members). Only 2 members are allowed in a team.`);
          return;
        }
      }

      if (password !== confirmPassword) {
        setError("Passwords do not match");
        return;
      }
      if (password.length < 4) {
        setError("Password must be at least 4 characters");
        return;
      }
      if (username.trim().length < 2) {
        setError("Username must be at least 2 characters");
        return;
      }
    }

    setLoading(true);

    try {
      let data;
      if (isRegister) {
        data = await registerUserAPI(
          username.trim(),
          password,
          teamMode,
          teamName.trim(),
          selectedTeamId ? parseInt(selectedTeamId, 10) : null
        );
        setSuccess(`Registration successful for Team "${data.teamName || teamName.trim()}"! Now login with your credentials.`);
        setUsername("");
        setTeamName("");
        setSelectedTeamId("");
        setPassword("");
        setConfirmPassword("");
        loadTeams();
      } else {
        data = await loginUser(username.trim(), password);
        if (data.role === "admin") {
          navigate("/admin");
        } else {
          navigate("/waiting");
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* Background ambient orbs */}
      <div style={styles.bgOrb1} />
      <div style={styles.bgOrb2} />

      <div style={styles.glassBox}>
        {/* Relay Icon Header */}
        <div style={styles.iconCircle}>
          <span style={{ fontSize: "28px" }}>⚡</span>
        </div>

        <h1 style={styles.title}>
          CODE <span style={{ color: "#38bdf8" }}>RELAY</span>
        </h1>
        <p style={styles.subtitle}>COMPETITIVE SPEED & RELAY CODING ARENA</p>

        {/* Toggle Tabs */}
        <div style={styles.tabRow}>
          <button
            type="button"
            onClick={() => { setIsRegister(false); setError(""); setSuccess(""); }}
            style={{
              ...styles.tab,
              ...(isRegister ? {} : styles.tabActive),
            }}
          >
            LOGIN
          </button>
          <button
            type="button"
            onClick={() => { setIsRegister(true); setError(""); setSuccess(""); loadTeams(); }}
            style={{
              ...styles.tab,
              ...(isRegister ? styles.tabActive : {}),
            }}
          >
            REGISTER
          </button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>USERNAME</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              style={styles.input}
              autoComplete="off"
              placeholder="Enter your handle"
            />
          </div>

          {isRegister && (
            <>
              {/* Team Mode Selection */}
              <div style={styles.inputGroup}>
                <label style={styles.label}>TEAM REGISTRATION (MAX 2 MEMBERS / TEAM)</label>
                <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                  <button
                    type="button"
                    onClick={() => setTeamMode("create")}
                    style={{
                      flex: 1,
                      padding: "8px",
                      fontSize: "11px",
                      fontWeight: "700",
                      borderRadius: "6px",
                      border: teamMode === "create" ? "1px solid #4f46e5" : "1px solid #cbd5e1",
                      background: teamMode === "create" ? "#e0e7ff" : "#ffffff",
                      color: teamMode === "create" ? "#3730a3" : "#475569",
                      cursor: "pointer",
                    }}
                  >
                    ➕ CREATE NEW TEAM
                  </button>
                  <button
                    type="button"
                    onClick={() => { setTeamMode("join"); loadTeams(); }}
                    style={{
                      flex: 1,
                      padding: "8px",
                      fontSize: "11px",
                      fontWeight: "700",
                      borderRadius: "6px",
                      border: teamMode === "join" ? "1px solid #0284c7" : "1px solid #cbd5e1",
                      background: teamMode === "join" ? "#e0f2fe" : "#ffffff",
                      color: teamMode === "join" ? "#075985" : "#475569",
                      cursor: "pointer",
                    }}
                  >
                    👥 JOIN EXISTING TEAM
                  </button>
                </div>

                {teamMode === "create" ? (
                  <input
                    type="text"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    required
                    style={styles.input}
                    autoComplete="off"
                    placeholder="Enter new team name"
                  />
                ) : (
                  <select
                    value={selectedTeamId}
                    onChange={(e) => setSelectedTeamId(e.target.value)}
                    required
                    style={styles.input}
                  >
                    <option value="">-- Select an existing team --</option>
                    {existingTeams.map((t) => (
                      <option key={t.id} value={t.id} disabled={t.isFull}>
                        {t.teamName} ({t.memberCount}/2 members{t.isFull ? " - FULL 🔒" : ""})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </>
          )}

          <div style={styles.inputGroup}>
            <label style={styles.label}>PASSWORD</label>
            <div style={styles.passwordWrapper}>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={styles.input}
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
              >
                {showPassword ? "👁" : "👁‍🗨"}
              </button>
            </div>
          </div>

          {isRegister && (
            <div style={styles.inputGroup}>
              <label style={styles.label}>CONFIRM PASSWORD</label>
              <div style={styles.passwordWrapper}>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  style={styles.input}
                  placeholder="Re-enter password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={styles.eyeBtn}
                >
                  {showConfirmPassword ? "👁" : "👁‍🗨"}
                </button>
              </div>
            </div>
          )}

          {error && <div style={styles.error}>{error}</div>}
          {success && <div style={styles.success}>{success}</div>}

          <button type="submit" style={styles.button} disabled={loading}>
            {loading
              ? (isRegister ? "CREATING ACCOUNT..." : "AUTHENTICATING...")
              : (isRegister ? "CREATE COMPETITOR ACCOUNT" : "ENTER RELAY ARENA →")}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    backgroundColor: "#f8fafc",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    overflow: "hidden",
    position: "relative",
    padding: "20px",
  },
  bgOrb1: {
    position: "absolute",
    top: "15%",
    left: "20%",
    width: "350px",
    height: "350px",
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(79, 70, 229, 0.1) 0%, transparent 70%)",
    pointerEvents: "none",
  },
  bgOrb2: {
    position: "absolute",
    bottom: "15%",
    right: "20%",
    width: "400px",
    height: "400px",
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(2, 132, 199, 0.08) 0%, transparent 70%)",
    pointerEvents: "none",
  },
  glassBox: {
    background: "#ffffff",
    backdropFilter: "blur(20px)",
    border: "1px solid #cbd5e1",
    borderRadius: "20px",
    padding: "44px 40px",
    boxShadow: "0 20px 50px rgba(0, 0, 0, 0.06)",
    position: "relative",
    zIndex: 1,
    width: "100%",
    maxWidth: "420px",
    animation: "fadeIn 0.6s ease-out",
  },
  iconCircle: {
    width: "60px",
    height: "60px",
    borderRadius: "18px",
    background: "linear-gradient(135deg, rgba(79, 70, 229, 0.1), rgba(2, 132, 199, 0.1))",
    border: "1px solid rgba(79, 70, 229, 0.25)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 16px",
    boxShadow: "0 8px 24px rgba(79, 70, 229, 0.1)",
  },
  title: {
    fontSize: "2.4rem",
    fontWeight: "800",
    color: "#4f46e5",
    letterSpacing: "3px",
    margin: 0,
    textAlign: "center",
  },
  subtitle: {
    color: "#475569",
    fontSize: "10px",
    letterSpacing: "3px",
    fontWeight: "600",
    textAlign: "center",
    marginTop: "8px",
    marginBottom: "24px",
  },
  tabRow: {
    display: "flex",
    marginBottom: "24px",
    background: "#f1f5f9",
    padding: "4px",
    borderRadius: "12px",
    border: "1px solid #e2e8f0",
  },
  tab: {
    flex: 1,
    padding: "10px",
    background: "transparent",
    border: "none",
    color: "#64748b",
    fontSize: "12px",
    fontWeight: "700",
    letterSpacing: "1px",
    cursor: "pointer",
    borderRadius: "8px",
    transition: "all 0.3s",
  },
  tabActive: {
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid #cbd5e1",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },
  inputGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  label: {
    color: "#475569",
    fontSize: "10px",
    fontWeight: "700",
    letterSpacing: "1.5px",
  },
  input: {
    backgroundColor: "#ffffff",
    border: "1px solid #cbd5e1",
    borderRadius: "10px",
    padding: "12px 16px",
    color: "#0f172a",
    fontSize: "14px",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  button: {
    background: "linear-gradient(135deg, #4f46e5, #4338ca)",
    color: "#ffffff",
    border: "none",
    borderRadius: "10px",
    padding: "14px",
    fontWeight: "700",
    cursor: "pointer",
    fontSize: "13px",
    letterSpacing: "1.5px",
    marginTop: "8px",
    boxShadow: "0 4px 20px rgba(79, 70, 229, 0.25)",
  },
  error: {
    color: "#be123c",
    fontSize: "12px",
    textAlign: "center",
    padding: "10px",
    borderRadius: "8px",
    border: "1px solid rgba(225, 29, 72, 0.25)",
    background: "rgba(225, 29, 72, 0.08)",
  },
  success: {
    color: "#047857",
    fontSize: "12px",
    textAlign: "center",
    padding: "10px",
    borderRadius: "8px",
    border: "1px solid rgba(5, 150, 105, 0.25)",
    background: "rgba(5, 150, 105, 0.08)",
  },
  passwordWrapper: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  eyeBtn: {
    position: "absolute",
    right: "12px",
    background: "none",
    border: "none",
    color: "#4f46e5",
    cursor: "pointer",
    fontSize: "15px",
    padding: "0",
  },
};
