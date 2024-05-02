import { generateAPIKey, documentCreatePDF, documentCreateTempPDF, documentSetSavedInEditor, documentSetVariableValues, taskGetStatus, getPdfExportSettings, documentGetXML } from './chili.js';
import { jsonifyChiliResponse } from './utilities.js';
import { hrtime } from 'node:process';

export async function startTests(tests, reporter) {
  for (var i = 0; i < tests.length; i++) {
    const test = tests[i];
    const report = await reporter.startReport(test.name);
    let results = await runTest(test, report);
    await report.writeTo(results);
  }
}

export async function runTest(test) {
  // Build base URL from backoffice URL
  const baseURL = buildBaseURL(test.environment.backofficeUrl);

  if (baseURL == null) {
    // TODO: Better error handling
    throw new Error("URL could not be found.");
  }

  // Check the auth type (was an API key provided or a user/password?)
  let apikey;
  if (typeof test.environment.auth === "string") {
    apikey = test.environment.auth;
  }
  else {
    const apikeyResult = await generateAPIKey(test.environment.auth.userName, test.environment.auth.password, test.environment.name, baseURL);
    if (!apikeyResult.isOK) {
      throw apikeyResult.error;
    }
    apikey = apikeyResult.response;
  }

  // Fetch PDF export settings
  const pdfExportSettingsResult = (test.pdfExportSettingsXml) ? { isOK: true, response: test.pdfExportSettingsXml } : await getPdfExportSettings(test.pdfExportSettingsId, apikey, baseURL);
  if (!pdfExportSettingsResult.isOK) {
    throw pdfExportSettingsResult.error;
  }
  const pdfExportSettings = pdfExportSettingsResult.response;

  let results = [];

  console.log(`Starting test ${test.name}...`);

  // Check if async or not
  if (test.runAsync) {
    let tasks = [];
    // Start document generations
    const start = hrtime.bigint();
    for (var i = 0; i < test.documents.length; i++) {
      const doc = test.documents[i];
      // Check if the document exists or not, this also has the document name and XML stored in it so can be used to add functionality down the line
      const getDocXMLResult = await documentGetXML(doc.id, apikey, baseURL);
      if (!getDocXMLResult.isOK) {
        console.error(`Aborting tests for doc ${doc.id} with message: ${getDocXMLResult.error}`);
      }
      else {
        for (var x = 0; x < test.outputEachDocumentThisAmount; x++) {
          console.log(`Running create PDF on ${doc.id}...`)


          if (doc.useTempXml) {

            // Dirty, but maybe not best way
            const docXml = getDocXMLResult.responseXML.replace(
              (doc.savedInEditor ? "savedInEditor=\"false\"" : "savedInEditor=\"true\""),
              (doc.savedInEditor ? "savedInEditor=\"true\"" : "savedInEditor=\"false\""))

            const generatePDF = await documentCreateTempPDF(doc.id, docXml, pdfExportSettings, apikey, baseURL)
            if (!generatePDF.isOK) {
              console.error(`Output attempt ${x + 1} on doc ${doc.id} failed: ${generatePDF.error}`);
            }
            else {
              tasks.push({ "docID": doc.id, "taskID": generatePDF.response });
            }
          }
          else {

            // Check if savedInEditor needs to be set
            if (!doc.savedInEditor) {
              const savedInEditorResult = await documentSetSavedInEditor(doc.id, false, apikey, baseURL);
              // Continue with test if setting savedInEditor fails for whatever reason, log in console
              if (!savedInEditorResult.isOK) {
                // This should only actually fail if either CHILI is wholly down or if the provided PDF settings are no good
                console.error(`Failed to set savedInEditor for output attempt ${x + 1} on doc ${doc.id}: ${savedInEditorResult.error}`);
              }
            }
            // Check for createPDF endpoint failing, handle accordingly
            const generatePDF = await documentCreatePDF(doc.id, pdfExportSettings, apikey, baseURL);
            if (!generatePDF.isOK) {
              console.error(`Output attempt ${x + 1} on doc ${doc.id} failed: ${generatePDF.error}`);
            }
            else {
              tasks.push({ "docID": doc.id, "taskID": generatePDF.response });
            }
          }
        }
      }
    }
    // Loop through each task, check if it's done, remove from list if finished
    while (tasks.length != 0) {
      let taskChecks = tasks.map(async (task) => {
        const taskStatusResult = await taskGetStatus(task.taskID, apikey, baseURL);
        task.taskPollFailures = (task.taskPollFailures) ? task.taskPollFailures + 1 : 0;
        if (!taskStatusResult.isOK) {
          console.error(`Failed to poll task ${task.taskID} for doc ${task.docID}: ${taskStatusResult.error}`);
          task.taskPollFailures++;
          // Pop task from queue if more than 20 failures on API call
          if (task.taskPollFailures > 20) {
            tasks.splice(tasks.indexOf(task), 1);
            console.error(`Failed to poll task ${task.taskID} more than 20 times, aborting task`);
          }
        }
        else {
          const taskStatus = taskStatusResult.response;
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
        }
      })
      // Wait half a second between each run
      await Promise.all(taskChecks);

      await new Promise(r => setTimeout(r, 500));
    }
  }
  // Sync run
  else {
    for (var i = 0; i < test.documents.length; i++) {

      const doc = test.documents[i];
      // Check if the document exists or not, this also has the document name and XML stored in it so can be used to add functionality down the line
      const getDocXMLResult = await documentGetXML(doc.id, apikey, baseURL);
      if (!getDocXMLResult.isOK) {
        console.error(`Aborting tests for doc ${doc.id} with message: ${getDocXMLResult.error}`);
      }
      else {
        for (var x = 0; x < test.outputEachDocumentThisAmount; x++) {
          console.log(`Running create PDF on ${doc.id}...`)

          let generatePDF;
          let task;
          let start;

          if (doc.useTempXml) {

            // Dirty, but maybe not best way
            const docXml = getDocXMLResult.responseXML.replace(
              (doc.savedInEditor ? "savedInEditor=\"false\"" : "savedInEditor=\"true\""),
              (doc.savedInEditor ? "savedInEditor=\"true\"" : "savedInEditor=\"false\""))
            start = hrtime.bigint();
            generatePDF = await documentCreateTempPDF(doc.id, docXml, pdfExportSettings, apikey, baseURL)
          }
          else {

            // Check if savedInEditor needs to be set
            if (!doc.savedInEditor) {
              const savedInEditorResult = await documentSetSavedInEditor(doc.id, false, apikey, baseURL);
              // Continue with test if setting savedInEditor fails for whatever reason, log in console
              if (!savedInEditorResult.isOK) {
                // This should only actually fail if either CHILI is wholly down or if the provided PDF settings are no good
                console.error(`Failed to set savedInEditor for output attempt ${x + 1} on doc ${doc.id}: ${savedInEditorResult.error}`);
              }
            }

            start = hrtime.bigint();
            generatePDF = await documentCreatePDF(doc.id, pdfExportSettings, apikey, baseURL);
          }
          if (!generatePDF.isOK) {
            console.error(`Output attempt ${x + 1} on doc ${doc.id} failed: ${generatePDF.error}`);
          }
          else {
            task = { "docID": doc.id, "taskID": generatePDF.response };
          }
          // Poll task until finished
          let taskRunning = true;
          while (taskRunning) {
            const taskStatusResult = await taskGetStatus(task.taskID, apikey, baseURL);
            task.taskPollFailures = (task.taskPollFailures) ? task.taskPollFailures + 1 : 0;
            if (!taskStatusResult.isOK) {
              console.error(`Failed to poll task ${task.taskID} for doc ${task.docID}: ${taskStatusResult.error}`);
              task.taskPollFailures++;
              // Stop task running if API failures exceed 20
              if (task.taskPollFailures > 20) {
                taskRunning = false;
                console.error(`Failed to poll task ${task.taskID} more than 20 times, aborting task`);
              }
            }
            else {
              const taskStatus = taskStatusResult.response;
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
            }
            // Check if finished
            // Wait half a second between each run
            await new Promise(r => setTimeout(r, 500));
          }
        }
      }
    }
  }

  console.log(`End test ${test.name}.\n`);
  return results;

}

function buildBaseURL(inputUrl) {
  try {
    const url = new URL(inputUrl);

    // Split the pathname into segments
    const pathSegments = url.pathname.split('/').filter(segment => segment.length > 0);

    if (pathSegments.pop().toLowerCase() != "interface.aspx") {
      throw new Error("URL does point to the BackOffice");
    }

    pathSegments.pop();

    // Replace with the new path
    url.pathname = pathSegments.join("/") + '/rest-api/v1.2';

    return url.toString();
  } catch (error) {
    console.error('Invalid URL:', error.message);
    return null;
  }
}
