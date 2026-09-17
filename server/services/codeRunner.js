const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

// Add MSYS2 / MinGW gcc/g++ to PATH if on Windows and not already available
if (os.platform() === "win32") {
  const gccPaths = [
    "C:\\msys64\\mingw64\\bin",
    "C:\\MinGW\\bin",
    "C:\\TDM-GCC-64\\bin",
  ];
  for (const gccPath of gccPaths) {
    if (fs.existsSync(path.join(gccPath, "gcc.exe"))) {
      process.env.PATH = gccPath + ";" + process.env.PATH;
      break;
    }
  }
}

// ─── Concurrency Limiter Queue ───────────────────────────────
const MAX_CONCURRENT_RUNS = Number(process.env.MAX_CONCURRENT_RUNS) || 10;
let activeRuns = 0;
const executionQueue = [];

function enqueueTask(taskFn) {
  return new Promise((resolve, reject) => {
    executionQueue.push({ taskFn, resolve, reject });
    processQueue();
  });
}

function processQueue() {
  if (activeRuns >= MAX_CONCURRENT_RUNS || executionQueue.length === 0) {
    return;
  }

  const { taskFn, resolve, reject } = executionQueue.shift();
  activeRuns++;

  taskFn()
    .then(resolve)
    .catch(reject)
    .finally(() => {
      activeRuns--;
      processQueue();
    });
}

// ─── Non-Blocking Async Exec Helper ──────────────────────────
function execAsync(command, options = {}) {
  return new Promise((resolve, reject) => {
    exec(command, options, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        return reject(error);
      }
      resolve({ stdout: stdout ? stdout.trim() : "", stderr: stderr ? stderr.trim() : "" });
    });
  });
}

/**
 * Prepare and compile user code once.
 * Returns a prepared execution object containing the command to execute and files to clean up.
 */
async function prepareCode(language, code) {
  const tmpDir = os.tmpdir();
  const timestamp = Date.now() + "_" + Math.random().toString(36).slice(2);
  const isWindows = os.platform() === "win32";
  const filesToClean = [];

  const lang = (language || "").toLowerCase();

  if (lang === "python") {
    let pyCode = code;
    const hasMain = pyCode.includes("if __name__ ==") || pyCode.includes("if __name__ ==");

    if (!hasMain) {
      pyCode += `

import sys

if __name__ == '__main__':
    try:
        raw_input = sys.stdin.read()
        lines = [l.strip() for l in raw_input.splitlines() if l.strip()]
        sol = Solution() if 'Solution' in globals() else None

        fn_twoSum = (getattr(sol, 'twoSum', None) or getattr(sol, 'two_sum', None) or globals().get('twoSum') or globals().get('two_sum'))
        fn_isAnagram = (getattr(sol, 'isAnagram', None) or getattr(sol, 'is_anagram', None) or globals().get('isAnagram') or globals().get('is_anagram'))
        fn_reverseString = (getattr(sol, 'reverseString', None) or getattr(sol, 'reverse_string', None) or globals().get('reverseString') or globals().get('reverse_string'))
        fn_isPalindrome = (getattr(sol, 'isPalindrome', None) or getattr(sol, 'is_palindrome', None) or globals().get('isPalindrome') or globals().get('is_palindrome'))
        fn_maxProfit = (getattr(sol, 'maxProfit', None) or getattr(sol, 'max_profit', None) or globals().get('maxProfit') or globals().get('max_profit'))
        fn_numIslands = (getattr(sol, 'numIslands', None) or getattr(sol, 'num_islands', None) or globals().get('numIslands') or globals().get('num_islands'))
        fn_fizzBuzz = (getattr(sol, 'fizzBuzz', None) or getattr(sol, 'fizz_buzz', None) or globals().get('fizzBuzz') or globals().get('fizz_buzz'))
        fn_lengthOfLongestSubstring = (getattr(sol, 'lengthOfLongestSubstring', None) or getattr(sol, 'length_of_longest_substring', None) or globals().get('lengthOfLongestSubstring') or globals().get('length_of_longest_substring'))

        if fn_lengthOfLongestSubstring:
            s_val = raw_input.rstrip('\\r\\n')
            res = fn_lengthOfLongestSubstring(s_val)
            if res is not None:
                print(res)
        elif lines:
            if fn_twoSum:
                all_tokens = [int(x) for line in lines for x in line.split()]
                if len(lines) >= 2:
                    nums = [int(x) for x in lines[0].split()]
                    target = int(lines[1].split()[0])
                elif len(all_tokens) >= 2:
                    nums = all_tokens[:-1]
                    target = all_tokens[-1]
                else:
                    nums = []
                    target = 0
                res = fn_twoSum(nums, target)
                if res is not None:
                    print(" ".join(map(str, res)))
            elif fn_isAnagram:
                s_val = lines[0] if len(lines) > 0 else ""
                t_val = lines[1] if len(lines) > 1 else ""
                res = fn_isAnagram(s_val, t_val)
                if res is not None:
                    print(str(res).lower())
            elif fn_reverseString:
                res = fn_reverseString(lines[0])
                if res is not None:
                    print(res)
            elif fn_isPalindrome:
                res = fn_isPalindrome(lines[0])
                if res is not None:
                    print(str(res).lower())
            elif fn_maxProfit:
                prices = [int(x) for x in lines[0].split()]
                res = fn_maxProfit(prices)
                if res is not None:
                    print(res)
            elif fn_numIslands:
                first_line = lines[0].split()
                m, n = int(first_line[0]), int(first_line[1])
                grid = []
                for r in range(1, 1 + m):
                    if r < len(lines):
                        grid.append(lines[r].split())
                res = fn_numIslands(grid)
                if res is not None:
                    print(res)
            elif fn_fizzBuzz:
                n = int(lines[0])
                res = fn_fizzBuzz(n)
                if res is not None:
                    if isinstance(res, list):
                        print("\\n".join(map(str, res)))
                    else:
                        print(res)
    except Exception as e:
        pass
`;
    }

    const filePath = path.join(tmpDir, `cb_${timestamp}.py`);
    await fs.promises.writeFile(filePath, pyCode);
    filesToClean.push(filePath);

    let pythonCmd = "python";
    if (isWindows) {
      const directPath = "C:\\Users\\karth\\AppData\\Local\\Programs\\Python\\Python310\\python.exe";
      if (fs.existsSync(directPath)) {
        pythonCmd = `"${directPath}"`;
      } else {
        pythonCmd = "py";
      }
    } else {
      pythonCmd = "python3";
    }

    return {
      command: `${pythonCmd} "${filePath}"`,
      filesToClean,
    };
  }

  if (lang === "javascript") {
    let jsCode = code;
    const hasMain = jsCode.includes("process.stdin") || jsCode.includes("readFileSync") || jsCode.includes("readline");

    if (!hasMain) {
      jsCode += `

try {
    const fs = require('fs');
    const inputStr = fs.readFileSync(0, 'utf-8');
    if (typeof lengthOfLongestSubstring === 'function') {
        const s = inputStr.replace(/[\r\n]+$/, '');
        const res = lengthOfLongestSubstring(s);
        if (res !== undefined) console.log(res);
    } else if (inputStr.trim()) {
        const lines = inputStr.trim().split('\\n').map(l => l.trim()).filter(Boolean);
        if (typeof twoSum === 'function') {
            const nums = lines[0].split(/\\s+/).map(Number);
            const target = Number(lines[1] || 0);
            const res = twoSum(nums, target);
            if (Array.isArray(res)) console.log(res.join(' '));
        } else if (typeof reverseString === 'function') {
            const res = reverseString(lines[0] || '');
            console.log(res);
        } else if (typeof isPalindrome === 'function') {
            const res = isPalindrome(lines[0] || '');
            console.log(res);
        } else if (typeof maxProfit === 'function') {
            const prices = lines[0].split(/\\s+/).map(Number);
            const res = maxProfit(prices);
            console.log(res);
        } else if (typeof fizzBuzz === 'function') {
            const n = Number(lines[0] || 0);
            const res = fizzBuzz(n);
            if (Array.isArray(res)) console.log(res.join('\\n'));
            else console.log(res);
        }
    }
} catch (e) {}
`;
    }

    const filePath = path.join(tmpDir, `cb_${timestamp}.js`);
    await fs.promises.writeFile(filePath, jsCode);
    filesToClean.push(filePath);

    return {
      command: `node "${filePath}"`,
      filesToClean,
    };
  }

  if (lang === "cpp" || lang === "c++") {
    let cppCode = code;
    const hasMain = cppCode.includes("int main") || cppCode.includes("void main");

    if (!hasMain) {
      if (cppCode.includes("twoSum")) {
        cppCode += `

#include <iostream>
#include <vector>
#include <string>
#include <sstream>

int main() {
    std::string line1, line2;
    if (!std::getline(std::cin, line1)) return 0;
    std::stringstream ss(line1);
    std::vector<int> nums;
    int val;
    while (ss >> val) nums.push_back(val);
    if (std::getline(std::cin, line2)) {
        int target = std::stoi(line2);
        std::vector<int> res = twoSum(nums, target);
        for (size_t i = 0; i < res.size(); i++) {
            std::cout << res[i] << (i == res.size() - 1 ? "" : " ");
        }
        std::cout << "\\n";
    }
    return 0;
}
`;
      } else if (cppCode.includes("reverseString")) {
        cppCode += `

#include <iostream>
#include <string>

int main() {
    std::string line;
    if (std::getline(std::cin, line)) {
        std::cout << reverseString(line) << "\\n";
    }
    return 0;
}
`;
      } else if (cppCode.includes("isPalindrome")) {
        cppCode += `

#include <iostream>
#include <string>

int main() {
    std::string line;
    if (std::getline(std::cin, line)) {
        std::cout << isPalindrome(line) << "\\n";
    }
    return 0;
}
`;
      } else if (cppCode.includes("maxProfit")) {
        cppCode += `

#include <iostream>
#include <vector>
#include <sstream>

int main() {
    std::string line;
    if (!std::getline(std::cin, line)) return 0;
    std::stringstream ss(line);
    std::vector<int> prices;
    int val;
    while (ss >> val) prices.push_back(val);
    std::cout << maxProfit(prices) << "\\n";
    return 0;
}
`;
      } else if (cppCode.includes("fizzBuzz")) {
        cppCode += `

#include <iostream>

int main() {
    int n;
    if (std::cin >> n) {
        fizzBuzz(n);
    }
    return 0;
}
`;
      } else if (cppCode.includes("lengthOfLongestSubstring") || cppCode.includes("length_of_longest_substring")) {
        const fnName = cppCode.includes("length_of_longest_substring") ? "length_of_longest_substring" : "lengthOfLongestSubstring";
        cppCode += `

#include <iostream>
#include <string>

int main() {
    std::string line = "";
    std::getline(std::cin, line);
    if (!line.empty() && line.back() == '\\r') line.pop_back();
    std::cout << ${fnName}(line) << "\\n";
    return 0;
}
`;
      }
    }

    const filePath = path.join(tmpDir, `cb_${timestamp}.cpp`);
    const outPath = path.join(tmpDir, `cb_${timestamp}${isWindows ? ".exe" : ""}`);
    await fs.promises.writeFile(filePath, cppCode);
    filesToClean.push(filePath, outPath);

    try {
      // Non-blocking async compilation!
      await execAsync(`g++ "${filePath}" -o "${outPath}" -lm 2>&1`, { timeout: 15000 });
    } catch (compileErr) {
      const stderr = compileErr.stdout ? compileErr.stdout.toString() : (compileErr.stderr || compileErr.message);
      return {
        compilationError: true,
        stderr,
        filesToClean,
      };
    }

    return {
      command: `"${outPath}"`,
      filesToClean,
    };
  }

  if (lang === "c") {
    let cCode = code;
    const hasMain = /\bint\s+main\b|\bvoid\s+main\b/.test(cCode);

    if (!hasMain) {
      if (cCode.includes("twoSum") || cCode.includes("two_sum")) {
        const fnName = cCode.includes("two_sum") ? "two_sum" : "twoSum";
        cCode += `

#include <stdio.h>
#include <stdlib.h>

int main() {
    int capacity = 100000;
    int* tokens = (int*)malloc(capacity * sizeof(int));
    int total = 0;
    int val;
    while (scanf("%d", &val) == 1) {
        tokens[total++] = val;
    }
    if (total < 2) return 0;
    int target = tokens[total - 1];
    int numsSize = total - 1;
    int returnSize = 0;
    int* res = ${fnName}(tokens, numsSize, target, &returnSize);
    if (res) printf("%d %d\\n", res[0], res[1]);
    return 0;
}
`;
      } else if (cCode.includes("maxProfit") || cCode.includes("max_profit")) {
        const fnName = cCode.includes("max_profit") ? "max_profit" : "maxProfit";
        cCode += `

#include <stdio.h>
#include <stdlib.h>

int main() {
    int capacity = 100000;
    int* prices = (int*)malloc(capacity * sizeof(int));
    int size = 0;
    int val;
    while (scanf("%d", &val) == 1) {
        prices[size++] = val;
    }
    printf("%d\\n", ${fnName}(prices, size));
    return 0;
}
`;
      } else if (cCode.includes("numIslands") || cCode.includes("num_islands")) {
        const fnName = cCode.includes("num_islands") ? "num_islands" : "numIslands";
        cCode += `

#include <stdio.h>
#include <stdlib.h>

int main() {
    int m, n;
    if (scanf("%d %d", &m, &n) != 2) return 0;
    char** grid = (char**)malloc(m * sizeof(char*));
    int* gridColSize = (int*)malloc(m * sizeof(int));
    for (int i = 0; i < m; i++) {
        grid[i] = (char*)malloc(n * sizeof(char));
        gridColSize[i] = n;
        for (int j = 0; j < n; j++) {
            char cell[10];
            scanf("%s", cell);
            grid[i][j] = cell[0];
        }
    }
    printf("%d\\n", ${fnName}(grid, m, gridColSize));
    return 0;
}
`;
      } else if (cCode.includes("isAnagram") || cCode.includes("is_anagram")) {
        const fnName = cCode.includes("is_anagram") ? "is_anagram" : "isAnagram";
        cCode += `

#include <stdio.h>
#include <string.h>
#include <stdbool.h>

int main() {
    char s[100000], t[100000];
    if (fgets(s, sizeof(s), stdin) && fgets(t, sizeof(t), stdin)) {
        s[strcspn(s, "\\r\\n")] = 0;
        t[strcspn(t, "\\r\\n")] = 0;
        printf("%s\\n", ${fnName}(s, t) ? "true" : "false");
    }
    return 0;
}
`;
      } else if (cCode.includes("reverseString") || cCode.includes("reverse_string")) {
        const fnName = cCode.includes("reverse_string") ? "reverse_string" : "reverseString";
        cCode += `

#include <stdio.h>
#include <string.h>

int main() {
    char buffer[100000];
    if (fgets(buffer, sizeof(buffer), stdin)) {
        buffer[strcspn(buffer, "\\r\\n")] = 0;
        ${fnName}(buffer);
        printf("%s\\n", buffer);
    }
    return 0;
}
`;
      } else if (cCode.includes("isPalindrome") || cCode.includes("is_palindrome")) {
        const fnName = cCode.includes("is_palindrome") ? "is_palindrome" : "isPalindrome";
        cCode += `

#include <stdio.h>
#include <string.h>

int main() {
    char buffer[100000];
    if (fgets(buffer, sizeof(buffer), stdin)) {
        buffer[strcspn(buffer, "\\r\\n")] = 0;
        printf("%s\\n", ${fnName}(buffer) ? "true" : "false");
    }
    return 0;
}
`;
      } else if (cCode.includes("lengthOfLongestSubstring") || cCode.includes("length_of_longest_substring")) {
        const fnName = cCode.includes("length_of_longest_substring") ? "length_of_longest_substring" : "lengthOfLongestSubstring";
        cCode += `

#include <stdio.h>
#include <string.h>

int main() {
    char s[100000] = "";
    if (fgets(s, sizeof(s), stdin)) {
        s[strcspn(s, "\\r\\n")] = 0;
    }
    printf("%d\\n", ${fnName}(s));
    return 0;
}
`;
      } else {
        cCode += `

#include <stdio.h>
int main() {
    return 0;
}
`;
      }
    }

    const filePath = path.join(tmpDir, `cb_${timestamp}.c`);
    const outPath = path.join(tmpDir, `cb_${timestamp}${isWindows ? ".exe" : ""}`);
    await fs.promises.writeFile(filePath, cCode);
    filesToClean.push(filePath, outPath);

    try {
      // Non-blocking async compilation!
      await execAsync(`gcc "${filePath}" -o "${outPath}" -lm 2>&1`, { timeout: 15000 });
    } catch (compileErr) {
      const stderr = compileErr.stdout ? compileErr.stdout.toString() : (compileErr.stderr || compileErr.message);
      return {
        compilationError: true,
        stderr,
        filesToClean,
      };
    }

    return {
      command: `"${outPath}"`,
      filesToClean,
    };
  }

  if (lang === "java") {
    const className = `CB_${timestamp.replace(/[^a-zA-Z0-9]/g, "_")}`;
    let javaCode = code;

    if (javaCode.includes("class ")) {
      javaCode = javaCode.replace(/public\s+class\s+\w+/g, `public class ${className}`);
      javaCode = javaCode.replace(/class\s+Solution/g, `class ${className}`);
    } else {
      javaCode = `public class ${className} {\n${code}\n}`;
    }

    const hasMain = javaCode.includes("main(") || javaCode.includes("main (");

    if (!hasMain) {
      const mainHarness = `
    public static void main(String[] args) {
        try {
            Scanner sc = new Scanner(System.in);
            ${className} solver = new ${className}();

            // Try calling twoSum / two_sum
            java.lang.reflect.Method mTwoSum = findMethod(${className}.class, new String[]{"twoSum", "two_sum"}, int[].class, int.class);
            if (mTwoSum != null) {
                List<Integer> allInts = new ArrayList<>();
                while (sc.hasNextInt()) {
                    allInts.add(sc.nextInt());
                }
                if (allInts.isEmpty() && sc.hasNextLine()) {
                    StringBuilder sb = new StringBuilder();
                    while (sc.hasNextLine()) sb.append(" ").append(sc.nextLine());
                    Scanner sc2 = new Scanner(sb.toString());
                    while (sc2.hasNextInt()) {
                        allInts.add(sc2.nextInt());
                    }
                }
                if (allInts.size() >= 2) {
                    int target = allInts.get(allInts.size() - 1);
                    int[] nums = new int[allInts.size() - 1];
                    for (int i = 0; i < nums.length; i++) nums[i] = allInts.get(i);
                    int[] res = (int[]) mTwoSum.invoke(solver, nums, target);
                    if (res != null && res.length >= 2) {
                        System.out.println(res[0] + " " + res[1]);
                        return;
                    }
                }
            }

            // Try calling isAnagram / is_anagram
            java.lang.reflect.Method mAnagram = findMethod(${className}.class, new String[]{"isAnagram", "is_anagram"}, String.class, String.class);
            if (mAnagram != null) {
                if (sc.hasNextLine()) {
                    String s1 = sc.nextLine().trim();
                    String s2 = sc.hasNextLine() ? sc.nextLine().trim() : "";
                    Object res = mAnagram.invoke(solver, s1, s2);
                    if (res != null) {
                        System.out.println(String.valueOf(res).toLowerCase());
                        return;
                    }
                }
            }

            // Try calling reverseString / reverse_string
            java.lang.reflect.Method mReverse = findMethod(${className}.class, new String[]{"reverseString", "reverse_string"}, String.class);
            if (mReverse != null) {
                if (sc.hasNextLine()) {
                    String s = sc.nextLine().trim();
                    Object res = mReverse.invoke(solver, s);
                    if (res != null) {
                        System.out.println(res);
                        return;
                    }
                }
            }

            // Try calling isPalindrome / is_palindrome
            java.lang.reflect.Method mPalin = findMethod(${className}.class, new String[]{"isPalindrome", "is_palindrome"}, String.class);
            if (mPalin != null) {
                if (sc.hasNextLine()) {
                    String s = sc.nextLine().trim();
                    Object res = mPalin.invoke(solver, s);
                    if (res != null) {
                        System.out.println(String.valueOf(res).toLowerCase());
                        return;
                    }
                }
            }

            // Try calling maxProfit / max_profit
            java.lang.reflect.Method mProfit = findMethod(${className}.class, new String[]{"maxProfit", "max_profit"}, int[].class);
            if (mProfit != null) {
                if (sc.hasNextLine()) {
                    String line1 = sc.nextLine().trim();
                    String[] parts = line1.split("\\s+");
                    int[] prices = new int[parts.length];
                    for (int i = 0; i < parts.length; i++) prices[i] = Integer.parseInt(parts[i]);
                    Object res = mProfit.invoke(solver, (Object) prices);
                    if (res != null) {
                        System.out.println(res);
                        return;
                    }
                }
            }

            // Try calling numIslands / num_islands
            java.lang.reflect.Method mIslands = findMethod(${className}.class, new String[]{"numIslands", "num_islands"}, char[][].class);
            if (mIslands != null) {
                if (sc.hasNextLine()) {
                    String line1 = sc.nextLine().trim();
                    String[] parts = line1.split("\\s+");
                    int rows = Integer.parseInt(parts[0]);
                    int cols = Integer.parseInt(parts[1]);
                    char[][] grid = new char[rows][cols];
                    for (int r = 0; r < rows; r++) {
                        if (sc.hasNextLine()) {
                            String[] rowCells = sc.nextLine().trim().split("\\s+");
                            for (int c = 0; c < cols && c < rowCells.length; c++) {
                                grid[r][c] = rowCells[c].charAt(0);
                            }
                        }
                    }
                    Object res = mIslands.invoke(solver, (Object) grid);
                    if (res != null) {
                        System.out.println(res);
                        return;
                    }
                }
            }

            // Try calling lengthOfLongestSubstring / length_of_longest_substring
            java.lang.reflect.Method mSubstring = findMethod(${className}.class, new String[]{"lengthOfLongestSubstring", "length_of_longest_substring"}, String.class);
            if (mSubstring != null) {
                String s = sc.hasNextLine() ? sc.nextLine().replace("\\r", "") : "";
                Object res = mSubstring.invoke(solver, s);
                if (res != null) {
                    System.out.println(res);
                    return;
                }
            }
        } catch (Exception e) {}
    }

    private static java.lang.reflect.Method findMethod(Class<?> clazz, String[] names, Class<?>... paramTypes) {
        for (String name : names) {
            try {
                java.lang.reflect.Method m = clazz.getDeclaredMethod(name, paramTypes);
                m.setAccessible(true);
                return m;
            } catch (Exception e) {}
            try {
                java.lang.reflect.Method m = clazz.getMethod(name, paramTypes);
                m.setAccessible(true);
                return m;
            } catch (Exception e) {}
        }
        return null;
    }
`;
      const lastBraceIdx = javaCode.lastIndexOf("}");
      if (lastBraceIdx !== -1) {
        javaCode = javaCode.substring(0, lastBraceIdx) + mainHarness + "\n}";
      } else {
        javaCode += mainHarness;
      }
    }

    if (!javaCode.includes("import java.util")) {
      javaCode = "import java.util.*;\nimport java.io.*;\n" + javaCode;
    }

    const filePath = path.join(tmpDir, `${className}.java`);
    await fs.promises.writeFile(filePath, javaCode);
    filesToClean.push(filePath, path.join(tmpDir, `${className}.class`));

    try {
      // Non-blocking async compilation!
      await execAsync(`javac "${filePath}" 2>&1`, { timeout: 20000 });
    } catch (compileErr) {
      const stderr = compileErr.stdout ? compileErr.stdout.toString() : (compileErr.stderr || compileErr.message);
      return {
        compilationError: true,
        stderr,
        filesToClean,
      };
    }

    return {
      command: `java -cp "${tmpDir}" ${className}`,
      filesToClean,
    };
  }

  throw new Error("Unsupported language: " + language);
}

/**
 * Execute a prepared code binary/script against stdin input.
 */
function execPreparedCode(prepared, input, timeLimit = 3000) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const proc = exec(
      prepared.command,
      { timeout: timeLimit, maxBuffer: 1024 * 512 },
      (error, stdout, stderr) => {
        const executionTime = Date.now() - startTime;

        if (error && error.killed) {
          resolve({
            stdout: "",
            stderr: "Time Limit Exceeded",
            timedOut: true,
            executionTime,
          });
        } else {
          resolve({
            stdout: stdout ? stdout.trim() : "",
            stderr: stderr ? stderr.trim() : "",
            timedOut: false,
            executionTime,
            exitCode: error ? error.code : 0,
          });
        }
      }
    );

    if (input !== undefined && input !== null) {
      const procInput = String(input).replace(/\\n/g, "\n");
      proc.stdin.write(procInput);
      proc.stdin.end();
    }
  });
}

/**
 * Single-run wrapper for backward compatibility.
 */
function runCode(language, code, input, timeLimit = 5000) {
  return enqueueTask(async () => {
    let prepared;
    try {
      prepared = await prepareCode(language, code);
      if (prepared.compilationError) {
        return {
          stdout: "",
          stderr: prepared.stderr,
          timedOut: false,
          executionTime: 0,
          compilationError: true,
        };
      }
      return await execPreparedCode(prepared, input, timeLimit);
    } catch (err) {
      return {
        stdout: "",
        stderr: err.message,
        timedOut: false,
        executionTime: 0,
      };
    } finally {
      if (prepared && prepared.filesToClean) {
        cleanup(prepared.filesToClean);
      }
    }
  });
}

/**
 * Highly parallelized LeetCode-style compiler execution & testcase evaluator
 */
function evaluateAgainstTestCases(language, code, testCases = [], problemPoints = 100) {
  return enqueueTask(async () => {
    if (!testCases || testCases.length === 0) {
      return {
        errorType: "Accepted",
        score: problemPoints,
        totalCases: 0,
        passedCases: 0,
        feedback: ["No test cases configured for this problem."],
      };
    }

    let prepared;
    try {
      // 1. Compile/prepare user code ONCE per submission
      prepared = await prepareCode(language, code);

      if (prepared.compilationError) {
        return {
          errorType: "Compile Error",
          score: 0,
          totalCases: testCases.length,
          passedCases: 0,
          feedback: [`Compilation Error:\n${prepared.stderr}`],
        };
      }

      // 2. Execute ALL test cases in parallel using Promise.all
      const results = await Promise.all(
        testCases.map((tc, index) =>
          execPreparedCode(prepared, tc.input || "", 3000).then((execRes) => ({
            index: index + 1,
            tc,
            execRes,
          }))
        )
      );

      // 3. Process results sequentially to identify status and first failed test case
      results.sort((a, b) => a.index - b.index);

      let passedCases = 0;
      const totalCases = testCases.length;
      let firstFailed = null;
      let timedOutMsg = false;
      let runtimeErrorMsg = null;

      for (const item of results) {
        const { index, tc, execRes } = item;

        if (execRes.timedOut) {
          if (!timedOutMsg) timedOutMsg = true;
          if (!firstFailed) {
            firstFailed = {
              index,
              input: tc.input,
              expected: tc.expectedOutput || tc.output || "",
              actual: "Time Limit Exceeded (3000ms)",
            };
          }
          continue;
        }

        if (execRes.exitCode && execRes.exitCode !== 0) {
          if (!runtimeErrorMsg) runtimeErrorMsg = execRes.stderr || "Runtime Error";
          if (!firstFailed) {
            firstFailed = {
              index,
              input: tc.input,
              expected: tc.expectedOutput || tc.output || "",
              actual: execRes.stderr || "Runtime Error",
            };
          }
          continue;
        }

        const actual = (execRes.stdout || "").trim().replace(/\r\n/g, "\n");
        const expected = (tc.expectedOutput || tc.output || "").trim().replace(/\r\n/g, "\n");

        if (actual === expected) {
          passedCases++;
        } else {
          if (!firstFailed) {
            firstFailed = { index, input: tc.input, expected, actual };
          }
        }
      }

      let errorType = "Accepted";
      if (timedOutMsg) errorType = "Time Limit Exceeded";
      else if (runtimeErrorMsg) errorType = "Runtime Error";
      else if (passedCases < totalCases) errorType = "Wrong Answer";

      const score = totalCases > 0 ? Math.round((passedCases / totalCases) * problemPoints) : 0;
      const feedback = [];

      if (errorType === "Accepted") {
        feedback.push(`🎉 All ${totalCases} test cases passed cleanly!`);
      } else if (errorType === "Time Limit Exceeded") {
        feedback.push(`Time Limit Exceeded on test case ${firstFailed?.index || 1}`);
      } else if (errorType === "Runtime Error") {
        feedback.push(`Runtime Error on test case ${firstFailed?.index || 1}: ${runtimeErrorMsg}`);
      } else {
        feedback.push(`${passedCases}/${totalCases} test cases passed.`);
        if (firstFailed) {
          feedback.push(
            `Test Case ${firstFailed.index} Failed! Input: "${firstFailed.input}" | Expected: "${firstFailed.expected}" | Got: "${firstFailed.actual}"`
          );
        }
      }

      return {
        errorType,
        score,
        totalCases,
        passedCases,
        feedback,
      };
    } catch (err) {
      return {
        errorType: "Runtime Error",
        score: 0,
        totalCases: testCases.length,
        passedCases: 0,
        feedback: [`Internal execution error: ${err.message}`],
      };
    } finally {
      // 4. Always clean up files in finally block
      if (prepared && prepared.filesToClean) {
        cleanup(prepared.filesToClean);
      }
    }
  });
}

function cleanup(files) {
  for (const f of files) {
    try {
      fs.unlinkSync(f);
    } catch {}
  }
}

module.exports = { runCode, evaluateAgainstTestCases };
