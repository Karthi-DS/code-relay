const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { query } = require("../db");
const router = express.Router();

// ─── GET /auth/teams (Public endpoint to list existing teams & member counts) ───
router.get("/teams", async (req, res) => {
  try {
    const resTeams = await query(`
      SELECT t.id, t.team_name, COUNT(ta.user_id)::int as member_count
      FROM teams t
      LEFT JOIN team_associations ta ON t.id = ta.team_id
      GROUP BY t.id, t.team_name
      ORDER BY t.team_name ASC
    `);

    const teams = resTeams.rows.map(row => ({
      id: row.id,
      teamName: row.team_name,
      memberCount: row.member_count,
      isFull: row.member_count >= 2,
    }));

    res.json({ teams });
  } catch (err) {
    console.error("[GET TEAMS] Error:", err.message);
    res.status(500).json({ message: "Failed to fetch teams: " + err.message });
  }
});

// ─── Register ───────────────────────────────────────────────
router.post("/register", async (req, res) => {
  try {
    const { username, password, teamMode, teamName, teamId } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required" });
    }

    const trimmed = username.trim().toLowerCase();

    if (trimmed.length < 2) {
      return res.status(400).json({ message: "Username must be at least 2 characters" });
    }

    if (password.length < 4) {
      return res.status(400).json({ message: "Password must be at least 4 characters" });
    }

    if (trimmed === "admin") {
      return res.status(400).json({ message: "This username is reserved" });
    }

    // Check if user exists in PostgreSQL
    const existing = await query("SELECT * FROM users WHERE LOWER(username) = $1", [trimmed]);
    if (existing.rowCount > 0) {
      return res.status(409).json({ message: "Username already exists. Please login instead." });
    }

    let targetTeam;

    if (teamMode === "join" || (teamId && !teamName)) {
      // ─── JOIN EXISTING TEAM ───
      let teamRes;
      if (teamId) {
        teamRes = await query("SELECT * FROM teams WHERE id = $1", [teamId]);
      } else if (teamName) {
        teamRes = await query("SELECT * FROM teams WHERE LOWER(team_name) = LOWER($1)", [teamName.trim()]);
      }

      if (!teamRes || teamRes.rowCount === 0) {
        return res.status(400).json({ message: "Selected team was not found." });
      }

      targetTeam = teamRes.rows[0];

      // Validate member count (MAX 2 MEMBERS PER TEAM)
      const countRes = await query(
        "SELECT COUNT(*)::int FROM team_associations WHERE team_id = $1",
        [targetTeam.id]
      );
      const currentMembers = countRes.rows[0].count;

      if (currentMembers >= 2) {
        return res.status(400).json({
          message: `Team "${targetTeam.team_name}" already has 2 members (FULL). Only 2 members are allowed per team.`
        });
      }
    } else {
      // ─── CREATE NEW TEAM ───
      const trimmedTeam = (teamName || "").trim();
      if (!trimmedTeam || trimmedTeam.length < 2) {
        return res.status(400).json({ message: "Team name must be at least 2 characters" });
      }

      // Check if team already exists
      let existingTeamRes = await query("SELECT * FROM teams WHERE LOWER(team_name) = LOWER($1)", [trimmedTeam]);

      if (existingTeamRes.rowCount > 0) {
        targetTeam = existingTeamRes.rows[0];
        // Check if team is full
        const countRes = await query(
          "SELECT COUNT(*)::int FROM team_associations WHERE team_id = $1",
          [targetTeam.id]
        );
        if (countRes.rows[0].count >= 2) {
          return res.status(400).json({
            message: `Team "${trimmedTeam}" already has 2 members (FULL). Only 2 members are allowed per team.`
          });
        }
      } else {
        // Insert new team into `teams` table (id, team_name)
        const newTeamRes = await query(
          "INSERT INTO teams (team_name) VALUES ($1) RETURNING id, team_name",
          [trimmedTeam]
        );
        targetTeam = newTeamRes.rows[0];
      }
    }

    // Hash password and store user in PostgreSQL
    const hashedPassword = bcrypt.hashSync(password, 10);
    const userRes = await query(
      "INSERT INTO users (username, password, role, team_name) VALUES ($1, $2, $3, $4) RETURNING id",
      [trimmed, hashedPassword, "competitor", targetTeam.team_name]
    );
    const newUserId = userRes.rows[0].id;

    // Record composite association in `team_associations` table (team_id, user_id)
    await query(
      "INSERT INTO team_associations (team_id, user_id) VALUES ($1, $2) ON CONFLICT (team_id, user_id) DO NOTHING",
      [targetTeam.id, newUserId]
    );

    // Determine member index in team (1 or 2)
    const assocList = await query("SELECT user_id FROM team_associations WHERE team_id = $1 ORDER BY created_at ASC, user_id ASC", [targetTeam.id]);
    const mIdx = assocList.rows.findIndex(r => r.user_id === newUserId);
    const memberRole = mIdx >= 0 ? mIdx + 1 : 1;

    const token = jwt.sign(
      { username: trimmed, role: "competitor", teamName: targetTeam.team_name, teamId: targetTeam.id, memberRole },
      process.env.JWT_SECRET || "codeblack_jwt_secret_key_2026",
      { expiresIn: "7d" }
    );

    res.json({
      token,
      username: trimmed,
      role: "competitor",
      teamName: targetTeam.team_name,
      teamId: targetTeam.id,
      memberRole,
    });
  } catch (err) {
    console.error("[REGISTER] Error:", err.message);
    res.status(500).json({ message: "Registration failed: " + err.message });
  }
});

// ─── Login ──────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const trimmed = (username || "").trim().toLowerCase();

    // Fetch user from PostgreSQL
    const userRes = await query("SELECT * FROM users WHERE LOWER(username) = $1", [trimmed]);

    if (userRes.rowCount === 0) {
      return res.status(401).json({ message: "User not found. Please register first." });
    }

    const user = userRes.rows[0];

    // Compare password
    let passwordValid = false;
    if (user.role === "admin") {
      // Plain text or bcrypt for admin account
      passwordValid = user.password === password || bcrypt.compareSync(password, user.password);
    } else {
      passwordValid = bcrypt.compareSync(password, user.password);
    }

    if (!passwordValid) {
      return res.status(401).json({ message: "Invalid password" });
    }

    if (req.gameState && req.gameState.removedUsers && req.gameState.removedUsers.has(trimmed)) {
      return res
        .status(403)
        .json({ message: "You have been removed from the event" });
    }

    // Determine member index in team (1 or 2)
    let memberRole = 1;
    if (user.team_name) {
      const teamRes = await query("SELECT id FROM teams WHERE LOWER(team_name) = LOWER($1)", [user.team_name]);
      if (teamRes.rowCount > 0) {
        const assocList = await query("SELECT user_id FROM team_associations WHERE team_id = $1 ORDER BY created_at ASC, user_id ASC", [teamRes.rows[0].id]);
        const mIdx = assocList.rows.findIndex(r => r.user_id === user.id);
        if (mIdx >= 0) memberRole = mIdx + 1;
      }
    }

    const token = jwt.sign(
      { username: trimmed, role: user.role, teamName: user.team_name, memberRole },
      process.env.JWT_SECRET || "codeblack_jwt_secret_key_2026",
      { expiresIn: "7d" }
    );

    res.json({ token, username: trimmed, role: user.role, teamName: user.team_name, memberRole });
  } catch (err) {
    console.error("[LOGIN] Error:", err.message);
    res.status(500).json({ message: "Login failed: " + err.message });
  }
});

module.exports = router;
