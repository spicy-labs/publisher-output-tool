import {generateAPIKey, documentCreatePDF, documentSetSavedInEditor, documentSetVariableValues, taskGetStatus} from './chili'

export async function startTests(tests, reporter) {

}


export async function runTestSync(test, reporter) {
    //Needs to:
    //  -Reference num outputs per document
    //  -Reference each document in the test
    //      -ID, savedInEditor, name (?)
    //  -(This one is sync) For each doc in the test:
    //      - Get a task ID from docCreatePDF
    //      - Poll that task every second (?) until it's finished
    //      - Throw that result in a JSON
    //      - Repeat x amount of times (num outputs defined in test JSON)
    //  -(This one is asnyc)
    //      - Do every document's output at once
    //      - Poll every task at a set interval (1 second?), pop tasks from list as they resolve
    //      - Throw results into a JSON as they come in
    //  -Toss a collated JSON at the reporter
}

// Don't need these split in hindsight, probably just easier to determine sync or async in one test function
export async function runTestAsync(test, reporter) {
 
}