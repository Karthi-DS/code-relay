import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getUser, logout } from "../services/auth";

export default function ProfileDropdown() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const user = getUser();
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div style={styles.container} ref={dropdownRef}>
      <button style={styles.trigger} onClick={() => setOpen(!open)}>
        <span style={styles.avatar}>
          {user.username?.[0]?.toUpperCase() || "?"}
        </span>
        <span style={styles.username}>{user.username}</span>
        <span style={styles.arrow}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={styles.dropdown}>
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <div style={styles.bigAvatar}>
                {user.username?.[0]?.toUpperCase()}
              </div>
              <div>
                <div style={styles.cardName}>{user.username}</div>
                {user.teamName && (
                  <div style={{ color: "#0284c7", fontSize: "11px", fontWeight: "700", marginTop: "2px" }}>
                    👥 TEAM: {user.teamName}
                  </div>
                )}
                <div style={styles.cardRole}>
                  {user.role === "admin" ? "⚡ Admin" : "🎮 Competitor"}
                </div>
              </div>
            </div>
            <div style={styles.divider} />
            <button style={styles.logoutBtn} onClick={handleLogout}>
              ⏻ LOGOUT
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { position: "relative" },
  trigger: {
    background: "rgba(255, 255, 255, 0.9)",
    backdropFilter: "blur(12px)",
    border: "1px solid #cbd5e1",
    borderRadius: "20px",
    color: "#0f172a",
    padding: "5px 14px 5px 6px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    fontSize: "13px",
    fontWeight: "600",
  },
  avatar: {
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #4f46e5, #0284c7)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "bold",
    fontSize: "13px",
  },
  username: { color: "#0f172a" },
  arrow: { fontSize: "9px", color: "#64748b" },
  dropdown: {
    position: "absolute",
    top: "100%",
    right: 0,
    marginTop: "10px",
    zIndex: 2000,
    animation: "fadeIn 0.2s ease",
  },
  card: {
    background: "#ffffff",
    backdropFilter: "blur(20px)",
    border: "1px solid #cbd5e1",
    borderRadius: "16px",
    padding: "20px",
    minWidth: "220px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  bigAvatar: {
    width: "42px",
    height: "42px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #4f46e5, #0284c7)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "bold",
    fontSize: "18px",
  },
  cardName: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: "16px",
  },
  cardRole: {
    color: "#4f46e5",
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "1px",
    fontWeight: "600",
    marginTop: "2px",
  },
  divider: {
    height: "1px",
    background: "#e2e8f0",
    margin: "16px 0",
  },
  logoutBtn: {
    background: "rgba(225, 29, 72, 0.08)",
    border: "1px solid rgba(225, 29, 72, 0.25)",
    borderRadius: "8px",
    color: "#be123c",
    padding: "10px",
    cursor: "pointer",
    width: "100%",
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    fontSize: "12px",
    fontWeight: "700",
    letterSpacing: "1px",
  },
};
