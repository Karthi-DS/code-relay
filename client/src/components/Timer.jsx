import { useEffect, useState } from "react";

export default function Timer({ endTime, onTimeUp }) {
  const [timeLeft, setTimeLeft] = useState("--:--:--");
  const [urgent, setUrgent] = useState(false);

  useEffect(() => {
    if (!endTime) return;

    const tick = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((endTime - now) / 1000));

      if (diff <= 0) {
        setTimeLeft("00:00:00");
        setUrgent(true);
        if (onTimeUp) onTimeUp();
        return;
      }

      setUrgent(diff < 300); // Last 5 minutes

      const h = String(Math.floor(diff / 3600)).padStart(2, "0");
      const m = String(Math.floor((diff % 3600) / 60)).padStart(2, "0");
      const s = String(diff % 60).padStart(2, "0");
      setTimeLeft(`${h}:${m}:${s}`);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [endTime, onTimeUp]);

  return (
    <span
      style={{
        color: urgent ? "#ff2222" : "#ff5555",
        animation: urgent ? "pulse 1s infinite" : "none",
        fontWeight: "bold",
        fontSize: "22px",
        letterSpacing: "3px",
        textShadow: urgent ? "0 0 15px #ff2222" : "0 0 10px #ff555530",
      }}
    >
      {timeLeft}
    </span>
  );
}
