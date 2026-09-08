const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const { query, getProblemsByRoundMap } = require("../db");

// Get list of problems for a given round
router.get("/problems", authMiddleware, async (req, res) => {
  const roundNum = Number(req.query.round) || 1;
  try {
    const problemPools = await getProblemsByRoundMap();
    const pool = problemPools[roundNum] || [];
    const sanitizedProblems = pool.map(p => ({
      id: p.id,
      title: p.title,
      difficulty: p.difficulty,
      description: p.description,
      points: p.points,
      timeLimit: p.timeLimit,
      sampleTestCase: p.sampleTestCase || p.sample_test_case || null,
      starterCode: p.starterCode || p.starter_code || null,
    }));
    res.json({ problems: sanitizedProblems });
  } catch (err) {
    console.error("Error fetching round problems:", err);
    res.status(500).json({ message: "Failed to fetch problems: " + err.message });
  }
});

// Get all submissions for the current user/team in a round
router.get("/submissions-by-round", authMiddleware, async (req, res) => {
  const { username } = req.user;
  const roundNum = Number(req.query.round) || 1;
  try {
    let userTeamName = "";
    const userRes = await query("SELECT team_name FROM users WHERE LOWER(username) = LOWER($1)", [username]);
    if (userRes.rowCount > 0 && userRes.rows[0].team_name) {
      userTeamName = userRes.rows[0].team_name;
    }

    let subRes;
    if (userTeamName) {
      subRes = await query(
        `SELECT s.* FROM submissions s
         LEFT JOIN users u ON LOWER(s.username) = LOWER(u.username)
         WHERE s.round = $1 AND (LOWER(s.username) = LOWER($2) OR LOWER(u.team_name) = LOWER($3) OR s.submission_key LIKE $4)
         ORDER BY s.created_at DESC`,
        [roundNum, username, userTeamName, `${userTeamName}_round${roundNum}_%`]
      );
    } else {
      subRes = await query(
        "SELECT * FROM submissions WHERE round = $1 AND LOWER(username) = LOWER($2) ORDER BY created_at DESC",
        [roundNum, username]
      );
    }

    const submissionsByProblem = {};
    subRes.rows.forEach(row => {
      const pId = row.problem_id;
      if (!submissionsByProblem[pId] || Number(row.timestamp) > (submissionsByProblem[pId].timestamp || 0)) {
        submissionsByProblem[pId] = {
          id: row.id,
          submissionKey: row.submission_key,
          username: row.username,
          round: row.round,
          problemId: row.problem_id,
          problemIdx: row.problem_idx,
          code: row.code,
          language: row.language,
          timestamp: Number(row.timestamp),
          status: row.status,
          result: row.result,
        };
      }
    });

    res.json({ submissions: submissionsByProblem });
  } catch (err) {
    console.error("Error fetching round submissions:", err);
    res.status(500).json({ message: "Failed to fetch round submissions: " + err.message });
  }
});

// Run code against test cases (LeetCode-style test runner before or upon submit)
router.post("/run-test", authMiddleware, async (req, res) => {
  const { code, language, round, problemId } = req.body;
  const { username } = req.user;
  const gs = req.gameState;

  const supportedLanguages = ["python", "javascript", "c", "java", "cpp"];
  if (!supportedLanguages.includes(language)) {
    return res.status(400).json({ message: "Unsupported language: " + language });
  }

  const roundNum = Number(round);
  const problemPools = await getProblemsByRoundMap();
  const problemPool = problemPools[roundNum] || [];

  let problem = null;
  if (problemId) {
    problem = problemPool.find(p => p.id === problemId);
  }
  if (!problem) {
    const assignmentIdx = gs.problemAssignments[username]?.[roundNum] || 0;
    problem = problemPool[assignmentIdx];
  }

  if (!problem) {
    return res.status(400).json({ message: "Problem not found" });
  }

  const { evaluateAgainstTestCases } = require("../services/codeRunner");
  // Only evaluate visible sample test cases for run-test button
  const visibleSampleTestCases = [
    ...(problem.sampleTestCase ? [{ input: problem.sampleTestCase.input, expectedOutput: problem.sampleTestCase.expectedOutput || problem.sampleTestCase.output, isSample: true }] : []),
    ...(problem.testCases ? problem.testCases.filter(tc => tc.isSample === true) : [])
  ];
  if (visibleSampleTestCases.length === 0 && problem.testCases && problem.testCases.length > 0) {
    visibleSampleTestCases.push({ input: problem.testCases[0].input, expectedOutput: problem.testCases[0].expectedOutput || problem.testCases[0].output, isSample: true });
  }

  try {
    const testResult = await evaluateAgainstTestCases(language, code, visibleSampleTestCases, problem.points || 100);
    res.json({ success: true, ...testResult });
  } catch (err) {
    console.error("Test run error:", err);
    res.status(500).json({ message: "Test run failed: " + err.message });
  }
});

router.post("/", authMiddleware, async (req, res) => {
  const { code, language, round, problemId } = req.body;
  const { username } = req.user;
  const gs = req.gameState;

  // Validate language
  const supportedLanguages = ["python", "javascript", "c", "java", "cpp"];
  if (!supportedLanguages.includes(language)) {
    return res.status(400).json({ message: "Unsupported language: " + language });
  }

  // Validation — check round time hasn't expired
  if (gs.roundStatus !== "active") {
    return res
      .status(400)
      .json({ message: "No active round. Submissions are closed." });
  }

  if (gs.roundEndTime && Date.now() > gs.roundEndTime) {
    return res
      .status(400)
      .json({ message: "Round time has expired. Submissions are closed." });
  }

  const roundNum = Number(round);
  if (gs.currentRound !== roundNum) {
    return res.status(400).json({ message: "Invalid round" });
  }

  // Check user team name
  let userTeamName = "";
  try {
    const userRes = await query("SELECT team_name FROM users WHERE LOWER(username) = LOWER($1)", [username]);
    if (userRes.rowCount > 0 && userRes.rows[0].team_name) {
      userTeamName = userRes.rows[0].team_name;
    }
  } catch (e) {}

  const problemPools = await getProblemsByRoundMap();
  const problemPool = problemPools[roundNum] || [];

  let problem = null;
  let assignmentIdx = 0;
  if (problemId) {
    assignmentIdx = problemPool.findIndex(p => p.id === problemId);
    if (assignmentIdx >= 0) problem = problemPool[assignmentIdx];
  }
  if (!problem) {
    assignmentIdx = gs.problemAssignments[username]?.[roundNum] || 0;
    problem = problemPool[assignmentIdx];
  }

  if (!problem) {
    return res.status(400).json({ message: "Problem not found" });
  }

  // Submission key unique to problem & user/team
  const submissionKey = userTeamName 
    ? `${userTeamName}_round${roundNum}_${problem.id}`
    : `${username}_round${roundNum}_${problem.id}`;

  // Get previous score for this submission if re-submitting
  const checkSub = await query("SELECT * FROM submissions WHERE submission_key = $1", [submissionKey]);
  const previousScore = checkSub.rowCount > 0 && checkSub.rows[0].result?.score !== undefined
    ? Number(checkSub.rows[0].result.score)
    : (gs.submissions[submissionKey]?.result?.score || 0);

  const now = Date.now();

  try {
    console.log(`[SUBMIT] Code submitted by ${username} (${userTeamName || "individual"}) for round ${roundNum}, problem ${problem.id}. Executing compiler tests...`);

    // ─── Real-time Local Compiler Testcase Evaluation ───
    const { evaluateAgainstTestCases } = require("../services/codeRunner");
    const allTestCases = [...(problem.sampleTestCase ? [{ input: problem.sampleTestCase.input, expectedOutput: problem.sampleTestCase.expectedOutput || problem.sampleTestCase.output, isSample: true }] : []), ...(problem.testCases || [])];
    const evaluationResult = await evaluateAgainstTestCases(language, code, allTestCases, problem.points || 100);

    // Store evaluation submission in PostgreSQL (UPSERT on re-submission)
    await query(
      `INSERT INTO submissions (submission_key, username, round, problem_id, problem_idx, code, language, timestamp, status, result)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (submission_key) DO UPDATE SET
         code = EXCLUDED.code,
         language = EXCLUDED.language,
         timestamp = EXCLUDED.timestamp,
         status = EXCLUDED.status,
         result = EXCLUDED.result`,
      [
        submissionKey,
        username,
        roundNum,
        problem.id,
        assignmentIdx >= 0 ? assignmentIdx : 0,
        code,
        language,
        now,
        "evaluated",
        JSON.stringify(evaluationResult),
      ]
    );

    // Record team submission state
    if (userTeamName) {
      if (!gs.teamSubmissions) gs.teamSubmissions = {};
      gs.teamSubmissions[`${userTeamName}_round${roundNum}_${problem.id}`] = {
        submitted: true,
        submittedBy: username,
        timestamp: now,
      };
      if (gs.teamRelay[userTeamName]) {
        gs.teamRelay[userTeamName].isSubmitted = true;
        gs.teamRelay[userTeamName].submittedBy = username;
      }
      // Broadcast team submission to all team members via socket
      req.io.to(`team:${userTeamName}`).emit("relay:team_submitted", {
        round: roundNum,
        problemId: problem.id,
        submittedBy: username,
        code,
        language,
        result: evaluationResult,
      });
      req.io.emit(`relay:team_submitted:${userTeamName}`, {
        round: roundNum,
        problemId: problem.id,
        submittedBy: username,
        code,
        language,
        result: evaluationResult,
      });
    }

    // Save submitted code to MongoDB for team persistence
    try {
      const { saveTeamCode } = require("../mongo");
      if (userTeamName) {
        await saveTeamCode({
          teamName: userTeamName,
          round: roundNum,
          problemId: problem.id,
          code,
          language,
          lastUpdatedBy: username,
        });
      }
    } catch (e) {
      console.warn("MongoDB submission save warning:", e.message);
    }

    // Store in memory gameState for fast socket sync
    gs.submissions[submissionKey] = {
      code,
      language,
      problemId: problem.id,
      problemIdx: assignmentIdx >= 0 ? assignmentIdx : 0,
      timestamp: now,
      status: "evaluated",
      result: evaluationResult,
    };

    // Update user points on leaderboard using score delta
    const roundKey = `round${roundNum}`;
    const scoreDelta = evaluationResult.score - previousScore;
    if (gs.onlineUsers[username]) {
      gs.onlineUsers[username].points[roundKey] = Math.max(0, (gs.onlineUsers[username].points[roundKey] || 0) + scoreDelta);
    }

    const getLeaderboard = req.app.get("getLeaderboard");
    if (getLeaderboard) {
      req.io.emit("leaderboard:update", getLeaderboard());
    }

    return res.json({
      success: true,
      pending: false,
      hasNext: false,
      message: "Submission evaluated successfully!",
      ...evaluationResult,
    });
  } catch (err) {
    console.error("Submission error:", err);
    res.status(500).json({ message: "Submission failed", error: err.message });
  }
});

// Endpoint for users to get their own submissions from PostgreSQL
router.get("/my-submissions", authMiddleware, async (req, res) => {
  const { username } = req.user;
  try {
    const subRes = await query(
      "SELECT * FROM submissions WHERE LOWER(username) = LOWER($1) ORDER BY created_at DESC",
      [username]
    );
    const mySubs = subRes.rows.map((row) => ({
      id: row.id,
      round: row.round,
      problemId: row.problem_id,
      problemIdx: row.problem_idx,
      code: row.code,
      language: row.language,
      timestamp: Number(row.timestamp),
      status: row.status,
      result: row.result,
    }));

    res.json({ submissions: mySubs });
  } catch (err) {
    console.error("Error fetching user submissions:", err);
    res.status(500).json({ message: "Failed to fetch submissions: " + err.message });
  }
});

// Endpoint to fetch team's saved relay code from MongoDB / DB
router.get("/team-code", authMiddleware, async (req, res) => {
  const { username } = req.user;
  const round = Number(req.query.round) || 1;
  const problemId = req.query.problemId || "";
  try {
    const { getTeamCode } = require("../mongo");
    const userRes = await query("SELECT team_name FROM users WHERE LOWER(username) = LOWER($1)", [username]);
    if (userRes.rowCount === 0 || !userRes.rows[0].team_name) {
      return res.json({ code: "", language: "python", activeMember: 1 });
    }

    const teamName = userRes.rows[0].team_name;
    const teamData = await getTeamCode(teamName, round, problemId);
    res.json({
      teamName,
      code: teamData?.code || "",
      language: teamData?.language || "python",
      activeMember: teamData?.activeMember || 1,
      turnSecondsLeft: teamData?.turnSecondsLeft !== undefined ? teamData.turnSecondsLeft : 300,
    });
  } catch (err) {
    console.error("Error fetching team code:", err);
    res.status(500).json({ message: "Failed to fetch team code: " + err.message });
  }
});

// Auto-submit helper
async function autoSubmitOnLeaveOrEnd(username, round, gs, req) {
  const assignmentIdx = gs.problemAssignments?.[username]?.[round] || 0;
  const submissionKey = `${username}_round${round}_q${assignmentIdx}`;

  const checkSub = await query("SELECT * FROM submissions WHERE submission_key = $1", [submissionKey]);
  if (checkSub.rowCount > 0) {
    console.log(`[AUTO-SUBMIT] User ${username} already submitted for round ${round}, question ${assignmentIdx}`);
    return;
  }

  const problemPools = await getProblemsByRoundMap();
  const problemPool = problemPools[round];
  if (!problemPool || !problemPool[assignmentIdx]) {
    console.error(`[AUTO-SUBMIT] Problem not found for user ${username}, round ${round}, question ${assignmentIdx}`);
    return;
  }

  const problem = problemPool[assignmentIdx];
  const now = Date.now();

  await query(
    `INSERT INTO submissions (submission_key, username, round, problem_id, problem_idx, code, language, timestamp, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (submission_key) DO NOTHING`,
    [
      submissionKey,
      username,
      round,
      problem.id,
      assignmentIdx,
      "",
      "",
      now,
      "auto-submitted",
    ]
  );

  gs.submissions[submissionKey] = {
    code: "",
    language: "",
    problemId: problem.id,
    problemIdx: assignmentIdx,
    timestamp: now,
    status: "auto-submitted",
  };

  console.log(`[AUTO-SUBMIT] Empty submission recorded for user ${username}, round ${round}, question ${assignmentIdx}`);

  const userData = gs.onlineUsers[username];
  if (userData && userData.socketId) {
    req.io.to(userData.socketId).emit("submission:auto-submitted", {
      round,
      problemId: problem.id,
      message: "Your code was auto-submitted as the round ended or you left.",
    });
  }
}

module.exports = router;
module.exports.autoSubmitOnLeaveOrEnd = autoSubmitOnLeaveOrEnd;
