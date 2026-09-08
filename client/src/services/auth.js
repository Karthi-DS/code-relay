import { API_URL } from "./api";

export async function loginUser(username, password) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "Login failed");
  }

  const data = await res.json();

  // Store auth data in both sessionStorage (per-tab isolation) and localStorage
  sessionStorage.setItem("token", data.token);
  sessionStorage.setItem("username", data.username);
  sessionStorage.setItem("role", data.role);
  if (data.teamName) sessionStorage.setItem("teamName", data.teamName);
  if (data.memberRole) sessionStorage.setItem("memberRole", String(data.memberRole));

  localStorage.setItem("token", data.token);
  localStorage.setItem("username", data.username);
  localStorage.setItem("role", data.role);
  if (data.teamName) localStorage.setItem("teamName", data.teamName);
  if (data.memberRole) localStorage.setItem("memberRole", String(data.memberRole));

  return data;
}

export async function fetchExistingTeams() {
  try {
    const res = await fetch(`${API_URL}/auth/teams`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.teams || [];
  } catch (err) {
    console.error("Failed to fetch teams:", err);
    return [];
  }
}

export async function registerUser(username, password, teamMode, teamName, teamId) {
  try {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, teamMode, teamName, teamId }),
    });

    if (!res.ok) {
      try {
        const err = await res.json();
        throw new Error(err.message || "Registration failed");
      } catch (e) {
        throw new Error(e.message || `Registration failed (${res.status}): Server error`);
      }
    }

    const data = await res.json();
    if (data.token) {
      sessionStorage.setItem("token", data.token);
      sessionStorage.setItem("username", data.username);
      sessionStorage.setItem("role", data.role || "competitor");
      if (data.teamName) sessionStorage.setItem("teamName", data.teamName);
      if (data.memberRole) sessionStorage.setItem("memberRole", String(data.memberRole));

      localStorage.setItem("token", data.token);
      localStorage.setItem("username", data.username);
      localStorage.setItem("role", data.role || "competitor");
      if (data.teamName) localStorage.setItem("teamName", data.teamName);
      if (data.memberRole) localStorage.setItem("memberRole", String(data.memberRole));
    }

    return { username: data.username, teamName: data.teamName, registered: true };
  } catch (err) {
    throw new Error(err.message || "Registration failed");
  }
}

export function getUser() {
  return {
    username: sessionStorage.getItem("username") || localStorage.getItem("username"),
    role: sessionStorage.getItem("role") || localStorage.getItem("role"),
    teamName: sessionStorage.getItem("teamName") || localStorage.getItem("teamName"),
    token: sessionStorage.getItem("token") || localStorage.getItem("token"),
    memberRole: Number(sessionStorage.getItem("memberRole") || localStorage.getItem("memberRole")) || 1,
  };
}

export function isLoggedIn() {
  return !!(sessionStorage.getItem("token") || localStorage.getItem("token"));
}

export function logout() {
  sessionStorage.clear();
  localStorage.removeItem("token");
  localStorage.removeItem("username");
  localStorage.removeItem("role");
  localStorage.removeItem("teamName");
  localStorage.removeItem("memberRole");
}
