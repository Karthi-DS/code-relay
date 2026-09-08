import { useState, useEffect } from "react";

export default function SplashScreen({ onFinish }) {
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFadeOut(true), 1200);
    const hideTimer = setTimeout(() => {
      setVisible(false);
      onFinish();
    }, 1800);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, [onFinish]);

  if (!visible) return null;

  return (
    <div style={{ ...styles.overlay, opacity: fadeOut ? 0 : 1 }}>
      <style>{splashAnimations}</style>

      {/* Glowing Relay Symbol */}
      <div style={styles.iconWrapper}>
        <div style={styles.glowRing} />
        <span style={styles.relayIcon}>⚡</span>
      </div>

      <h1 style={styles.title}>
        CODE <span style={{ color: "#38bdf8" }}>RELAY</span>
      </h1>
      <p style={styles.subtitle}>COMPETITIVE SPEED & RELAY CODING</p>
    </div>
  );
}

const splashAnimations = `
@keyframes floatPulse {
  0%, 100% { transform: scale(1); opacity: 0.9; }
  50% { transform: scale(1.08); opacity: 1; }
}
@keyframes ringExpand {
  0%, 100% { box-shadow: 0 0 30px rgba(99, 102, 241, 0.4); }
  50% { box-shadow: 0 0 70px rgba(6, 182, 212, 0.6), 0 0 120px rgba(99, 102, 241, 0.3); }
}
`;

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "#f8fafc",
    backgroundImage: "radial-gradient(circle at 50% 50%, rgba(79, 70, 229, 0.08) 0%, transparent 60%)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 99999,
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    transition: "opacity 0.6s ease",
  },
  iconWrapper: {
    position: "relative",
    width: "100px",
    height: "100px",
    borderRadius: "24px",
    background: "linear-gradient(135deg, rgba(79, 70, 229, 0.1), rgba(2, 132, 199, 0.1))",
    border: "1px solid rgba(79, 70, 229, 0.25)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "24px",
    animation: "ringExpand 2s ease-in-out infinite",
  },
  glowRing: {
    position: "absolute",
    inset: "-8px",
    borderRadius: "30px",
    border: "1px solid rgba(79, 70, 229, 0.15)",
    animation: "floatPulse 2s ease-in-out infinite",
  },
  relayIcon: {
    fontSize: "44px",
    background: "linear-gradient(135deg, #4f46e5, #0284c7)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  title: {
    fontSize: "3rem",
    fontWeight: "800",
    color: "#4f46e5",
    letterSpacing: "4px",
    margin: 0,
  },
  subtitle: {
    color: "#475569",
    fontSize: "11px",
    letterSpacing: "5px",
    fontWeight: "600",
    marginTop: "12px",
  },
};
