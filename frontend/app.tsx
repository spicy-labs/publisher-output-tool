import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

interface Session {
  apiKey: string;
  backofficeUrl: string;
}

interface TaskState {
  taskId: string;
  finished: boolean;
  succeeded: boolean | null;
  result: string;
  url: string;
  errorMessage: string;
  creationError: boolean;
  startTime: number;
  processingTime: number | null;
  totalTime: number | null;
}

interface OutputConfig {
  documentId: string;
  pdfExportSettingsId: string;
  count: number;
  copyToFolder?: string;
  datasourceGuid?: string;
}

interface ProgressConfig {
  batchTaskIds: (string | { error: string })[][];
  totalBatchCount: number;
  isAsync: boolean;
  outputConfig?: OutputConfig;
  historyTimestamp?: number;
  resumeMode?: boolean;
}

interface BatchViewState {
  batchIndex: number;
  status: "waiting" | "starting" | "running" | "completed";
  taskStates: TaskState[];
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 120) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

function ElapsedTime({ startTime }: { startTime: number }) {
  const [elapsed, setElapsed] = useState(Date.now() - startTime);
  useEffect(() => {
    const id = setInterval(() => setElapsed(Date.now() - startTime), 1000);
    return () => clearInterval(id);
  }, [startTime]);
  return <span className="task-time">{formatDuration(elapsed)}</span>;
}

function createTaskState(id: string | { error: string }, index: number): TaskState {
  if (typeof id === "string") {
    return {
      taskId: id,
      finished: false,
      succeeded: null,
      result: "",
      url: "",
      errorMessage: "",
      creationError: false,
      startTime: Date.now(),
      processingTime: null,
      totalTime: null,
    };
  }
  return {
    taskId: `creation-error-${index}`,
    finished: true,
    succeeded: false,
    result: "",
    url: "",
    errorMessage: id.error,
    creationError: true,
    startTime: Date.now(),
    processingTime: null,
    totalTime: null,
  };
}

const COOKIE_MAX_AGE = 3 * 60 * 60; // 3 hours in seconds

function saveSessionCookie(session: Session) {
  const value = encodeURIComponent(JSON.stringify(session));
  document.cookie = `session=${value}; max-age=${COOKIE_MAX_AGE}; path=/; SameSite=Lax`;
}

function loadSessionCookie(): Session | null {
  const match = document.cookie.match(/(?:^|; )session=([^;]*)/);
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
}

function clearSessionCookie() {
  document.cookie = "session=; max-age=0; path=/; SameSite=Lax";
}

// --- Login View ---

function LoginView({ onLogin }: { onLogin: (s: Session) => void }) {
  const [tab, setTab] = useState<"user" | "apikey">("user");
  const [backofficeUrl, setBackofficeUrl] = useState("");
  const [environment, setEnvironment] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (tab === "apikey") {
      onLogin({ apiKey, backofficeUrl });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/generate-api-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, environment, backofficeUrl }),
      });
      const data = await res.json();
      if (data.isOK) {
        onLogin({ apiKey: data.apiKey, backofficeUrl });
      } else {
        setError(data.error || "Login failed");
      }
    } catch (e: any) {
      setError(e.message || "Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h1>Publisher Output Tool</h1>
      <div className="tabs">
        <button className={tab === "user" ? "active" : ""} onClick={() => setTab("user")}>
          User Login
        </button>
        <button className={tab === "apikey" ? "active" : ""} onClick={() => setTab("apikey")}>
          API Key
        </button>
      </div>
      <form onSubmit={handleSubmit}>
        <label>Backoffice URL</label>
        <input
          value={backofficeUrl}
          onChange={(e) => setBackofficeUrl(e.target.value)}
          placeholder="https://example.chili-publish.online/interface.aspx"
          required
        />

        {tab === "user" ? (
          <>
            <label>Environment</label>
            <input
              value={environment}
              onChange={(e) => setEnvironment(e.target.value)}
              placeholder="Environment name"
              required
            />
            <label>Username</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} required />
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </>
        ) : (
          <>
            <label>API Key</label>
            <input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste your API key"
              required
            />
          </>
        )}

        {error && <div className="error">{error}</div>}
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Generating API Key..." : tab === "user" ? "Login" : "Continue"}
        </button>
      </form>
    </div>
  );
}

// --- Folder Browser Modal ---

interface FolderItem {
  name: string;
  path: string;
  hasSubDirectories: boolean;
}

function FolderBrowserModal({
  session,
  onSelect,
  onCancel,
}: {
  session: Session;
  onSelect: (folderPath: string) => void;
  onCancel: () => void;
}) {
  const [currentPath, setCurrentPath] = useState("");
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  const breadcrumbs = currentPath
    ? currentPath.split("\\").filter(Boolean)
    : [];

  async function fetchFolders(parentFolder: string) {
    setLoading(true);
    setError("");
    setSelectedFolder(null);
    try {
      const res = await fetch("/api/folder-tree", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentFolder,
          apiKey: session.apiKey,
          backofficeUrl: session.backofficeUrl,
        }),
      });
      const data = await res.json();
      if (data.isOK) {
        setFolders(data.items);
        setCurrentPath(parentFolder);
      } else {
        setError(data.error || "Failed to load folders");
      }
    } catch (e: any) {
      setError(e.message || "Network error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchFolders("");
  }, []);

  function navigateToFolder(folderPath: string) {
    fetchFolders(folderPath);
  }

  function navigateToBreadcrumb(index: number) {
    if (index < 0) {
      fetchFolders("");
    } else {
      const path = breadcrumbs.slice(0, index + 1).join("\\");
      fetchFolders(path);
    }
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Select Folder</h2>
        <div className="breadcrumbs">
          <span
            className={breadcrumbs.length > 0 ? "breadcrumb-link" : "breadcrumb-current"}
            onClick={() => breadcrumbs.length > 0 && navigateToBreadcrumb(-1)}
          >
            Root
          </span>
          {breadcrumbs.map((segment, i) => (
            <React.Fragment key={i}>
              <span className="breadcrumb-separator">/</span>
              <span
                className={i < breadcrumbs.length - 1 ? "breadcrumb-link" : "breadcrumb-current"}
                onClick={() => i < breadcrumbs.length - 1 && navigateToBreadcrumb(i)}
              >
                {segment}
              </span>
            </React.Fragment>
          ))}
        </div>
        {error && <div className="error">{error}</div>}
        {loading ? (
          <div className="folder-list-loading">
            <span className="spinner" />
          </div>
        ) : (
          <div className="folder-list">
            {folders.length === 0 && <div className="folder-empty">No subfolders</div>}
            {folders.map((folder) => (
              <div
                key={folder.path}
                className={`folder-item${selectedFolder === folder.path ? " folder-selected" : ""}${selectedFolder && selectedFolder !== folder.path ? " folder-dimmed" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={selectedFolder === folder.path}
                  onChange={() =>
                    setSelectedFolder(selectedFolder === folder.path ? null : folder.path)
                  }
                />
                <span
                  className={folder.hasSubDirectories ? "folder-navigable" : "folder-name"}
                  onClick={() =>
                    folder.hasSubDirectories && navigateToFolder(folder.path)
                  }
                >
                  {folder.name}
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          {selectedFolder && (
            <button
              className="btn btn-primary"
              onClick={() => onSelect(selectedFolder)}
            >
              Select
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Processing Modal ---

function ProcessingModal({ message }: { message: string }) {
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="processing-modal">
          <span className="spinner" />
          <p>{message}</p>
        </div>
      </div>
    </div>
  );
}

// --- History Sidebar ---

interface HistoryEntry {
  documentId: string;
  pdfExportSettingsId: string;
  count: number;
  timestamp: number;
  datasourceGuid?: string;
  dataSourceID?: string;
  datasourceFileName?: string;
  batches?: number;
  asyncBatches?: boolean;
  copyToFolder?: string;
  batchTaskIds?: (string | { error: string })[][];
}

function HistorySidebar({
  session,
  onSelect,
  onResume,
}: {
  session: Session;
  onSelect: (entry: HistoryEntry) => void;
  onResume: (entry: HistoryEntry) => void;
}) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ backofficeUrl: session.backofficeUrl }),
        });
        const data = await res.json();
        if (data.isOK) setEntries(data.entries);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, [session.backofficeUrl]);

  return (
    <div className="history-sidebar">
      <h2>Previous Outputs</h2>
      {loading ? (
        <div style={{ textAlign: "center", padding: "16px" }}>
          <span className="spinner" />
        </div>
      ) : entries.length === 0 ? (
        <div className="history-empty">No previous outputs</div>
      ) : (
        entries.map((entry, i) => (
          <div key={i} className="history-card" onClick={() => onSelect(entry)}>
            {entry.batchTaskIds && entry.batchTaskIds.length > 0 && (
              <button
                className="history-card-resume"
                title="View progress"
                onClick={(e) => {
                  e.stopPropagation();
                  onResume(entry);
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              </button>
            )}
            <div className="history-card-field">doc: {entry.documentId}</div>
            <div className="history-card-field">settings: {entry.pdfExportSettingsId}</div>
            <div className="history-card-field">count: {entry.count}</div>
            {entry.batches && entry.batches > 1 && (
              <div className="history-card-field">batches: {entry.batches}{entry.asyncBatches ? " (async)" : ""}</div>
            )}
            {entry.copyToFolder && (
              <div className="history-card-field">copy: {entry.copyToFolder}</div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

// --- Config View ---

function ConfigView({
  session,
  onStart,
  onBack,
  onResume,
}: {
  session: Session;
  onStart: (config: ProgressConfig) => void;
  onBack: () => void;
  onResume: (config: ProgressConfig) => void;
}) {
  const [documentId, setDocumentId] = useState("");
  const [settingsId, setSettingsId] = useState("");
  const [count, setCount] = useState(1);
  const [batches, setBatches] = useState(1);
  const [asyncBatches, setAsyncBatches] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copyBeforeOutput, setCopyBeforeOutput] = useState(false);
  const [copyToFolder, setCopyToFolder] = useState<string | null>(null);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [datasourceStatus, setDatasourceStatus] = useState<
    "idle" | "checking" | "no-datasource" | "no-id" | "ready" | "uploading" | "uploaded"
  >("idle");
  const [datasourceError, setDatasourceError] = useState("");
  const [dataSourceID, setDataSourceID] = useState<string | null>(null);
  const [datasourceGuid, setDatasourceGuid] = useState<string | null>(null);
  const [datasourceFileName, setDatasourceFileName] = useState<string | null>(null);
  const skipDatasourceResetRef = React.useRef(false);

  useEffect(() => {
    if (skipDatasourceResetRef.current) {
      skipDatasourceResetRef.current = false;
      return;
    }
    setDatasourceStatus("idle");
    setDatasourceError("");
    setDataSourceID(null);
    setDatasourceGuid(null);
    setDatasourceFileName(null);
  }, [documentId]);

  useEffect(() => {
    if (count <= 1) {
      setBatches(1);
      setAsyncBatches(false);
    }
  }, [count]);

  async function handleCheckDatasource() {
    if (!documentId) {
      setDatasourceError("Please enter a Document ID first");
      return;
    }
    setDatasourceStatus("checking");
    setDatasourceError("");
    try {
      const res = await fetch("/api/check-datasource", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId,
          apiKey: session.apiKey,
          backofficeUrl: session.backofficeUrl,
        }),
      });
      const data = await res.json();
      if (!data.isOK) {
        setDatasourceStatus("no-datasource");
        setDatasourceError(data.error || "Failed to check datasource");
        return;
      }
      if (!data.hasDataSource) {
        setDatasourceStatus("no-datasource");
        setDatasourceError("Document does not have a datasource configured");
        return;
      }
      if (!data.hasDataSourceID) {
        setDatasourceStatus("no-id");
        setDatasourceError("Document has a datasource node but no datasource ID");
        return;
      }
      setDataSourceID(data.dataSourceID);
      setDatasourceStatus("ready");
    } catch (e: any) {
      setDatasourceStatus("no-datasource");
      setDatasourceError(e.message || "Network error");
    }
  }

  async function handleUploadDatasource() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setDatasourceStatus("uploading");
      setDatasourceError("");
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("apiKey", session.apiKey);
        formData.append("backofficeUrl", session.backofficeUrl);
        formData.append("dataSourceID", dataSourceID!);
        const res = await fetch("/api/upload-datasource", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (data.isOK) {
          setDatasourceGuid(data.guid);
          setDatasourceFileName(file.name);
          setDatasourceStatus("uploaded");
        } else {
          setDatasourceStatus("ready");
          setDatasourceError(data.error || "Upload failed");
        }
      } catch (e: any) {
        setDatasourceStatus("ready");
        setDatasourceError(e.message || "Network error");
      }
    };
    input.click();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (copyBeforeOutput && !copyToFolder) {
      setError("Please select a folder for document copies");
      return;
    }
    setError("");
    setLoading(true);

    const outputConfig: OutputConfig = {
      documentId,
      pdfExportSettingsId: settingsId,
      count,
      ...(copyBeforeOutput && copyToFolder ? { copyToFolder } : {}),
      ...(datasourceGuid ? { datasourceGuid } : {}),
    };

    const requestBody = {
      ...outputConfig,
      apiKey: session.apiKey,
      backofficeUrl: session.backofficeUrl,
      ...(batches > 1 ? { batches, asyncBatches } : {}),
      ...(dataSourceID ? { dataSourceID } : {}),
      ...(datasourceFileName ? { datasourceFileName } : {}),
    };

    try {
      if (batches <= 1 || !asyncBatches) {
        // Single batch or sync mode: start only the first batch
        const res = await fetch("/api/start-output", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });
        const data = await res.json();
        if (!data.isOK) {
          setError(data.error || "Failed to start output");
          return;
        }
        onStart({
          batchTaskIds: [data.taskIds],
          totalBatchCount: batches,
          isAsync: false,
          outputConfig,
          historyTimestamp: data.timestamp,
        });
      } else {
        // Async mode: start all batches in parallel
        const promises = Array.from({ length: batches }, (_, i) =>
          fetch("/api/start-output", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...requestBody, skipHistory: i > 0 }),
          }).then((r) => r.json()),
        );
        const results = await Promise.all(promises);
        const failed = results.find((r) => !r.isOK);
        if (failed) {
          setError(failed.error || "Failed to start output");
          return;
        }
        const historyTimestamp = results[0].timestamp;
        // Persist task IDs for batches 1+ to the history entry
        for (let i = 1; i < results.length; i++) {
          fetch("/api/update-run-tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              backofficeUrl: session.backofficeUrl,
              timestamp: historyTimestamp,
              batchIndex: i,
              taskIds: results[i].taskIds,
            }),
          }).catch(() => {});
        }
        onStart({
          batchTaskIds: results.map((r) => r.taskIds),
          totalBatchCount: batches,
          isAsync: true,
          outputConfig,
          historyTimestamp,
        });
      }
    } catch (e: any) {
      setError(e.message || "Network error");
    } finally {
      setLoading(false);
    }
  }

  async function handleHistorySelect(entry: HistoryEntry) {
    if (entry.datasourceGuid) {
      skipDatasourceResetRef.current = true;
    }
    setDocumentId(entry.documentId);
    setSettingsId(entry.pdfExportSettingsId);
    setCount(entry.count);
    if (entry.batches && entry.batches > 1) {
      setBatches(entry.batches);
      setAsyncBatches(entry.asyncBatches || false);
    } else {
      setBatches(1);
      setAsyncBatches(false);
    }
    if (entry.copyToFolder) {
      setCopyBeforeOutput(true);
      setCopyToFolder(entry.copyToFolder);
    } else {
      setCopyBeforeOutput(false);
      setCopyToFolder(null);
    }
    if (entry.datasourceGuid) {
      const res = await fetch("/api/check-datasource-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datasourceGuid: entry.datasourceGuid }),
      });
      const check = await res.json();
      if (check.isOK && check.exists) {
        setDatasourceGuid(entry.datasourceGuid);
        setDataSourceID(entry.dataSourceID || null);
        setDatasourceStatus("uploaded");
        setDatasourceFileName(entry.datasourceFileName || "(from history)");
      } else {
        setDatasourceGuid(null);
        setDataSourceID(null);
        setDatasourceStatus("idle");
        setDatasourceFileName(null);
      }
    } else {
      setDatasourceGuid(null);
      setDataSourceID(null);
      setDatasourceStatus("idle");
      setDatasourceFileName(null);
    }
  }

  return (
    <div className="config-layout">
      <HistorySidebar
        session={session}
        onSelect={handleHistorySelect}
        onResume={(entry) => onResume({
          batchTaskIds: entry.batchTaskIds || [],
          totalBatchCount: entry.batches || 1,
          isAsync: entry.asyncBatches || false,
          resumeMode: true,
        })}
      />
      <div className="card">
        <h1>Output Configuration</h1>
        <form onSubmit={handleSubmit}>
          <label>Document ID</label>
          <input value={documentId} onChange={(e) => setDocumentId(e.target.value)} required />
          <label>PDF Export Settings ID</label>
          <input value={settingsId} onChange={(e) => setSettingsId(e.target.value)} required />
          <label>Number of Outputs</label>
          <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
            {Array.from({ length: 25 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>

          {count > 1 && (
            <>
              <label>Number of Batches</label>
              <div className="batch-config-row">
                <select value={batches} onChange={(e) => setBatches(Number(e.target.value))}>
                  {Array.from({ length: 5 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1}
                    </option>
                  ))}
                </select>
                {batches > 1 && (
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={asyncBatches}
                      onChange={(e) => setAsyncBatches(e.target.checked)}
                    />
                    Async
                  </label>
                )}
              </div>
            </>
          )}

          <div className="copy-section">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={copyBeforeOutput}
                onChange={(e) => {
                  setCopyBeforeOutput(e.target.checked);
                  if (!e.target.checked) setCopyToFolder(null);
                }}
              />
              Copy Before Output
            </label>
            {copyBeforeOutput && (
              <>
                <button
                  type="button"
                  className={`btn ${copyToFolder ? "btn-folder" : "btn-folder-unset"}`}
                  onClick={() => setShowFolderModal(true)}
                >
                  {copyToFolder ? "Change Folder" : "Select Folder"}
                </button>
                {copyToFolder && <div className="folder-path">{copyToFolder}</div>}
              </>
            )}
          </div>

          <div className="datasource-section">
            {datasourceStatus === "idle" && (
              <button type="button" className="btn btn-datasource" onClick={handleCheckDatasource}>
                Add Datasource
              </button>
            )}
            {(datasourceStatus === "no-datasource") && (
              <>
                <button type="button" className="btn btn-datasource" onClick={handleCheckDatasource}>
                  Add Datasource
                </button>
                {datasourceError && <div className="datasource-error">{datasourceError}</div>}
              </>
            )}
            {datasourceStatus === "no-id" && (
              <>
                <button type="button" className="btn btn-datasource" disabled>
                  Add Datasource
                </button>
                {datasourceError && <div className="datasource-error">{datasourceError}</div>}
              </>
            )}
            {datasourceStatus === "ready" && (
              <>
                <div className="datasource-info">Datasource ID: {dataSourceID}</div>
                <button type="button" className="btn btn-datasource-upload" onClick={handleUploadDatasource}>
                  Upload Datasource
                </button>
                {datasourceError && <div className="datasource-error">{datasourceError}</div>}
              </>
            )}
            {datasourceStatus === "uploaded" && (
              <>
                <div className="datasource-success">
                  Datasource uploaded: {datasourceFileName}
                </div>
                <button type="button" className="btn btn-datasource-change" onClick={handleUploadDatasource}>
                  Change Datasource
                </button>
              </>
            )}
          </div>

          {(datasourceStatus === "checking" || datasourceStatus === "uploading") && (
            <ProcessingModal message="Processing..." />
          )}

          {error && <div className="error">{error}</div>}
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Creating outputs..." : "Start Output"}
          </button>
        </form>
        <button className="btn btn-secondary" onClick={onBack} style={{ width: "100%" }}>
          Back to Login
        </button>
        <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ flex: 1 }}
            onClick={() => {
              const data: HistoryEntry = {
                documentId,
                pdfExportSettingsId: settingsId,
                count,
                timestamp: Date.now(),
                ...(datasourceGuid ? { datasourceGuid } : {}),
                ...(dataSourceID ? { dataSourceID } : {}),
                ...(datasourceFileName ? { datasourceFileName } : {}),
                ...(batches > 1 ? { batches, asyncBatches } : {}),
                ...(copyBeforeOutput && copyToFolder ? { copyToFolder } : {}),
              };
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "output-config.json";
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Export
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ flex: 1 }}
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = ".json";
              input.onchange = async () => {
                const file = input.files?.[0];
                if (!file) return;
                try {
                  const text = await file.text();
                  const data = JSON.parse(text) as HistoryEntry;
                  if (data.documentId) setDocumentId(data.documentId);
                  if (data.pdfExportSettingsId) setSettingsId(data.pdfExportSettingsId);
                  if (data.count) setCount(data.count);
                  if (data.batches && data.batches > 1) {
                    setBatches(data.batches);
                    setAsyncBatches(data.asyncBatches || false);
                  } else {
                    setBatches(1);
                    setAsyncBatches(false);
                  }
                  if (data.copyToFolder) {
                    setCopyBeforeOutput(true);
                    setCopyToFolder(data.copyToFolder);
                  } else {
                    setCopyBeforeOutput(false);
                    setCopyToFolder(null);
                  }
                  if (data.datasourceGuid) {
                    const res = await fetch("/api/check-datasource-file", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ datasourceGuid: data.datasourceGuid }),
                    });
                    const check = await res.json();
                    if (check.isOK && check.exists) {
                      skipDatasourceResetRef.current = true;
                      setDatasourceGuid(data.datasourceGuid);
                      setDataSourceID(data.dataSourceID || null);
                      setDatasourceStatus("uploaded");
                      setDatasourceFileName(data.datasourceFileName || "(from import)");
                    }
                  }
                } catch {
                  setError("Invalid JSON file");
                }
              };
              input.click();
            }}
          >
            Import
          </button>
        </div>
        {showFolderModal && (
          <FolderBrowserModal
            session={session}
            onSelect={(path) => {
              setCopyToFolder(path);
              setShowFolderModal(false);
            }}
            onCancel={() => setShowFolderModal(false)}
          />
        )}
      </div>
    </div>
  );
}

// --- Progress View ---

function ProgressView({
  progressConfig,
  session,
  onNewOutput,
}: {
  progressConfig: ProgressConfig;
  session: Session;
  onNewOutput: () => void;
}) {
  const { batchTaskIds: initialBatchTaskIds, totalBatchCount, isAsync, outputConfig, resumeMode } = progressConfig;
  const singleBatch = totalBatchCount === 1;

  const [batches, setBatches] = useState<BatchViewState[]>(() =>
    Array.from({ length: totalBatchCount }, (_, i) => {
      const taskIds = initialBatchTaskIds[i];
      if (taskIds) {
        return {
          batchIndex: i,
          status: "running" as const,
          taskStates: taskIds.map((id, j) => createTaskState(id, j)),
        };
      }
      return {
        batchIndex: i,
        status: "waiting" as const,
        taskStates: [],
      };
    }),
  );

  useEffect(() => {
    let stopped = false;

    // Internal tracking for polling (independent of React state)
    const activeBatches = new Map<number, { taskIds: string[]; finished: Set<string> }>();
    const completedBatches = new Set<number>();

    // Initialize from provided batch data
    for (let i = 0; i < totalBatchCount; i++) {
      const taskIds = initialBatchTaskIds[i];
      if (taskIds) {
        const pollableIds = taskIds.filter((id): id is string => typeof id === "string");
        if (pollableIds.length === 0) {
          // All creation errors - batch is immediately complete
          completedBatches.add(i);
          setBatches((prev) =>
            prev.map((b) => (b.batchIndex === i ? { ...b, status: "completed" } : b)),
          );
        } else {
          activeBatches.set(i, { taskIds: pollableIds, finished: new Set() });
        }
      }
    }

    // If sync mode and first batch is already complete (all creation errors), start next
    if (!resumeMode && !isAsync && completedBatches.has(0) && totalBatchCount > 1) {
      startBatch(1);
    }

    async function startBatch(batchIndex: number) {
      if (stopped) return;

      setBatches((prev) =>
        prev.map((b) => (b.batchIndex === batchIndex ? { ...b, status: "starting" } : b)),
      );

      try {
        const res = await fetch("/api/start-output", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...outputConfig,
            apiKey: session.apiKey,
            backofficeUrl: session.backofficeUrl,
            skipHistory: true,
          }),
        });
        const data = await res.json();

        if (data.isOK) {
          const newTaskStates = data.taskIds.map(
            (id: string | { error: string }, j: number) => createTaskState(id, j),
          );
          const pollableIds = data.taskIds.filter(
            (id: any): id is string => typeof id === "string",
          );

          // Persist task IDs for sync-mode subsequent batches
          if (progressConfig.historyTimestamp && batchIndex > 0) {
            fetch("/api/update-run-tasks", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                backofficeUrl: session.backofficeUrl,
                timestamp: progressConfig.historyTimestamp,
                batchIndex,
                taskIds: data.taskIds,
              }),
            }).catch(() => {});
          }

          if (pollableIds.length === 0) {
            completedBatches.add(batchIndex);
            setBatches((prev) =>
              prev.map((b) =>
                b.batchIndex === batchIndex
                  ? { ...b, status: "completed", taskStates: newTaskStates }
                  : b,
              ),
            );
            if (!isAsync && batchIndex + 1 < totalBatchCount) {
              await startBatch(batchIndex + 1);
            }
          } else {
            activeBatches.set(batchIndex, { taskIds: pollableIds, finished: new Set() });
            setBatches((prev) =>
              prev.map((b) =>
                b.batchIndex === batchIndex
                  ? { ...b, status: "running", taskStates: newTaskStates }
                  : b,
              ),
            );
          }
        } else {
          completedBatches.add(batchIndex);
          setBatches((prev) =>
            prev.map((b) =>
              b.batchIndex === batchIndex
                ? {
                    ...b,
                    status: "completed",
                    taskStates: [
                      createTaskState({ error: data.error || "Failed to start batch" }, 0),
                    ],
                  }
                : b,
            ),
          );
          if (!isAsync && batchIndex + 1 < totalBatchCount) {
            await startBatch(batchIndex + 1);
          }
        }
      } catch (e: any) {
        completedBatches.add(batchIndex);
        setBatches((prev) =>
          prev.map((b) =>
            b.batchIndex === batchIndex
              ? {
                  ...b,
                  status: "completed",
                  taskStates: [
                    createTaskState({ error: e.message || "Network error" }, 0),
                  ],
                }
              : b,
          ),
        );
        if (!isAsync && batchIndex + 1 < totalBatchCount) {
          await startBatch(batchIndex + 1);
        }
      }
    }

    async function pollOnce() {
      for (const [batchIndex, batch] of activeBatches) {
        if (completedBatches.has(batchIndex) || stopped) continue;

        const pending = batch.taskIds.filter((id) => !batch.finished.has(id));
        if (pending.length === 0) continue;

        await Promise.allSettled(
          pending.map(async (taskId) => {
            const res = await fetch("/api/task-status", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                taskId,
                apiKey: session.apiKey,
                backofficeUrl: session.backofficeUrl,
              }),
            });
            const data = await res.json();
            if (data.finished === "True") {
              batch.finished.add(taskId);
              setBatches((prev) =>
                prev.map((b) => {
                  if (b.batchIndex !== batchIndex) return b;
                  return {
                    ...b,
                    taskStates: b.taskStates.map((t) =>
                      t.taskId === taskId
                        ? {
                            ...t,
                            finished: true,
                            succeeded: data.succeeded === "True",
                            result: data.result || "",
                            url: data.url || "",
                            errorMessage: data.errorMessage || "",
                            processingTime: data.processingTime
                              ? Number(data.processingTime)
                              : null,
                            totalTime: data.totalTime ? Number(data.totalTime) : null,
                          }
                        : t,
                    ),
                  };
                }),
              );
            }
          }),
        );

        // Check if this batch is now complete
        if (batch.taskIds.every((id) => batch.finished.has(id))) {
          completedBatches.add(batchIndex);
          setBatches((prev) =>
            prev.map((b) =>
              b.batchIndex === batchIndex ? { ...b, status: "completed" } : b,
            ),
          );

          // Sync mode: start next batch (skip in resume mode)
          if (
            !resumeMode &&
            !isAsync &&
            batchIndex + 1 < totalBatchCount &&
            !activeBatches.has(batchIndex + 1) &&
            !completedBatches.has(batchIndex + 1)
          ) {
            await startBatch(batchIndex + 1);
          }
        }
      }
    }

    async function mainLoop() {
      while (!stopped) {
        await pollOnce();
        // Stop when all active batches are complete (remaining may be unstarted in resume mode)
        if (activeBatches.size === 0 || completedBatches.size >= totalBatchCount) break;
        const allActiveDone = [...activeBatches.keys()].every((i) => completedBatches.has(i));
        if (allActiveDone) break;
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    mainLoop();
    return () => {
      stopped = true;
    };
  }, []);

  async function downloadXml(taskId: string) {
    const res = await fetch("/api/task-xml", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId,
        apiKey: session.apiKey,
        backofficeUrl: session.backofficeUrl,
      }),
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `task-${taskId}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function renderTaskItem(task: TaskState, index: number) {
    return (
      <div key={task.taskId} className="task-item">
        <div className="task-header">
          <span className="task-number">#{index + 1}</span>
          <span className="task-id">
            {task.creationError ? "Failed to create task" : task.taskId}
          </span>
          <span className="task-status">
            {!task.finished ? (
              <span className="spinner" />
            ) : task.succeeded ? (
              <span className="success">&#10003;</span>
            ) : (
              <span className="failure">&#10007;</span>
            )}
          </span>
          {!task.finished && !task.creationError ? (
            <ElapsedTime startTime={task.startTime} />
          ) : task.finished && task.totalTime != null ? (
            <span
              className="task-time"
              title={
                task.processingTime != null
                  ? `Processing: ${formatDuration(task.processingTime)} | Total: ${formatDuration(task.totalTime)}`
                  : `Total: ${formatDuration(task.totalTime)}`
              }
            >
              {formatDuration(task.totalTime)}
            </span>
          ) : null}
        </div>
        {task.finished && (
          <div className="task-actions">
            {task.succeeded && task.url && (
              <a
                href={task.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-download"
              >
                Download PDF
              </a>
            )}
            {!task.creationError && (
              <button onClick={() => downloadXml(task.taskId)} className="btn btn-xml">
                Download Task XML
              </button>
            )}
            {task.errorMessage && <div className="error-msg">{task.errorMessage}</div>}
          </div>
        )}
      </div>
    );
  }

  const allDone = batches.every((b) => b.status === "completed" || (b.status === "waiting" && b.taskStates.length === 0));

  // Single batch: render like the original ProgressView
  if (singleBatch) {
    const batch = batches[0];
    return (
      <div className="card">
        <h1>Output Progress</h1>
        <div className="task-list">
          {batch.taskStates.map((task, i) => renderTaskItem(task, i))}
        </div>
        {allDone && (
          <button className="btn btn-secondary" onClick={onNewOutput} style={{ width: "100%" }}>
            New Output
          </button>
        )}
      </div>
    );
  }

  // Multi-batch: render responsive grid
  return (
    <div className="progress-layout">
      <h1>Output Progress</h1>
      <div className="batch-grid">
        {batches.map((batch) => (
          <div key={batch.batchIndex} className="batch-card">
            <div className="batch-card-header">Batch #{batch.batchIndex + 1}</div>
            {batch.status === "waiting" ? (
              <div className="batch-waiting">{resumeMode ? "Not started" : `Waiting for #${batch.batchIndex}`}</div>
            ) : batch.status === "starting" ? (
              <div className="batch-starting">
                <span className="spinner" />
                <span>Starting...</span>
              </div>
            ) : (
              <div className="task-list">
                {batch.taskStates.map((task, i) => renderTaskItem(task, i))}
              </div>
            )}
          </div>
        ))}
      </div>
      {allDone && (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <button className="btn btn-secondary" onClick={onNewOutput} style={{ minWidth: 200 }}>
            New Output
          </button>
        </div>
      )}
    </div>
  );
}

// --- App ---

function App() {
  const [session, setSession] = useState<Session | null>(loadSessionCookie);
  const [view, setView] = useState<"login" | "config" | "progress">(session ? "config" : "login");
  const [progressConfig, setProgressConfig] = useState<ProgressConfig | null>(null);

  function handleLogin(s: Session) {
    setSession(s);
    saveSessionCookie(s);
    setView("config");
  }

  function handleLogout() {
    setSession(null);
    clearSessionCookie();
    setView("login");
  }

  if (view === "login" || !session) {
    return <LoginView onLogin={handleLogin} />;
  }

  if (view === "config") {
    return (
      <ConfigView
        session={session}
        onStart={(config) => {
          setProgressConfig(config);
          setView("progress");
        }}
        onBack={handleLogout}
        onResume={(config) => {
          setProgressConfig(config);
          setView("progress");
        }}
      />
    );
  }

  return (
    <ProgressView
      key={JSON.stringify(progressConfig)}
      progressConfig={progressConfig!}
      session={session}
      onNewOutput={() => setView("config")}
    />
  );
}

createRoot(document.getElementById("root")!).render(<App />);
