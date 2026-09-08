import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

export default function LogoTopLeft() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const location = useLocation();

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const hideLogoRoutes = ["/arena", "/leaderboard", "/admin", "/admin/leaderboard"];
  if (hideLogoRoutes.includes(location.pathname)) return null;

  return (
    <div style={{ ...styles.wrapper, top: isMobile ? 14 : 20, left: isMobile ? 14 : 24 }}>
      <div style={styles.badge}>
        <span style={styles.bolt}>⚡</span>
        <span style={styles.brandText}>CODE <span style={{ color: "#38bdf8" }}>RELAY</span></span>
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    position: "fixed",
    zIndex: 9999,
    pointerEvents: "none",
    transition: "all 0.3s ease",
  },
  badge: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 16px",
    background: "rgba(255, 255, 255, 0.9)",
    backdropFilter: "blur(12px)",
    border: "1px solid #cbd5e1",
    borderRadius: "20px",
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.04)",
  },
  bolt: {
    fontSize: "16px",
    color: "#4f46e5",
  },
  brandText: {
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    fontWeight: "800",
    fontSize: "13px",
    color: "#4f46e5",
    letterSpacing: "2px",
  },
};
