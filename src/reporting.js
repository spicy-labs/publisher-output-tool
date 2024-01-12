import { appendFileSync, writeFileSync, existsSync, mkdirSync } from "fs";

const example = {
  documentName: "",
  documentId: "",
  taskToCompleteTimeFromXml: "",
  taskToCompleteTimeFromRequest: "",
  taskFailed: false,
  missingUrl: true
}


export function createReporter(options) {

  const outputPath = options?.outputPath ?? "./Results";

  return {
    startReport: async (name) => {

      if (!existsSync(outputPath)) {
        mkdirSync(outputPath, { recursive: true });
      }

      appendFileSync(`${outputPath}/${name}.txt`, `${name} Results ${(new Date()).toUTCString()} \n\n`);

      return {
        writeTo: async (results) => {
          results.forEach(test => {
            // Add JSON data for each document in the result
            appendFileSync(`${outputPath}/${name}.txt`, `Document ID: ${test.documentID}\n`, err => {
              if (err) {
                console.error(err);
              }
            });
            appendFileSync(`${outputPath}/${name}.txt`, `Succeeded: ${test.succeeded}\n`, err => {
              if (err) {
                console.error(err);
              }
            });
            appendFileSync(`${outputPath}/${name}.txt`, `Result: ${test.result}\n`, err => {
              if (err) {
                console.error(err);
              }
            });
            appendFileSync(`${outputPath}/${name}.txt`, `Time to complete from result XML: ${test.taskTimeToComplete}ms\n`, err => {
              if (err) {
                console.error(err);
              }
            });
            appendFileSync(`${outputPath}/${name}.txt`, `Time to complete from initial request: ${Number(test.programTimeToComplete) * 0.000001}ms\n\n\n`, err => {
              if (err) {
                console.error(err);
              }
            });
          })
        }
      }
    },

  }
}

