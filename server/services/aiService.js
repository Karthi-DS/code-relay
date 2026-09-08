const axios = require("axios");

const AI_URL = process.env.AI_SERVICE || "http://localhost:8000";

/**
 * Send code + test cases to the AI service for full evaluation.
 * The AI service compiles (C/Java), executes, classifies errors,
 * and returns structured results with error counts.
 */
exports.evaluateCode = async (code, language, testCases, timeLimit = 5000) => {
  try {
    const res = await axios.post(
      `${AI_URL}/evaluate`,
      {
        code,
        language,
        test_cases: testCases.map(tc => ({
          input: tc.input,
          expected: tc.expected,
        })),
        time_limit: timeLimit,
      },
      { timeout: 30000 } // 30s timeout for the HTTP request
    );
    return res.data;
  } catch (err) {
    console.error("[AI] Evaluate error:", err.message);
    return null;
  }
};

/**
 * Classify an error from stderr text.
 */
exports.analyzeError = async (stderr, language = "python") => {
  try {
    const res = await axios.post(`${AI_URL}/analyze`, { stderr, language });
    return res.data;
  } catch (err) {
    console.error("[AI] Analyze error:", err.message);
    return { type: "unknown", penalty: 0 };
  }
};

/**
 * Health check for the AI service.
 */
exports.healthCheck = async () => {
  try {
    const res = await axios.get(`${AI_URL}/health`, { timeout: 3000 });
    return res.data;
  } catch {
    return null;
  }
};
