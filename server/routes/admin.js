const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const { query, getAllProblemsWithTestCases, getProblemsByRoundMap } = require("../db");

// Admin-only middleware
const adminOnly = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

// ─── Problem & Solution & Testcase Management Routes ──────────────

// GET all problems with solutions and test cases
router.get("/problems", authMiddleware, adminOnly, async (req, res) => {
  try {
    const problems = await getAllProblemsWithTestCases();
    res.json({ problems });
  } catch (err) {
    console.error("Failed to fetch problems:", err);
    res.status(500).json({ message: "Failed to fetch problems: " + err.message });
  }
});

// GET all teams and their members (via team_associations)
router.get("/teams", authMiddleware, adminOnly, async (req, res) => {
  try {
    const teamsRes = await query(`
      SELECT t.id as team_id, t.team_name, t.created_at, u.id as user_id, u.username, u.role
      FROM teams t
      LEFT JOIN team_associations ta ON t.id = ta.team_id
      LEFT JOIN users u ON ta.user_id = u.id
      ORDER BY t.team_name ASC, u.username ASC
    `);

    const gs = req.gameState;
    const removedUsers = gs.removedUsers || new Set();

    const teamsMap = {};
    teamsRes.rows.forEach((row) => {
      if (!teamsMap[row.team_id]) {
        teamsMap[row.team_id] = {
          id: row.team_id,
          teamName: row.team_name,
          memberCount: 0,
          members: [],
          isBlocked: false,
          createdAt: row.created_at,
        };
      }
      if (row.user_id && row.username) {
        const isUserBlocked = removedUsers.has(row.username);
        teamsMap[row.team_id].members.push({
          userId: row.user_id,
          username: row.username,
          role: row.role,
          isBlocked: isUserBlocked,
        });
        teamsMap[row.team_id].memberCount += 1;
      }
    });

    // Determine if entire team is blocked (if any or all members blocked)
    const teamsList = Object.values(teamsMap).map(team => {
      const blockedMembersCount = team.members.filter(m => m.isBlocked).length;
      return {
        ...team,
        isBlocked: team.memberCount > 0 && blockedMembersCount === team.memberCount,
        hasBlockedMember: blockedMembersCount > 0,
      };
    });

    res.json({ teams: teamsList });
  } catch (err) {
    console.error("Failed to fetch teams:", err);
    res.status(500).json({ message: "Failed to fetch teams: " + err.message });
  }
});

// POST Block an entire team from the arena
router.post("/block-team", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { teamName } = req.body;
    const gs = req.gameState;

    if (!teamName) {
      return res.status(400).json({ message: "Team name is required" });
    }

    // Fetch member usernames belonging to team
    const membersRes = await query(`
      SELECT u.username
      FROM users u
      JOIN team_associations ta ON u.id = ta.user_id
      JOIN teams t ON ta.team_id = t.id
      WHERE LOWER(t.team_name) = LOWER($1)
    `, [teamName.trim()]);

    const usernames = membersRes.rows.map(r => r.username);

    if (usernames.length === 0) {
      // Fallback check by team_name on users table directly
      const userDirectRes = await query("SELECT username FROM users WHERE LOWER(team_name) = LOWER($1)", [teamName.trim()]);
      userDirectRes.rows.forEach(r => {
        if (!usernames.includes(r.username)) usernames.push(r.username);
      });
    }

    usernames.forEach(uname => {
      if (uname !== "admin") {
        gs.removedUsers.add(uname);

        // Notify socket if connected
        const userData = gs.onlineUsers[uname];
        if (userData && userData.socketId) {
          req.io.to(userData.socketId).emit("user:removed");
        }
        delete gs.onlineUsers[uname];
      }
    });

    req.io.emit("users:update", req.app.get("getOnlineCompetitors")());
    req.io.emit("leaderboard:update", req.app.get("getLeaderboard")());

    res.json({
      success: true,
      message: `Team "${teamName}" (${usernames.length} members) has been blocked from the arena.`,
      blockedUsers: usernames,
    });
  } catch (err) {
    console.error("Failed to block team:", err);
    res.status(500).json({ message: "Failed to block team: " + err.message });
  }
});

// POST Unblock a team
router.post("/unblock-team", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { teamName } = req.body;
    const gs = req.gameState;

    if (!teamName) {
      return res.status(400).json({ message: "Team name is required" });
    }

    const membersRes = await query(`
      SELECT u.username
      FROM users u
      JOIN team_associations ta ON u.id = ta.user_id
      JOIN teams t ON ta.team_id = t.id
      WHERE LOWER(t.team_name) = LOWER($1)
    `, [teamName.trim()]);

    const usernames = membersRes.rows.map(r => r.username);

    usernames.forEach(uname => {
      gs.removedUsers.delete(uname);
      req.io.emit("user:kick_revoked", { username: uname });
    });

    req.io.emit("users:update", req.app.get("getOnlineCompetitors")());

    res.json({
      success: true,
      message: `Team "${teamName}" has been unblocked.`,
      unblockedUsers: usernames,
    });
  } catch (err) {
    console.error("Failed to unblock team:", err);
    res.status(500).json({ message: "Failed to unblock team: " + err.message });
  }
});

// POST create a single problem with reference solution, starter code, and test cases
router.post("/problems", authMiddleware, adminOnly, async (req, res) => {
  try {
    const {
      id,
      round,
      title,
      difficulty,
      description,
      solution,
      points,
      timeLimit,
      sampleTestCase,
      starterCode,
      testCases,
    } = req.body;

    if (!title || !description || !round) {
      return res.status(400).json({ message: "Title, description, and round (1 or 2) are required." });
    }

    const problemId = (id || `r${round}p_${Date.now()}`).trim();
    const roundNum = parseInt(round, 10);
    const pts = parseInt(points || "100", 10);
    const limit = parseInt(timeLimit || "2000", 10);

    // Insert or update problem in PostgreSQL
    await query(
      `INSERT INTO problems (id, round, title, difficulty, description, solution, points, time_limit, sample_test_case, starter_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO UPDATE SET
         round = EXCLUDED.round,
         title = EXCLUDED.title,
         difficulty = EXCLUDED.difficulty,
         description = EXCLUDED.description,
         solution = EXCLUDED.solution,
         points = EXCLUDED.points,
         time_limit = EXCLUDED.time_limit,
         sample_test_case = EXCLUDED.sample_test_case,
         starter_code = EXCLUDED.starter_code`,
      [
        problemId,
        roundNum,
        title.trim(),
        difficulty || "Easy",
        description,
        solution || null,
        pts,
        limit,
        sampleTestCase ? JSON.stringify(sampleTestCase) : null,
        starterCode ? JSON.stringify(starterCode) : null,
      ]
    );

    // Delete existing test cases if updating
    await query("DELETE FROM test_cases WHERE problem_id = $1", [problemId]);

    // Insert new test cases
    if (Array.isArray(testCases)) {
      for (const tc of testCases) {
        if (tc.input !== undefined && tc.expectedOutput !== undefined) {
          await query(
            `INSERT INTO test_cases (problem_id, input, expected_output, is_sample)
             VALUES ($1, $2, $3, $4)`,
            [problemId, tc.input, tc.expectedOutput, !!tc.isSample]
          );
        }
      }
    }

    // Insert sample test case into test_cases table if provided
    if (sampleTestCase && sampleTestCase.input) {
      await query(
        `INSERT INTO test_cases (problem_id, input, expected_output, is_sample)
         VALUES ($1, $2, $3, true)`,
        [problemId, sampleTestCase.input, sampleTestCase.output || sampleTestCase.expectedOutput || "", true]
      );
    }

    res.json({ success: true, message: `Problem "${title}" saved successfully!`, problemId });
  } catch (err) {
    console.error("Failed to save problem:", err);
    res.status(500).json({ message: "Failed to save problem: " + err.message });
  }
});

// PUT update existing problem
router.put("/problems/:id", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    req.body.id = id;
    const {
      round,
      title,
      difficulty,
      description,
      solution,
      points,
      timeLimit,
      sampleTestCase,
      starterCode,
      testCases,
    } = req.body;

    const roundNum = parseInt(round, 10);
    const pts = parseInt(points || "100", 10);
    const limit = parseInt(timeLimit || "2000", 10);

    await query(
      `UPDATE problems SET
         round = $1,
         title = $2,
         difficulty = $3,
         description = $4,
         solution = $5,
         points = $6,
         time_limit = $7,
         sample_test_case = $8,
         starter_code = $9
       WHERE id = $10`,
      [
        roundNum,
        title.trim(),
        difficulty || "Easy",
        description,
        solution || null,
        pts,
        limit,
        sampleTestCase ? JSON.stringify(sampleTestCase) : null,
        starterCode ? JSON.stringify(starterCode) : null,
        id,
      ]
    );

    await query("DELETE FROM test_cases WHERE problem_id = $1", [id]);

    if (Array.isArray(testCases)) {
      for (const tc of testCases) {
        if (tc.input !== undefined && tc.expectedOutput !== undefined) {
          await query(
            `INSERT INTO test_cases (problem_id, input, expected_output, is_sample)
             VALUES ($1, $2, $3, $4)`,
            [id, tc.input, tc.expectedOutput, !!tc.isSample]
          );
        }
      }
    }

    res.json({ success: true, message: `Problem "${title}" updated successfully!` });
  } catch (err) {
    console.error("Failed to update problem:", err);
    res.status(500).json({ message: "Failed to update problem: " + err.message });
  }
});

// DELETE problem
router.delete("/problems/:id", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    await query("DELETE FROM problems WHERE id = $1", [id]);
    res.json({ success: true, message: `Problem ${id} deleted successfully.` });
  } catch (err) {
    console.error("Failed to delete problem:", err);
    res.status(500).json({ message: "Failed to delete problem: " + err.message });
  }
});

// POST Batch JSON upload of problems, solutions, starter code, and testcases
router.post("/problems/upload-json", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { problems: problemList } = req.body;

    if (!Array.isArray(problemList) || problemList.length === 0) {
      return res.status(400).json({ message: "Invalid payload: Array of problems required under key 'problems'" });
    }

    let count = 0;
    for (const p of problemList) {
      const pId = (p.id || `p_${Date.now()}_${Math.floor(Math.random() * 1000)}`).trim();
      const roundNum = parseInt(p.round || 1, 10);
      const pts = parseInt(p.points || 100, 10);
      const limit = parseInt(p.timeLimit || p.time_limit || 2000, 10);

      await query(
        `INSERT INTO problems (id, round, title, difficulty, description, solution, points, time_limit, sample_test_case, starter_code)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO UPDATE SET
           round = EXCLUDED.round,
           title = EXCLUDED.title,
           difficulty = EXCLUDED.difficulty,
           description = EXCLUDED.description,
           solution = EXCLUDED.solution,
           points = EXCLUDED.points,
           time_limit = EXCLUDED.time_limit,
           sample_test_case = EXCLUDED.sample_test_case,
           starter_code = EXCLUDED.starter_code`,
        [
          pId,
          roundNum,
          p.title || `Problem ${pId}`,
          p.difficulty || "Easy",
          p.description || "",
          p.solution || null,
          pts,
          limit,
          p.sampleTestCase ? JSON.stringify(p.sampleTestCase) : null,
          p.starterCode || p.starter_code ? JSON.stringify(p.starterCode || p.starter_code) : null,
        ]
      );

      await query("DELETE FROM test_cases WHERE problem_id = $1", [pId]);

      const tcs = p.testCases || p.test_cases || [];
      if (Array.isArray(tcs)) {
        for (const tc of tcs) {
          const inp = tc.input !== undefined ? tc.input : (tc.in !== undefined ? tc.in : "");
          const out = tc.expectedOutput !== undefined ? tc.expectedOutput : (tc.out !== undefined ? tc.out : tc.output);
          if (inp !== undefined && out !== undefined) {
            await query(
              `INSERT INTO test_cases (problem_id, input, expected_output, is_sample)
               VALUES ($1, $2, $3, $4)`,
              [pId, String(inp), String(out), !!tc.isSample]
            );
          }
        }
      }

      count++;
    }

    res.json({ success: true, message: `Successfully uploaded ${count} problems with solutions & testcases!` });
  } catch (err) {
    console.error("Failed to upload problems JSON:", err);
    res.status(500).json({ message: "Upload failed: " + err.message });
  }
});

// ─── Game State Routes ─────────────────────────────────────────────

// Get current game state
router.get("/state", authMiddleware, adminOnly, (req, res) => {
  const gs = req.gameState;
  const getLeaderboard = req.app.get("getLeaderboard");
  const getOnlineCompetitors = req.app.get("getOnlineCompetitors");
  const getAllCompetitors = req.app.get("getAllCompetitors");

  res.json({
    currentRound: gs.currentRound,
    roundStatus: gs.roundStatus,
    roundEndTime: gs.roundEndTime,
    onlineUsers: getOnlineCompetitors(),
    allCompetitors: getAllCompetitors(),
    leaderboard: getLeaderboard(),
    removedUsers: [...gs.removedUsers],
    violations: gs.violations || {},
    problemAssignments: gs.problemAssignments || {},
    tabKicked: gs.tabKicked || [],
  });
});

// Start a round with dynamic problem assignment from PostgreSQL
router.post("/start-round", authMiddleware, adminOnly, async (req, res) => {
  const gs = req.gameState;
  const { round } = req.body;
  const roundNum = round || (gs.currentRound === 0 ? 1 : gs.currentRound + 1);

  const problemPools = await getProblemsByRoundMap();
  const problemPool = problemPools[roundNum];

  if (!problemPool || problemPool.length === 0) {
    return res.status(400).json({ message: `No problems available for Round ${roundNum} in PostgreSQL database. Please upload problems first.` });
  }

  const duration = roundNum === 2 ? 45 * 60 * 1000 : 30 * 60 * 1000; // 45 mins for Leg 2, 30 mins for Leg 1
  const startTime = Date.now();
  const endTime = startTime + duration;

  gs.currentRound = roundNum;
  gs.roundStatus = "active";
  gs.roundStartTime = startTime;
  gs.roundEndTime = endTime;

  // Clear any existing timer
  if (gs.roundTimer) clearTimeout(gs.roundTimer);
  if (gs.roundCheckInterval) clearInterval(gs.roundCheckInterval);

  // Auto-end round when time expires (primary timer)
  gs.roundTimer = setTimeout(() => {
    if (gs.roundStatus === "active") {
      gs.roundStatus = "ended";
      req.io.emit("round:end", { round: roundNum });
      req.io.emit("leaderboard:update", req.app.get("getLeaderboard")());
      console.log(`Round ${roundNum} auto-ended by timer.`);
    }
  }, duration);

  // Secondary check every 5 seconds to enforce time strictly
  gs.roundCheckInterval = setInterval(() => {
    if (gs.roundEndTime && Date.now() >= gs.roundEndTime && gs.roundStatus === "active") {
      gs.roundStatus = "ended";
      clearInterval(gs.roundCheckInterval);
      gs.roundCheckInterval = null;
      req.io.emit("round:end", { round: roundNum });
      req.io.emit("leaderboard:update", req.app.get("getLeaderboard")());
      console.log(`Round ${roundNum} force-ended by interval check.`);
    }
  }, 5000);

  const assignProblem = req.app.get("assignProblem");
  const getUserProblem = req.app.get("getUserProblem");

  // Broadcast round start to all (for navigation in WaitingRoom)
  req.io.emit("round:start", { round: roundNum, endTime });

  // Assign problems individually to each online competitor
  for (const [username, userData] of Object.entries(gs.onlineUsers)) {
    if (userData.role === "competitor" && userData.connected) {
      await assignProblem(username, roundNum);
      const problem = await getUserProblem(username, roundNum);

      if (userData.socketId) {
        req.io.to(userData.socketId).emit("problem:assigned", {
          round: roundNum,
          problem,
        });
      }
    }
  }

  res.json({ success: true, round: roundNum, endTime });
});

// End current round manually
router.post("/end-round", authMiddleware, adminOnly, (req, res) => {
  const gs = req.gameState;

  if (gs.roundStatus !== "active") {
    return res.status(400).json({ message: "No active round to end" });
  }

  if (gs.roundTimer) clearTimeout(gs.roundTimer);
  if (gs.roundCheckInterval) clearInterval(gs.roundCheckInterval);
  gs.roundCheckInterval = null;
  gs.roundStatus = "ended";

  req.io.emit("round:end", { round: gs.currentRound });
  req.io.emit("leaderboard:update", req.app.get("getLeaderboard")());

  res.json({ success: true });
});

// Remove a user
router.post("/remove-user", authMiddleware, adminOnly, (req, res) => {
  const { username } = req.body;
  const gs = req.gameState;

  if (!username || username === "admin") {
    return res.status(400).json({ message: "Invalid user" });
  }

  gs.removedUsers.add(username);

  // Notify the removed user via socket
  const userData = gs.onlineUsers[username];
  if (userData && userData.socketId) {
    req.io.to(userData.socketId).emit("user:removed");
  }

  // Clear any disconnect timer
  if (userData?.disconnectTimer) {
    clearTimeout(userData.disconnectTimer);
  }

  delete gs.onlineUsers[username];

  req.io.emit("users:update", req.app.get("getOnlineCompetitors")());
  req.io.emit("leaderboard:update", req.app.get("getLeaderboard")());

  res.json({ success: true });
});

// Reset entire event
router.post("/reset", authMiddleware, adminOnly, async (req, res) => {
  const gs = req.gameState;
  const { keepExistingData } = req.body;

  if (gs.roundTimer) clearTimeout(gs.roundTimer);
  if (gs.roundCheckInterval) clearInterval(gs.roundCheckInterval);
  gs.roundCheckInterval = null;

  gs.currentRound = 0;
  gs.roundStatus = "waiting";
  gs.roundEndTime = null;
  gs.roundStartTime = null;

  if (keepExistingData) {
    // Keep existing data: submissions, code, points retained in DB and state
    try {
      const subRes = await query("SELECT username, round, result FROM submissions WHERE status = 'evaluated'");
      const pointsMap = {};
      subRes.rows.forEach((row) => {
        const uname = row.username;
        const rKey = `round${row.round}`;
        const score = Number(row.result?.finalScore ?? row.result?.score ?? 0);
        if (!pointsMap[uname]) pointsMap[uname] = { round1: 0, round2: 0 };
        pointsMap[uname][rKey] = (pointsMap[uname][rKey] || 0) + score;
      });

      for (const [uname, uData] of Object.entries(gs.onlineUsers)) {
        if (pointsMap[uname]) {
          uData.points = { ...pointsMap[uname] };
        }
      }
    } catch (err) {
      console.error("Error recalculating points on reset (keep data):", err);
    }
  } else {
    // Delete existing data from DB and memory
    gs.submissions = {};
    gs.teamRelay = {};
    gs.teamSubmissions = {};
    gs.removedUsers.clear();
    gs.problemAssignments = {};
    gs.violations = {};
    gs.tabKicked = [];

    for (const user of Object.values(gs.onlineUsers)) {
      user.points = { round1: 0, round2: 0 };
    }

    // Clear PostgreSQL submissions table
    try {
      await query("DELETE FROM submissions");
    } catch (err) {
      console.error("Error clearing submissions on reset:", err);
    }

    // Clear PostgreSQL team relay event_state
    try {
      await query("DELETE FROM event_state WHERE key LIKE 'team_relay_%'");
    } catch (err) {
      console.error("Error clearing event_state on reset:", err);
    }

    // Clear MongoDB team code collection if connected
    try {
      const { isMongoConnected, TeamCode } = require("../mongo");
      if (isMongoConnected()) {
        await TeamCode.deleteMany({});
        console.log("🗑️ Cleared MongoDB TeamCode collection on event reset.");
      }
    } catch (err) {
      console.error("Error clearing MongoDB TeamCode collection on reset:", err);
    }
  }

  req.io.emit("event:reset", { keepExistingData: !!keepExistingData });
  req.io.emit("leaderboard:update", req.app.get("getLeaderboard")());

  res.json({
    success: true,
    message: keepExistingData
      ? "Event reset. Existing submissions, code, and points were kept."
      : "Event reset. All submissions, code, and points were deleted from database.",
  });
});

// Revoke a kick/removal decision
router.post("/revoke-kick", authMiddleware, adminOnly, (req, res) => {
  const { username } = req.body;
  const gs = req.gameState;

  if (!username) {
    return res.status(400).json({ message: "Username is required" });
  }

  gs.removedUsers.delete(username);
  gs.tabKicked = (gs.tabKicked || []).filter(k => k.username !== username);

  if (gs.violations[username]) {
    gs.violations[username].kicked = false;
    gs.violations[username].tabSwitch = 0;
  }

  req.io.emit("user:kick_revoked", { username });
  req.io.emit("users:update", req.app.get("getOnlineCompetitors")());

  res.json({ success: true, message: `Kick decision revoked for ${username}` });
});

// Get all submissions from PostgreSQL
router.get("/submissions", authMiddleware, adminOnly, async (req, res) => {
  try {
    const subRes = await query(`
      SELECT s.*, COALESCE(t.team_name, u.team_name) AS team_name
      FROM submissions s
      LEFT JOIN users u ON LOWER(s.username) = LOWER(u.username)
      LEFT JOIN team_associations ta ON u.id = ta.user_id
      LEFT JOIN teams t ON ta.team_id = t.id
      WHERE s.status = 'pending' OR s.status = 'ai_pending' OR COALESCE((s.result->>'finalScore')::numeric, (s.result->>'score')::numeric, 0) > 0
      ORDER BY s.created_at DESC
    `);
    const problemPools = await getProblemsByRoundMap();

    const subs = subRes.rows.map((row) => {
      const round = row.round;
      const pool = problemPools[round] || [];
      const problem = pool.find(p => p.id === row.problem_id) || pool[row.problem_idx || 0];

      let computedTeamName = row.team_name;
      if (!computedTeamName && row.submission_key && row.submission_key.includes("_round")) {
        computedTeamName = row.submission_key.split("_round")[0];
      }

      return {
        id: row.id,
        submissionKey: row.submission_key,
        username: row.username,
        teamName: computedTeamName || row.username || "Individual",
        round: row.round,
        problemId: row.problem_id,
        problemIdx: row.problem_idx,
        code: row.code,
        language: row.language,
        timestamp: Number(row.timestamp) || (row.created_at ? new Date(row.created_at).getTime() : Date.now()),
        status: row.status,
        result: row.result,
        problem,
      };
    });

    res.json({ submissions: subs });
  } catch (err) {
    console.error("Error fetching submissions from DB:", err);
    res.status(500).json({ message: "Failed to fetch submissions: " + err.message });
  }
});

// Manual score set
router.post("/manual-evaluate", authMiddleware, adminOnly, async (req, res) => {
  const gs = req.gameState;
  const { submissionKey, score, feedback } = req.body;
  const getLeaderboard = req.app.get("getLeaderboard");

  const clampedScore = Math.max(0, Math.min(100, Number(score) || 0));

  const parts = submissionKey.split("_round");
  const username = parts[0];
  const round = parseInt(parts[1], 10);
  const roundKey = `round${round}`;

  const sub = gs.submissions[submissionKey];
  if (sub && sub.result?.finalScore) {
    if (gs.onlineUsers[username]) {
      gs.onlineUsers[username].points[roundKey] -= sub.result.finalScore;
    }
  }

  const resultData = {
    aiScore: clampedScore,
    manualScore: clampedScore,
    finalScore: clampedScore,
    errorType: clampedScore === 0 ? "Irrelevant Program" : clampedScore >= 80 ? "Accepted" : "Wrong Answer",
    feedback: [feedback || `Manually scored by admin: ${clampedScore} pts.`],
  };

  if (gs.submissions[submissionKey]) {
    gs.submissions[submissionKey].result = resultData;
    gs.submissions[submissionKey].status = "evaluated";
  }

  // Update in PostgreSQL database
  await query(
    `UPDATE submissions SET status = $1, result = $2 WHERE submission_key = $3`,
    ["evaluated", JSON.stringify(resultData), submissionKey]
  );

  if (gs.onlineUsers[username]) {
    gs.onlineUsers[username].points[roundKey] += clampedScore;
  }

  req.io.emit("leaderboard:update", getLeaderboard());
  console.log(`[MANUAL] ${username} R${round}: manually scored ${clampedScore}`);
  res.json({ success: true, message: `Manual score of ${clampedScore} set for ${username}` });
});

// Run AI evaluation for a single submission
router.post("/evaluate-one", authMiddleware, adminOnly, async (req, res) => {
  const gs = req.gameState;
  const { getLLMScore } = require("../services/llmScoringService");
  const { submissionKey } = req.body;

  const parts = submissionKey.split("_round");
  const round = parseInt(parts[1], 10);
  const problemPools = await getProblemsByRoundMap();
  const problemPool = problemPools[round];

  const subRes = await query("SELECT * FROM submissions WHERE submission_key = $1", [submissionKey]);
  if (subRes.rowCount === 0 && !gs.submissions[submissionKey]) {
    return res.status(404).json({ message: "Submission not found" });
  }

  const subData = subRes.rowCount > 0 ? subRes.rows[0] : gs.submissions[submissionKey];
  const problem = problemPool?.find(p => p.id === subData.problem_id) || problemPool?.[subData.problem_idx || 0];

  if (!problem) return res.status(400).json({ message: "Problem not found" });

  try {
    const scoring = await getLLMScore(subData.code, subData.language, problem);

    await query(
      `UPDATE submissions SET status = $1, result = $2 WHERE submission_key = $3`,
      ["ai_pending", JSON.stringify(scoring), submissionKey]
    );

    if (gs.submissions[submissionKey]) {
      gs.submissions[submissionKey].result = scoring;
      gs.submissions[submissionKey].status = "ai_pending";
    }

    res.json({ success: true, scoring, message: "AI evaluation complete. Review and approve." });
  } catch (err) {
    res.status(500).json({ message: "AI evaluation failed: " + err.message });
  }
});

// Approve AI evaluation
router.post("/approve-evaluation", authMiddleware, adminOnly, async (req, res) => {
  const gs = req.gameState;
  const { submissionKey, finalScore } = req.body;
  const getLeaderboard = req.app.get("getLeaderboard");

  const subRes = await query("SELECT * FROM submissions WHERE submission_key = $1", [submissionKey]);
  if (subRes.rowCount === 0) return res.status(404).json({ message: "Submission not found" });

  const dbSub = subRes.rows[0];
  const currentResult = dbSub.result || {};
  const clampedScore = Math.max(0, Math.min(100, Number(finalScore) ?? currentResult.score ?? 0));

  currentResult.finalScore = clampedScore;

  await query(
    `UPDATE submissions SET status = $1, result = $2 WHERE submission_key = $3`,
    ["evaluated", JSON.stringify(currentResult), submissionKey]
  );

  const parts = submissionKey.split("_round");
  const username = parts[0];
  const round = parseInt(parts[1], 10);
  const roundKey = `round${round}`;

  if (gs.onlineUsers[username]) {
    gs.onlineUsers[username].points[roundKey] += clampedScore;
  }

  req.io.emit("leaderboard:update", getLeaderboard());
  console.log(`[APPROVE] ${username} R${round}: score approved as ${clampedScore}`);
  res.json({ success: true, message: `Score ${clampedScore} approved for ${username}` });
});

// Save client-side evaluation fallback to Postgres DB
router.post("/save-evaluations", authMiddleware, adminOnly, async (req, res) => {
  const gs = req.gameState;
  const { results } = req.body;

  if (!results || !Array.isArray(results)) {
    return res.status(400).json({ message: "Invalid results payload" });
  }

  for (const result of results) {
    const { submissionKey, scoring } = result;
    if (submissionKey && scoring) {
      await query(
        `UPDATE submissions SET status = $1, result = $2 WHERE submission_key = $3 AND status = $4`,
        ["ai_pending", JSON.stringify(scoring), submissionKey, "pending"]
      );

      if (gs.submissions[submissionKey]) {
        gs.submissions[submissionKey].result = scoring;
        gs.submissions[submissionKey].status = "ai_pending";
      }
    }
  }

  res.json({ success: true, message: `${results.length} submissions evaluated and saved to database. Please review and approve scores.` });
});

module.exports = router;
