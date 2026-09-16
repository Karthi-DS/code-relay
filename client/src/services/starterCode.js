/**
 * Starter Code Generator for Code Relay Problems
 * Contains ONLY function signatures without full solution implementations.
 * Supported languages: python, java, c
 */

const DEFAULT_STARTER_CODES = {
  r1p1: { // Two Sum
    python: `def twoSum(nums, target):
    pass
`,
    c: `#include <stdio.h>
#include <stdlib.h>

int* twoSum(int* nums, int numsSize, int target, int* returnSize) {
    *returnSize = 2;
    int* result = (int*)malloc(2 * sizeof(int));
    
    return result;
}
`,
    java: `import java.util.*;

public class Solution {
    public int[] twoSum(int[] nums, int target) {
        return new int[]{};
    }
}
`
  },
  r1p2: { // Valid Anagram
    python: `def isAnagram(s, t):
    pass
`,
    c: `#include <stdio.h>
#include <stdbool.h>
#include <string.h>

bool isAnagram(char* s, char* t) {
    return false;
}
`,
    java: `public class Solution {
    public boolean isAnagram(String s, String t) {
        return false;
    }
}
`
  },
  r2p1: { // Best Time to Buy and Sell Stock
    python: `def maxProfit(prices):
    pass
`,
    c: `#include <stdio.h>

int maxProfit(int* prices, int pricesSize) {
    return 0;
}
`,
    java: `public class Solution {
    public int maxProfit(int[] prices) {
        return 0;
    }
}
`
  },
  r2p2: { // Number of Islands
    python: `def numIslands(grid):
    pass
`,
    c: `#include <stdio.h>
#include <stdlib.h>

int numIslands(char** grid, int gridSize, int* gridColSize) {
    return 0;
}
`,
    java: `public class Solution {
    public int numIslands(char[][] grid) {
        return 0;
    }
}
`
  }
};

/**
 * Get initial function signature stub based on problem object & target language
 */
export function getStarterCode(problem, language = "python") {
  if (!problem) return getGenericStarterCode("solution", language);

  // 1. Check if problem contains custom starterCode object
  const sc = problem.starterCode || problem.starter_code;
  if (sc && sc[language]) {
    return sc[language];
  }

  // 2. Check predefined problem catalog
  const problemId = problem.id;
  if (DEFAULT_STARTER_CODES[problemId] && DEFAULT_STARTER_CODES[problemId][language]) {
    return DEFAULT_STARTER_CODES[problemId][language];
  }

  // 3. Fallback to generating generic function signature from problem title
  const fnName = toCamelCase(problem.title || "solution");
  return getGenericStarterCode(fnName, language);
}

function toCamelCase(str) {
  return str
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .split(" ")
    .map((word, index) =>
      index === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    )
    .join("");
}

function getGenericStarterCode(funcName, language) {
  switch (language) {
    case "c":
      return `#include <stdio.h>\n\nvoid ${funcName}() {\n    \n}\n`;
    case "java":
      return `public class Solution {\n    public void ${funcName}() {\n        \n    }\n}\n`;
    case "python":
    default:
      return `def ${funcName}():\n    pass\n`;
  }
}
