import { FileSpreadsheet, FileUp, LoaderCircle, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ModalDialog } from "../components/common/ModalDialog";
import { HelpTip } from "../components/forms";
import { PageHeader } from "../components/layout/PageHeader";
import { useWorkflow } from "../features/files/WorkflowContext";
import { checkBackendHealth } from "../services/apiClient";
import { uploadFiles } from "../services/fileApi";
import { addSessionFile, createSessionDraft, deleteSessionFile, listRecentSessions } from "../services/validationApi";
import type { UploadedFile } from "../types/file.types";
import { isSupportedFileName } from "../utils/validators";

const DEFAULT_SESSION_NAME = "New session";
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const removeButtonClass = "grid size-8 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600";

function isPlaceholderSessionName(name: string) {
  return !name.trim() || /^New session( \(\d+\))?$/.test(name.trim());
}

/** "supplier_quote.xlsx" -> "supplier quote - Nov 20, 2026" so sessions are distinguishable. */
function sessionNameFromFile(fileName: string) {
  const base = fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  const date = new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return `${base || DEFAULT_SESSION_NAME} - ${date}`.slice(0, 160);
}
const requiredBadgeClass = "rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold leading-5 text-amber-700";
const uploadCardClass = "rounded-2xl border border-slate-200 bg-panel p-5 shadow-sm";

function formatFileSize(size: number) {
  if (!size) return "0 KB";
  const kilobytes = size / 1024;
  return kilobytes < 1024 ? `${kilobytes.toFixed(0)} KB` : `${(kilobytes / 1024).toFixed(1)} MB`;
}

function nextSessionName(existingNames: string[]) {
  const names = new Set(existingNames.map((name) => name.trim()).filter(Boolean));
  if (!names.has(DEFAULT_SESSION_NAME)) return DEFAULT_SESSION_NAME;
  let index = 2;
  while (names.has(`${DEFAULT_SESSION_NAME} (${index})`)) index += 1;
  return `${DEFAULT_SESSION_NAME} (${index})`;
}

function mergeUploadedFiles(existingFiles: UploadedFile[], newFiles: UploadedFile[]) {
  const merged = [...existingFiles];
  const seen = new Set(merged.map((file) => file.id).filter(Boolean));
  for (const file of newFiles) {
    if (file.id && !seen.has(file.id)) {
      merged.push(file);
      seen.add(file.id);
    }
  }
  return merged;
}

export function UploadFilesPage() {
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const { sessionId, setSessionId, projectName, setProjectName, files, setFiles, dataSources, setDataSources, removeSourcePreview, rules, setRules, setResult } = useWorkflow();
  const [selected, setSelected] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [fileError, setFileError] = useState("");
  const [sessionNameError, setSessionNameError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<UploadedFile | null>(null);

  useEffect(() => {
    // Suggest a name on arrival only (empty deps); re-running whenever the field was empty made it impossible to clear.
    if (projectName.trim()) return;
    let active = true;
    void listRecentSessions()
      .then((sessions) => {
        if (active) setProjectName(nextSessionName(sessions.map((session) => session.project_name)));
      })
      .catch(() => {
        if (active) setProjectName(DEFAULT_SESSION_NAME);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run on mount only
  }, []);

  const createDraftSession = async (sessionName: string, uploadedFiles: { id: string; name: string }[]) => {
    if (!uploadedFiles.length) return;
    const response = await createSessionDraft({
      project_name: sessionName,
      file_names: uploadedFiles.map((file) => file.name),
      uploaded_file_ids: uploadedFiles.map((file) => file.id),
    });
    window.dispatchEvent(new CustomEvent("sessions:updated"));
    window.dispatchEvent(new CustomEvent("sidebar:view", { detail: { view: "workflow" } }));
    return response;
  };

  const add = (list: File[]) => {
    const supported = list.filter((file) => isSupportedFileName(file.name));
    const valid = supported.filter((file) => file.size > 0 && file.size <= MAX_FILE_BYTES);
    const problems = [];
    if (supported.length !== list.length) problems.push("Only .xlsx, .xls, and .csv files are accepted.");
    if (valid.length !== supported.length) problems.push("Files must be between 1 byte and 50 MB.");
    const room = Math.max(0, 10 - files.length - selected.length);
    if (valid.length > room) problems.push(`Only ${room} more file${room === 1 ? "" : "s"} can be added (10 per session).`);
    setFileError(problems.join(" "));
    setFormError("");
    const firstValid = valid[0];
    if (firstValid && isPlaceholderSessionName(projectName)) setProjectName(sessionNameFromFile(firstValid.name));
    setSelected((current) => {
      const existingKeys = new Set(current.map(fileKey));
      return [...current, ...valid.filter((file) => !existingKeys.has(fileKey(file)))].slice(0, Math.max(0, 10 - files.length));
    });
  };

  // Server first, then local state: a failed delete leaves everything as it was.
  const removeUploadedFile = async (fileId: string) => {
    if (sessionId) {
      try {
        await deleteSessionFile(sessionId, fileId);
        window.dispatchEvent(new CustomEvent("sessions:updated"));
      } catch (cause) {
        setFormError(cause instanceof Error ? cause.message : "Could not remove this file from the saved session.");
        return;
      }
    }
    const affectedSourceIds = dataSources.filter((source) => source.file_id === fileId).map((source) => source.id);
    setFiles((current) => current.filter((file) => file.id !== fileId));
    if (affectedSourceIds.length) {
      setDataSources((current) => current.filter((source) => source.file_id !== fileId));
      affectedSourceIds.forEach((id) => removeSourcePreview(id));
      setRules((current) => current.filter((rule) => !(rule.left_data_source_id && affectedSourceIds.includes(rule.left_data_source_id)) && !(rule.right_data_source_id && affectedSourceIds.includes(rule.right_data_source_id))));
    }
  };

  const affectedByPendingRemoval = pendingRemoval
    ? rules.filter((rule) => dataSources.some((source) => source.file_id === pendingRemoval.id && (rule.left_data_source_id === source.id || rule.right_data_source_id === source.id))).length
    : 0;

  const submit = async () => {
    const hasExistingSessionFiles = files.length > 0;
    const hasOpenSession = Boolean(sessionId);
    setFormError("");
    setFileError("");
    if (!selected.length && !hasExistingSessionFiles && !hasOpenSession) {
      setFileError("Please choose at least one spreadsheet before continuing.");
      return;
    }
    if (!projectName.trim()) {
      setSessionNameError("Please enter a session name before continuing.");
      return;
    }
    setSessionNameError("");

    setBusy(true);
    try {
      await checkBackendHealth();
      if (selected.length) {
        const uploadedSelection = await uploadFiles(selected);
        const existingFileIds = new Set(files.map((file) => file.id));
        const newUploadedFiles = uploadedSelection.filter((file) => file.id && !existingFileIds.has(file.id));
        const nextFiles = mergeUploadedFiles(files, uploadedSelection);
        setFiles(nextFiles);

        if (hasOpenSession) {
          if (newUploadedFiles.length) {
            await Promise.all(newUploadedFiles.map((file) => addSessionFile(sessionId as string, file.id)));
            window.dispatchEvent(new CustomEvent("sessions:updated"));
          }
        } else {
          const created = await createDraftSession(projectName.trim(), nextFiles);
          if (created) setSessionId(created.id);
        }
        setSelected([]);
      }

      if (!hasOpenSession && !sessionId) {
        setDataSources([]);
        setRules([]);
        setResult(null);
      }
      navigate("/mapping");
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Step 1 of 5"
        title="Choose comparison files"
        description="Select the local spreadsheets you want to inspect. Clario keeps the files in the active validation session and leaves the originals unchanged."
      />
      <div className="grid items-start gap-8 pt-8 xl:grid-cols-[320px_minmax(0,1fr)]">
        <section className={`${uploadCardClass} self-start space-y-5`}>
          <div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1">
                <label htmlFor="session-name" className="text-sm font-semibold text-slate-900">Session name</label>
                <HelpTip text="Give this validation session a clear name. It is also used for saved reports." />
              </div>
              <span className={requiredBadgeClass}>Required</span>
            </div>
            <input
              id="session-name"
              placeholder={DEFAULT_SESSION_NAME}
              value={projectName}
              onChange={(event) => {
                setProjectName(event.target.value);
                if (event.target.value.trim()) setSessionNameError("");
              }}
              aria-invalid={sessionNameError ? true : undefined}
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus-visible:border-emerald-600 focus-visible:ring-2 focus-visible:ring-emerald-600/40"
            />
            {sessionNameError && <p className="mt-2 text-xs font-medium text-red-700" role="alert">{sessionNameError}</p>}
          </div>
        </section>

        <section className={`${uploadCardClass} min-w-0 self-start`}>
          <div className="mb-2 flex items-center gap-1 text-sm font-semibold text-slate-700">
            Files to compare
            <HelpTip text="Choose the Excel or CSV files you want to inspect. New files added to an existing session are saved immediately." />
          </div>
          <button
            title="Choose local Excel or CSV files"
            type="button"
            onClick={() => input.current?.click()}
            onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }}
            onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setDragActive(true); }}
            onDragLeave={(event) => { event.preventDefault(); if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragActive(false); }}
            onDrop={(event) => { event.preventDefault(); setDragActive(false); add([...event.dataTransfer.files]); }}
            className={`grid min-h-52 w-full place-items-center rounded-2xl border border-dashed p-8 text-center transition active:scale-[0.99] ${dragActive ? "border-emerald-600 bg-emerald-50 ring-4 ring-emerald-100" : "border-slate-300 bg-panel hover:border-emerald-500 hover:bg-emerald-50/30"}`}
          >
            <span>
              <FileUp className={`mx-auto size-7 text-emerald-700 transition-transform ${dragActive ? "-translate-y-1 scale-110" : ""}`} />
              <span className="mt-3 block font-semibold">{dragActive ? "Release to add files" : "Drop spreadsheets here or browse"}</span>
              <span className="mt-1 block text-sm text-slate-500">Up to 10 files, 50 MB each</span>
            </span>
          </button>
          {fileError && <p className="mt-2 text-xs font-medium text-red-700" role="alert">{fileError}</p>}
          <input
            ref={input}
            hidden
            multiple
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(event) => {
              add([...(event.target.files ?? [])]);
              // Reset so choosing the same file again after removing it still fires onChange.
              event.target.value = "";
            }}
          />

          <div className="mt-4 space-y-2">
            {selected.map((file) => (
              <div key={fileKey(file)} className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-panel p-3">
                <FileSpreadsheet className="size-5 shrink-0 text-emerald-700" />
                <span className="min-w-0 flex-1 text-sm font-medium break-anywhere">{file.name}</span>
                <span className="shrink-0 text-xs text-slate-500">{formatFileSize(file.size)}</span>
                <button type="button" title={`Remove ${file.name}`} onClick={() => setSelected((current) => current.filter((item) => fileKey(item) !== fileKey(file)))} aria-label={`Remove ${file.name}`} className={removeButtonClass}><X aria-hidden="true" className="size-4" /></button>
              </div>
            ))}
          </div>

          {files.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Uploaded in this session</p>
              {files.map((file) => (
                <div key={file.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-panel p-3">
                  <FileSpreadsheet className="size-5 shrink-0 text-emerald-700" />
                  <span className="min-w-0 flex-1 text-sm font-medium break-anywhere">{file.name}</span>
                  <span className="shrink-0 text-xs text-slate-500">{formatFileSize(file.size)}</span>
                  <button type="button" title={`Remove ${file.name} from this session`} onClick={() => setPendingRemoval(file)} aria-label={`Remove ${file.name} from this session`} className={removeButtonClass}><X aria-hidden="true" className="size-4" /></button>
                </div>
              ))}
            </div>
          )}

          {formError && <p className="mt-3 text-sm text-red-700" role="alert">{formError}</p>}
          <button title="Read the selected files and continue to row setup" disabled={busy} onClick={submit} className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : null}
            {busy ? "Inspecting files..." : "Continue to row setup"}
          </button>
        </section>
      </div>
      {pendingRemoval ? (
        <ModalDialog labelledBy="remove-file-title" onClose={() => setPendingRemoval(null)} className="w-full max-w-md rounded-3xl border border-slate-200 bg-panel p-6 shadow-2xl">
          <h2 id="remove-file-title" className="text-lg font-semibold text-slate-950">Remove {pendingRemoval.name}?</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            The file is removed from this session{affectedByPendingRemoval ? `, along with ${affectedByPendingRemoval} rule${affectedByPendingRemoval === 1 ? "" : "s"} that use it` : ""}. The original file on disk is not changed.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" data-autofocus onClick={() => setPendingRemoval(null)} className="rounded-xl border border-slate-300 bg-panel px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">Cancel</button>
            <button
              type="button"
              onClick={() => {
                const target = pendingRemoval;
                setPendingRemoval(null);
                void removeUploadedFile(target.id);
              }}
              className="rounded-xl bg-danger px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-danger-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
            >
              Remove file
            </button>
          </div>
        </ModalDialog>
      ) : null}
    </div>
  );
}

function fileKey(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}
