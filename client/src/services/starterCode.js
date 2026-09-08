/**
 * Starter Code Generator for Code Relay Problems
 * Contains ONLY function signatures without full solution implementations.
 */

const DEFAULT_STARTER_CODES = {
  r1p1: { // Two Sum
    python: `def twoSum(nums, target):
    pass
`,
    javascript: `function twoSum(nums, target) {
    
}
`,
    cpp: `#include <iostream>
#include <vector>
using namespace std;

vector<int> twoSum(vector<int>& nums, int target) {
    
}
`,
    c: `#include <stdio.h>

void twoSum(int* nums, int numsSize, int target, int* returnSize) {
    
}
`,
    java: `import java.util.*;

public class Solution {
    public int[] twoSum(int[] nums, int target) {
        
    }
}
`
  },
  r1p2: { // Reverse String
    python: `def reverseString(s):
    pass
`,
    javascript: `function reverseString(s) {
    
}
`,
    cpp: `#include <iostream>
#include <string>
using namespace std;

string reverseString(string s) {
    
}
`,
    c: `#include <stdio.h>
#include <string.h>

void reverseString(char* s) {
    
}
`,
    java: `public class Solution {
    public String reverseString(String s) {
        
    }
}
`
  },
  r1p3: { // Best Time to Buy and Sell Stock
    python: `def maxProfit(prices):
    pass
`,
    javascript: `function maxProfit(prices) {
    
}
`,
    cpp: `#include <iostream>
#include <vector>
using namespace std;

int maxProfit(vector<int>& prices) {
    
}
`,
    c: `#include <stdio.h>

int maxProfit(int* prices, int pricesSize) {
    
}
`,
    java: `public class Solution {
    public int maxProfit(int[] prices) {
        
    }
}
`
  },
  r2p1: { // FizzBuzz
    python: `def fizzBuzz(n):
    pass
`,
    javascript: `function fizzBuzz(n) {
    
}
`,
    cpp: `#include <iostream>
using namespace std;

void fizzBuzz(int n) {
    
}
`,
    c: `#include <stdio.h>

void fizzBuzz(int n) {
    
}
`,
    java: `public class Solution {
    public void fizzBuzz(int n) {
        
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
  if (problem.starterCode && problem.starterCode[language]) {
    return problem.starterCode[language];
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
    case "javascript":
      return `function ${funcName}() {\n    \n}\n`;
    case "cpp":
      return `#include <iostream>\nusing namespace std;\n\nvoid ${funcName}() {\n    \n}\n`;
    case "c":
      return `#include <stdio.h>\n\nvoid ${funcName}() {\n    \n}\n`;
    case "java":
      return `public class Solution {\n    public void ${funcName}() {\n        \n    }\n}\n`;
    case "python":
    default:
      return `def ${funcName}():\n    pass\n`;
  }
}
