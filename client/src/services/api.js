// Dynamic URL: works on localhost AND LAN (uses the hostname the browser connected to)
const hostname = window.location.hostname || "localhost";
export const API_URL = `http://${hostname}:5000`;

export function getAuthHeaders() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function fetchWithAuth(url, options = {}) {
  const res = await fetch(`${API_URL}${url}`, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
  });

  if (res.status === 401) {
    // Token is invalid or expired
    localStorage.clear(); // Clear expired token and stored state
    window.location.href = "/"; // Redirect to login page
    throw new Error("Token expired. Please log in again.");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Request failed" }));
    throw new Error(err.message);
  }

  return res.json();
}
