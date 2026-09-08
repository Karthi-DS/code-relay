/**
 * AI-Powered Scoring System:
 * 
 * Base Points: from problem definition (e.g., 100)
 * 
 * Language Deductions (from base points):
 * - C:           0 (no deduction - hardest language)
 * - Java:       -3 points
 * - Python:     -5 points
 * - JavaScript: -5 points
 * 
 * Error Deductions (from adjusted points, per error instance):
 * - Syntax Error:  -7 points per error
 * - Logical Error: -10 points per failed test case
 * - Runtime Error: -8 points per error
 * 
 * Time Limit Exceeded: 10% of adjusted points only
 * 
 * Irrelevant Program: 0 points (code does not solve the problem)
 * 
 * STRICT MODE (Rounds 1 & 2):
 * - Must pass at least 50% of test cases or score = 0 (Irrelevant)
 * - Logical error penalty multiplied by 1.5x
 */

const LANGUAGE_DEDUCTIONS = {
  c: 0,
  java: 0,
  python: 0,
  javascript: 0,
  cpp: 0,
};

const ERROR_PENALTIES = {
  syntax: 7,    // -7 per syntax error
  logical: 10,  // -10 per failed test case (logical error)
  runtime: 8,   // -8 per runtime error
};

function calculateScore(basePoints, aiResult, timeInfo = null, language = "python", round = 1) {
  let score = 0;
  let errorType = "none";
  const feedback = [];
  const isStrictRound = (round === 1 || round === 2); // Both rounds are strict

  // ── Step 1: Language deduction ──
  const langDeduction = LANGUAGE_DEDUCTIONS[language] || 0;
  const adjustedPoints = Math.max(0, basePoints - langDeduction);

  // ── Step 2: Handle error types from AI evaluation ──
  const syntaxErrors = aiResult.syntax_error_count || 0;
  const runtimeErrors = aiResult.runtime_error_count || 0;
  const logicalErrors = aiResult.logical_error_count || 0;
  const testResults = aiResult.test_results || [];
  const totalTests = testResults.length;
  const passedTests = testResults.filter(t => t.passed).length;

  // ── Guard: If no test results and no errors, treat as irrelevant program ──
  if (totalTests === 0 && !aiResult.compilation_error && !aiResult.syntax_error && !aiResult.runtime_error && !aiResult.timed_out) {
    score = 0;
    errorType = "Irrelevant Program";
    feedback.push("Your code does not produce valid output for any test case.");
    feedback.push("Please submit a program that solves the given problem.");
    feedback.push(`Score: 0/${adjustedPoints}`);
    return buildResult(score, errorType, feedback, language, langDeduction, 0, 0, 0, 0, 0);
  }

  // Compilation / Syntax errors
  if (aiResult.compilation_error || aiResult.syntax_error) {
    const syntaxPenalty = syntaxErrors * ERROR_PENALTIES.syntax;
    const testsRatio = totalTests > 0 ? passedTests / totalTests : 0;
    const earnedPoints = adjustedPoints * testsRatio;
    score = Math.floor(Math.max(0, earnedPoints - syntaxPenalty));
    errorType = aiResult.compilation_error ? "Compilation Error" : "Syntax Error";

    feedback.push(`${syntaxErrors} syntax error(s) detected → -${syntaxPenalty} pts (${syntaxErrors} × ${ERROR_PENALTIES.syntax})`);
    feedback.push(`Score: ${score}/${adjustedPoints}`);

    if (aiResult.error_details) {
      // Show first few lines of the error
      const errorLines = aiResult.error_details.split("\n").slice(0, 5).join("\n");
      feedback.push(`Error: ${errorLines}`);
    }

    return buildResult(score, errorType, feedback, language, langDeduction, totalTests, passedTests, syntaxErrors, runtimeErrors, logicalErrors);
  }

  // Runtime errors
  if (aiResult.runtime_error) {
    const runtimePenalty = runtimeErrors * ERROR_PENALTIES.runtime;
    const testsRatio = totalTests > 0 ? passedTests / totalTests : 0;
    const earnedPoints = adjustedPoints * testsRatio;
    score = Math.floor(Math.max(0, earnedPoints - runtimePenalty));
    errorType = "Runtime Error";

    feedback.push(`${runtimeErrors} runtime error(s) detected → -${runtimePenalty} pts (${runtimeErrors} × ${ERROR_PENALTIES.runtime})`);
    feedback.push(`Score: ${score}/${adjustedPoints}`);

    if (aiResult.error_details) {
      const errorLines = aiResult.error_details.split("\n").slice(0, 5).join("\n");
      feedback.push(`Error: ${errorLines}`);
    }

    return buildResult(score, errorType, feedback, language, langDeduction, totalTests, passedTests, syntaxErrors, runtimeErrors, logicalErrors);
  }

  // Time Limit Exceeded
  if (aiResult.timed_out) {
    score = Math.round(adjustedPoints * 0.10);
    errorType = "Time Limit Exceeded";

    feedback.push(`Time Limit Exceeded! Score: ${score} (10% partial credit).`);
    feedback.push("Optimize your algorithm — avoid nested loops or use better data structures.");

    return buildResult(score, errorType, feedback, language, langDeduction, totalTests, passedTests, syntaxErrors, runtimeErrors, logicalErrors);
  }

  // ── Step 3: Check if program is irrelevant (ALL test cases failed) ──
  if (totalTests > 0 && passedTests === 0) {
    score = 0;
    errorType = "Irrelevant Program";

    feedback.push(`0/${totalTests} test cases passed — your program does not produce correct output.`);
    feedback.push("This program appears irrelevant to the given problem. Please review the problem statement.");
    feedback.push(`Score: 0/${adjustedPoints}`);

    // Show first failed test case
    const firstFailed = testResults.find(t => !t.passed);
    if (firstFailed) {
      feedback.push(`Expected: "${firstFailed.expected}", Got: "${firstFailed.actual}"`);
    }

    // Pass 0 for logicalErrors — irrelevant program is NOT a logical error
    return buildResult(score, errorType, feedback, language, langDeduction, totalTests, passedTests, 0, 0, 0);
  }

  // ── Step 3.5: Strict mode — less than half test cases passed = Irrelevant ──
  if (isStrictRound && totalTests > 0 && passedTests < Math.ceil(totalTests / 2)) {
    score = 0;
    errorType = "Irrelevant Program";

    feedback.push(`${passedTests}/${totalTests} test cases passed — insufficient for this round.`);
    feedback.push("In competitive rounds, you must pass at least half the test cases to earn points.");
    feedback.push("Your program does not adequately solve the given problem.");
    feedback.push(`Score: 0/${adjustedPoints}`);

    const firstFailed = testResults.find(t => !t.passed);
    if (firstFailed) {
      feedback.push(`Expected: "${firstFailed.expected}", Got: "${firstFailed.actual}"`);
    }

    return buildResult(score, errorType, feedback, language, langDeduction, totalTests, passedTests, 0, 0, logicalErrors);
  }

  // ── Step 4: Logical errors (some test cases failed, some passed) ──
  if (logicalErrors > 0) {
    // Strict rounds apply heavier logical penalties
    const penaltyMultiplier = isStrictRound ? 1.5 : 1;
    const logicalPenalty = Math.round(logicalErrors * ERROR_PENALTIES.logical * penaltyMultiplier);
    const testsRatio = totalTests > 0 ? passedTests / totalTests : 0;
    const earnedPoints = adjustedPoints * testsRatio;
    score = Math.floor(Math.max(0, earnedPoints - logicalPenalty));
    errorType = "Wrong Answer";

    feedback.push(`${passedTests}/${totalTests} test cases passed.`);
    feedback.push(`${logicalErrors} logical error(s) → -${logicalPenalty} pts (${logicalErrors} × ${ERROR_PENALTIES.logical}${isStrictRound ? " × 1.5 strict" : ""})`);
    feedback.push(`Score: ${score}/${adjustedPoints}`);

    // Show first failed test case
    const firstFailed = testResults.find(t => !t.passed);
    if (firstFailed) {
      feedback.push(`First failure: expected "${firstFailed.expected}", got "${firstFailed.actual}"`);
    }

    return buildResult(score, errorType, feedback, language, langDeduction, totalTests, passedTests, syntaxErrors, runtimeErrors, logicalErrors);
  }

  // ── Step 5: All test cases passed! ──
  score = adjustedPoints;
  errorType = "Accepted";

  feedback.push(`All ${totalTests} test cases passed! Score: ${score} points.`);

  return buildResult(score, errorType, feedback, language, langDeduction, totalTests, passedTests, syntaxErrors, runtimeErrors, logicalErrors);
}

function buildResult(score, errorType, feedback, language, langDeduction, totalCases, passedCases, syntaxErrors, runtimeErrors, logicalErrors) {
  return {
    score,
    errorType,
    feedback,
    language,
    languageDeduction: langDeduction,
    totalCases,
    passedCases,
    errorBreakdown: {
      syntaxErrors,
      runtimeErrors,
      logicalErrors,
      syntaxPenaltyPerError: ERROR_PENALTIES.syntax,
      runtimePenaltyPerError: ERROR_PENALTIES.runtime,
      logicalPenaltyPerError: ERROR_PENALTIES.logical,
    },
  };
}

function getFinalScore(submission) {
  if (submission.result?.manualScore !== undefined) {
    return submission.result.manualScore;
  }
  return submission.result?.aiScore ?? 0;
}

module.exports = {
  calculateScore,
  getFinalScore,
};
