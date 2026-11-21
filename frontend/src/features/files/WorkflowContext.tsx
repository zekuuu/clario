import { createContext, useCallback, useContext, useMemo, useState, type PropsWithChildren, type SetStateAction } from "react";
import type { UploadedFile } from "../../types/file.types";
import type {
  ComparisonDataSource,
  ComparisonRule,
  DataSourcePreview,
  PresetSelection,
  ValidationResult,
} from "../../types/validation.types";

const STORED_RESULT_KEY = "clario:last-validation-result";
const LEGACY_STORED_RESULT_KEY = "procurement-validator:last-validation-result";

function readStoredResult() {
  if (typeof window === "undefined") return null;
  try {
    const value = window.sessionStorage.getItem(STORED_RESULT_KEY) ?? window.sessionStorage.getItem(LEGACY_STORED_RESULT_KEY);
    if (value && !window.sessionStorage.getItem(STORED_RESULT_KEY)) {
      window.sessionStorage.setItem(STORED_RESULT_KEY, value);
      window.sessionStorage.removeItem(LEGACY_STORED_RESULT_KEY);
    }
    return value ? (JSON.parse(value) as ValidationResult) : null;
  } catch {
    return null;
  }
}

function writeStoredResult(value: ValidationResult | null) {
  if (typeof window === "undefined") return;
  try {
    if (value) {
      window.sessionStorage.setItem(STORED_RESULT_KEY, JSON.stringify(value));
      window.sessionStorage.removeItem(LEGACY_STORED_RESULT_KEY);
    } else {
      window.sessionStorage.removeItem(STORED_RESULT_KEY);
      window.sessionStorage.removeItem(LEGACY_STORED_RESULT_KEY);
    }
  } catch {
    // Ignore storage failures so local validation still works in restricted browsers.
  }
}

function rowSetupSignature(source: ComparisonDataSource) {
  return [source.file_id, source.sheet_name, source.header_row, source.first_data_row].join("|");
}

function normalizeRowSetupConfirmation(next: ComparisonDataSource, previous?: ComparisonDataSource) {
  const setupUnchanged = previous ? rowSetupSignature(previous) === rowSetupSignature(next) : false;
  const requestedConfirmation = next.row_setup_confirmed ?? previous?.row_setup_confirmed ?? false;
  return {
    ...next,
    row_setup_confirmed: setupUnchanged ? Boolean(requestedConfirmation) : Boolean(!previous && next.row_setup_confirmed),
  };
}

function uniqueFilesById(files: UploadedFile[]) {
  const seen = new Set<string>();
  return files.filter((file) => {
    if (!file.id || seen.has(file.id)) return false;
    seen.add(file.id);
    return true;
  });
}

/** Fields and rules are only persisted on run, so the setup is "saved" when it matches the last run/opened setup. */
export function setupSignature(dataSources: ComparisonDataSource[], rules: ComparisonRule[]) {
  return JSON.stringify([dataSources.map((source) => ({ ...source, row_setup_confirmed: undefined })), rules]);
}

function applyStateAction<T>(action: SetStateAction<T>, current: T) {
  return typeof action === "function" ? (action as (value: T) => T)(current) : action;
}

interface WorkflowState {
  sessionId: string | null;
  setSessionId: (value: string | null) => void;
  projectName: string;
  setProjectName: (value: string) => void;
  preset: PresetSelection;
  setPreset: (value: PresetSelection) => void;
  files: UploadedFile[];
  setFiles: (value: SetStateAction<UploadedFile[]>) => void;
  dataSources: ComparisonDataSource[];
  setDataSources: (value: SetStateAction<ComparisonDataSource[]>) => void;
  updateDataSource: (id: string, value: ComparisonDataSource) => void;
  removeDataSource: (id: string) => void;
  sourcePreviews: Record<string, DataSourcePreview>;
  setSourcePreview: (id: string, value: DataSourcePreview) => void;
  removeSourcePreview: (id: string) => void;
  clearSourcePreviews: () => void;
  rules: ComparisonRule[];
  setRules: (value: SetStateAction<ComparisonRule[]>) => void;
  updateRule: (id: string, value: ComparisonRule) => void;
  removeRule: (id: string) => void;
  result: ValidationResult | null;
  setResult: (value: ValidationResult | null) => void;
  /** True when fields/rules exist that differ from the last run (or opened) setup. */
  hasUnsavedSetup: boolean;
  markSetupSaved: (dataSources: ComparisonDataSource[], rules: ComparisonRule[]) => void;
}

const Context = createContext<WorkflowState | null>(null);

export function WorkflowProvider({ children }: PropsWithChildren) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("");
  // Presets are intentionally not exposed in the current workflow. Keep the
  // legacy state at the neutral custom value for backward-compatible payloads.
  const [preset, setPresetState] = useState<PresetSelection>("custom_comparison_builder");
  // Nothing in the UI can pick a preset any more, so never let it become "" (which blocked runs).
  const setPreset = useCallback((value: PresetSelection) => setPresetState(value || "custom_comparison_builder"), []);
  const [files, setFilesState] = useState<UploadedFile[]>([]);
  const [dataSources, setDataSourcesState] = useState<ComparisonDataSource[]>([]);
  const [sourcePreviews, setSourcePreviews] = useState<Record<string, DataSourcePreview>>({});
  const [rules, setRules] = useState<ComparisonRule[]>([]);
  const [result, setResultState] = useState<ValidationResult | null>(() => readStoredResult());

  const setFiles = useCallback((value: SetStateAction<UploadedFile[]>) => {
    setFilesState((current) => uniqueFilesById(applyStateAction(value, current)));
  }, []);

  const setDataSources = useCallback((value: SetStateAction<ComparisonDataSource[]>) => {
    setDataSourcesState((current) => applyStateAction(value, current).map((source) => normalizeRowSetupConfirmation(source, current.find((item) => item.id === source.id))));
  }, []);

  const updateDataSource = useCallback((id: string, value: ComparisonDataSource) => {
    setDataSourcesState((current) => current.map((item) => (item.id === id ? normalizeRowSetupConfirmation(value, item) : item)));
  }, []);

  const removeDataSource = useCallback((id: string) => {
    setDataSourcesState((current) => current.filter((item) => item.id !== id));
  }, []);

  const setResult = useCallback((value: ValidationResult | null) => {
    setResultState(value);
    writeStoredResult(value);
  }, []);

  const [savedSignature, setSavedSignature] = useState(() => setupSignature([], []));
  const markSetupSaved = useCallback((sources: ComparisonDataSource[], savedRules: ComparisonRule[]) => {
    setSavedSignature(setupSignature(sources, savedRules));
  }, []);
  const hasSetupContent = rules.length > 0 || dataSources.some((source) => source.fields.length > 0);
  const hasUnsavedSetup = hasSetupContent && setupSignature(dataSources, rules) !== savedSignature;

  const setSourcePreview = useCallback((id: string, preview: DataSourcePreview) => setSourcePreviews((current) => ({ ...current, [id]: preview })), []);
  const clearSourcePreviews = useCallback(() => setSourcePreviews({}), []);
  const removeSourcePreview = useCallback((id: string) => setSourcePreviews((current) => {
    const next = { ...current };
    delete next[id];
    return next;
  }), []);
  const updateRule = useCallback((id: string, rule: ComparisonRule) => setRules((current) => current.map((item) => (item.id === id ? rule : item))), []);
  const removeRule = useCallback((id: string) => setRules((current) => current.filter((item) => item.id !== id)), []);

  const value = useMemo(
    () => ({
      sessionId,
      setSessionId,
      projectName,
      setProjectName,
      preset,
      setPreset,
      files,
      setFiles,
      dataSources,
      setDataSources,
      updateDataSource,
      removeDataSource,
      sourcePreviews,
      setSourcePreview,
      clearSourcePreviews,
      removeSourcePreview,
      rules,
      setRules,
      updateRule,
      removeRule,
      result,
      setResult,
      hasUnsavedSetup,
      markSetupSaved,
    }),
    [sessionId, projectName, preset, setPreset, files, setFiles, dataSources, setDataSources, updateDataSource, removeDataSource, sourcePreviews, setSourcePreview, clearSourcePreviews, removeSourcePreview, rules, updateRule, removeRule, result, setResult, hasUnsavedSetup, markSetupSaved],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useWorkflow() {
  const value = useContext(Context);
  if (!value) throw new Error("WorkflowProvider is missing");
  return value;
}
