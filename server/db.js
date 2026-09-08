const { Pool, Client } = require("pg");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432", 10),
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  database: process.env.DB_NAME || "codeblack",
};

let pool;

if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  });
} else {
  pool = new Pool(dbConfig);
}

/**
 * Ensure database exists before attempting full pool connection.
 */
async function ensureDatabaseExists() {
  if (process.env.DATABASE_URL) return;

  const adminClient = new Client({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    database: "postgres", // Connect to default postgres DB first
  });

  try {
    await adminClient.connect();
    const res = await adminClient.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbConfig.database]
    );

    if (res.rowCount === 0) {
      console.log(`🛠️ Creating database "${dbConfig.database}"...`);
      await adminClient.query(`CREATE DATABASE "${dbConfig.database}"`);
      console.log(`✅ Database "${dbConfig.database}" created successfully.`);
    }
  } catch (err) {
    console.warn("⚠️ Database check/creation warning:", err.message);
  } finally {
    await adminClient.end().catch(() => {});
  }
}

/**
 * Initialize all PostgreSQL tables & seed data if needed
 */
async function initDb() {
  await ensureDatabaseExists();

  const client = await pool.connect();
  try {
    console.log("🐘 Initializing PostgreSQL database tables...");

    // 1. Users Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'competitor',
        team_name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE users ADD COLUMN IF NOT EXISTS team_name VARCHAR(255);
    `);

    // 1b. Teams Table (id, team_name UNIQUE)
    await client.query(`
      CREATE TABLE IF NOT EXISTS teams (
        id SERIAL PRIMARY KEY,
        team_name VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Migration helper: If old teams table had user_id column, migrate data or remove user_id column
    try {
      await client.query(`
        ALTER TABLE teams DROP COLUMN IF EXISTS user_id;
        ALTER TABLE teams DROP COLUMN IF EXISTS username;
        ALTER TABLE teams ADD CONSTRAINT teams_team_name_key UNIQUE (team_name);
      `);
    } catch (e) {
      // Ignore if constraint already exists
    }

    // 1c. Team Associations Table (composite key: team_id, user_id)
    await client.query(`
      CREATE TABLE IF NOT EXISTS team_associations (
        team_id INT REFERENCES teams(id) ON DELETE CASCADE,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (team_id, user_id)
      );
    `);

    // 2. Problems Table (supports round 1 & round 2, title, description, solution, points, time_limit, sample_test_case)
    await client.query(`
      CREATE TABLE IF NOT EXISTS problems (
        id VARCHAR(100) PRIMARY KEY,
        round INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        difficulty VARCHAR(50) DEFAULT 'Easy',
        description TEXT NOT NULL,
        solution TEXT,
        points INT DEFAULT 100,
        time_limit INT DEFAULT 2000,
        sample_test_case JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Test Cases Table (inputs, expected outputs, links to problems)
    await client.query(`
      CREATE TABLE IF NOT EXISTS test_cases (
        id SERIAL PRIMARY KEY,
        problem_id VARCHAR(100) REFERENCES problems(id) ON DELETE CASCADE,
        input TEXT NOT NULL,
        expected_output TEXT NOT NULL,
        is_sample BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4. Submissions Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS submissions (
        id SERIAL PRIMARY KEY,
        submission_key VARCHAR(255) UNIQUE NOT NULL,
        username VARCHAR(255) NOT NULL,
        round INT NOT NULL,
        problem_id VARCHAR(100),
        problem_idx INT DEFAULT 0,
        code TEXT,
        language VARCHAR(50),
        timestamp BIGINT,
        status VARCHAR(50),
        result JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 5. Event State Table (for game persistence)
    await client.query(`
      CREATE TABLE IF NOT EXISTS event_state (
        key VARCHAR(100) PRIMARY KEY,
        value JSONB
      );
    `);

    // ─── Auto Create Default Admin Account ───
    const adminCheck = await client.query("SELECT * FROM users WHERE username = $1", ["admin"]);
    if (adminCheck.rowCount === 0) {
      await client.query(
        "INSERT INTO users (username, password, role) VALUES ($1, $2, $3)",
        ["admin", "admin123", "admin"]
      );
      console.log("🛠️ Default Admin account ('admin') created in PostgreSQL");
    }

    // ─── Seed Default LeetCode Problems into PostgreSQL ───
    console.log("🌱 Syncing default LeetCode problems into PostgreSQL...");
    const defaultProblems = require("./data/problems");
    for (const [roundNum, poolArr] of Object.entries(defaultProblems)) {
      for (const p of poolArr) {
        await client.query(
          `INSERT INTO problems (id, round, title, difficulty, description, solution, points, time_limit, sample_test_case)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (id) DO UPDATE SET
             round = EXCLUDED.round,
             title = EXCLUDED.title,
             difficulty = EXCLUDED.difficulty,
             description = EXCLUDED.description,
             solution = EXCLUDED.solution,
             points = EXCLUDED.points,
             time_limit = EXCLUDED.time_limit,
             sample_test_case = EXCLUDED.sample_test_case`,
          [
            p.id,
            parseInt(roundNum, 10),
            p.title,
            p.difficulty || "Easy",
            p.description,
            p.solution || null,
            p.points || 100,
            p.timeLimit || 2000,
            p.sampleTestCase ? JSON.stringify(p.sampleTestCase) : null,
          ]
        );

        // Clear existing test cases for this seeded problem to ensure clean sync
        await client.query("DELETE FROM test_cases WHERE problem_id = $1", [p.id]);

        // Insert visible sample test case
        if (p.sampleTestCase && p.sampleTestCase.input !== undefined) {
          await client.query(
            `INSERT INTO test_cases (problem_id, input, expected_output, is_sample)
             VALUES ($1, $2, $3, true)`,
            [p.id, p.sampleTestCase.input, p.sampleTestCase.expectedOutput || p.sampleTestCase.output || "", true]
          );
        }

        // Insert hidden evaluation test cases
        if (Array.isArray(p.testCases)) {
          for (const tc of p.testCases) {
            await client.query(
              `INSERT INTO test_cases (problem_id, input, expected_output, is_sample)
               VALUES ($1, $2, $3, false)`,
              [p.id, tc.input, tc.expectedOutput || tc.output || "", false]
            );
          }
        }
      }
    }
    console.log("✅ Seed LeetCode problems & test cases successfully populated in PostgreSQL.");

    console.log("✅ PostgreSQL initialization complete.");
  } catch (err) {
    console.error("❌ Error initializing PostgreSQL:", err.message);
  } finally {
    client.release();
  }
}

// ─── Helper Queries ───
async function query(text, params) {
  return pool.query(text, params);
}

// Helper to get problems grouped by round or all problems with testcases
async function getAllProblemsWithTestCases() {
  const probRes = await query("SELECT * FROM problems ORDER BY round ASC, id ASC");
  const testRes = await query("SELECT * FROM test_cases ORDER BY id ASC");

  const problemsMap = {};
  probRes.rows.forEach((p) => {
    problemsMap[p.id] = {
      ...p,
      timeLimit: p.time_limit,
      sampleTestCase: p.sample_test_case,
      testCases: [],
    };
  });

  testRes.rows.forEach((tc) => {
    if (problemsMap[tc.problem_id]) {
      problemsMap[tc.problem_id].testCases.push({
        id: tc.id,
        input: tc.input,
        expectedOutput: tc.expected_output,
        isSample: tc.is_sample,
      });
    }
  });

  return Object.values(problemsMap);
}

async function getProblemsByRoundMap() {
  const allProbs = await getAllProblemsWithTestCases();
  const roundMap = { 1: [], 2: [] };

  allProbs.forEach((p) => {
    if (!roundMap[p.round]) roundMap[p.round] = [];
    roundMap[p.round].push(p);
  });

  return roundMap;
}

module.exports = {
  pool,
  query,
  initDb,
  getAllProblemsWithTestCases,
  getProblemsByRoundMap,
};
