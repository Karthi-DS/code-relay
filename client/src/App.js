import { useState, useCallback } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Login from "./views/Login";
import WaitingRoom from "./views/WaitingRoom";
import CodingArena from "./views/CodingArena";
import Leaderboard from "./views/Leaderboard";
import AdminPanel from "./views/AdminPanel";
import AdminLeaderboard from "./views/AdminLeaderboard";
import LogoTopLeft from "./components/LogoTopRight";
import SplashScreen from "./components/SplashScreen";
import { isLoggedIn, getUser } from "./services/auth";
import "./styles/cyber.css";
import "./styles/glitch.css";

function ProtectedRoute({ children, adminOnly = false }) {
  if (!isLoggedIn()) return <Navigate to="/" />;
  const user = getUser();
  if (adminOnly && user.role !== "admin") return <Navigate to="/" />;
  return children;
}

function App() {
  const [splashDone, setSplashDone] = useState(false);
  const handleSplashFinish = useCallback(() => setSplashDone(true), []);

  if (!splashDone) {
    return <SplashScreen onFinish={handleSplashFinish} />;
  }

  return (
    <Router>
      <LogoTopLeft />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route
          path="/waiting"
          element={
            <ProtectedRoute>
              <WaitingRoom />
            </ProtectedRoute>
          }
        />
        <Route
          path="/arena"
          element={
            <ProtectedRoute>
              <CodingArena />
            </ProtectedRoute>
          }
        />
        <Route
          path="/leaderboard"
          element={
            <ProtectedRoute>
              <Leaderboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute adminOnly>
              <AdminPanel />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/leaderboard"
          element={
            <ProtectedRoute adminOnly>
              <AdminLeaderboard />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
