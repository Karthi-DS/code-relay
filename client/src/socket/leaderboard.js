import { io } from "socket.io-client";
import { API_URL } from "../services/api";

export const socket = io(API_URL, {
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
  transports: ["websocket", "polling"],
});

// Auto-re-register on reconnect
let cachedUsername = null;
let cachedRole = null;

socket.on("connect", () => {
  console.log("Socket connected:", socket.id);
  if (cachedUsername && cachedRole) {
    socket.emit("user:register", { username: cachedUsername, role: cachedRole });
  }
});

socket.on("disconnect", (reason) => {
  console.log("Socket disconnected:", reason);
});

export function registerUser(username, role, teamName, memberRole) {
  cachedUsername = username;
  cachedRole = role;
  socket.emit("user:register", { username, role, teamName, memberRole });
}
