import { generateAPIKey, documentCreatePDF, documentSetSavedInEditor, documentSetVariableValues, taskGetStatus, getPdfExportSettings } from './chili.js';
import { jsonifyChiliResponse } from './utilities.js';
import { hrtime } from 'node:process';

export async function startTests(tests, reporter) {
  for (var i = 0; i < tests.tests.length; i++) {
    reporter.createTestFile(tests.tests[i]);
    let results = await runTest(tests.tests[i], reporter);
    reporter.writeResultsToFile(results, tests.tests[i].name);
  }
}

export async function runTest(test) {
  // Build base URL from backoffice URL
  const baseURL = buildBaseURL(test.environment.backofficeUrl);
  // Check the auth type (was an API key provided or a user/password?)
  let apikey;
  if (typeof test.environment.auth === "string") {
    apikey = test.environment.auth;
  }
  else {
    apikey = await generateAPIKey(test.environment.auth.userName, test.environment.auth.password, test.environment.name, baseURL);
  }

  // Fetch PDF export settings
  const pdfExportSettings = await getPdfExportSettings(test.pdfExportSettingsId, apikey, baseURL);

  let results = [];

  console.log(`Starting test ${test.name}...`);

  // Check if async or not
  if (test.runAsync) {
    let tasks = [];
    // Start document generations
    const start = hrtime.bigint();
    for (var i = 0; i < test.documents.length; i++) {
      for (var x = 0; x < test.outputEachDocumenThisAmount; x++) {
        console.log(`Running create PDF on ${test.documents[i].id}...`)
        // Check if savedInEditor needs to be set
        if (!test.documents[i].savedInEditor) {
          // await documentSetSavedInEditor(test.documents[i].id, false, apikey, baseURL);
          await documentSetSavedInEditor(test.documents[i].id, false, apikey, baseURL);
        }
        tasks.push({ "docID": test.documents[i].id, "taskID": await documentCreatePDF(test.documents[i].id, pdfExportSettings, apikey, baseURL) });
      }
    }
    // Loop through each task, check if it's done, remove from list if finished
    while (tasks.length != 0) {
      tasks.forEach(async (task) => {
        let taskStatus = await taskGetStatus(task.taskID, apikey, baseURL);
        // Check if finished
        if (taskStatus.finished === "True") {
          // Check for success
          if (taskStatus.succeeded === "True") {
            // Check if the URL is empty
            //  - programTimeToComplete is recorded in nanoseconds now, it's probably easier to just convert to milliseconds in the reporter
            if (jsonifyChiliResponse(taskStatus.result).url === '') {
              results.push({ "documentID": task.docID, "succeeded": false, "result": "Task marked as succeeded, but no result URL returned", "taskTimeToComplete": taskStatus.totalTime, "programTimeToComplete": `${(hrtime.bigint() - start)}` });
            }
            else {
              results.push({ "documentID": task.docID, "succeeded": true, "result": jsonifyChiliResponse(taskStatus.result).url, "taskTimeToComplete": taskStatus.totalTime, "programTimeToComplete": `${(hrtime.bigint() - start)}` });
            }
          }
          else {
            results.push({ "documentID": task.docID, "succeeded": false, "result": `Task failed with error message: ${taskStatus.errorMessage}`, "taskTimeToComplete": taskStatus.totalTime, "programTimeToComplete": `${(hrtime.bigint() - start)}` });
          }
          tasks.splice(tasks.indexOf(task), 1);
        }
      })
      // Wait half a second between each run
      await new Promise(r => setTimeout(r, 500));
    }
  }
  // Sync run
  else {
    for (var i = 0; i < test.documents.length; i++) {
      for (var x = 0; x < test.outputEachDocumenThisAmount; x++) {
        console.log(`Running create PDF on ${test.documents[i].id}...`)
        // Check if savedInEditor needs to be set
        if (!test.documents[i].savedInEditor) {
          // await documentSetSavedInEditor(test.documents[i].id, false, apikey, baseURL);
          await documentSetSavedInEditor(test.documents[i].id, false, apikey, baseURL);
        }
        const start = hrtime.bigint();
        let task = { "docID": test.documents[i].id, "taskID": await documentCreatePDF(test.documents[i].id, pdfExportSettings, apikey, baseURL) };
        // Poll task until finished
        let taskRunning = true;
        while (taskRunning) {
          let taskStatus = await taskGetStatus(task.taskID, apikey, baseURL);
          // Check if finished
          if (taskStatus.finished === "True") {
            // Check for success
            if (taskStatus.succeeded === "True") {
              // Check if the URL is empty
              //  - programTimeToComplete is recorded in nanoseconds now, it's probably easier to just convert to milliseconds in the reporter
              if (jsonifyChiliResponse(taskStatus.result).url === '') {
                results.push({ "documentID": task.docID, "succeeded": false, "result": "Task marked as succeeded, but no result URL returned", "taskTimeToComplete": taskStatus.totalTime, "programTimeToComplete": `${(hrtime.bigint() - start)}` });
              }
              else {
                results.push({ "documentID": task.docID, "succeeded": true, "result": jsonifyChiliResponse(taskStatus.result).url, "taskTimeToComplete": taskStatus.totalTime, "programTimeToComplete": `${(hrtime.bigint() - start)}` });
              }

            }
            else {
              results.push({ "documentID": task.docID, "succeeded": false, "result": `Task failed with error message: ${taskStatus.errorMessage}`, "taskTimeToComplete": taskStatus.totalTime, "programTimeToComplete": `${(hrtime.bigint() - start)}` });
            }
            taskRunning = false;
          }
          // Wait half a second between each run
          await new Promise(r => setTimeout(r, 500));
        }
      }
    }
  }

  console.log(`End test ${test.name}.\n`);
  return results;

}

function buildBaseURL(url) {
  const urlFirst = url.split("/")[0] + "/" + url.split("/")[1] + "/" + url.split("/")[2];
  const urlSecond = "/rest-api/v1.2";
  return urlFirst + urlSecond;
}
