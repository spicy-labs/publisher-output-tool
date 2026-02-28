import { generateAPIKey, documentCreatePDF, taskGetStatus, getPdfExportSettings, documentDownloadOriginal, datasourceConvertXlsx, documentSetDatasource } from "./src/chili.js";
import { jsonifyChiliResponse } from "./src/utilities.js";
import index from "./frontend/index.html";

const HISTORY_FILE = "./history.json";

async function loadHistory() {
  try {
    return await Bun.file(HISTORY_FILE).json();
  } catch {
    return {};
  }
}

async function saveHistory(history) {
  await Bun.write(HISTORY_FILE, JSON.stringify(history, null, 2));
}

function getApiUrl(backofficeUrl) {
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
  } catch (e) {
    if (e.message.includes("interface.aspx")) throw e;
    throw new Error(`Invalid backoffice URL: ${e.message}`);
  }
}

function getUploadUrl(backofficeUrl) {
  return backofficeUrl.replace(/interface\.aspx/i, "upload_resource.aspx");
}

Bun.serve({
  port: 3000,
  routes: {
    "/": index,

    "/api/generate-api-key": {
      POST: async (req) => {
        try {
          const { username, password, environment, backofficeUrl } = await req.json();
          const url = getApiUrl(backofficeUrl);
          console.log("[generate-api-key] URL:", url);
          console.log("[generate-api-key] Environment:", environment);
          const result = await generateAPIKey(username, password, environment, url);
          if (!result.isOK) {
            console.log("[generate-api-key] FAILED:", result.error?.message || String(result.error));
            return Response.json({ isOK: false, error: result.error?.message || String(result.error) });
          }
          console.log("[generate-api-key] OK, key:", result.response?.slice(0, 8) + "...");
          return Response.json({ isOK: true, apiKey: result.response });
        } catch (e) {
          console.log("[generate-api-key] EXCEPTION:", e);
          return Response.json({ isOK: false, error: e.message }, { status: 500 });
        }
      },
    },

    "/api/folder-tree": {
      POST: async (req) => {
        try {
          const { parentFolder, apiKey, backofficeUrl } = await req.json();
          const url = getApiUrl(backofficeUrl);
          const encoded = encodeURIComponent(parentFolder || "");
          const response = await fetch(
            url + `/resources/Documents/treelevel?parentFolder=${encoded}&numLevels=1&includeSubDirectories=true&includeFiles=false`,
            {
              method: "GET",
              headers: { "api-key": apiKey },
            },
          );
          if (!response.ok) {
            return Response.json({ isOK: false, error: `Failed: ${response.status} ${response.statusText}` });
          }
          const xml = await response.text();
          const parsed = jsonifyChiliResponse(xml);
          let items = parsed.item || [];
          if (!Array.isArray(items)) items = [items];
          const folders = items.map((item) => ({
            name: item.name,
            path: item.path,
            hasSubDirectories: item.isFolder === "true" || item.numSubDirectories !== "0",
          }));
          return Response.json({ isOK: true, path: parentFolder || "", items: folders });
        } catch (e) {
          console.log("[folder-tree] EXCEPTION:", e);
          return Response.json({ isOK: false, error: e.message }, { status: 500 });
        }
      },
    },

    "/api/history": {
      POST: async (req) => {
        try {
          const { backofficeUrl } = await req.json();
          const history = await loadHistory();
          const entries = history[backofficeUrl] || [];
          return Response.json({ isOK: true, entries });
        } catch (e) {
          return Response.json({ isOK: false, error: e.message }, { status: 500 });
        }
      },
    },

    "/api/check-datasource": {
      POST: async (req) => {
        try {
          const { documentId, apiKey, backofficeUrl } = await req.json();
          const url = getApiUrl(backofficeUrl);
          console.log("[check-datasource] Downloading original XML for document:", documentId);
          const result = await documentDownloadOriginal(documentId, apiKey, url);
          if (!result.isOK) {
            const msg = result.error?.message || String(result.error);
            console.log("[check-datasource] FAILED:", msg);
            return Response.json({ isOK: false, error: msg });
          }
          const parsed = jsonifyChiliResponse(result.response);
          const hasDataSource = parsed.dataSource != null;
          const dataSourceID = hasDataSource ? (parsed.dataSource?.id || parsed.dataSource?.dataSourceID || "") : "";
          const hasDataSourceID = hasDataSource && dataSourceID.length > 0;
          console.log("[check-datasource] hasDataSource:", hasDataSource, "hasDataSourceID:", hasDataSourceID, "dataSourceID:", dataSourceID);
          return Response.json({ isOK: true, hasDataSource, hasDataSourceID, dataSourceID });
        } catch (e) {
          console.log("[check-datasource] EXCEPTION:", e);
          return Response.json({ isOK: false, error: e.message }, { status: 500 });
        }
      },
    },

    "/api/check-datasource-file": {
      POST: async (req) => {
        try {
          const { datasourceGuid } = await req.json();
          if (!datasourceGuid) {
            return Response.json({ isOK: true, exists: false });
          }
          const file = Bun.file(`./datasources/${datasourceGuid}.xml`);
          const exists = await file.exists();
          console.log("[check-datasource-file] guid:", datasourceGuid, "exists:", exists);
          return Response.json({ isOK: true, exists });
        } catch (e) {
          console.log("[check-datasource-file] EXCEPTION:", e);
          return Response.json({ isOK: false, error: e.message }, { status: 500 });
        }
      },
    },

    "/api/upload-datasource": {
      POST: async (req) => {
        try {
          const formData = await req.formData();
          const file = formData.get("file");
          const apiKey = formData.get("apiKey");
          const backofficeUrl = formData.get("backofficeUrl");
          const dataSourceID = formData.get("dataSourceID");

          if (!file || !apiKey || !backofficeUrl || !dataSourceID) {
            return Response.json({ isOK: false, error: "Missing required fields" });
          }

          const url = getApiUrl(backofficeUrl);
          const uploadUrl = getUploadUrl(backofficeUrl);

          // Upload xlsx file
          console.log("[upload-datasource] Uploading file to:", uploadUrl);
          const uploadForm = new FormData();
          uploadForm.append("file", file);
          const uploadRes = await fetch(uploadUrl, {
            method: "POST",
            headers: { "api-key": apiKey },
            body: uploadForm,
          });

          if (!uploadRes.ok) {
            const errText = await uploadRes.text();
            console.log("[upload-datasource] Upload FAILED:", errText);
            return Response.json({ isOK: false, error: `Upload failed: ${uploadRes.status} ${uploadRes.statusText}` });
          }

          const uploadXml = await uploadRes.text();
          console.log("[upload-datasource] Upload response:", uploadXml);
          const uploadParsed = jsonifyChiliResponse(uploadXml);
          const guid = uploadParsed.guid || uploadParsed.id || "";

          if (!guid) {
            console.log("[upload-datasource] No guid in upload response");
            return Response.json({ isOK: false, error: "No guid returned from upload" });
          }

          console.log("[upload-datasource] File uploaded, guid:", guid);

          // Convert xlsx to datasource XML
          console.log("[upload-datasource] Converting xlsx for datasource:", dataSourceID);
          const convertResult = await datasourceConvertXlsx(dataSourceID, guid, apiKey, url);
          if (!convertResult.isOK) {
            const msg = convertResult.error?.message || String(convertResult.error);
            console.log("[upload-datasource] Convert FAILED:", msg);
            return Response.json({ isOK: false, error: msg });
          }

          // Save datasource XML to file
          const datasourceDir = "./datasources";
          await Bun.write(`${datasourceDir}/${guid}.xml`, convertResult.response);
          console.log("[upload-datasource] Saved datasource XML to:", `${datasourceDir}/${guid}.xml`);

          return Response.json({ isOK: true, guid });
        } catch (e) {
          console.log("[upload-datasource] EXCEPTION:", e);
          return Response.json({ isOK: false, error: e.message }, { status: 500 });
        }
      },
    },

    "/api/start-output": {
      POST: async (req) => {
        try {
          const { documentId, pdfExportSettingsId, count, apiKey, backofficeUrl, copyToFolder, datasourceGuid, dataSourceID, datasourceFileName, skipHistory, batches, asyncBatches } = await req.json();
          const url = getApiUrl(backofficeUrl);

          console.log("[start-output] Base API URL:", url);
          console.log("[start-output] Document ID:", documentId);
          console.log("[start-output] PDF Export Settings ID:", pdfExportSettingsId);
          console.log("[start-output] Count:", count);
          console.log("[start-output] API Key:", apiKey ? apiKey.slice(0, 8) + "..." : "(empty)");
          if (copyToFolder) console.log("[start-output] Copy to folder:", copyToFolder);
          if (datasourceGuid) console.log("[start-output] Datasource GUID:", datasourceGuid);

          // Load datasource XML if provided
          let datasourceXML = null;
          if (datasourceGuid) {
            try {
              datasourceXML = await Bun.file(`./datasources/${datasourceGuid}.xml`).text();
              console.log("[start-output] Loaded datasource XML, length:", datasourceXML.length);
            } catch (err) {
              console.log("[start-output] Failed to load datasource XML:", err);
              return Response.json({ isOK: false, error: "Failed to load datasource XML file" });
            }
          }

          console.log("[start-output] Fetching PDF export settings...");
          console.log("[start-output] GET", url + `/resources/PdfExportSettings/items?itemIdOrPath=${pdfExportSettingsId}`);
          const settingsResult = await getPdfExportSettings(pdfExportSettingsId, apiKey, url);
          if (!settingsResult.isOK) {
            const msg = settingsResult.error?.message || String(settingsResult.error);
            console.log("[start-output] getPdfExportSettings FAILED:", msg);
            return Response.json({ isOK: false, error: msg });
          }
          console.log("[start-output] getPdfExportSettings OK, response length:", settingsResult.response.length);

          const taskIds = [];
          for (let i = 0; i < count; i++) {
            let docIdForPdf = documentId;

            if (copyToFolder) {
              console.log(`[start-output] Copying document ${i + 1}/${count} to ${copyToFolder}...`);
              try {
                const copyName = crypto.randomUUID();
                const encodedFolder = encodeURIComponent(copyToFolder);
                const copyRes = await fetch(
                  url + `/resources/Documents/items/${documentId}/copy?newName=${copyName}&folderPath=${encodedFolder}`,
                  {
                    method: "POST",
                    headers: { "api-key": apiKey },
                  },
                );
                if (!copyRes.ok) {
                  const errText = await copyRes.text();
                  const msg = `Copy failed: ${copyRes.status} ${copyRes.statusText} - ${errText}`;
                  console.log(`[start-output] Copy ${i + 1} FAILED:`, msg);
                  taskIds.push({ error: msg });
                  continue;
                }
                const copyXml = await copyRes.text();
                const copyParsed = jsonifyChiliResponse(copyXml);
                docIdForPdf = copyParsed.id;
                console.log(`[start-output] Copy ${i + 1} created with ID: ${docIdForPdf}`);
              } catch (copyErr) {
                const msg = copyErr.message || String(copyErr);
                console.log(`[start-output] Copy ${i + 1} EXCEPTION:`, msg);
                taskIds.push({ error: msg });
                continue;
              }
            }

            // Apply datasource if provided
            if (datasourceXML) {
              console.log(`[start-output] Applying datasource to document ${docIdForPdf}...`);
              const dsResult = await documentSetDatasource(docIdForPdf, datasourceXML, apiKey, url);
              if (!dsResult.isOK) {
                const msg = dsResult.error?.message || String(dsResult.error);
                console.log(`[start-output] Set datasource ${i + 1} FAILED:`, msg);
                taskIds.push({ error: `Datasource failed: ${msg}` });
                continue;
              }
              console.log(`[start-output] Datasource applied to ${docIdForPdf}`);
            }

            console.log(`[start-output] Creating PDF output ${i + 1}/${count}...`);
            const result = await documentCreatePDF(docIdForPdf, settingsResult.response, apiKey, url);
            if (result.isOK) {
              console.log(`[start-output] Task ${i + 1} created: ${result.response}`);
              taskIds.push(result.response);
            } else {
              const msg = result.error?.message || String(result.error);
              console.log(`[start-output] Task ${i + 1} FAILED:`, msg);
              taskIds.push({ error: msg });
            }
          }

          // Save to history (skip for subsequent batch calls)
          let timestamp = Date.now();
          if (!skipHistory) {
            try {
              const history = await loadHistory();
              const entries = history[backofficeUrl] || [];
              entries.unshift({
                documentId,
                pdfExportSettingsId,
                count,
                timestamp,
                ...(datasourceGuid ? { datasourceGuid } : {}),
                ...(dataSourceID ? { dataSourceID } : {}),
                ...(datasourceFileName ? { datasourceFileName } : {}),
                ...(batches > 1 ? { batches, asyncBatches } : {}),
                ...(copyToFolder ? { copyToFolder } : {}),
                batchTaskIds: [taskIds],
              });
              history[backofficeUrl] = entries.slice(0, 50);
              await saveHistory(history);
            } catch (histErr) {
              console.log("[start-output] Failed to save history:", histErr);
            }
          }

          return Response.json({ isOK: true, taskIds, timestamp });
        } catch (e) {
          console.log("[start-output] EXCEPTION:", e);
          return Response.json({ isOK: false, error: e.message }, { status: 500 });
        }
      },
    },

    "/api/task-status": {
      POST: async (req) => {
        try {
          const { taskId, apiKey, backofficeUrl } = await req.json();
          const url = getApiUrl(backofficeUrl);
          const result = await taskGetStatus(taskId, apiKey, url);
          if (!result.isOK) {
            return Response.json({ isOK: false, error: result.error?.message || String(result.error) });
          }
          return Response.json({ isOK: true, ...result.response });
        } catch (e) {
          return Response.json({ isOK: false, error: e.message }, { status: 500 });
        }
      },
    },

    "/api/task-xml": {
      POST: async (req) => {
        try {
          const { taskId, apiKey, backofficeUrl } = await req.json();
          const url = getApiUrl(backofficeUrl);
          const response = await fetch(url + `/system/tasks/${taskId}/status`, {
            method: "GET",
            headers: { "api-key": apiKey },
          });
          const xml = await response.text();
          return new Response(xml, {
            headers: {
              "Content-Type": "application/xml",
              "Content-Disposition": `attachment; filename="task-${taskId}.xml"`,
            },
          });
        } catch (e) {
          return Response.json({ error: e.message }, { status: 500 });
        }
      },
    },

    "/api/update-run-tasks": {
      POST: async (req) => {
        try {
          const { backofficeUrl, timestamp, batchIndex, taskIds } = await req.json();
          const history = await loadHistory();
          const entries = history[backofficeUrl] || [];
          const entry = entries.find((e) => e.timestamp === timestamp);
          if (!entry) {
            return Response.json({ isOK: false, error: "History entry not found" });
          }
          if (!entry.batchTaskIds) entry.batchTaskIds = [];
          entry.batchTaskIds[batchIndex] = taskIds;
          await saveHistory(history);
          return Response.json({ isOK: true });
        } catch (e) {
          console.log("[update-run-tasks] EXCEPTION:", e);
          return Response.json({ isOK: false, error: e.message }, { status: 500 });
        }
      },
    },
  },
  development: {
    hmr: true,
    console: true,
  },
});

console.log("Server running on http://localhost:3000");
