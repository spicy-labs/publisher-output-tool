import { startTests } from "./testRunner.js"
import { createReporter } from "./reporting.js"
import { existsSync, readFileSync } from "fs";

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
    if (isValidTest(test)) {
      return setDefaults(test);
    }
    else {
      console.error(`Error: a test is invalid`);
      process.exit(1);
    }
  });

  await startTests(tests, createReporter());

}
catch (e) {
  console.error(`Error: Failed to parse JSON with error: \n${e}`);
  process.exit(1);
}

if (tests.length == 0) {
  console.error(`Error: No tests found.`);
  process.exit(1);
}

function setDefaults(test) {

  const testCopy = structuredClone(test)

  if (typeof test.runAsync !== 'boolean') {
    testCopy.runAsync = false;
  }

  return testCopy
}

function isValidTest(test) {
  // Check the main properties
  if (typeof test.name !== 'string' ||
    typeof test.pdfExportSettingsId !== 'string' ||
    typeof test.outputEachDocumenThisAmount !== 'number') {
    return false;
  }

  // Check the 'environment' object
  if (typeof test.environment !== 'object' ||
    typeof test.environment.name !== 'string' ||
    typeof test.environment.backofficeUrl !== 'string' ||
    typeof test.environment.auth !== 'string') {
    return false;
  }

  // Check the 'documents' array
  if (!Array.isArray(test.documents)) {
    return false;
  }
  for (const doc of test.documents) {
    if (typeof doc.id !== 'string' ||
      typeof doc.savedInEditor !== 'boolean') {
      return false;
    }
  }

  return true;
}
