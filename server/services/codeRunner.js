const { exec, execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

// Add MSYS2 gcc/g++ to PATH if on Windows and not already available
if (os.platform() === "win32") {
  const msys2Gcc = "C:\\msys64\\mingw64\\bin";
  if (fs.existsSync(path.join(msys2Gcc, "gcc.exe"))) {
    process.env.PATH = msys2Gcc + ";" + process.env.PATH;
  }
}

/**
 * Execute user code locally with timeout and proper error classification.
 * Supports: Python, JavaScript, C, C++, Java
 */
function runCode(language, code, input, timeLimit = 5000) {
  return new Promise((resolve) => {
    const tmpDir = os.tmpdir();
    const timestamp = Date.now() + "_" + Math.random().toString(36).slice(2);
    const isWindows = os.platform() === "win32";
    let filePath, command;
    const filesToClean = [];

    try {
      if (language === "python") {
        let pyCode = code;
        const hasMain = pyCode.includes("__main__") || pyCode.includes("sys.stdin") || pyCode.includes("input(");

        if (!hasMain) {
          pyCode += `

import sys

if __name__ == '__main__':
    try:
        lines = [l.strip() for l in sys.stdin.read().splitlines() if l.strip()]
        if lines:
            if 'twoSum' in globals():
                nums = [int(x) for x in lines[0].split()]
                target = int(lines[1]) if len(lines) > 1 else 0
                res = twoSum(nums, target)
                if res is not None:
                    print(" ".join(map(str, res)))
            elif 'isPalindrome' in globals():
                res = isPalindrome(lines[0])
                if res is not None:
                    print(str(res).lower())
            elif 'maxProfit' in globals():
                prices = [int(x) for x in lines[0].split()]
                res = maxProfit(prices)
                if res is not None:
                    print(res)
            elif 'fizzBuzz' in globals():
                n = int(lines[0])
                res = fizzBuzz(n)
                if res is not None:
                    if isinstance(res, list):
                        print("\\n".join(map(str, res)))
                    else:
                        print(res)
    except Exception as e:
        pass
`;
        }

        filePath = path.join(tmpDir, `cb_${timestamp}.py`);
        fs.writeFileSync(filePath, pyCode);
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
        command = `${pythonCmd} "${filePath}"`;
      } else if (language === "javascript") {
        let jsCode = code;
        const hasMain = jsCode.includes("process.stdin") || jsCode.includes("readFileSync") || jsCode.includes("readline");

        if (!hasMain) {
          jsCode += `

try {
    const fs = require('fs');
    const inputStr = fs.readFileSync(0, 'utf-8').trim();
    if (inputStr) {
        const lines = inputStr.split('\\n').map(l => l.trim()).filter(Boolean);
        if (typeof twoSum === 'function') {
            const nums = lines[0].split(/\\s+/).map(Number);
            const target = Number(lines[1] || 0);
            const res = twoSum(nums, target);
            if (Array.isArray(res)) console.log(res.join(' '));
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

        filePath = path.join(tmpDir, `cb_${timestamp}.js`);
        fs.writeFileSync(filePath, jsCode);
        filesToClean.push(filePath);
        command = `node "${filePath}"`;
      } else if (language === "cpp" || language === "c++") {
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
        std::cout << "\n";
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
        std::cout << isPalindrome(line) << "\n";
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
    std::cout << maxProfit(prices) << "\n";
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
          }
        }

        filePath = path.join(tmpDir, `cb_${timestamp}.cpp`);
        const outPath = path.join(tmpDir, `cb_${timestamp}${isWindows ? ".exe" : ""}`);
        fs.writeFileSync(filePath, cppCode);
        filesToClean.push(filePath, outPath);

        try {
          execSync(`g++ "${filePath}" -o "${outPath}" -lm 2>&1`, { timeout: 15000 });
        } catch (compileErr) {
          const stderr = compileErr.stdout ? compileErr.stdout.toString() : compileErr.message;
          cleanup(filesToClean);
          resolve({
            stdout: "",
            stderr: stderr,
            timedOut: false,
            executionTime: 0,
            compilationError: true,
          });
          return;
        }
        command = `"${outPath}"`;
      } else if (language === "c") {
        filePath = path.join(tmpDir, `cb_${timestamp}.c`);
        const outPath = path.join(tmpDir, `cb_${timestamp}${isWindows ? ".exe" : ""}`);
        fs.writeFileSync(filePath, code);
        filesToClean.push(filePath, outPath);

        try {
          execSync(`gcc "${filePath}" -o "${outPath}" -lm 2>&1`, { timeout: 15000 });
        } catch (compileErr) {
          const stderr = compileErr.stdout ? compileErr.stdout.toString() : compileErr.message;
          cleanup(filesToClean);
          resolve({
            stdout: "",
            stderr: stderr,
            timedOut: false,
            executionTime: 0,
            compilationError: true,
          });
          return;
        }
        command = `"${outPath}"`;
      } else if (language === "java") {
        const className = `CB_${timestamp.replace(/[^a-zA-Z0-9]/g, "_")}`;
        let javaCode = code;

        // Ensure class name matches className
        if (javaCode.includes("class ")) {
          javaCode = javaCode.replace(/public\s+class\s+\w+/g, `public class ${className}`);
          javaCode = javaCode.replace(/class\s+Solution/g, `class ${className}`);
        } else {
          javaCode = `public class ${className} {\n${code}\n}`;
        }

        // Check if main method is present
        const hasMain = javaCode.includes("main(") || javaCode.includes("main (");

        if (!hasMain) {
          const mainHarness = `
    public static void main(String[] args) {
        try {
            Scanner sc = new Scanner(System.in);
            if (!sc.hasNextLine()) return;
            String line1 = sc.nextLine().trim();
            ${className} solver = new ${className}();

            // Try calling twoSum
            try {
                java.lang.reflect.Method m = ${className}.class.getMethod("twoSum", int[].class, int.class);
                String[] parts = line1.split("\\s+");
                int[] nums = new int[parts.length];
                for (int i = 0; i < parts.length; i++) nums[i] = Integer.parseInt(parts[i]);
                if (sc.hasNextLine()) {
                    int target = Integer.parseInt(sc.nextLine().trim());
                    int[] res = (int[]) m.invoke(solver, nums, target);
                    if (res != null) {
                        System.out.println(res[0] + " " + res[1]);
                        return;
                    }
                }
            } catch (Exception e1) {}

            // Try calling isPalindrome
            try {
                java.lang.reflect.Method m = ${className}.class.getMethod("isPalindrome", String.class);
                Object res = m.invoke(solver, line1);
                System.out.println(res);
                return;
            } catch (Exception e2) {}

            // Try calling maxProfit
            try {
                java.lang.reflect.Method m = ${className}.class.getMethod("maxProfit", int[].class);
                String[] parts = line1.split("\\s+");
                int[] nums = new int[parts.length];
                for (int i = 0; i < parts.length; i++) nums[i] = Integer.parseInt(parts[i]);
                Object res = m.invoke(solver, (Object) nums);
                System.out.println(res);
                return;
            } catch (Exception e3) {}

            // Try calling fizzBuzz
            try {
                java.lang.reflect.Method m = ${className}.class.getMethod("fizzBuzz", int.class);
                int n = Integer.parseInt(line1);
                m.invoke(solver, n);
                return;
            } catch (Exception e4) {}

        } catch (Exception e) {}
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

        filePath = path.join(tmpDir, `${className}.java`);
        fs.writeFileSync(filePath, javaCode);
        filesToClean.push(filePath, path.join(tmpDir, `${className}.class`));

        try {
          execSync(`javac "${filePath}" 2>&1`, { timeout: 20000 });
        } catch (compileErr) {
          const stderr = compileErr.stdout ? compileErr.stdout.toString() : compileErr.message;
          cleanup(filesToClean);
          resolve({
            stdout: "",
            stderr: stderr,
            timedOut: false,
            executionTime: 0,
            compilationError: true,
          });
          return;
        }
        command = `java -cp "${tmpDir}" ${className}`;
      } else {
        resolve({
          stdout: "",
          stderr: "Unsupported language: " + language,
          timedOut: false,
          executionTime: 0,
        });
        return;
      }
    } catch (setupErr) {
      resolve({
        stdout: "",
        stderr: "Setup error: " + setupErr.message,
        timedOut: false,
        executionTime: 0,
      });
      return;
    }

    const startTime = Date.now();
    const proc = exec(
      command,
      { timeout: timeLimit, maxBuffer: 1024 * 512 },
      (error, stdout, stderr) => {
        const executionTime = Date.now() - startTime;
        cleanup(filesToClean);

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
      },
    );

    if (input !== undefined && input !== null) {
      proc.stdin.write(input);
      proc.stdin.end();
    }
  });
}

/**
 * LeetCode-style compiler execution & testcase evaluator
 */
async function evaluateAgainstTestCases(language, code, testCases = [], problemPoints = 100) {
  if (!testCases || testCases.length === 0) {
    return {
      errorType: "Accepted",
      score: problemPoints,
      totalCases: 0,
      passedCases: 0,
      feedback: ["No test cases configured for this problem."],
    };
  }

  let passedCases = 0;
  const totalCases = testCases.length;
  let firstFailed = null;
  let compilationErrorMsg = null;
  let timedOutMsg = false;
  let runtimeErrorMsg = null;

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const execRes = await runCode(language, code, tc.input || "", 3000);

    if (execRes.compilationError) {
      compilationErrorMsg = execRes.stderr || "Compilation Error";
      break;
    }

    if (execRes.timedOut) {
      timedOutMsg = true;
      if (!firstFailed) {
        firstFailed = { index: i + 1, input: tc.input, expected: tc.expectedOutput || tc.output || "", actual: "Time Limit Exceeded (3000ms)" };
      }
      break;
    }

    if (execRes.exitCode && execRes.exitCode !== 0) {
      runtimeErrorMsg = execRes.stderr || "Runtime Error";
      if (!firstFailed) {
        firstFailed = { index: i + 1, input: tc.input, expected: tc.expectedOutput || tc.output || "", actual: execRes.stderr || "Runtime Error" };
      }
      break;
    }

    const actual = (execRes.stdout || "").trim().replace(/\r\n/g, "\n");
    const expected = (tc.expectedOutput || tc.output || "").trim().replace(/\r\n/g, "\n");

    if (actual === expected) {
      passedCases++;
    } else {
      if (!firstFailed) {
        firstFailed = { index: i + 1, input: tc.input, expected, actual };
      }
    }
  }

  let errorType = "Accepted";
  if (compilationErrorMsg) errorType = "Compile Error";
  else if (timedOutMsg) errorType = "Time Limit Exceeded";
  else if (runtimeErrorMsg) errorType = "Runtime Error";
  else if (passedCases < totalCases) errorType = "Wrong Answer";

  const score = totalCases > 0 ? Math.round((passedCases / totalCases) * problemPoints) : 0;
  const feedback = [];

  if (errorType === "Accepted") {
    feedback.push(`🎉 All ${totalCases} test cases passed cleanly!`);
  } else if (errorType === "Compile Error") {
    feedback.push(`Compilation Error:\n${compilationErrorMsg}`);
  } else if (errorType === "Time Limit Exceeded") {
    feedback.push(`Time Limit Exceeded on test case ${firstFailed?.index || 1}`);
  } else if (errorType === "Runtime Error") {
    feedback.push(`Runtime Error on test case ${firstFailed?.index || 1}: ${runtimeErrorMsg}`);
  } else {
    feedback.push(`${passedCases}/${totalCases} test cases passed.`);
    if (firstFailed) {
      feedback.push(`Test Case ${firstFailed.index} Failed! Input: "${firstFailed.input}" | Expected: "${firstFailed.expected}" | Got: "${firstFailed.actual}"`);
    }
  }

  return {
    errorType,
    score,
    totalCases,
    passedCases,
    feedback,
  };
}

function cleanup(files) {
  for (const f of files) {
    try { fs.unlinkSync(f); } catch {}
  }
}

module.exports = { runCode, evaluateAgainstTestCases };
