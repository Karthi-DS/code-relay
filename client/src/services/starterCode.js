/**
 * Starter Code Generator for Code Relay Problems
 * Contains function signatures without full solution implementations.
 * Supported languages: python, java, c
 */

const TWO_SUM = {
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
};

const VALID_ANAGRAM = {
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
};

const BEST_TIME_STOCK = {
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
};

const NUMBER_OF_ISLANDS = {
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
};

const LONGEST_SUBSTRING = {
  python: `def lengthOfLongestSubstring(s):
    pass
`,
  c: `#include <stdio.h>
#include <string.h>

int lengthOfLongestSubstring(char* s) {
    return 0;
}
`,
  java: `public class Solution {
    public int lengthOfLongestSubstring(String s) {
        return 0;
    }
}
`
};

const DEFAULT_STARTER_CODES = {
  // Canonical DB Problem IDs
  "two-sum": TWO_SUM,
  "valid-anagram": VALID_ANAGRAM,
  "best-time-to-buy-and-sell-stock": BEST_TIME_STOCK,
  "number-of-islands": NUMBER_OF_ISLANDS,
  "longest-substring-without-repeating-characters": LONGEST_SUBSTRING,

  // Legacy/Round aliases
  r1p1: TWO_SUM,
  r1p2: VALID_ANAGRAM,
  r2p1: LONGEST_SUBSTRING,
  r2p2: NUMBER_OF_ISLANDS,
};

/**
 * Get initial function signature stub based on problem object & target language
 */
export function getStarterCode(problem, language = "python") {
  const lang = (language || "python").toLowerCase();
  if (!problem) return getGenericStarterCode("solution", lang);

  // 1. Check if problem contains custom starterCode / starter_code object
  let sc = problem.starterCode || problem.starter_code;
  if (typeof sc === "string") {
    try {
      sc = JSON.parse(sc);
    } catch {
      // Not valid JSON string, continue
    }
  }

  if (sc && typeof sc === "object" && sc[lang]) {
    return sc[lang];
  }

  // 2. Check predefined problem catalog by exact problemId
  const problemId = problem.id;
  if (problemId && DEFAULT_STARTER_CODES[problemId] && DEFAULT_STARTER_CODES[problemId][lang]) {
    return DEFAULT_STARTER_CODES[problemId][lang];
  }

  // 3. Fallback: match by normalized title
  const normalizedTitle = (problem.title || "").toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
  if (normalizedTitle && DEFAULT_STARTER_CODES[normalizedTitle] && DEFAULT_STARTER_CODES[normalizedTitle][lang]) {
    return DEFAULT_STARTER_CODES[normalizedTitle][lang];
  }

  // 4. Fallback to generating generic function signature from problem title
  const fnName = toCamelCase(problem.title || "solution");
  return getGenericStarterCode(fnName, lang);
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
