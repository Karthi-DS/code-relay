/**
 * Problem Pool
 * Leg 1 (Round 1) contains iconic LeetCode Easy problems:
 * 1. Two Sum (r1p1) - 100 PTS MAX
 * 2. Valid Palindrome (r1p2) - 100 PTS MAX
 * 3. Best Time to Buy and Sell Stock (r1p3) - 100 PTS MAX
 * 
 * Leg 2 (Round 2) contains:
 * 1. FizzBuzz (r2p1) - 150 PTS MAX
 * 
 * Each problem includes:
 * - Detailed problem description & constraints
 * - 1 Visible sample test case
 * - AT LEAST 20 Hidden evaluation test cases for rigorous code submission verification
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
- Exactly one valid answer exists.

Example 1:
Input:
2 7 11 15
9

Output:
0 1

Explanation:
nums[0] + nums[1] == 2 + 7 == 9, so return [0, 1].

Example 2:
Input:
3 2 4
6

Output:
1 2`,
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
      testCases: [
        { input: "3 2 4\n6", expectedOutput: "1 2", isSample: false },
        { input: "3 3\n6", expectedOutput: "0 1", isSample: false },
        { input: "-1 -2 -3 -4 -5\n-8", expectedOutput: "2 4", isSample: false },
        { input: "0 4 3 0\n0", expectedOutput: "0 3", isSample: false },
        { input: "1 5 8 12 14\n13", expectedOutput: "1 2", isSample: false },
        { input: "10 20 30 40 50\n90", expectedOutput: "3 4", isSample: false },
        { input: "-10 7 19 15 2\n9", expectedOutput: "0 2", isSample: false },
        { input: "100 200 500 1000\n700", expectedOutput: "1 2", isSample: false },
        { input: "4 4\n8", expectedOutput: "0 1", isSample: false },
        { input: "1 2 3 4 5 6\n11", expectedOutput: "4 5", isSample: false },
        { input: "-50 -20 0 20 50\n0", expectedOutput: "1 3", isSample: false },
        { input: "8 11 4 6 15\n21", expectedOutput: "1 4", isSample: false },
        { input: "2 5 5 11\n10", expectedOutput: "1 2", isSample: false },
        { input: "1 7 3 9 12\n10", expectedOutput: "0 3", isSample: false },
        { input: "-3 4 3 90\n0", expectedOutput: "0 2", isSample: false },
        { input: "15 25 35 45\n60", expectedOutput: "1 2", isSample: false },
        { input: "6 1 4 9 11\n15", expectedOutput: "2 4", isSample: false },
        { input: "100 -50 25 -10\n15", expectedOutput: "2 3", isSample: false },
        { input: "5 10 15 20 25 30\n55", expectedOutput: "4 5", isSample: false },
        { input: "7 14 21 28 35\n49", expectedOutput: "2 3", isSample: false }
      ]
    },
    {
      id: "r1p2",
      title: "Reverse String",
      difficulty: "Easy",
      description: `Write a function that reverses a string. The input string is given as a single line.

Input Format:
- A single line containing the string s.

Output Format:
- The reversed string.

Constraints:
- 1 <= s.length <= 10^5
- s consists of printable ASCII characters.

Example 1:
Input:
hello

Output:
olleh

Example 2:
Input:
Hannah

Output:
hannaH`,
      solution: `def reverseString(s):
    return s[::-1]`,
      points: 100,
      timeLimit: 2000,
      sampleTestCase: {
        input: "hello",
        expectedOutput: "olleh"
      },
      testCases: [
        { input: "Hannah", expectedOutput: "hannaH", isSample: false },
        { input: "a", expectedOutput: "a", isSample: false },
        { input: "12345", expectedOutput: "54321", isSample: false },
        { input: "CodeRelay", expectedOutput: "yaleRedoC", isSample: false },
        { input: "OpenAI", expectedOutput: "IAnepO", isSample: false },
        { input: "Python 3.10", expectedOutput: "01.3 nohtyP", isSample: false },
        { input: "racecar", expectedOutput: "racecar", isSample: false },
        { input: "antigravity", expectedOutput: "ytivargitna", isSample: false },
        { input: "world", expectedOutput: "dlrow", isSample: false },
        { input: "JavaScript", expectedOutput: "tpircSavaJ", isSample: false },
        { input: "A man, a plan, a canal: Panama", expectedOutput: "amanaP :lanac a ,nalp a ,nam A", isSample: false },
        { input: "ab", expectedOutput: "ba", isSample: false },
        { input: "spaces inside string", expectedOutput: "gnirts edisni secaps", isSample: false },
        { input: "100200", expectedOutput: "002001", isSample: false },
        { input: "Algorithm", expectedOutput: "mhtiroglA", isSample: false },
        { input: "Data Structures", expectedOutput: "serutcurtS ataD", isSample: false },
        { input: "LeetCode", expectedOutput: "edoCteeL", isSample: false },
        { input: "Frontend", expectedOutput: "dnetnorF", isSample: false },
        { input: "Backend", expectedOutput: "dnekcaB", isSample: false }
      ]
    },
    {
      id: "r1p3",
      title: "Best Time to Buy and Sell Stock",
      difficulty: "Easy",
      description: `You are given an array prices where prices[i] is the price of a given stock on the i-th day.

You want to maximize your profit by choosing a single day to buy one stock and choosing a different day in the future to sell that stock.

Return the maximum profit you can achieve from this transaction. If you cannot achieve any profit, return 0.

Input Format:
- A single line containing space-separated integers representing array prices.

Output Format:
- A single integer representing maximum profit.

Constraints:
- 1 <= prices.length <= 10^5
- 0 <= prices[i] <= 10^4

Example 1:
Input:
7 1 5 3 6 4

Output:
5

Explanation:
Buy on day 2 (price = 1) and sell on day 5 (price = 6), profit = 6 - 1 = 5.

Example 2:
Input:
7 6 4 3 1

Output:
0

Explanation:
In this case, no transactions are done and max profit = 0.`,
      solution: `def maxProfit(prices):
    min_price = float('inf')
    max_profit = 0
    for price in prices:
        if price < min_price:
            min_price = price
        elif price - min_price > max_profit:
            max_profit = price - min_price
    return max_profit`,
      points: 100,
      timeLimit: 2000,
      sampleTestCase: {
        input: "7 1 5 3 6 4",
        expectedOutput: "5"
      },
      testCases: [
        { input: "7 6 4 3 1", expectedOutput: "0", isSample: false },
        { input: "1 2 3 4 5", expectedOutput: "4", isSample: false },
        { input: "2 4 1", expectedOutput: "2", isSample: false },
        { input: "3 2 6 5 0 3", expectedOutput: "4", isSample: false },
        { input: "10 20 30 40 50", expectedOutput: "40", isSample: false },
        { input: "50 40 30 20 10", expectedOutput: "0", isSample: false },
        { input: "5 5 5 5 5", expectedOutput: "0", isSample: false },
        { input: "1 10", expectedOutput: "9", isSample: false },
        { input: "10 1", expectedOutput: "0", isSample: false },
        { input: "2 1 2 1 0 1 2", expectedOutput: "2", isSample: false },
        { input: "3 3 5 0 0 3 1 4", expectedOutput: "4", isSample: false },
        { input: "1 4 2", expectedOutput: "3", isSample: false },
        { input: "2 1 4", expectedOutput: "3", isSample: false },
        { input: "100 180 260 310 40 535 695", expectedOutput: "655", isSample: false },
        { input: "11 12 13 14 15 16 17", expectedOutput: "6", isSample: false },
        { input: "9 8 7 6 5 10", expectedOutput: "5", isSample: false },
        { input: "1 2 4 2 5 7 2 4 9 0", expectedOutput: "8", isSample: false },
        { input: "10 15 20 5 25", expectedOutput: "20", isSample: false },
        { input: "6 1 3 2 4 7", expectedOutput: "6", isSample: false },
        { input: "12 3 10 1 8", expectedOutput: "7", isSample: false }
      ]
    }
  ],

  2: [
    {
      id: "r2p1",
      title: "FizzBuzz",
      difficulty: "Easy",
      description: `Given an integer N, print numbers from 1 to N using the following rules:
- Print "Fizz" for multiples of 3
- Print "Buzz" for multiples of 5
- Print "FizzBuzz" for multiples of both 3 and 5
- Otherwise, print the number itself

Input Format:
- A single integer N.

Output Format:
- N lines following the rules above.

Constraints:
- 1 ≤ N ≤ 100`,
      solution: `def fizzBuzz(n):
    res = []
    for i in range(1, n + 1):
        if i % 15 == 0: res.append("FizzBuzz")
        elif i % 3 == 0: res.append("Fizz")
        elif i % 5 == 0: res.append("Buzz")
        else: res.append(str(i))
    return res`,
      points: 150,
      timeLimit: 2000,
      sampleTestCase: {
        input: "5",
        expectedOutput: "1\n2\nFizz\n4\nBuzz"
      },
      testCases: [
        { input: "1", expectedOutput: "1", isSample: false },
        { input: "3", expectedOutput: "1\n2\nFizz", isSample: false },
        { input: "5", expectedOutput: "1\n2\nFizz\n4\nBuzz", isSample: false },
        { input: "15", expectedOutput: "1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz", isSample: false },
        { input: "6", expectedOutput: "1\n2\nFizz\n4\nBuzz\nFizz", isSample: false },
        { input: "10", expectedOutput: "1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz", isSample: false },
        { input: "2", expectedOutput: "1\n2", isSample: false },
        { input: "4", expectedOutput: "1\n2\nFizz\n4", isSample: false },
        { input: "7", expectedOutput: "1\n2\nFizz\n4\nBuzz\nFizz\n7", isSample: false },
        { input: "8", expectedOutput: "1\n2\nFizz\n4\nBuzz\nFizz\n7\n8", isSample: false },
        { input: "9", expectedOutput: "1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz", isSample: false },
        { input: "11", expectedOutput: "1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11", isSample: false },
        { input: "12", expectedOutput: "1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz", isSample: false },
        { input: "13", expectedOutput: "1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13", isSample: false },
        { input: "14", expectedOutput: "1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14", isSample: false },
        { input: "16", expectedOutput: "1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz\n16", isSample: false },
        { input: "20", expectedOutput: "1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz\n16\n17\nFizz\n19\nBuzz", isSample: false },
        { input: "21", expectedOutput: "1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz\n16\n17\nFizz\n19\nBuzz\nFizz", isSample: false },
        { input: "25", expectedOutput: "1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz\n16\n17\nFizz\n19\nBuzz\nFizz\n22\n23\nFizz\nBuzz", isSample: false },
        { input: "30", expectedOutput: "1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz\n16\n17\nFizz\n19\nBuzz\nFizz\n22\n23\nFizz\nBuzz\n26\nFizz\n28\n29\nFizzBuzz", isSample: false }
      ]
    }
  ]
};

module.exports = problems;