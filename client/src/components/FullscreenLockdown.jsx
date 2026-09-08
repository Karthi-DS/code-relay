import { useEffect, useState, useCallback, useRef } from "react";
import { socket } from "../socket/leaderboard";
import { getUser } from "../services/auth";

/**
 * FullscreenLockdown - Forces competitors into fullscreen during active rounds.
 * - Shows a blocking overlay requiring fullscreen entry
 * - Re-shows overlay if user exits fullscreen during round
 * - Tracks fullscreen violations and reports to admin via socket
 * - Tab switching immediately kicks the user from the competition
 * - Blocks keyboard shortcuts and right-click
 * - Shows warning on page leave
 */
export default function FullscreenLockdown({ roundActive, children }) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [violationCount, setViolationCount] = useState(0);
  const [kicked, setKicked] = useState(false);
  const violationRef = useRef(0);
  const kickedRef = useRef(false);
  // const tabSwitchCountRef = useRef(0);
  const user = getUser();
  const roundActiveRef = useRef(roundActive);
  roundActiveRef.current = roundActive;

  // Check fullscreen state
  const checkFullscreen = useCallback(() => {
    const fs = !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );
    setIsFullscreen(fs);
    return fs;
  }, []);

  // Enter fullscreen
  const enterFullscreen = useCallback(async () => {
    try {
      const el = document.documentElement;
      if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if (el.webkitRequestFullscreen) {
        await el.webkitRequestFullscreen();
      } else if (el.mozRequestFullScreen) {
        await el.mozRequestFullScreen();
      } else if (el.msRequestFullscreen) {
        await el.msRequestFullscreen();
      }
      setIsFullscreen(true);
      setShowPrompt(false);
    } catch (err) {
      console.error("Fullscreen request failed:", err);
    }
  }, []);

  // Exit fullscreen (when round ends)
  const exitFullscreen = useCallback(() => {
    try {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    } catch (err) {
      // Ignore
    }
  }, []);

  // Handle fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      const fs = checkFullscreen();
      if (!fs && roundActiveRef.current) {
        // User exited fullscreen during active round - FULLSCREEN VIOLATION
        setShowPrompt(true);
        violationRef.current += 1;
        setViolationCount(violationRef.current);

        // Report fullscreen violation to server
        socket.emit("violation:fullscreen", {
          username: user.username,
          type: "fullscreen_exit",
        });
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
      document.removeEventListener("MSFullscreenChange", handleFullscreenChange);
    };
  }, [checkFullscreen, user.username]);

  // Block keyboard shortcuts
  useEffect(() => {
    if (!roundActive) return;

    const handleKeyDown = (e) => {
      // Block common escape shortcuts
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      // Block F11
      if (e.key === "F11") {
        e.preventDefault();
      }
      // Block Ctrl+W (close tab)
      if (e.ctrlKey && e.key === "w") {
        e.preventDefault();
      }
      // Block Alt+F4
      if (e.altKey && e.key === "F4") {
        e.preventDefault();
      }
      // Block Ctrl+Shift+I (devtools), Ctrl+Shift+J, F12
      if (
        (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "J")) ||
        e.key === "F12"
      ) {
        e.preventDefault();
      }
    };

    // Block right-click
    const handleContextMenu = (e) => {
      e.preventDefault();
      return false;
    };

    // Warn before leaving page
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "Competition is in progress. Are you sure you want to leave?";
      return e.returnValue;
    };

    // Detect visibility change (tab switch) — DISABLED FOR TESTING
    const handleVisibilityChange = () => {
      /*
      if (document.hidden && roundActiveRef.current && !kickedRef.current) {
        tabSwitchCountRef.current += 1;

        if (tabSwitchCountRef.current === 1) {
          alert("⚠️ TAB SWITCH WARNING ⚠️\n\nThis is your ONLY warning. Do not switch tabs or minimize the browser window. Doing it again will instantly disqualify you from the competition.");
        } else if (tabSwitchCountRef.current >= 2) {
          kickedRef.current = true;
          socket.emit("violation:tab_switch", {
            username: user.username,
          });
          setKicked(true);
        }
      }
      */
    };

    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("beforeunload", handleBeforeUnload);
    // document.addEventListener("visibilitychange", handleVisibilityChange);

    // Listen for server confirmation of kick (only set once)
    socket.on("user:kicked", () => {
      if (!kickedRef.current) {
        kickedRef.current = true;
        setKicked(true);
      }
    });

    // Listen for kick revoke from admin
    socket.on("user:kick_revoked", ({ username: revokedUser }) => {
      if (revokedUser === user.username) {
        kickedRef.current = false;
        setKicked(false);
      }
    });

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      socket.off("user:kicked");
      socket.off("user:kick_revoked");
    };
  }, [roundActive, user.username]);

  // Show prompt when round becomes active and not in fullscreen
  useEffect(() => {
    if (roundActive && !checkFullscreen()) {
      setShowPrompt(true);
    }
    if (!roundActive) {
      setShowPrompt(false);
      // Exit fullscreen when round ends
      if (checkFullscreen()) {
        exitFullscreen();
      }
    }
  }, [roundActive, checkFullscreen, exitFullscreen]);

  // If round is not active, just render children normally
  if (!roundActive && !kicked) {
    return children;
  }

  // If kicked for tab switching, show removal screen
  if (kicked) {
    return (
      <div style={styles.overlay}>
        <div style={styles.promptBox}>
          <div style={{ fontSize: "64px", marginBottom: "20px" }}>🚫</div>
          <h1 style={{ ...styles.promptTitle, color: "#ff4444", fontSize: "22px" }}>
            YOU ARE REMOVED FROM THE COMPETITION
          </h1>
          <p style={{ color: "#ff6666", fontSize: "14px", lineHeight: "1.8", marginBottom: "16px" }}>
            Tab switching was detected during the active round.
          </p>
          <p style={{ color: "#666", fontSize: "12px", lineHeight: "1.8", marginBottom: "24px" }}>
            This is a serious violation. You have been permanently removed from this competition.
            Your submission has been disqualified.
          </p>
          <div style={{
            background: "#ff444415",
            border: "1px solid #ff444440",
            padding: "12px 20px",
            color: "#ff4444",
            fontSize: "11px",
            letterSpacing: "2px",
            fontWeight: "bold",
          }}>
            ⛔ DISQUALIFIED — TAB SWITCH DETECTED
          </div>
        </div>
      </div>
    );
  }

  // If in fullscreen, render children
  if (isFullscreen && !showPrompt) {
    return (
      <>
        {children}
        {/* Fullscreen violation indicator */}
        {violationCount > 0 && (
          <div style={styles.violationBadge}>
            🖥️ {violationCount} fullscreen violation{violationCount > 1 ? "s" : ""}
          </div>
        )}
      </>
    );
  }

  // Show fullscreen prompt overlay
  return (
    <>
      {/* Blocked content behind overlay */}
      <div style={styles.blockedContent}>{children}</div>

      {/* Fullscreen prompt overlay */}
      <div style={styles.overlay}>
        <div style={styles.promptBox}>
          <div style={styles.lockIcon}>🔒</div>
          <h1 style={styles.promptTitle}>COMPETITION MODE REQUIRED</h1>
          <p style={styles.promptText}>
            You must enter fullscreen mode to participate in the competition.
            <br />
            Exiting fullscreen during the round is considered a violation.
          </p>
          {violationCount > 0 && (
            <div style={styles.violationWarning}>
              🖥️ {violationCount} FULLSCREEN VIOLATION{violationCount > 1 ? "S" : ""} RECORDED
            </div>
          )}
          <button onClick={enterFullscreen} style={styles.enterBtn}>
            ▶ ENTER FULLSCREEN MODE
          </button>
          <p style={styles.disclaimer}>
            Press F11 or click the button above. Do not exit until the round ends.
          </p>
        </div>
      </div>
    </>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(248, 250, 252, 0.97)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 99999,
    fontFamily: "'JetBrains Mono', monospace",
  },
  promptBox: {
    textAlign: "center",
    padding: "60px 48px",
    border: "1px solid rgba(225, 29, 72, 0.3)",
    background: "#ffffff",
    borderRadius: "16px",
    maxWidth: "500px",
    boxShadow: "0 10px 40px rgba(0,0,0,0.08)",
  },
  lockIcon: {
    fontSize: "48px",
    marginBottom: "20px",
  },
  promptTitle: {
    color: "#e11d48",
    fontSize: "18px",
    letterSpacing: "4px",
    marginBottom: "16px",
  },
  promptText: {
    color: "#475569",
    fontSize: "12px",
    lineHeight: "1.8",
    marginBottom: "24px",
  },
  violationWarning: {
    color: "#d97706",
    fontSize: "13px",
    fontWeight: "bold",
    letterSpacing: "2px",
    padding: "10px 20px",
    border: "1px solid rgba(217, 119, 6, 0.3)",
    background: "rgba(217, 119, 6, 0.08)",
    marginBottom: "24px",
  },
  enterBtn: {
    background: "linear-gradient(135deg, #059669, #047857)",
    color: "#ffffff",
    border: "none",
    padding: "16px 48px",
    fontWeight: "bold",
    cursor: "pointer",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "14px",
    letterSpacing: "3px",
    transition: "all 0.3s",
    borderRadius: "8px",
  },
  disclaimer: {
    color: "#64748b",
    fontSize: "9px",
    marginTop: "20px",
    letterSpacing: "1px",
  },
  blockedContent: {
    filter: "blur(20px)",
    pointerEvents: "none",
    userSelect: "none",
  },
  violationBadge: {
    position: "fixed",
    top: "64px",
    right: "16px",
    background: "#ff990020",
    border: "1px solid #ff990040",
    color: "#ff9900",
    padding: "4px 12px",
    fontSize: "10px",
    fontFamily: "'JetBrains Mono', monospace",
    letterSpacing: "1px",
    zIndex: 2000,
  },
};
