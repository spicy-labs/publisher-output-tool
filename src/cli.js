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
    const errors = isValidTest(test);

    if (errors.length > 0) {
      for (const err of errors) {
        console.error("Error: " + err);
      }
      process.exit(1);
    }

    return setDefaults(test);
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

function setDefaults(test) {

  const testCopy = structuredClone(test)

  if (typeof test.runAsync !== 'boolean') {
    testCopy.runAsync = false;
  }

  return testCopy
}

function isValidTest(test) {

  const checkObjectMeetsSchema = (object, schema) => {

    return schema.reduce((errors, check) => {
      const testObj = check.prop.reduce((o, key) => Reflect.get(o, key), object);
      const [isValidType, validType] = check.types.reduce(([isValid, validType], type) => {
        if (isValid) return [isValid, validType];
        return [typeof testObj === type, type]
      }, [false, null]);
      if (!isValidType) {
        errors.push(`${check.prop.join(".")} is not of type ${check.types.join(", ")}`);
      }
      if (isValidType && validType === "object" && check.schema) {
        if (check.array) {
          if (!Array.isArray(testObj)) {
            errors.push(`${check.prop.join(".")} is not an array`);
          }
          else {
            for (const obj of testObj) {
              errors = [...checkObjectMeetsSchema(obj, check.schema), ...errors];
            }
          }
        }
        else {
          errors = [...checkObjectMeetsSchema(testObj, check.schema), ...errors];
        }
      }
      return errors;
    }, []);
  }

  const schema = [
    { prop: ["name"], types: ["string"] },
    { prop: ["pdfExportSettingsId"], types: ["string"] },
    { prop: ["outputEachDocumentThisAmount"], types: ["number"] },
    { prop: ["environment", "name"], types: ["string"] },
    { prop: ["environment", "backofficeUrl"], types: ["string"] },
    {
      prop: ["environment", "auth"], types: ["string", "object"], schema: [
        { prop: ["userName"], types: ["string"] },
        { prop: ["password"], types: ["string"] }
      ]
    },
    {
      prop: ["documents"], types: ["object"], array: true, schema: [
        { prop: ["id"], types: ["string"] },
        { prop: ["savedInEditor"], types: ["boolean"] },
      ]
    }
  ]

  return checkObjectMeetsSchema(test, schema);
}
