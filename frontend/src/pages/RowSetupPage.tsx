import { CheckCircle2, ChevronDown, ChevronRight, FileSpreadsheet, LoaderCircle, Play, RefreshCw, Rows3 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SelectField } from "../components/forms/SelectField";
import { PageHeader } from "../components/layout/PageHeader";
import { useWorkflow } from "../features/files/WorkflowContext";
import { previewDataSource } from "../services/fileApi";
import type { ComparisonDataSource } from "../types/validation.types";
import { applyRowBoundaries, clampRow, displayCell, rowBoundaryError, sanitizeAutoDetectedPreview, setupConfidence, sourceFile, sourceSheet, sourceSignature } from "../features/validation/rowSetupModel";
import { confirmedStatus, rowAccentClass, rowBadge, rowCellClass, rowTone } from "../components/validation/rowSetup/rowPreviewStyles";

interface RowSetupPageProps {
  onContinue: () => void;
}

type ReloadVisualState = "loading" | "reloaded";

type RowInputDrafts = Record<string, { headerRow?: string; firstDataRow?: string }>;

const primaryButtonClass = "inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-hover active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:active:scale-100";

const secondaryButtonClass = "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-panel px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100";

const setupActionButtonClass = "inline-flex items-center justify-center rounded-xl border bg-panel px-3 py-2 text-xs font-semibold transition active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100";

export function RowSetupPage({ onContinue }: RowSetupPageProps) {
  const {
    files,
    dataSources,
    setDataSources,
    updateDataSource,
    sourcePreviews,
    setSourcePreview,
    removeSourcePreview,
  } = useWorkflow();
  const [busySourceId, setBusySourceId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [collapsedSourceIds, setCollapsedSourceIds] = useState<Set<string>>(() => new Set());
  const [selectedRowsBySource, setSelectedRowsBySource] = useState<Record<string, number>>({});
  const [reloadVisualStates, setReloadVisualStates] = useState<Record<string, ReloadVisualState | undefined>>({});
  const [rowInputDrafts, setRowInputDrafts] = useState<RowInputDrafts>({});
  const [expandedConfidenceSourceIds, setExpandedConfidenceSourceIds] = useState<Set<string>>(() => new Set());
  const autoPreviewed = useRef<Set<string>>(new Set());
  const previewRequestIds = useRef<Record<string, number>>({});
  const reloadTimersRef = useRef<Record<string, number>>({});
  const rowInputTimersRef = useRef<Record<string, number>>({});

  const allConfirmed = dataSources.length > 0 && dataSources.every((source) => source.row_setup_confirmed);
  const confirmedCount = dataSources.filter((source) => source.row_setup_confirmed).length;
  const hasPreviewedSource = dataSources.some((source) => sourcePreviews[source.id]);

  useEffect(() => {
    const reloadTimers = reloadTimersRef.current;
    const rowInputTimers = rowInputTimersRef.current;
    return () => {
      Object.values(reloadTimers).forEach((timer) => window.clearTimeout(timer));
      Object.values(rowInputTimers).forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  const setReloadVisualState = useCallback((sourceId: string, state?: ReloadVisualState) => {
    if (reloadTimersRef.current[sourceId]) {
      window.clearTimeout(reloadTimersRef.current[sourceId]);
      delete reloadTimersRef.current[sourceId];
    }
    setReloadVisualStates((current) => ({ ...current, [sourceId]: state }));
  }, []);

  const loadPreview = useCallback(async (source: ComparisonDataSource, showReloadVisual = false) => {
    if (!source.file_id || !source.sheet_name) return;
    const boundaryError = rowBoundaryError(source, files, sourcePreviews[source.id]);
    if (boundaryError) {
      setReloadVisualState(source.id, undefined);
      setErrors((current) => ({ ...current, [source.id]: boundaryError }));
      return;
    }
    const requestId = (previewRequestIds.current[source.id] ?? 0) + 1;
    previewRequestIds.current[source.id] = requestId;
    const isLatest = () => previewRequestIds.current[source.id] === requestId;
    setBusySourceId(source.id);
    if (showReloadVisual) setReloadVisualState(source.id, "loading");
    setErrors((current) => ({ ...current, [source.id]: "" }));
    try {
      const rawPreview = await previewDataSource({
        ...source,
        selected_row_numbers: [],
        ignored_row_numbers: [],
        row_selection_mode: "auto_detected",
      });
      // A newer request for this source was started; drop this stale response.
      if (!isLatest()) return;
      const preview = sanitizeAutoDetectedPreview(rawPreview);
      updateDataSource(source.id, {
        ...preview.data_source,
        row_setup_confirmed: Boolean(source.row_setup_confirmed),
      });
      setSourcePreview(source.id, preview);
      setSelectedRowsBySource((current) => ({
        ...current,
        [source.id]: current[source.id] ?? preview.data_source.header_row ?? preview.rows[0]?.row_number ?? source.header_row,
      }));
      if (showReloadVisual) {
        setReloadVisualState(source.id, "reloaded");
        reloadTimersRef.current[source.id] = window.setTimeout(() => {
          setReloadVisualStates((current) => ({ ...current, [source.id]: undefined }));
          delete reloadTimersRef.current[source.id];
        }, 1100);
      }
    } catch (cause) {
      if (!isLatest()) return;
      if (showReloadVisual) setReloadVisualState(source.id, undefined);
      setErrors((current) => ({
        ...current,
        [source.id]: cause instanceof Error ? cause.message : "Could not load the row preview.",
      }));
    } finally {
      if (isLatest()) setBusySourceId((current) => (current === source.id ? null : current));
    }
  }, [files, setReloadVisualState, setSourcePreview, sourcePreviews, updateDataSource]);

  useEffect(() => {
    dataSources.forEach((source) => {
      const signature = `${source.id}:${sourceSignature(source)}`;
      if (sourcePreviews[source.id] || autoPreviewed.current.has(signature) || busySourceId) return;
      autoPreviewed.current.add(signature);
      void loadPreview(source);
    });
  }, [busySourceId, dataSources, loadPreview, sourcePreviews]);

  const fileOptions = useMemo(
    () => files.map((file) => ({ value: file.id, label: file.name, description: `${file.extension.toUpperCase()} • ${file.sheets.length} sheet${file.sheets.length === 1 ? "" : "s"}` })),
    [files],
  );

  const updateSourceSetup = (source: ComparisonDataSource, next: ComparisonDataSource, clearPreview = true) => {
    for (const field of ["headerRow", "firstDataRow"] as const) {
      const timerKey = `${source.id}:${field}`;
      if (rowInputTimersRef.current[timerKey]) {
        window.clearTimeout(rowInputTimersRef.current[timerKey]);
        delete rowInputTimersRef.current[timerKey];
      }
    }
    updateDataSource(source.id, { ...next, row_setup_confirmed: false });
    if (clearPreview) removeSourcePreview(source.id);
    setRowInputDrafts((current) => {
      const nextDrafts = { ...current };
      delete nextDrafts[source.id];
      return nextDrafts;
    });
    setSelectedRowsBySource((current) => {
      const nextRows = { ...current };
      delete nextRows[source.id];
      return nextRows;
    });
    setCollapsedSourceIds((current) => {
      const nextSet = new Set(current);
      nextSet.delete(source.id);
      return nextSet;
    });
  };

  const selectPreviewRow = (sourceId: string, rowNumber: number) => {
    setSelectedRowsBySource((current) => ({ ...current, [sourceId]: rowNumber }));
  };

  const toggleSource = (sourceId: string) => {
    setCollapsedSourceIds((current) => {
      const next = new Set(current);
      if (next.has(sourceId)) {
        next.delete(sourceId);
      } else {
        next.add(sourceId);
      }
      return next;
    });
  };

  const toggleConfidenceDetails = (sourceId: string) => {
    setExpandedConfidenceSourceIds((current) => {
      const next = new Set(current);
      if (next.has(sourceId)) {
        next.delete(sourceId);
      } else {
        next.add(sourceId);
      }
      return next;
    });
  };

  const changeFile = (source: ComparisonDataSource, fileId: string) => {
    const file = files.find((item) => item.id === fileId);
    const sheet = file?.sheets[0];
    const headerRow = sheet?.detected_header_row ?? 1;
    updateSourceSetup(source, {
      ...source,
      file_id: file?.id ?? "",
      file_name: file?.name ?? null,
      sheet_name: sheet?.name ?? "",
      header_row: headerRow,
      first_data_row: headerRow + 1,
      selected_row_numbers: [],
      ignored_row_numbers: [],
      row_selection_mode: "auto_detected",
    });
  };

  const changeSheet = (source: ComparisonDataSource, sheetName: string) => {
    const file = sourceFile(source, files);
    const sheet = file?.sheets.find((item) => item.name === sheetName);
    const headerRow = sheet?.detected_header_row ?? 1;
    updateSourceSetup(source, {
      ...source,
      sheet_name: sheetName,
      header_row: headerRow,
      first_data_row: headerRow + 1,
      selected_row_numbers: [],
      ignored_row_numbers: [],
      row_selection_mode: "auto_detected",
    });
  };

  const applyRowSetupChange = (source: ComparisonDataSource, next: ComparisonDataSource, selectedRowNumber: number) => {
    const unconfirmedNext = { ...next, row_setup_confirmed: false };
    updateSourceSetup(source, unconfirmedNext, false);
    setSelectedRowsBySource((current) => ({ ...current, [source.id]: selectedRowNumber }));
    void loadPreview(unconfirmedNext, true);
  };

  const changeHeaderRow = (source: ComparisonDataSource, value: number) => {
    const headerRow = clampRow(value);
    const next = applyRowBoundaries(source, headerRow, Math.max(source.first_data_row, headerRow + 1));
    applyRowSetupChange(source, next, headerRow);
  };

  const changeFirstDataRow = (source: ComparisonDataSource, value: number) => {
    const firstDataRow = Math.max(clampRow(value), source.header_row + 1);
    const next = applyRowBoundaries(source, source.header_row, firstDataRow);
    applyRowSetupChange(source, next, firstDataRow);
  };

  const clearRowInputDraft = (sourceId: string, field: "headerRow" | "firstDataRow") => {
    setRowInputDrafts((current) => {
      const sourceDraft = { ...current[sourceId] };
      delete sourceDraft[field];
      const next = { ...current };
      if (sourceDraft.headerRow === undefined && sourceDraft.firstDataRow === undefined) {
        delete next[sourceId];
      } else {
        next[sourceId] = sourceDraft;
      }
      return next;
    });
  };

  const clearRowInputTimer = (sourceId: string, field: "headerRow" | "firstDataRow") => {
    const timerKey = `${sourceId}:${field}`;
    if (rowInputTimersRef.current[timerKey]) {
      window.clearTimeout(rowInputTimersRef.current[timerKey]);
      delete rowInputTimersRef.current[timerKey];
    }
  };

  const commitRowInputValue = (source: ComparisonDataSource, field: "headerRow" | "firstDataRow", value: string) => {
    const parsed = Number.parseInt(value, 10);
    clearRowInputDraft(source.id, field);
    if (!Number.isInteger(parsed)) return;
    if (field === "headerRow") {
      changeHeaderRow(source, parsed);
    } else {
      changeFirstDataRow(source, parsed);
    }
  };

  const updateRowInputDraft = (source: ComparisonDataSource, field: "headerRow" | "firstDataRow", value: string) => {
    if (value && !/^\d+$/.test(value)) return;
    clearRowInputTimer(source.id, field);
    setRowInputDrafts((current) => ({
      ...current,
      [source.id]: {
        ...current[source.id],
        [field]: value,
      },
    }));
    // Commit happens on blur/Enter only: auto-committing mid-typing clamped partial values
    // (e.g. "" became header+1) and wiped the sibling field's draft.
  };

  const commitRowInputDraft = (source: ComparisonDataSource, field: "headerRow" | "firstDataRow") => {
    clearRowInputTimer(source.id, field);
    const value = rowInputDrafts[source.id]?.[field];
    if (value === undefined) return;
    commitRowInputValue(source, field, value);
  };

  const setHeaderFromRow = (source: ComparisonDataSource, rowNumber: number) => {
    const next = applyRowBoundaries(source, rowNumber, Math.max(source.first_data_row, rowNumber + 1));
    applyRowSetupChange(source, next, rowNumber);
  };

  const setFirstDataFromRow = (source: ComparisonDataSource, rowNumber: number) => {
    const firstDataRow = Math.max(rowNumber, source.header_row + 1);
    const next = applyRowBoundaries(source, source.header_row, firstDataRow);
    applyRowSetupChange(source, next, firstDataRow);
  };

  const confirmSource = (source: ComparisonDataSource) => {
    if (!sourcePreviews[source.id]) return;
    if (rowBoundaryError(source, files, sourcePreviews[source.id])) return;
    updateDataSource(source.id, { ...source, row_setup_confirmed: true });
  };

  // Bulk confirm skips sources whose own checks flag problems; those must be reviewed one by one.
  const confirmAllPreviewed = () => {
    setDataSources(dataSources.map((source) => {
      if (source.row_setup_confirmed) return source;
      const preview = sourcePreviews[source.id];
      const stale = !preview || sourceSignature(preview.data_source) !== sourceSignature(source);
      const boundaryError = rowBoundaryError(source, files, preview);
      const confident = setupConfidence(source, files, preview, stale, boundaryError).tone === "high";
      return { ...source, row_setup_confirmed: !stale && !boundaryError && confident };
    }));
  };

  return (
    <div>
      <PageHeader
        eyebrow="Step 2 of 5"
        title="Confirm row setup"
        description="Check the detected header row and first data row inside Clario before building rows, fields, and rules."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
              {confirmedCount} of {dataSources.length} confirmed
            </span>
            <button type="button" disabled={!hasPreviewedSource} onClick={confirmAllPreviewed} className={secondaryButtonClass}>
              <CheckCircle2 className="size-4" /> Confirm high-confidence
            </button>
            <button type="button" disabled={!allConfirmed} onClick={onContinue} className={primaryButtonClass}>
              <Play className="size-4" /> Continue to comparison builder
            </button>
          </div>
        }
      />

      <div className="space-y-6 pt-6">
        <div className="space-y-5">
          {dataSources.map((source, index) => {
            const file = sourceFile(source, files);
            const sheet = sourceSheet(source, files);
            const preview = sourcePreviews[source.id];
            const status = confirmedStatus(source, preview);
            const StatusIcon = status.icon;
            const sheetOptions = (file?.sheets ?? []).map((sheet) => ({ value: sheet.name, label: sheet.name, description: `${sheet.row_count} rows • ${sheet.column_count} columns` }));
            const columns = preview?.columns ?? [];
            const stalePreview = Boolean(preview && sourceSignature(preview.data_source) !== sourceSignature(source));
            const collapsed = collapsedSourceIds.has(source.id);
            const selectedRowNumber = selectedRowsBySource[source.id] ?? (preview?.rows.some((row) => row.row_number === source.header_row) ? source.header_row : preview?.rows[0]?.row_number);
            const selectedRowNumberValue = typeof selectedRowNumber === "number" ? selectedRowNumber : null;
            const selectedRow = selectedRowNumberValue ? preview?.rows.find((row) => row.row_number === selectedRowNumberValue) : undefined;
            const reloadState = reloadVisualStates[source.id];
            const rowInputDraft = rowInputDrafts[source.id] ?? {};
            const boundaryError = rowBoundaryError(source, files, preview);
            const sourceError = boundaryError || errors[source.id];
            const rowInputInvalidClass = boundaryError ? "border-red-300 focus:border-red-500 focus:ring-red-100" : "border-slate-300 focus:border-emerald-600 focus:ring-emerald-100";
            const maxRowNumber = sheet?.row_count || preview?.total_rows;
            const confidence = setupConfidence(source, files, preview, stalePreview, boundaryError);
            const confidenceExpanded = expandedConfidenceSourceIds.has(source.id);
            const confidenceDetailsId = `confidence-details-${source.id}`;

            return (
              <section key={source.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-panel shadow-sm" data-fade-section>
                <div className="border-b border-slate-200 bg-panel p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <h2 className="flex min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => toggleSource(source.id)}
                      aria-expanded={!collapsed}
                      className="group flex min-w-0 flex-1 items-start gap-3 rounded-2xl text-left outline-none transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700 transition group-hover:bg-emerald-100">
                        <FileSpreadsheet className="size-5" />
                      </span>
                      <span className="block min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-semibold text-slate-950">{source.name}</span>
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}>
                            <StatusIcon className="size-3.5" /> {status.label}
                          </span>
                          <span className={`text-xs font-semibold ${confidence.labelClassName}`}>
                            {confidence.label}
                          </span>
                        </span>
                        <span className="mt-1 block text-sm font-normal leading-6 text-slate-500">{status.detail}</span>
                      </span>
                    </button>
                    </h2>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Source {index + 1}</span>
                      <button
                        type="button"
                        onClick={() => toggleSource(source.id)}
                        aria-label={collapsed ? `Expand ${source.name}` : `Collapse ${source.name}`}
                        className="grid size-9 place-items-center rounded-xl border border-slate-200 bg-panel text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                      >
                        {collapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${collapsed ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"}`}>
                  {/* inert keeps collapsed controls out of the tab order and accessibility tree. */}
                  <div className="overflow-hidden" inert={collapsed}>
                    <div className="grid gap-5 p-5 xl:grid-cols-[340px_minmax(0,1fr)]">
                      <div className="space-y-4">
                        <div className="rounded-2xl border border-slate-200 bg-panel p-3 text-xs leading-5 text-slate-600 shadow-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`font-semibold ${confidence.labelClassName}`}>{confidence.label}</span>
                            <span className="font-semibold text-slate-700">{confidence.score}%</span>
                          </div>
                          <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-100">
                            <div className={`h-full rounded-full transition-all ${confidence.barClassName}`} style={{ width: `${confidence.score}%` }} />
                          </div>
                          <p className="mt-2 text-slate-500">{confidence.detail}</p>
                          <button
                            type="button"
                            onClick={() => toggleConfidenceDetails(source.id)}
                            aria-expanded={confidenceExpanded}
                            aria-controls={confidenceDetailsId}
                            className="mt-1 text-xs font-semibold text-emerald-700 transition hover:text-emerald-800"
                          >
                            {confidenceExpanded ? "Hide details" : "View details"}
                          </button>
                          <div
                            id={confidenceDetailsId}
                            aria-hidden={!confidenceExpanded}
                            className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${confidenceExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                          >
                            <div className="overflow-hidden">
                              <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2 text-xs text-slate-500">
                                {confidence.checks.map((check) => <li key={check}>- {check}</li>)}
                              </ul>
                            </div>
                          </div>
                        </div>

                        <div className="block">
                          <span className="text-xs font-semibold text-slate-600">Workbook file</span>
                          <SelectField
                            ariaLabel={`${source.name} file`}
                            className="mt-1"
                            helpText="Choose which uploaded workbook this source should use."
                            value={source.file_id}
                            options={fileOptions}
                            onChange={(value) => changeFile(source, value)}
                          />
                        </div>
                        <div className="block">
                          <span className="text-xs font-semibold text-slate-600">Worksheet tab</span>
                          <SelectField
                            ariaLabel={`${source.name} sheet`}
                            className="mt-1"
                            helpText="Choose the worksheet to inspect for this source."
                            value={source.sheet_name}
                            options={sheetOptions}
                            onChange={(value) => changeSheet(source, value)}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <label className="block">
                            <span className="text-xs font-semibold text-slate-600">Header row</span>
                            <input
                              type="number"
                              min={1}
                              max={maxRowNumber}
                              value={rowInputDraft.headerRow ?? String(source.header_row)}
                              onChange={(event) => updateRowInputDraft(source, "headerRow", event.target.value)}
                              onBlur={() => commitRowInputDraft(source, "headerRow")}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") event.currentTarget.blur();
                              }}
                              className={`mt-1 w-full rounded-xl border px-3 py-2.5 text-sm font-semibold outline-none transition focus:ring-3 ${rowInputInvalidClass}`}
                            />
                          </label>
                          <label className="block">
                            <span className="text-xs font-semibold text-slate-600">First data row</span>
                            <input
                              type="number"
                              min={source.header_row + 1}
                              max={maxRowNumber}
                              value={rowInputDraft.firstDataRow ?? String(source.first_data_row)}
                              onChange={(event) => updateRowInputDraft(source, "firstDataRow", event.target.value)}
                              onBlur={() => commitRowInputDraft(source, "firstDataRow")}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") event.currentTarget.blur();
                              }}
                              className={`mt-1 w-full rounded-xl border px-3 py-2.5 text-sm font-semibold outline-none transition focus:ring-3 ${rowInputInvalidClass}`}
                            />
                          </label>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                          Header row should contain column names. First data row should be the first real item row, not a title, lot header, blank row, or total row.
                        </div>

                        {sourceError ? <p className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{sourceError}</p> : null}

                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => loadPreview(source, true)} disabled={busySourceId === source.id || Boolean(boundaryError)} className={secondaryButtonClass}>
                            {busySourceId === source.id ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                            {busySourceId === source.id ? "Reloading..." : preview ? "Refresh preview" : "Load preview"}
                          </button>
                          <button
                            type="button"
                            onClick={() => confirmSource(source)}
                            disabled={source.row_setup_confirmed || !preview || stalePreview || Boolean(sourceError) || busySourceId === source.id || rowInputDraft.headerRow !== undefined || rowInputDraft.firstDataRow !== undefined}
                            className={source.row_setup_confirmed ? "inline-flex cursor-default items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700" : primaryButtonClass}
                          >
                            <CheckCircle2 className="size-4" /> {source.row_setup_confirmed ? "Confirmed" : "Confirm setup"}
                          </button>
                        </div>
                        {stalePreview ? <p className="text-xs leading-5 text-amber-700">Preview is stale. Refresh it before confirming this source.</p> : null}
                      </div>

                      <div className="min-w-0">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <h3 className="text-sm font-semibold text-slate-900">Spreadsheet row preview</h3>
                            <p className="mt-1 text-xs leading-5 text-slate-500">Click a row to select it. Use the action bar below to set the selected row.</p>
                          </div>
                          {preview ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">Showing all {preview.rows.length} preview rows</span> : null}
                        </div>

                        {preview ? (
                          <>
                            <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-panel shadow-sm">
                              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-3 py-3">
                                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                                  <span className="font-semibold text-slate-900">Selected row</span>
                                  <span className="rounded-full bg-panel px-2.5 py-1 font-semibold text-slate-700 shadow-sm">
                                    {selectedRowNumberValue ? `Row ${selectedRowNumberValue}` : "Choose a row"}
                                  </span>
                                  {selectedRow ? rowBadge(selectedRow, source) : null}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    disabled={!selectedRowNumberValue}
                                    onClick={() => selectedRowNumberValue && setHeaderFromRow(source, selectedRowNumberValue)}
                                    className={`${setupActionButtonClass} border-sky-200 text-sky-700 hover:bg-sky-50 focus-visible:outline-sky-500`}
                                  >
                                    Set selected as header
                                  </button>
                                  <button
                                    type="button"
                                    disabled={!selectedRowNumberValue || selectedRowNumberValue <= source.header_row}
                                    onClick={() => selectedRowNumberValue && setFirstDataFromRow(source, selectedRowNumberValue)}
                                    className={`${setupActionButtonClass} border-amber-200 text-amber-800 hover:bg-amber-50 focus-visible:outline-amber-500`}
                                  >
                                    Set selected as first data
                                  </button>
                                </div>
                              </div>
                              <div className={`max-h-[34rem] overflow-auto transition duration-300 ${reloadState === "loading" ? "scale-[0.998] opacity-65 blur-[0.7px] saturate-[0.96]" : reloadState === "reloaded" ? "shadow-[inset_0_0_0_1px_rgba(16,185,129,0.28),0_16px_40px_rgba(16,185,129,0.08)]" : ""}`}>
                                <table className="min-w-full border-separate border-spacing-0 text-left text-xs">
                                  <tbody>
                                    {preview.rows.map((row) => {
                                      const selected = selectedRowNumberValue === row.row_number;
                                      const cellClass = rowCellClass(selected);
                                      return (
                                        <tr
                                          key={row.row_number}
                                          data-selected={selected}
                                          onClick={() => selectPreviewRow(source.id, row.row_number)}
                                          className={`cursor-pointer align-top transition ${rowTone(row, source, selected)}`}
                                        >
                                          <td className={`w-40 min-w-40 border-l-4 px-3 py-2.5 ${cellClass} ${rowAccentClass(row, source, selected)}`}>
                                            <div className="flex flex-wrap items-center gap-2">
                                              <button
                                                type="button"
                                                aria-pressed={selected}
                                                onClick={(event) => {
                                                  event.stopPropagation();
                                                  selectPreviewRow(source.id, row.row_number);
                                                }}
                                                className="rounded font-semibold text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                                              >
                                                Row {row.row_number}
                                              </button>
                                              {rowBadge(row, source)}
                                            </div>
                                          </td>
                                          {columns.map((column) => (
                                            <td key={`${row.row_number}-${column.letter}`} className={`min-w-52 px-3 py-2.5 text-slate-700 ${cellClass}`}>
                                              <span className="block whitespace-normal leading-5">{displayCell(row.cells[column.header_label])}</span>
                                            </td>
                                          ))}
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                              {reloadState ? (
                                <div className={`reload-feedback-overlay pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl transition duration-300 ${reloadState === "loading" ? "reload-feedback-overlay--loading backdrop-blur-[2px]" : "reload-feedback-overlay--success"}`}>
                                  <div className={`reload-feedback-message inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold shadow-lg animate-[app-section-fade-in_180ms_cubic-bezier(0.16,1,0.3,1)_both] ${reloadState === "loading" ? "reload-feedback-message--loading" : "reload-feedback-message--success"}`}>
                                    {reloadState === "loading" ? <LoaderCircle className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                                    {reloadState === "loading" ? "Reloading preview..." : "Preview reloaded"}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </>
                        ) : (
                          <div className="grid min-h-64 place-items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                            <span>
                              <Rows3 className="mx-auto size-7 text-slate-500" />
                              <span className="mt-3 block text-sm font-semibold text-slate-800">Preview not loaded yet</span>
                              <span className="mt-1 block text-sm text-slate-500">Load the preview to see the actual header and data rows.</span>
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            );
          })}
        </div>

        <section className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-panel p-5 shadow-sm" data-fade-section>
          <div>
            <h2 className="text-sm font-semibold text-slate-950">Ready for the comparison builder?</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Confirm every source first so fields and rules are built from the correct rows.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!hasPreviewedSource} onClick={confirmAllPreviewed} className={secondaryButtonClass}>
              <CheckCircle2 className="size-4" /> Confirm high-confidence
            </button>
            <button type="button" disabled={!allConfirmed} onClick={onContinue} className={primaryButtonClass}>
              <Play className="size-4" /> Continue to comparison builder
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
