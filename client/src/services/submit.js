import { fetchWithAuth } from "./api";

export async function submitCode(code, language, round, problemId) {
  return fetchWithAuth("/submit", {
    method: "POST",
    body: JSON.stringify({ code, language, round, problemId }),
  });
}

export async function runTestCode(code, language, round, problemId) {
  return fetchWithAuth("/submit/run-test", {
    method: "POST",
    body: JSON.stringify({ code, language, round, problemId }),
  });
}

export async function fetchTeamCode(round = 1, problemId = "") {
  return fetchWithAuth(`/submit/team-code?round=${round}&problemId=${problemId}`);
}

export async function fetchRoundProblems(round = 1) {
  return fetchWithAuth(`/submit/problems?round=${round}`);
}

export async function fetchRoundSubmissions(round = 1) {
  return fetchWithAuth(`/submit/submissions-by-round?round=${round}`);
}

