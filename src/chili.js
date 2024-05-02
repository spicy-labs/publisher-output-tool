import { jsonifyChiliResponse } from "./utilities.js";

//Generate API key
export async function generateAPIKey(user, pass, environment, url) {
  // Rewrite to better handle errors
  let result = {
    response: "",
    isOK: false,
    error: "",
  };

  try {
    const response = await fetch(
      url + `/system/apikey?environmentNameOrURL=${environment}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ userName: user, password: pass }),
      },
    );

    if (!response.ok) {
      result.isOK = false;
      result.error = Error(`GenerateApiKey failed with message: ${response.status} ${response.statusText}, ${await response.text()}`);
    } else {
      const responseJSON = jsonifyChiliResponse(await response.text());
      if (responseJSON.succeeded == "false") {
        result.isOK = false;
        result.error = Error(responseJSON.errorMessage);
      } else {
        result.isOK = true;
        result.response = responseJSON.key;
      }
    }
  } catch (err) {
    result.isOK = false;
    result.error = err;
  }
  return result;
}

//CreatePDF
export async function documentCreatePDF(id, exportSettings, apikey, url) {
  let result = {
    response: "",
    isOK: false,
    error: "",
  };
  try {
    const response = await fetch(
      url + `/resources/documents/${id}/representations/pdf`,
      {
        method: "POST",
        headers: {
          "api-key": apikey,
          "content-type": "application/json",
        },
        body: JSON.stringify({ settingsXML: exportSettings }),
      },
    );

    if (!response.ok) {
      result.isOK = false;
      result.error = Error(`DocumentCreatePDF failed with message: ${response.status} ${response.statusText}, ${await response.text()}`);
    } else {
      const responseJSON = jsonifyChiliResponse(await response.text());
      result.isOK = true;
      result.response = responseJSON.id;
    }
  } catch (err) {
    result.isOK = false;
    result.error = err;
  }
  return result;
}

export async function documentCreateTempPDF(id, docXml, exportSettings, apikey, url) {
  let result = {
    response: "",
    isOK: false,
    error: "",
  };
  try {
    const response = await fetch(
      url + `/resources/documents/tempxml/pdf?itemID=${id}`,
      {
        method: "POST",
        headers: {
          "api-key": apikey,
          "content-type": "application/json",
        },
        body: JSON.stringify({ docXML: docXml, settingsXML: exportSettings }),
      },
    );

    if (!response.ok) {
      result.isOK = false;
      result.error = Error(`DocumentCreatePDF failed with message: ${response.status} ${response.statusText}, ${await response.text()}`);
    } else {
      const responseJSON = jsonifyChiliResponse(await response.text());
      result.isOK = true;
      result.response = responseJSON.id;
    }
  } catch (err) {
    result.isOK = false;
    result.error = err;
  }
  return result;
}

export async function documentGetXML(id, apikey, url) {
  let result = {
    responseName: "",
    responseXML: "",
    isOK: false,
    error: "",
  };
  try {
    const response = await fetch(url + `/resources/documents/items/${id}/xml`, {
      method: "GET",
      headers: {
        "api-key": apikey,
      },
    });

    if (!response.ok) {
      result.isOK = false;
      result.error = Error(`ResourceItemGetXML failed with message: ${response.status} ${response.statusText}, ${await response.text()}`);
    } else {
      const responseText = await response.text();
      const responseJSON = jsonifyChiliResponse(responseText);
      result.isOK = true;
      result.responseName = responseJSON.name;
      result.responseXML = responseText;
    }
  } catch (err) {
    result.isOK = false;
    result.error = err;
  }
  return result;
}

//SetVariables
export async function documentSetVariableValues(
  id,
  variablesContent,
  apikey,
  url,
) {
  let result = {
    isOK: false,
    error: "",
  };
  try {
    const response = await fetch(
      url + `/resources/documents/${id}/variablevalues`,
      {
        method: "POST",
        headers: {
          "api-key": apikey,
          "content-type": "application/json",
        },
        body: JSON.stringify(variablesContent),
      },
    );

    if (!response.ok) {
      result.isOK = false;
      result.error = Error(`DocumentSetVariableValues failed with message: ${response.status} ${response.statusText}, ${await response.text()}`);
    } else {
      result.isOK = true;
    }
  } catch (err) {
    result.isOK = false;
    result.error = err;
  }
  return result;
}

//Set savedInEditor
export async function documentSetSavedInEditor(id, savedInEditor, apikey, url) {
  const varXMLString = `<variables savedInEditor="${savedInEditor}" />`;
  return await documentSetVariableValues(
    id,
    { varXML: varXMLString },
    apikey,
    url,
  );
}

//Poll task
export async function taskGetStatus(taskID, apikey, url) {
  let result = {
    response: "",
    isOK: false,
    error: "",
  };
  try {
    const response = await fetch(url + `/system/tasks/${taskID}/status`, {
      method: "GET",
      headers: {
        "api-key": apikey,
      },
    });

    if (!response.ok) {
      result.isOK = false;
      result.error = Error(`TaskGetStatus failed with message: ${response.status} ${response.statusText}, ${await response.text()}`);
    } else {
      const responseJSON = jsonifyChiliResponse(await response.text());
      // Check if task exists
      if (responseJSON.found == "false") {
        result.isOK = false;
        result.error = Error(`No task found at ID ${taskID}`);
      } else {
        result.isOK = true;
        result.response = responseJSON;
      }
    }
  } catch (err) {
    result.isOK = false;
    result.error = err;
  }
  return result;
}

//GetPdfExportSettings
export async function getPdfExportSettings(id, apikey, url) {
  let result = {
    response: "",
    isOK: false,
    error: "",
  };
  try {
    const response = await fetch(
      url + `/resources/PdfExportSettings/items?itemIdOrPath=${id}`,
      {
        method: "GET",
        headers: {
          "api-key": apikey,
        },
      },
    );

    if (!response.ok) {
      result.isOK = false;
      result.error = Error(`ResourceItemGetByIdOrPath failed with message: ${response.status} ${response.statusText}, ${await response.text()}`);
    } else {
      const responseText = await response.text();
      // Error if no PDF settings found at ID
      if (responseText == "<none />") {
        result.isOK = false;
        result.error = Error(`No PDF export settings found at ID ${id}`);
      } else {
        result.isOK = true;
        result.response = responseText;
      }
    }
  } catch (err) {
    result.isOK = false;
    result.error = err;
  }
  return result;
}
