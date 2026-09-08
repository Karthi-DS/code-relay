import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { socket, registerUser } from "../socket/leaderboard";
import { getUser } from "../services/auth";
import ProfileDropdown from "../components/ProfileDropdown";

export default function WaitingRoom() {
  const navigate = useNavigate();
  const user = getUser();
  const [users, setUsers] = useState([]);
  const [dots, setDots] = useState("");

  useEffect(() => {
    registerUser(user.username, user.role);

    socket.on("users:update", (userList) => {
      setUsers(userList);
    });

    socket.on("round:start", (data) => {
      navigate(`/arena?round=${data.round}`);
    });

    socket.on("user:removed", () => {
      localStorage.clear();
      navigate("/");
    });

    socket.on("state:sync", (state) => {
      if (state.roundStatus === "active" && state.currentRound > 0) {
        navigate(`/arena?round=${state.currentRound}`);
      }
    });

    const dotInterval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "" : d + "."));
    }, 600);

    return () => {
      socket.off("users:update");
      socket.off("round:start");
      socket.off("user:removed");
      socket.off("state:sync");
      clearInterval(dotInterval);
    };
  }, [navigate, user.username, user.role]);

  return (
    <div style={styles.container}>
      {/* Top Navigation Bar */}
      <div style={styles.topBar}>
        <div style={styles.logoBadge}>
          <span style={{ fontSize: "18px" }}>⚡</span>
          <span style={styles.logoText}>CODE <span style={{ color: "#38bdf8" }}>RELAY</span></span>
        </div>
        <span className="badge-indigo">RELAY LOBBY</span>
        <ProfileDropdown />
      </div>

      {/* Center Content */}
      <div style={styles.center}>
        {/* Animated Radar Pulse Rings */}
        <div style={styles.pulseContainer}>
          <div style={styles.pulseRing} />
          <div style={styles.pulseRingOuter} />
          <div style={styles.pulseCenter}>⚡</div>
        </div>

        <h1 style={styles.title}>WAITING FOR RELAY TO START{dots}</h1>
        <p style={styles.subtitle}>
          The administrator will start the relay leg shortly. You will be redirected automatically.
        </p>

        {/* Competitor Grid Card */}
        <div style={styles.userSection}>
          <div style={styles.userSectionHeader}>
            <span style={styles.userTitle}>ACTIVE COMPETITORS</span>
            <span className="badge-cyan">{users.length} ONLINE</span>
          </div>

          <div style={styles.userGrid}>
            {users.length === 0 ? (
              <p style={styles.noUsers}>Waiting for competitors to join...</p>
            ) : (
              users.map((u) => (
                <div
                  key={u}
                  style={{
                    ...styles.userCard,
                    borderColor: u === user.username ? "#c7d2fe" : "#e2e8f0",
                    background: u === user.username ? "#e0e7ff" : "#ffffff",
                  }}
                >
                  <span style={styles.avatarMini}>{u[0]?.toUpperCase()}</span>
                  <span
                    style={{
                      ...styles.userName,
                      color: u === user.username ? "#0f172a" : "#475569",
                      fontWeight: u === user.username ? "700" : "500",
                    }}
                  >
                    {u}
                  </span>
                  {u === user.username && (
                    <span className="badge-indigo" style={{ fontSize: "9px", padding: "2px 8px" }}>YOU</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    backgroundColor: "#f8fafc",
    backgroundImage: "radial-gradient(circle at 50% 30%, rgba(79, 70, 229, 0.08) 0%, transparent 60%)",
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
  center: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "16px",
    padding: "40px 20px",
  },
  pulseContainer: {
    position: "relative",
    width: "90px",
    height: "90px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "12px",
  },
  pulseRing: {
    position: "absolute",
    inset: "8px",
    border: "2px solid #4f46e5",
    borderRadius: "50%",
    animation: "floatPulse 2s ease-in-out infinite",
  },
  pulseRingOuter: {
    position: "absolute",
    inset: 0,
    border: "1px solid rgba(2, 132, 199, 0.4)",
    borderRadius: "50%",
    animation: "floatPulse 2s ease-in-out infinite 0.5s",
  },
  pulseCenter: {
    fontSize: "32px",
    color: "#4f46e5",
    zIndex: 2,
  },
  title: {
    color: "#0f172a",
    fontSize: "20px",
    fontWeight: "800",
    letterSpacing: "2px",
    textAlign: "center",
    margin: 0,
  },
  subtitle: {
    color: "#475569",
    fontSize: "13px",
    margin: 0,
    textAlign: "center",
    maxWidth: "460px",
  },
  userSection: {
    marginTop: "24px",
    background: "#ffffff",
    backdropFilter: "blur(16px)",
    border: "1px solid #e2e8f0",
    borderRadius: "16px",
    padding: "24px",
    width: "100%",
    maxWidth: "440px",
    boxShadow: "0 12px 40px rgba(0,0,0,0.05)",
  },
  userSectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
  },
  userTitle: {
    color: "#64748b",
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "1.5px",
  },
  userGrid: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    maxHeight: "260px",
    overflowY: "auto",
  },
  noUsers: {
    color: "#64748b",
    fontSize: "13px",
    textAlign: "center",
    padding: "16px",
  },
  userCard: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid #e2e8f0",
    transition: "all 0.3s",
  },
  avatarMini: {
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #4f46e5, #0284c7)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "bold",
    fontSize: "12px",
  },
  userName: {
    fontSize: "13px",
    flex: 1,
  },
};
