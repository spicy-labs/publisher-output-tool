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

function isValidTest(test) {

  const addObjectToPath = (parentObject, keyPath, objectToAdd) => {

    keyPath.reduce((obj, key, idx) => {
      if (idx == keyPath.length - 1) {
        obj[key] = objectToAdd;
      }
      else {
        if (obj[key] == null) {
          obj[key] = {};
          return obj[key];
        }
        else {
          return obj[key]
        }
      }

      return obj

    }, parentObject);

    return parentObject;
  }

  const checkObjectValidType = (check, object) => {
    const objectType = typeof object;
    const [isValid, validType] = check.types.reduce(([isValid, validType], type) => {
      if (isValid) return [isValid, validType];
      return [objectType === type, type]
    }, [false, null]);

    return {
      objectType,
      isValid,
      validType
    }
  }

  const getIn = (object, keys, _default) => keys.reduce((o, k) => o ? o[k] : o, object) ?? _default;

  const getStrOfCheckFullPath = (check) => check.keyPath.join(".");

  const getStrOfCheckTypes = (check, seperator = " , ") => check.types.join(seperator);

  const joinPathsOfSchema = (schema, seperator) => schema.map(getStrOfCheckFullPath).join(seperator);

  const getOrObject = (object, orSchema) => {
    const keyValuePairs = orSchema
      .map(check => ({ key: check.keyPath, value: getIn(object, check.keyPath, check.default ?? null), check }))
      .filter(({ value }) => value != null);

    switch (true) {
      case (keyValuePairs.length > 1):
        return { error: `You should only have one of ${joinPathsOfSchema(orSchema, " or ")}` };
      case (keyValuePairs.length < 1):
        return { error: `You are missing one of ${joinPathsOfSchema(orSchema, " or ")}` };
      default:
        const { check, value } = keyValuePairs[0];
        return { check, object: value, }
    }
  }

  const getObject = (object, check) => ({ check, object: getIn(object, check.keyPath, check.default ?? null) });

  const getValidTest = (object, schema) => {
    return schema.reduce(({ errors, validTest }, check) => {

      const { error, object: objectToCheck, check: currentCheck } = check.or ? getOrObject(object, check.or) : getObject(object, check);

      if (error) {
        return { errors: [error, ...errors], validTest }
      }

      if (objectToCheck == null) {
        return { errors: [`Missing value for ${getStrOfCheckFullPath(currentCheck)} which should include a value of ${getStrOfCheckTypes(currentCheck)}${(currentCheck.array) ? " which is an array" : ""}`, ...errors], validTest };
      }

      const { objectType, isValid, validType } = checkObjectValidType(currentCheck, objectToCheck);

      if (!isValid) {
        return {
          errors: currentCheck.default ? errors : [`Type for ${getStrOfCheckFullPath(currentCheck)} is ${objectType} but expected types: ${getStrOfCheckTypes(currentCheck)}${(currentCheck.array) ? " which is an array" : ""}`, ...errors],
          validTest: currentCheck.default ? addObjectToPath(validTest, currentCheck.keyPath, currentCheck.default) : validTest
        }
      }

      switch (true) {
        case (validType == "object" && currentCheck.schema != null && currentCheck.array == null): {
          const { errors: newErrors, validTest: newTest } = getValidTest(objectToCheck, currentCheck.schema);
          return { errors: [...(newErrors.map(e => e + ` in ${getStrOfCheckFullPath(currentCheck)}`)), ...errors], validTest: addObjectToPath(validTest, currentCheck.keyPath, newTest) }
        }
        case (validType == "object" && currentCheck.schema != null && currentCheck.array != null && !Array.isArray(objectToCheck)):
          { return { errors: [`${getStrOfCheckFullPath(currentCheck)} is not an array`, ...errors], validTest } }
        case (validType == "object" && currentCheck.schema != null && currentCheck.array != null && Array.isArray(objectToCheck)): {
          const arrayOfObjects = objectToCheck;
          const arrayOfTests = arrayOfObjects.map(obj => getValidTest(obj, currentCheck.schema));
          const { errors: newErrors, array } = arrayOfTests.reduce((r, ct) => ({ errors: [...ct.errors, ...r.errors], array: [ct.validTest, ...r.array] }), { errors: [], array: [] })
          return { errors: [...(newErrors.map(e => e + ` in ${getStrOfCheckFullPath(currentCheck)}`)), ...errors], validTest: addObjectToPath(validTest, currentCheck.keyPath, array) }
        }
        default:
          return { errors, validTest: addObjectToPath(validTest, currentCheck.keyPath, objectToCheck) };
      }
    }, { errors: [], validTest: {} })
  };

  const schema = [
    { keyPath: ["name"], types: ["string"] },
    {
      or: [
        { keyPath: ["pdfExportSettingsId"], types: ["string"] },
        { keyPath: ["pdfExportSettingsXml"], types: ["string"] },
      ]
    },
    { keyPath: ["runAsync"], types: ["boolean"], default: true },
    { keyPath: ["outputEachDocumentThisAmount"], types: ["number"] },
    { keyPath: ["environment", "name"], types: ["string"] },
    { keyPath: ["environment", "backofficeUrl"], types: ["string"] },
    {
      keyPath: ["environment", "auth"], types: ["string", "object"], schema: [
        { keyPath: ["userName"], types: ["string"] },
        { keyPath: ["password"], types: ["string"] }
      ]
    },
    {
      keyPath: ["documents"], types: ["object"], array: true, schema: [
        { keyPath: ["id"], types: ["string"] },
        { keyPath: ["savedInEditor"], types: ["boolean"] },
      ]
    }
  ]

  return getValidTest(test, schema);
}
