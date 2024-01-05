import { jsonifyChiliResponse } from './utilities'

//Generate API key
export async function generateAPIKey(user, pass){
    let response = fetch(url + `/system/apikey`, {
        method: "POST",
        headers: {
            "content-type": "application/json"
        },
        body: JSON.stringify({userName: user, password: pass})
    }).then(async (response) => {
        if(!response.ok){
            throw new Error(response.status, response.statusText);
        }
        let responseJSON = jsonifyChiliResponse(await response.text());
        if(responseJSON.apiKey.succeeded == 'false'){
            throw new Error('Invalid credentials!');
        }
        return responseJSON.apiKey.key;
    }).catch(error => {
        console.error(error);
    });
    return response;
}

//CreatePDF
export async function documentCreatePDF(id, exportSettings, apikey){
    let response = fetch(url + `/resources/documents/${id}/representations/pdf`, {
        method: "POST",
        headers: {
            'api-key': apikey,
            'content-type': 'application/json'
        },
        body: JSON.stringify({settingsXML: exportSettings})
    }).then(async (response) => {
        if(!response.ok){
            throw new Error(response.status, response.statusText);
        }
        let responseJSON = jsonifyChiliResponse(await response.text());
        return responseJSON.task.id;
    }).catch(error => {
        console.error(error);
    });
    return response;
}

//SetVariables
//  -does this need to return anything?
export async function documentSetVariableValues(id, variablesContent, apikey){
    let response = fetch(url, `/resources/documents/${id}/variablevalues`, {
        method: "POST",
        headers: {
            'api-key': apikey,
            'content-type': 'application/json'
        },
        body: JSON.stringify(variablesContent)
    }).then(response => {
        if(!response.ok){
            throw new Error(response.status, response.statusText);
        }
        return response.status;
    }).catch(error => {
        console.error(error)
    });
    return response;
}

//Set savedInEditor
export async function documentSetSavedInEditor(id, savedInEditor, apikey){
    const varXML = `<variables savedInEditor=${savedInEditor} />`;
    return await documentSetVariableValues(id, {varXML: varXML}, apikey);
}

//Poll task
export async function taskGetStatus(taskID, apikey){
    let response = fetch(url + `/system/tasks/${taskID}/status`, {
        method: "GET",
        headers: {
            'api-key': apikey
        }
    }).then(async (response) => {
        if(!response.ok){
            throw new Error(response.status, response.statusText);
        }
        return jsonifyChiliResponse(await response.text());
    }).catch(error => {
        console.error(error);
    });
}