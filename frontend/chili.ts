import { XMLParser } from "fast-xml-parser";

// --- URL helpers ---

export function getApiUrl(backofficeUrl: string): string {
  try {
    const url = new URL(backofficeUrl);
    const segments = url.pathname.split("/").filter((s) => s.length > 0);

    if (segments.pop()?.toLowerCase() !== "interface.aspx") {
      throw new Error("URL must point to the BackOffice (ending in interface.aspx)");
    }

    // Remove the environment path segment before interface.aspx
    segments.pop();

    url.pathname = segments.join("/") + "/rest-api/v1.2";
    return url.toString();
  } catch (e: any) {
    if (e.message.includes("interface.aspx")) throw e;
    throw new Error(`Invalid backoffice URL: ${e.message}`);
  }
}

export function getUploadUrl(backofficeUrl: string): string {
  return backofficeUrl.replace(/interface\.aspx/i, "upload_resource.aspx");
}

// --- XML parsing ---

export function jsonifyChiliResponse(response: string): any {
  const fastXmlParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
  });

  let data = fastXmlParser.parse(response);
  const firstKeys = Object.keys(data);
  if (firstKeys.length === 1) {
    if (typeof data[firstKeys[0]] === "object") {
      data = data[firstKeys[0]];
    }
  }
  return data;
}

// --- Cookie session helpers ---

export interface Session {
  apiKey: string;
  backofficeUrl: string;
}

export function setSession(apiKey: string, backofficeUrl: string): void {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `pot_apikey=${encodeURIComponent(apiKey)}; max-age=10800; path=/; SameSite=Lax${secure}`;
  document.cookie = `pot_backoffice=${encodeURIComponent(backofficeUrl)}; max-age=10800; path=/; SameSite=Lax${secure}`;
}

export function getSession(): Session | null {
  const cookies = Object.fromEntries(
    document.cookie.split("; ").filter(Boolean).map((c) => {
      const [key, ...rest] = c.split("=");
      return [key, decodeURIComponent(rest.join("="))];
    }),
  );
  const apiKey = cookies.pot_apikey;
  const backofficeUrl = cookies.pot_backoffice;
  if (apiKey && backofficeUrl) {
    return { apiKey, backofficeUrl };
  }
  return null;
}

export function clearSession(): void {
  document.cookie = "pot_apikey=; max-age=0; path=/; SameSite=Lax";
  document.cookie = "pot_backoffice=; max-age=0; path=/; SameSite=Lax";
}

// --- CHILI API functions ---

export async function login(params: {
  mode: "user" | "apikey";
  backofficeUrl: string;
  username?: string;
  password?: string;
  environment?: string;
  apiKey?: string;
}): Promise<{ isOK: boolean; apiKey?: string; error?: string }> {
  const apiUrl = getApiUrl(params.backofficeUrl);

  if (params.mode === "user") {
    try {
      const response = await fetch(
        apiUrl + `/system/apikey?environmentNameOrURL=${encodeURIComponent(params.environment || "")}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ userName: params.username, password: params.password }),
        },
      );

      if (!response.ok) {
        const text = await response.text();
        return { isOK: false, error: `GenerateApiKey failed: ${response.status} ${response.statusText}, ${text}` };
      }

      const parsed = jsonifyChiliResponse(await response.text());
      if (parsed.succeeded === "false") {
        return { isOK: false, error: parsed.errorMessage };
      }
      return { isOK: true, apiKey: parsed.key };
    } catch (e: any) {
      return { isOK: false, error: e.message || "Network error" };
    }
  } else {
    // API key mode: validate by calling folder-tree API
    try {
      const response = await fetch(
        apiUrl + `/resources/Documents/treelevel?parentFolder=&numLevels=1&includeSubDirectories=true&includeFiles=false`,
        { method: "GET", headers: { "api-key": params.apiKey! } },
      );
      if (!response.ok) {
        return { isOK: false, error: "API key validation failed" };
      }
      return { isOK: true, apiKey: params.apiKey };
    } catch (e: any) {
      return { isOK: false, error: e.message || "Network error" };
    }
  }
}

export interface FolderItem {
  name: string;
  path: string;
  hasSubDirectories: boolean;
}

export async function getFolderTree(
  parentFolder: string,
  apiKey: string,
  apiUrl: string,
): Promise<{ isOK: boolean; path?: string; items?: FolderItem[]; error?: string }> {
  try {
    const encoded = encodeURIComponent(parentFolder || "");
    const response = await fetch(
      apiUrl + `/resources/Documents/treelevel?parentFolder=${encoded}&numLevels=1&includeSubDirectories=true&includeFiles=false`,
      { method: "GET", headers: { "api-key": apiKey } },
    );
    if (!response.ok) {
      return { isOK: false, error: `Failed: ${response.status} ${response.statusText}` };
    }
    const xml = await response.text();
    const parsed = jsonifyChiliResponse(xml);
    let items = parsed.item || [];
    if (!Array.isArray(items)) items = [items];
    const folders: FolderItem[] = items.map((item: any) => ({
      name: item.name,
      path: item.path,
      hasSubDirectories: item.isFolder === "true" || item.numSubDirectories !== "0",
    }));
    return { isOK: true, path: parentFolder || "", items: folders };
  } catch (e: any) {
    return { isOK: false, error: e.message || "Network error" };
  }
}

export async function checkDatasource(
  documentId: string,
  apiKey: string,
  apiUrl: string,
): Promise<{ isOK: boolean; hasDataSource?: boolean; hasDataSourceID?: boolean; dataSourceID?: string; error?: string }> {
  try {
    const response = await fetch(
      apiUrl + `/resources/Documents/download?type=original&id=${documentId}`,
      { method: "GET", headers: { "api-key": apiKey } },
    );
    if (!response.ok) {
      const text = await response.text();
      return { isOK: false, error: `DocumentDownloadOriginal failed: ${response.status} ${response.statusText}, ${text}` };
    }
    const xml = await response.text();
    const parsed = jsonifyChiliResponse(xml);
    const hasDataSource = parsed.dataSource != null;
    const dataSourceID = hasDataSource ? (parsed.dataSource?.id || parsed.dataSource?.dataSourceID || "") : "";
    const hasDataSourceID = hasDataSource && dataSourceID.length > 0;
    return { isOK: true, hasDataSource, hasDataSourceID, dataSourceID };
  } catch (e: any) {
    return { isOK: false, error: e.message || "Network error" };
  }
}

export async function uploadDatasource(
  file: File,
  dataSourceID: string,
  apiKey: string,
  apiUrl: string,
  uploadUrl: string,
): Promise<{ isOK: boolean; guid?: string; datasourceXML?: string; error?: string }> {
  try {
    // Upload xlsx file via server proxy (upload_resource.aspx has CORS issues)
    const uploadForm = new FormData();
    uploadForm.append("file", file);
    const uploadRes = await fetch("/api/upload", {
      method: "POST",
      headers: {
        "x-upload-url": uploadUrl,
        "x-api-key": apiKey,
      },
      body: uploadForm,
    });

    if (!uploadRes.ok) {
      return { isOK: false, error: `Upload failed: ${uploadRes.status} ${uploadRes.statusText}` };
    }

    const uploadXml = await uploadRes.text();
    const uploadParsed = jsonifyChiliResponse(uploadXml);
    const guid = uploadParsed.guid || uploadParsed.id || "";

    if (!guid) {
      return { isOK: false, error: "No guid returned from upload" };
    }

    // Convert xlsx to datasource XML
    const convertRes = await fetch(
      apiUrl + `/settings/datasources/${dataSourceID}/xmlconverter?fileExtension=xlsx`,
      {
        method: "PUT",
        headers: {
          "api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fileDataOrPath: guid }),
      },
    );

    if (!convertRes.ok) {
      const text = await convertRes.text();
      return { isOK: false, error: `DatasourceConvertXlsx failed: ${convertRes.status} ${convertRes.statusText}, ${text}` };
    }

    const datasourceXML = await convertRes.text();
    return { isOK: true, guid, datasourceXML };
  } catch (e: any) {
    return { isOK: false, error: e.message || "Network error" };
  }
}

export async function startOutput(params: {
  documentId: string;
  pdfExportSettingsId: string;
  count: number;
  copyToFolder?: string;
  datasourceXML?: string;
  apiKey: string;
  apiUrl: string;
}): Promise<{ isOK: boolean; taskIds?: (string | { error: string })[]; error?: string }> {
  const { documentId, pdfExportSettingsId, count, copyToFolder, datasourceXML, apiKey, apiUrl } = params;

  try {
    // Fetch PDF export settings
    const settingsRes = await fetch(
      apiUrl + `/resources/PdfExportSettings/items?itemIdOrPath=${pdfExportSettingsId}`,
      { method: "GET", headers: { "api-key": apiKey } },
    );

    if (!settingsRes.ok) {
      const text = await settingsRes.text();
      return { isOK: false, error: `getPdfExportSettings failed: ${settingsRes.status} ${settingsRes.statusText}, ${text}` };
    }

    const settingsXML = await settingsRes.text();
    if (settingsXML === "<none />") {
      return { isOK: false, error: `No PDF export settings found at ID ${pdfExportSettingsId}` };
    }

    const taskIds: (string | { error: string })[] = [];

    for (let i = 0; i < count; i++) {
      let docIdForPdf = documentId;

      if (copyToFolder) {
        try {
          const copyName = crypto.randomUUID();
          const encodedFolder = encodeURIComponent(copyToFolder);
          const copyRes = await fetch(
            apiUrl + `/resources/Documents/items/${documentId}/copy?newName=${copyName}&folderPath=${encodedFolder}`,
            { method: "POST", headers: { "api-key": apiKey } },
          );
          if (!copyRes.ok) {
            const errText = await copyRes.text();
            taskIds.push({ error: `Copy failed: ${copyRes.status} ${copyRes.statusText} - ${errText}` });
            continue;
          }
          const copyXml = await copyRes.text();
          const copyParsed = jsonifyChiliResponse(copyXml);
          docIdForPdf = copyParsed.id;
        } catch (copyErr: any) {
          taskIds.push({ error: copyErr.message || String(copyErr) });
          continue;
        }
      }

      // Apply datasource if provided
      if (datasourceXML) {
        try {
          const dsRes = await fetch(
            apiUrl + `/resources/documents/${docIdForPdf}/datasource`,
            {
              method: "POST",
              headers: { "api-key": apiKey, "content-type": "application/json" },
              body: JSON.stringify({ datasourceXML }),
            },
          );
          if (!dsRes.ok) {
            const text = await dsRes.text();
            taskIds.push({ error: `Datasource failed: ${dsRes.status} ${dsRes.statusText}, ${text}` });
            continue;
          }
        } catch (dsErr: any) {
          taskIds.push({ error: `Datasource failed: ${dsErr.message || String(dsErr)}` });
          continue;
        }
      }

      // Create PDF
      try {
        const pdfRes = await fetch(
          apiUrl + `/resources/documents/${docIdForPdf}/representations/pdf`,
          {
            method: "POST",
            headers: { "api-key": apiKey, "content-type": "application/json" },
            body: JSON.stringify({ settingsXML }),
          },
        );
        if (!pdfRes.ok) {
          const text = await pdfRes.text();
          taskIds.push({ error: `DocumentCreatePDF failed: ${pdfRes.status} ${pdfRes.statusText}, ${text}` });
        } else {
          const parsed = jsonifyChiliResponse(await pdfRes.text());
          taskIds.push(parsed.id);
        }
      } catch (pdfErr: any) {
        taskIds.push({ error: pdfErr.message || String(pdfErr) });
      }
    }

    return { isOK: true, taskIds };
  } catch (e: any) {
    return { isOK: false, error: e.message || "Network error" };
  }
}

export async function getTaskStatus(
  taskId: string,
  apiKey: string,
  apiUrl: string,
): Promise<{ isOK: boolean; finished?: string; succeeded?: string; result?: string; url?: string; errorMessage?: string; processingTime?: string; totalTime?: string; error?: string }> {
  try {
    const response = await fetch(apiUrl + `/system/tasks/${taskId}/status`, {
      method: "GET",
      headers: { "api-key": apiKey },
    });
    if (!response.ok) {
      return { isOK: false, error: `TaskGetStatus failed: ${response.status} ${response.statusText}` };
    }
    const parsed = jsonifyChiliResponse(await response.text());
    if (parsed.found === "false") {
      return { isOK: false, error: `No task found at ID ${taskId}` };
    }

    // The result attribute contains escaped XML like <result url="..." />
    // Parse it to extract the actual PDF download URL
    let url = "";
    if (parsed.result && typeof parsed.result === "string") {
      try {
        const resultParsed = jsonifyChiliResponse(parsed.result);
        url = resultParsed.url || "";
      } catch {
        // result is not parseable XML, ignore
      }
    }

    return { isOK: true, ...parsed, url };
  } catch (e: any) {
    return { isOK: false, error: e.message || "Network error" };
  }
}

export async function getTaskXml(
  taskId: string,
  apiKey: string,
  apiUrl: string,
): Promise<Blob> {
  const response = await fetch(apiUrl + `/system/tasks/${taskId}/status`, {
    method: "GET",
    headers: { "api-key": apiKey },
  });
  return response.blob();
}
