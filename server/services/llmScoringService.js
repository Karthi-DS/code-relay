const axios = require("axios");

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:7b-instruct";

const LANG_PENALTY = { python: 0, javascript: 0, js: 0, java: 0, cpp: 0, "c++": 0, c: 0 };

// Minimum code length to be considered a real attempt
const MIN_CODE_LENGTH = 15;

function applyRules(result, language, rawCode) {
    const errorType = (result.error_type || "Accepted").trim();
    const feedback = [result.feedback || "Evaluated."];

    // Hard rule: gibberish / too short → Irrelevant Program
    const codeLen = (rawCode || "").trim().length;
    if (codeLen < MIN_CODE_LENGTH || errorType === "Irrelevant Program") {
        feedback.push("Code does not attempt to solve the problem.");
        return { score: 0, errorType: "Irrelevant Program", feedback };
    }

    let score = Math.max(0, Math.min(100, Number(result.score) || 0));

    // Hard rule: error types must not give near-perfect scores
    if (errorType === "Syntax Error" && score > 40)    score = 40;
    if (errorType === "Runtime Error" && score > 50)   score = 50;
    if (errorType === "Wrong Answer" && score > 60)    score = 60;

    return { score, errorType, feedback };
}

async function getLLMScore(code, language, problem) {
    const prompt = `You are a code judge. Problem: ${problem.description.slice(0, 300)}
Code (${language}): ${code.slice(0, 800)}
Output ONLY valid JSON: {"score":0-100,"feedback":"one sentence","error_type":"Accepted|Wrong Answer|Syntax Error|Runtime Error|Irrelevant Program"}`;

    try {
        const response = await axios.post(
            `${OLLAMA_URL}/api/generate`,
            {
                model: OLLAMA_MODEL,
                prompt,
                stream: false,
                format: "json",
                options: { num_predict: 80, temperature: 0 }
            },
            { timeout: 60000 }
        );

        let resultText = response.data.response.trim();
        if (resultText.startsWith("```")) resultText = resultText.replace(/```[\w]*\n?/g, "").trim();
        const result = JSON.parse(resultText);

        return applyRules(result, language, code);
    } catch (error) {
        console.error("LLM Evaluation Failed:", error.message);
        return {
            score: 0,
            errorType: "LLM Request Failed",
            feedback: ["Failed to reach the AI model.", error.message]
        };
    }
}

module.exports = { getLLMScore };
