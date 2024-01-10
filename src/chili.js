import { jsonifyChiliResponse } from './utilities.js'

//Generate API key
export async function generateAPIKey(user, pass, environment, url) {
    let response = fetch(url + `/system/apikey?environmentNameOrURL=${environment}`, {
        method: "POST",
        headers: {
            "content-type": "application/json"
        },
        body: JSON.stringify({ "userName": user, "password": pass })
    }).then(async (response) => {
        if (!response.ok) {
            throw new Error(response.status, response.statusText);
        }
        let responseJSON = jsonifyChiliResponse(await response.text());
        if (responseJSON.succeeded == 'false') {
            throw new Error('Invalid credentials!');
        }
        return responseJSON.key;
    }).catch(error => {
        console.error(error);
    });
    return response;
}

//CreatePDF
export async function documentCreatePDF(id, exportSettings, apikey, url) {
    let response = fetch(url + `/resources/documents/${id}/representations/pdf`, {
        method: "POST",
        headers: {
            'api-key': apikey,
            'content-type': 'application/json'
        },
        body: JSON.stringify({ settingsXML: exportSettings })
    }).then(async (response) => {
        if (!response.ok) {
            throw new Error(response.status, response.statusText);
        }
        let responseJSON = jsonifyChiliResponse(await response.text());
        return responseJSON.id;
    }).catch(error => {
        console.error(error);
    });
    return response;
}

//SetVariables
export async function documentSetVariableValues(id, variablesContent, apikey, url) {
    let response = fetch(url +  `/resources/documents/${id}/variablevalues`, {
        method: "POST",
        headers: {
            'api-key': apikey,
            'content-type': 'application/json'
        },
        body: JSON.stringify(variablesContent)
    }).then(response => {
        if (!response.ok) {
            throw new Error(response.status, response.statusText);
        }
        return response.status;
    }).catch(error => {
        console.error(error)
    });
    return response;
}

//Set savedInEditor
export async function documentSetSavedInEditor(id, savedInEditor, apikey, url) {
    const varXMLString = `<variables savedInEditor="${savedInEditor}" />`;
    await documentSetVariableValues(id, { "varXML": varXMLString }, apikey, url);
}

//Poll task
export async function taskGetStatus(taskID, apikey, url) {
    let response = fetch(url + `/system/tasks/${taskID}/status`, {
        method: "GET",
        headers: {
            'api-key': apikey
        }
    }).then(async (response) => {
        if (!response.ok) {
            throw new Error(response.status, response.statusText);
        }
        return jsonifyChiliResponse(await response.text());
    }).catch(error => {
        console.error(error);
    });
    return response;
}

//GetPdfExportSettings
export async function getPdfExportSettings(id, apikey, url) {
    let response = fetch(url + `/resources/PdfExportSettings/items?itemIdOrPath=${id}`, {
        method: "GET",
        headers: {
            'api-key': apikey
        }
    }).then(async (response) => {
        if (!response.ok) {
            throw new Error(response.status, response.statusText);
        }
        return response.text();
    }).catch(error => {
        console.error(error);
    });
    return response;
}