const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/codeblack";

let isConnected = false;

const teamCodeSchema = new mongoose.Schema(
  {
    teamName: { type: String, required: true, index: true },
    round: { type: Number, default: 1 },
    problemId: { type: String, default: "" },
    code: { type: String, default: "" },
    language: { type: String, default: "python" },
    activeMember: { type: Number, default: 1 },
    turnSecondsLeft: { type: Number, default: 300 },
    lastUpdatedBy: { type: String, default: "" },
  },
  { timestamps: true }
);

// Compound index for teamName, round, and problemId
teamCodeSchema.index({ teamName: 1, round: 1, problemId: 1 });

const TeamCode = mongoose.model("TeamCode", teamCodeSchema);

async function initMongo() {
  try {
    console.log(`🍃 Connecting to MongoDB at ${MONGODB_URI}...`);
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = true;
    console.log("✅ MongoDB connected successfully for Code Black team persistence.");
  } catch (err) {
    console.warn("⚠️ MongoDB connection failed:", err.message);
    console.warn("   Falling back to PostgreSQL/in-memory team state.");
    isConnected = false;
  }
}

async function saveTeamCode({ teamName, round = 1, code, language, activeMember, turnSecondsLeft, lastUpdatedBy, problemId = "" }) {
  if (!teamName) return null;
  const pId = problemId || "";
  
  // Try saving to MongoDB if connected
  if (isConnected) {
    try {
      const updateData = { updatedAt: new Date() };
      if (code !== undefined) updateData.code = code;
      if (language !== undefined) updateData.language = language;
      if (activeMember !== undefined) updateData.activeMember = activeMember;
      if (turnSecondsLeft !== undefined) updateData.turnSecondsLeft = turnSecondsLeft;
      if (lastUpdatedBy !== undefined) updateData.lastUpdatedBy = lastUpdatedBy;
      if (problemId !== undefined) updateData.problemId = pId;

      const filter = pId ? { teamName, round: Number(round) || 1, problemId: pId } : { teamName, round: Number(round) || 1 };

      const record = await TeamCode.findOneAndUpdate(
        filter,
        { $set: updateData },
        { upsert: true, new: true }
      );
      console.log(`💾 [MONGO SAVE] Code & Turn state saved in MongoDB for team: "${teamName}" (Round ${round}, Problem ${pId || "default"}, Active Member ${activeMember || 1})`);
      return record;
    } catch (err) {
      console.error("❌ MongoDB Save Error:", err.message);
    }
  }

  // Also save to PostgreSQL event_state table as secondary backup
  try {
    const { query } = require("./db");
    const key = `team_relay_${teamName.toLowerCase()}_round_${round}${pId ? `_prob_${pId}` : ""}`;
    const pgVal = JSON.stringify({
      teamName,
      round: Number(round) || 1,
      problemId: pId,
      code: code !== undefined ? code : "",
      language: language !== undefined ? language : "python",
      activeMember: activeMember !== undefined ? activeMember : 1,
      turnSecondsLeft: turnSecondsLeft !== undefined ? turnSecondsLeft : 300,
      lastUpdatedBy: lastUpdatedBy || "",
      updatedAt: new Date().toISOString(),
    });

    await query(
      `INSERT INTO event_state (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [key, pgVal]
    );
  } catch (err) {
    console.warn("⚠️ PostgreSQL event_state backup save warning:", err.message);
  }

  return null;
}

async function getTeamCode(teamName, round = 1, problemId = "") {
  if (!teamName) return null;
  const pId = problemId || "";

  if (isConnected) {
    try {
      const filter = pId ? { teamName, round: Number(round) || 1, problemId: pId } : { teamName, round: Number(round) || 1 };
      const record = await TeamCode.findOne(filter);
      if (record) return record;
    } catch (err) {
      console.error("❌ MongoDB Fetch Error:", err.message);
    }
  }

  // Fallback to PostgreSQL event_state table
  try {
    const { query } = require("./db");
    const key = `team_relay_${teamName.toLowerCase()}_round_${round}${pId ? `_prob_${pId}` : ""}`;
    const pgRes = await query("SELECT value FROM event_state WHERE key = $1", [key]);
    if (pgRes.rowCount > 0) {
      return pgRes.rows[0].value;
    }
  } catch (err) {
    console.warn("⚠️ PostgreSQL event_state backup fetch warning:", err.message);
  }

  return null;
}

module.exports = {
  initMongo,
  saveTeamCode,
  getTeamCode,
  TeamCode,
  isMongoConnected: () => isConnected,
};
