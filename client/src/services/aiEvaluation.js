const hostname = (typeof window !== "undefined" && window.location && window.location.hostname) || "localhost";
const DEFAULT_OLLAMA_URL = `http://${hostname}:11434`;
const DEFAULT_OLLAMA_MODEL = "qwen2.5:7b-instruct";

const MIN_CODE_LENGTH = 15;

function applyRules(result, language, rawCode) {
    const errorType = (result.error_type || "Accepted").trim();
    const feedback = [result.feedback || "Evaluated."];

    // Hard rule: gibberish / too short
    const codeLen = (rawCode || "").trim().length;
    if (codeLen < MIN_CODE_LENGTH || errorType === "Irrelevant Program") {
        return {
            score: 0,
            errorType: "Irrelevant Program",
            feedback: ["Code does not attempt to solve the problem."]
        };
    }

    // Recalculate score from rubric (trust rubric, not model guess)
    const r = result.rubric || {};
    let score =
        (r.understanding || 0) +
        (r.logic || 0) +
        (r.edge_cases || 0) +
        (r.clarity || 0) +
        (r.language || 0);

    // Hard caps by error type
    if (errorType === "Syntax Error")  score = Math.min(score, 40);
    if (errorType === "Runtime Error") score = Math.min(score, 50);
    if (errorType === "Wrong Answer")  score = Math.min(score, 60);

    return {
        score: Math.max(0, Math.min(100, score)),
        errorType,
        feedback
    };
}

export async function evaluateCodeLocally(code, language, problem) {
    const ollamaUrl = localStorage.getItem("OLLAMA_URL") || DEFAULT_OLLAMA_URL;
    const ollamaModel = localStorage.getItem("OLLAMA_MODEL") || DEFAULT_OLLAMA_MODEL;

    const prompt = `
You are a STRICT code judge for a blind coding contest.
You MUST be conservative. Do NOT guess missing logic.

Problem:
${(problem?.description || "Solve the problem.").slice(0, 300)}

Submitted Code (${language}):
${code.slice(0, 800)}

Evaluation Steps (MANDATORY):
1. Decide whether the code attempts to solve the problem.
2. Check if the main logic is correct.
3. Identify missing edge cases or logical flaws.
4. Choose error_type EXACTLY as one of:
   Accepted | Wrong Answer | Syntax Error | Runtime Error | Irrelevant Program
5. Score using the rubric below.

STRICT RUBRIC:
- understanding (0–20)
- logic (0–40)
- edge_cases (0–20)
- clarity (0–10)
- language (0–10)

HARD RULES:
- If code does not attempt the problem → Irrelevant Program (score 0)
- If logic is incorrect → error_type MUST be Wrong Answer
- Wrong Answer → max score 60
- Runtime Error → max score 50
- Syntax Error → max score 40
- Do NOT give high scores for partially correct logic
- Do NOT assume missing code works

Output ONLY valid JSON in this EXACT format:
{
  "intent_match": true,
  "logic_correct": false,
  "error_type": "Wrong Answer",
  "rubric": {
    "understanding": 0,
    "logic": 0,
    "edge_cases": 0,
    "clarity": 0,
    "language": 0
  },
  "feedback": "one short sentence"
}
`;

    try {
        const response = await fetch(`${ollamaUrl}/api/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: ollamaModel,
                prompt,
                stream: false,
                format: "json",
                options: {
                    temperature: 0,
                    num_predict: 200
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Ollama returned HTTP ${response.status}`);
        }

        const data = await response.json();
        let content = data?.response;
        if (!content) throw new Error("No response from Ollama");

        content = content.trim();
        if (content.startsWith("```")) {
            content = content.replace(/```[\w]*\n?/g, "").trim();
        }

        const result = JSON.parse(content);

        return {
            ...applyRules(result, language, code),
            modelUsed: ollamaModel
        };

    } catch (error) {
        console.error("Ollama AI Evaluation error:", error);
        throw new Error(
            `AI evaluation failed: ${error.message}. Make sure Ollama is running (ollama serve).`
        );
    }
}