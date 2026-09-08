import { useNavigate } from "react-router-dom";

export default function RoundSelect() {
  const navigate = useNavigate();

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>SELECT ROUND</h1>

      <button style={styles.button} onClick={() => navigate("/arena?round=1")}>
        LEG 1
      </button>

      <button style={styles.button} onClick={() => navigate("/arena?round=2")}>
        LEG 2
      </button>
    </div>
  );
}

const styles = {
  container: {
    height: "100vh",
    background: "#f8fafc",
    color: "#0f172a",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
  },
  title: {
    marginBottom: "30px",
    letterSpacing: "3px",
    color: "#4f46e5",
    fontWeight: "800",
  },
  button: {
    background: "linear-gradient(135deg, #4f46e5, #4338ca)",
    color: "#ffffff",
    border: "none",
    padding: "15px 30px",
    margin: "10px",
    fontSize: "16px",
    fontWeight: "700",
    cursor: "pointer",
    width: "250px",
    borderRadius: "10px",
    boxShadow: "0 4px 16px rgba(79, 70, 229, 0.25)",
  },
};
