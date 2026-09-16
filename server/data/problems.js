/**
 * Problem Pool
 * Leg 1 (Round 1 - 30 MINS) contains iconic LeetCode Easy problems:
 * 1. Two Sum (r1p1) - 100 PTS MAX
 * 2. Valid Anagram (r1p2) - 100 PTS MAX
 * 
 * Leg 2 (Round 2 - 45 MINS) contains:
 * 1. Best Time to Buy and Sell Stock (r2p1) - 150 PTS MAX
 * 2. Number of Islands (r2p2) - 150 PTS MAX
 */

const problems = {
  1: [
    {
      id: "r1p1",
      title: "Two Sum",
      difficulty: "Easy",
      description: `Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.

You may assume that each input would have exactly one solution, and you may not use the same element twice.

Input Format:
- Line 1: Space-separated integers representing array nums.
- Line 2: An integer target.

Output Format:
- Two space-separated indices (0-indexed).

Constraints:
- 2 <= nums.length <= 10^4
- -10^9 <= nums[i] <= 10^9
- -10^9 <= target <= 10^9
- Exactly one valid answer exists.`,
      solution: `def twoSum(nums, target):
    seen = {}
    for i, num in enumerate(nums):
        diff = target - num
        if diff in seen:
            return [seen[diff], i]
        seen[num] = i
    return []`,
      points: 100,
      timeLimit: 2000,
      sampleTestCase: {
        input: "2 7 11 15\n9",
        expectedOutput: "0 1"
      },
      starterCode: {
        python: `def twoSum(nums, target):
    pass
`,
        java: `import java.util.*;

public class Solution {
    public int[] twoSum(int[] nums, int target) {
        return new int[]{};
    }
}
`,
        c: `#include <stdio.h>
#include <stdlib.h>

int* twoSum(int* nums, int numsSize, int target, int* returnSize) {
    *returnSize = 2;
    int* result = (int*)malloc(2 * sizeof(int));
    return result;
}
`
      },
      testCases: [
        { input: "3 2 4\n6", expectedOutput: "1 2", isSample: false },
        { input: "3 3\n6", expectedOutput: "0 1", isSample: false },
        { input: "-1 -2 -3 -4 -5\n-8", expectedOutput: "2 4", isSample: false },
        { input: "0 4 3 0\n0", expectedOutput: "0 3", isSample: false },
        { input: "1 5 8 12 14\n13", expectedOutput: "1 2", isSample: false }
      ]
    },
    {
      id: "r1p2",
      title: "Valid Anagram",
      difficulty: "Easy",
      description: `Given two strings s and t, return true if t is an anagram of s, and false otherwise.

An Anagram is a word or phrase formed by rearranging the letters of a different word or phrase, typically using all the original letters exactly once.

Input Format:
- Line 1: String s.
- Line 2: String t.

Output Format:
- "true" or "false" (lowercase).`,
      solution: `def isAnagram(s, t):
    return sorted(s) == sorted(t)`,
      points: 100,
      timeLimit: 2000,
      sampleTestCase: {
        input: "anagram\nnagaram",
        expectedOutput: "true"
      },
      starterCode: {
        python: `def isAnagram(s, t):
    pass
`,
        java: `public class Solution {
    public boolean isAnagram(String s, String t) {
        return false;
    }
}
`,
        c: `#include <stdio.h>
#include <stdbool.h>

bool isAnagram(char* s, char* t) {
    return false;
}
`
      },
      testCases: [
        { input: "rat\ncar", expectedOutput: "false", isSample: false },
        { input: "a\na", expectedOutput: "true", isSample: false },
        { input: "listen\nsilent", expectedOutput: "true", isSample: false }
      ]
    }
  ],

  2: [
    {
      id: "r2p1",
      title: "Best Time to Buy and Sell Stock",
      difficulty: "Easy",
      description: `You are given an array prices where prices[i] is the price of a given stock on the i-th day.

You want to maximize your profit by choosing a single day to buy one stock and choosing a different day in the future to sell that stock.

Return the maximum profit you can achieve from this transaction. If you cannot achieve any profit, return 0.`,
      solution: `def maxProfit(prices):
    min_price = float('inf')
    max_profit = 0
    for price in prices:
        if price < min_price:
            min_price = price
        elif price - min_price > max_profit:
            max_profit = price - min_price
    return max_profit`,
      points: 150,
      timeLimit: 2000,
      sampleTestCase: {
        input: "7 1 5 3 6 4",
        expectedOutput: "5"
      },
      starterCode: {
        python: `def maxProfit(prices):
    pass
`,
        java: `public class Solution {
    public int maxProfit(int[] prices) {
        return 0;
    }
}
`,
        c: `#include <stdio.h>

int maxProfit(int* prices, int pricesSize) {
    return 0;
}
`
      },
      testCases: [
        { input: "7 6 4 3 1", expectedOutput: "0", isSample: false },
        { input: "1 2 3 4 5", expectedOutput: "4", isSample: false }
      ]
    },
    {
      id: "r2p2",
      title: "Number of Islands",
      difficulty: "Medium",
      description: `Given an m x n 2D binary grid grid which represents a map of '1's (land) and '0's (water), return the number of islands.`,
      solution: `def numIslands(grid):
    if not grid:
        return 0
    m, n = len(grid), len(grid[0])
    islands = 0

    def dfs(r, c):
        if r < 0 or r >= m or c < 0 or c >= n or grid[r][c] != '1':
            return
        grid[r][c] = '0'
        dfs(r + 1, c)
        dfs(r - 1, c)
        dfs(r, c + 1)
        dfs(r, c - 1)

    for r in range(m):
        for c in range(n):
            if grid[r][c] == '1':
                islands += 1
                dfs(r, c)
    return islands`,
      points: 150,
      timeLimit: 3000,
      sampleTestCase: {
        input: "4 5\n1 1 1 1 0\n1 1 0 1 0\n1 1 0 0 0\n0 0 0 0 0",
        expectedOutput: "1"
      },
      starterCode: {
        python: `def numIslands(grid):
    pass
`,
        java: `public class Solution {
    public int numIslands(char[][] grid) {
        return 0;
    }
}
`,
        c: `#include <stdio.h>

int numIslands(char** grid, int gridSize, int* gridColSize) {
    return 0;
}
`
      },
      testCases: [
        { input: "1 1\n1", expectedOutput: "1", isSample: false },
        { input: "1 1\n0", expectedOutput: "0", isSample: false }
      ]
    }
  ]
};

module.exports = problems;