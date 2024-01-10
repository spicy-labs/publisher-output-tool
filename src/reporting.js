import { appendFileSync, writeFileSync } from "fs";

const example = {
    documentName: "",
    documentId: "",
    taskToCompleteTimeFromXml: "",
    taskToCompleteTimeFromRequest: "",
    taskFailed: false,
    missingUrl: true
}


const reporter = {
    createTestFile(testJSON) {
        appendFileSync(`.\\Results\\${testJSON.name}.txt`, `${testJSON.name} Results\n\n`, err => {
            if (err) {
                console.error(err);
            }
        });
    },
    writeResultsToFile(resultsJSON, fileName) {
        resultsJSON.results.forEach(test => {
            // Add JSON data for each document in the result
            appendFileSync(`.\\Results\\${fileName}.txt`, `Document ID: ${test.documentID}\n`, err => {
                if (err) {
                    console.error(err);
                }
            });
            appendFileSync(`.\\Results\\${fileName}.txt`, `Succeeded: ${test.succeeded}\n`, err => {
                if (err) {
                    console.error(err);
                }
            });
            appendFileSync(`.\\Results\\${fileName}.txt`, `Result: ${test.result}\n`, err => {
                if (err) {
                    console.error(err);
                }
            });
            appendFileSync(`.\\Results\\${fileName}.txt`, `Time to complete from result XML: ${test.taskTimeToComplete}ms\n`, err => {
                if (err) {
                    console.error(err);
                }
            });
            appendFileSync(`.\\Results\\${fileName}.txt`, `Time to complete from initial request: ${Number(test.programTimeToComplete) * 0.000001}ms\n\n\n`, err => {
                if (err) {
                    console.error(err);
                }
            });
        })
    },
};


export {
    reporter
}