import { startTests } from "./testRunner.js"
import { createReporter } from "./reporting.js"
import { existsSync, readFileSync } from "fs";
import { isValidTest } from "./validateTest.js";

const testArgIndex = process.argv.findLastIndex(currentValue => currentValue == "--tests" || currentValue == "-t");
let testPath = "./tests.json";

// [nodepath, yourpath, -t, /config/tests.json]

if (testArgIndex > -1 && process.argv[testArgIndex + 1] != null) {
  testPath = process.argv[testArgIndex + 1];
}

if (!existsSync(testPath)) {
  console.error(`Error: File does not exist at ${testPath}`);
  process.exit(1);
}

let tests = [];

try {
  const testsJSON = JSON.parse(readFileSync(testPath, "utf-8"));

  tests = testsJSON.tests.map(test => {

    const { errors, validTest } = isValidTest(test);

    if (errors.length > 0) {
      for (const err of errors) {
        console.error("ERROR: " + err);
      }
      process.exit(1);
    }

    return validTest
  });

}
catch (e) {
  console.error(`Error: Failed to parse JSON with error: \n${e}`);
  process.exit(1);
}

if (tests.length == 0) {
  console.error(`Error: No tests found.`);
  process.exit(1);
}

try {
  const asyncWrapper = async () => {
    await startTests(tests, createReporter());
  }
  asyncWrapper();
}
catch (e) {
  console.error(`Error: Error during testing wth \n${e}`);
  process.exit(1);
}

