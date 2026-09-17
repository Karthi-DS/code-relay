require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const express = require("express");
const http = require("http");
const cors = require("cors");
const os = require("os");
const path = require("path");
const { Server } = require("socket.io");
const { initDb, getProblemsByRoundMap } = require("./db");
const { initMongo, saveTeamCode, getTeamCode } = require("./mongo");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
  pingInterval: 10000,
  pingTimeout: 20000,
});

app.use(cors());
app.use(express.json());

// Initialize PostgreSQL and MongoDB databases on startup
initDb().catch((err) => console.error("Database init error:", err));
initMongo().catch((err) => console.error("MongoDB init error:", err));

// ─── In-Memory Game State ───────────────────────────────────
const gameState = {
  onlineUsers: {},          // { username: { role, socketId, connected, points, disconnectTimer } }
  currentRound: 0,
  roundStatus: "waiting",   // "waiting" | "active" | "ended"
  roundEndTime: null,
  roundStartTime: null,
  roundTimer: null,
  submissions: {},
  removedUsers: new Set(),
  problemAssignments: {},   // { username: { 1: problemIndex, 2: problemIndex } }
  violations: {},           // { username: { fullscreen: count, tabSwitch: count } }
  tabKicked: [],            // [{ username, timestamp }] - users kicked for tab switching
  teamRelay: {},            // { teamName: { activeMember, turnSecondsLeft, code, language, isSubmitted } }
  teamSubmissions: {},      // { `${teamName}_round${round}`: { submitted: true, submittedBy: username } }
};

const DISCONNECT_GRACE_MS = 60000; // 60 second grace period before removing user

// Make io and gameState available to routes
app.use((req, res, next) => {
  req.io = io;
  req.gameState = gameState;
  next();
});

// ─── Routes ─────────────────────────────────────────────────
app.use("/auth", require("./routes/auth"));
app.use("/submit", require("./routes/submit"));
app.use("/admin", require("./routes/admin"));

// ─── Static Assets (client/build) ───────────────────────────
const clientBuildPath = path.join(__dirname, "../client/build");
app.use(express.static(clientBuildPath));

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/auth") || req.path.startsWith("/submit") || req.path.startsWith("/admin") || req.path.startsWith("/health")) {
    return next();
  }
  const indexPath = path.join(clientBuildPath, "index.html");
  if (require("fs").existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  res.send("CODE RELAY server running with PostgreSQL backend");
});

// ─── Helper Functions ───────────────────────────────────────
function getOnlineCompetitors() {
  return Object.entries(gameState.onlineUsers)
    .filter(([, d]) => d.role === "competitor" && d.connected)
    .map(([username]) => username);
}

function getAllCompetitors() {
  return Object.entries(gameState.onlineUsers)
    .filter(([, d]) => d.role === "competitor")
    .map(([username, d]) => ({
      username,
      connected: d.connected,
    }));
}

function getLeaderboard() {
  return Object.entries(gameState.onlineUsers)
    .filter(([, d]) => d.role === "competitor")
    .map(([username, d]) => {
      let violationPenalty = 0;
      const v = gameState.violations[username] || { fullscreen: 0, tabSwitch: 0 };
      const totalViolations = v.fullscreen + v.tabSwitch;

      if (totalViolations === 1) violationPenalty = 5;
      else if (totalViolations === 2) violationPenalty = 20;
      else if (totalViolations >= 3) violationPenalty = 50;

      let total = d.points.round1 + d.points.round2 - violationPenalty;
      if (total < 0) total = 0;

      return {
        username,
        round1: d.points.round1,
        round2: d.points.round2,
        violationPenalty,
        total,
        connected: d.connected,
      };
    })
    .sort((a, b) => b.total - a.total)
    .map((e, i) => ({ ...e, rank: i + 1 }));
}

/**
 * Assign a problem from PostgreSQL pool for a given round to a user.
 */
async function assignProblem(username, roundNum) {
  if (!gameState.problemAssignments[username]) {
    gameState.problemAssignments[username] = {};
  }
  if (gameState.problemAssignments[username][roundNum] !== undefined) {
    return gameState.problemAssignments[username][roundNum];
  }
  const problemPools = await getProblemsByRoundMap();
  const pool = problemPools[roundNum];
  if (!pool || pool.length === 0) return null;
  const startIndex = 0; // Always start at first problem sequentially
  gameState.problemAssignments[username][roundNum] = startIndex;
  return startIndex;
}

/**
 * Get the sanitized problem (no hidden test cases) for a user in a round.
 */
async function getUserProblem(username, roundNum) {
  const idx = gameState.problemAssignments[username]?.[roundNum];
  if (idx === undefined || idx === null) return null;
  const problemPools = await getProblemsByRoundMap();
  const pool = problemPools[roundNum];
  if (!pool || !pool[idx]) return null;
  const p = pool[idx];
  return {
    id: p.id,
    title: p.title,
    difficulty: p.difficulty,
    description: p.description,
    points: p.points,
    timeLimit: p.timeLimit,
    sampleTestCase: p.sampleTestCase || p.sample_test_case || null,
    starterCode: p.starterCode || p.starter_code || null,
  };
}

app.set("getLeaderboard", getLeaderboard);
app.set("getOnlineCompetitors", getOnlineCompetitors);
app.set("getAllCompetitors", getAllCompetitors);
app.set("assignProblem", assignProblem);
app.set("getUserProblem", getUserProblem);

// ─── Socket.IO ──────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("user:register", async ({ username, role, teamName, memberRole: clientMemberRole }) => {
    if (gameState.removedUsers.has(username)) {
      socket.emit("user:removed");
      return;
    }

    // Clear any pending disconnect timer
    if (gameState.onlineUsers[username]?.disconnectTimer) {
      clearTimeout(gameState.onlineUsers[username].disconnectTimer);
      gameState.onlineUsers[username].disconnectTimer = null;
    }

    if (!gameState.onlineUsers[username]) {
      gameState.onlineUsers[username] = {
        role,
        socketId: socket.id,
        connected: true,
        points: { round1: 0, round2: 0 },
        disconnectTimer: null,
      };
    } else {
      gameState.onlineUsers[username].socketId = socket.id;
      gameState.onlineUsers[username].connected = true;
    }

    // Initialize violations if not present
    if (role === "competitor" && !gameState.violations[username]) {
      gameState.violations[username] = { fullscreen: 0, tabSwitch: 0 };
    }

    // If there's an active round, assign a problem to this user
    let problem = null;
    if (gameState.currentRound > 0 && role === "competitor") {
      if (gameState.roundStatus === "active") {
        await assignProblem(username, gameState.currentRound);
        problem = await getUserProblem(username, gameState.currentRound);
      } else if (gameState.roundStatus === "ended") {
        problem = await getUserProblem(username, gameState.currentRound);
      }
    }

    // Determine member role in team (1 or 2) & team name
    let memberRole = clientMemberRole || 1;
    let userTeamName = teamName || "";
    try {
      const { query } = require("./db");
      const userRes = await query("SELECT id, team_name FROM users WHERE LOWER(username) = LOWER($1)", [username]);
      if (userRes.rowCount > 0 && userRes.rows[0].team_name) {
        userTeamName = userRes.rows[0].team_name;
        const teamRes = await query("SELECT id FROM teams WHERE LOWER(team_name) = LOWER($1)", [userRes.rows[0].team_name]);
        if (teamRes.rowCount > 0) {
          const assocList = await query("SELECT user_id FROM team_associations WHERE team_id = $1 ORDER BY created_at ASC, user_id ASC", [teamRes.rows[0].id]);
          const mIdx = assocList.rows.findIndex(r => r.user_id === userRes.rows[0].id);
          if (mIdx >= 0) memberRole = mIdx + 1;
        }
      }
    } catch (e) {
      console.log("Notice: Using fallback memberRole & teamName for socket:", e.message);
    }

    if (userTeamName) {
      socket.join(`team:${userTeamName}`);
    }

    // Fetch team's saved code & relay turn state from MongoDB/DB
    let relayState = { activeMember: 1, turnSecondsLeft: 300, problems: {} };
    if (userTeamName) {
      if (!gameState.teamRelay[userTeamName]) {
        const dbRelay = await getTeamCode(userTeamName, gameState.currentRound || 1);
        if (dbRelay) {
          relayState = {
            activeMember: dbRelay.activeMember || 1,
            turnSecondsLeft: dbRelay.turnSecondsLeft !== undefined ? dbRelay.turnSecondsLeft : 300,
            problems: {},
          };
        }
        gameState.teamRelay[userTeamName] = relayState;
      } else {
        relayState = gameState.teamRelay[userTeamName];
      }
    }

    const teamSub = userTeamName ? gameState.teamSubmissions?.[`${userTeamName}_round${gameState.currentRound || 1}`] : null;

    socket.emit("state:sync", {
      currentRound: gameState.currentRound,
      roundStatus: gameState.roundStatus,
      roundEndTime: gameState.roundEndTime,
      problem,
      memberRole,
      teamName: userTeamName,
      activeMember: relayState.activeMember,
      turnSecondsLeft: relayState.turnSecondsLeft,
      savedCode: relayState.code,
      savedLanguage: relayState.language,
      teamSubmitted: !!teamSub?.submitted,
      submittedBy: teamSub?.submittedBy || "",
    });

    io.emit("users:update", getOnlineCompetitors());
    io.emit("leaderboard:update", getLeaderboard());
    console.log(`👤 User registered: ${username} (${role}, Team: ${userTeamName || "none"}, Member: ${memberRole})`);
  });

  function handleViolation(username, type) {
    const v = gameState.violations[username];
    if (!v) return;

    if (type === "fullscreen") v.fullscreen++;
    if (type === "tab_switch") v.tabSwitch++;

    const total = v.fullscreen + v.tabSwitch;
    console.log(`🖥️ [VIOLATION] ${type} by ${username} (total: ${total})`);

    io.emit("violation:update", {
      username,
      count: total,
      fullscreen: v.fullscreen,
      tabSwitch: v.tabSwitch,
      type: type,
    });

    if (total >= 4) {
      console.log(`⛔ [KICK] 4th Violation by ${username} — Removing from competition`);

      gameState.removedUsers.add(username);
      gameState.tabKicked.push({ username, timestamp: Date.now() });

      if (gameState.onlineUsers[username]) {
        gameState.onlineUsers[username].points = { round1: 0, round2: 0 };
      }

      const userData = gameState.onlineUsers[username];
      if (userData && userData.socketId) {
        io.to(userData.socketId).emit("user:kicked", { reason: "Too many violations" });
      }

      io.emit("violation:update", {
        username,
        count: total,
        fullscreen: v.fullscreen,
        tabSwitch: v.tabSwitch,
        type: "max_violations",
        kicked: true,
      });

      io.emit("user:tab_kicked", {
        username,
        timestamp: Date.now(),
      });

      if (gameState.onlineUsers[username]?.disconnectTimer) {
        clearTimeout(gameState.onlineUsers[username].disconnectTimer);
      }
      delete gameState.onlineUsers[username];
      io.emit("users:update", getOnlineCompetitors());
    }

    io.emit("leaderboard:update", getLeaderboard());
  }

  // Track fullscreen violations
  socket.on("violation:fullscreen", ({ username }) => handleViolation(username, "fullscreen"));

  // Track tab switch violations
  socket.on("violation:tab_switch", ({ username }) => handleViolation(username, "tab_switch"));

  // Real-time Code Relay synchronization across teammates with MongoDB save
  socket.on("relay:code_change", async ({ teamName, code, language, username, problemId }) => {
    if (!teamName || !problemId) return;
    const cleanTeam = teamName.includes("_") ? teamName.split("_")[0] : teamName;
    const currentRound = gameState.currentRound || 1;
    if (gameState.roundStatus !== "active") return; // Code locked when round not active

    if (!gameState.teamRelay[cleanTeam]) {
      gameState.teamRelay[cleanTeam] = {
        activeMember: 1,
        turnSecondsLeft: 300,
        problems: {},
      };
    }
    if (!gameState.teamRelay[cleanTeam].problems) {
      gameState.teamRelay[cleanTeam].problems = {};
    }

    gameState.teamRelay[cleanTeam].problems[problemId] = {
      code,
      language: language || "python",
      lastUpdatedBy: username || "",
    };

    // Save to MongoDB / DB with clean teamName and problemId
    await saveTeamCode({
      teamName: cleanTeam,
      round: currentRound,
      problemId,
      code,
      language: language || "python",
      activeMember: gameState.teamRelay[cleanTeam].activeMember || 1,
      turnSecondsLeft: gameState.teamRelay[cleanTeam].turnSecondsLeft || 300,
      lastUpdatedBy: username || "",
    });

    // Broadcast to room & legacy socket topic specifically for this problemId
    io.to(`team:${cleanTeam}`).emit("relay:code_sync", {
      problemId,
      code,
      language: language || "python",
      activeMember: gameState.teamRelay[cleanTeam].activeMember,
      updatedBy: username,
    });
    socket.broadcast.emit(`relay:code_sync:${cleanTeam}`, {
      problemId,
      code,
      language: language || "python",
      updatedBy: username,
    });
  });

  socket.on("relay:problem_switch", ({ teamName, problemIndex, problemId, username }) => {
    if (!teamName) return;
    const cleanTeam = teamName.includes("_") ? teamName.split("_")[0] : teamName;
    io.to(`team:${cleanTeam}`).emit("relay:problem_switch", {
      problemIndex,
      problemId,
      switchedBy: username,
    });
    socket.broadcast.emit(`relay:problem_switch:${cleanTeam}`, {
      problemIndex,
      problemId,
      switchedBy: username,
    });
  });

  socket.on("relay:get_state", async ({ teamName, round, problemId }, callback) => {
    if (!teamName) return;
    const cleanTeam = teamName.includes("_") ? teamName.split("_")[0] : teamName;
    const roundNum = Number(round) || gameState.currentRound || 1;
    const teamRelay = gameState.teamRelay[cleanTeam];
    const inMemProb = teamRelay?.problems?.[problemId];

    let code = inMemProb?.code;
    let language = inMemProb?.language;
    let activeMember = teamRelay?.activeMember || 1;
    let turnSecondsLeft = teamRelay?.turnSecondsLeft !== undefined ? teamRelay.turnSecondsLeft : 300;

    if (code === undefined) {
      const dbState = await getTeamCode(cleanTeam, roundNum, problemId || "");
      code = dbState?.code || "";
      language = dbState?.language || "python";
      if (dbState?.activeMember !== undefined && !teamRelay) activeMember = dbState.activeMember;
      if (dbState?.turnSecondsLeft !== undefined && !teamRelay) turnSecondsLeft = dbState.turnSecondsLeft;
    }

    const resState = {
      teamName: cleanTeam,
      problemId,
      code,
      language: language || "python",
      activeMember,
      turnSecondsLeft,
    };
    if (typeof callback === "function") callback(resState);
    socket.emit("relay:state_response", resState);
  });

  socket.on("disconnect", () => {
    for (const [username, data] of Object.entries(gameState.onlineUsers)) {
      if (data.socketId === socket.id) {
        data.connected = false;
        console.log(`User disconnected (${DISCONNECT_GRACE_MS / 1000}s grace): ${username}`);

        io.emit("users:update", getOnlineCompetitors());

        data.disconnectTimer = setTimeout(() => {
          if (gameState.onlineUsers[username] && !gameState.onlineUsers[username].connected) {
            if (gameState.roundStatus === "active" || Object.keys(gameState.submissions).some(k => k.startsWith(username))) {
              console.log(`User timeout but keeping for scores: ${username}`);
            } else {
              delete gameState.onlineUsers[username];
              console.log(`User fully removed after timeout: ${username}`);
            }
            io.emit("users:update", getOnlineCompetitors());
            io.emit("leaderboard:update", getLeaderboard());
          }
        }, DISCONNECT_GRACE_MS);

        break;
      }
    }
  });
});

// ─── Team Relay 5-Minute Turn Server Loop ───────────────────
setInterval(async () => {
  if (gameState.roundStatus !== "active") return;

  for (const [rawTeamName, relay] of Object.entries(gameState.teamRelay)) {
    if (!relay) continue;
    // Guarantee real team name (in case of legacy keys)
    const teamName = rawTeamName.includes("_") ? rawTeamName.split("_")[0] : rawTeamName;

    if (relay.turnSecondsLeft > 1) {
      relay.turnSecondsLeft--;
    } else {
      // 5 Minutes (300 seconds) elapsed! Auto-switch active member (1 -> 2 or 2 -> 1)
      const nextMember = relay.activeMember === 1 ? 2 : 1;
      relay.activeMember = nextMember;
      relay.turnSecondsLeft = 300;

      console.log(`⏱️ [5-MIN AUTO-SWITCH] Team "${teamName}" turned over to Member ${nextMember}`);

      try {
        const probKeys = relay.problems ? Object.keys(relay.problems) : [];
        if (probKeys.length > 0) {
          for (const pId of probKeys) {
            const pData = relay.problems[pId];
            await saveTeamCode({
              teamName,
              round: gameState.currentRound || 1,
              problemId: pId,
              code: pData.code || "",
              language: pData.language || "python",
              activeMember: nextMember,
              turnSecondsLeft: 300,
              lastUpdatedBy: "system",
            });
          }
        } else {
          await saveTeamCode({
            teamName,
            round: gameState.currentRound || 1,
            problemId: "",
            code: "",
            language: "python",
            activeMember: nextMember,
            turnSecondsLeft: 300,
            lastUpdatedBy: "system",
          });
        }
      } catch (e) {
        console.warn("MongoDB turn switch save error:", e.message);
      }

      io.to(`team:${teamName}`).emit("relay:turn_switch", {
        teamName,
        activeMember: nextMember,
        turnSecondsLeft: 300,
        switchedBy: "system",
      });
      io.emit(`relay:turn_switch:${teamName}`, {
        teamName,
        activeMember: nextMember,
        turnSecondsLeft: 300,
      });
    }
  }
}, 1000);

// ─── Get LAN IP Address ─────────────────────────────────────
function getLanIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "localhost";
}

// ─── Health Check Endpoint ──────────────────────────────────
app.get("/health", async (req, res) => {
  res.json({
    server: "ok",
    db: "postgresql",
    uptime: process.uptime(),
    competitors: getOnlineCompetitors().length,
    currentRound: gameState.currentRound,
    roundStatus: gameState.roundStatus,
  });
});

// ─── Start Server ───────────────────────────────────────────
const PORT = process.env.SERVER_PORT || 5000;

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n❌ Port ${PORT} is already in use!`);
    console.error(`   Run stop.bat first, or kill the process on port ${PORT}.\n`);
    console.error(`   Retrying in 3 seconds...\n`);
    setTimeout(() => {
      server.close();
      server.listen(PORT, "0.0.0.0");
    }, 3000);
  } else {
    console.error("Server error:", err);
  }
});

server.listen(PORT, "0.0.0.0", () => {
  const lanIP = getLanIP();
  console.log(`\n⚡ CODE RELAY server running with PostgreSQL backend`);
  console.log(`   Local:   http://localhost:${PORT}`);
  console.log(`   Network: http://${lanIP}:${PORT}\n`);
});
