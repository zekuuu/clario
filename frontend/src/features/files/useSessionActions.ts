import { useCallback } from "react";
import { getSessionState } from "../../services/validationApi";
import { useWorkflow } from "./WorkflowContext";

/** Workflow-level session operations shared by the sidebar and the dashboard. */
export function useSessionActions() {
  const { setSessionId, setProjectName, setPreset, setFiles, setDataSources, setRules, setResult, clearSourcePreviews, markSetupSaved } = useWorkflow();

  const clearWorkflowState = useCallback(() => {
    markSetupSaved([], []);
    clearSourcePreviews();
    setSessionId(null);
    setProjectName("");
    setPreset("");
    setFiles([]);
    setDataSources([]);
    setRules([]);
    setResult(null);
  }, [clearSourcePreviews, markSetupSaved, setDataSources, setFiles, setPreset, setProjectName, setResult, setRules, setSessionId]);

  /** Loads a saved session into the workflow. Resolves to whether it has a real validation result. */
  const loadSession = useCallback(async (sessionId: string) => {
    const state = await getSessionState(sessionId);
    const hasRunResult = (state.result.rule_summaries?.length ?? 0) > 0 || (state.result.extracted_records?.length ?? 0) > 0;
    const dataSources = state.request?.data_sources ?? state.result.data_sources;
    const rules = state.request?.rules ?? [];

    setSessionId(sessionId);
    clearSourcePreviews();
    setProjectName(state.request?.project_name || state.result.project_name);
    setPreset(state.request?.preset || state.result.preset);
    setFiles(state.files ?? []);
    setDataSources(dataSources);
    setRules(rules);
    // A draft session (uploaded but never run) only has an empty placeholder result. Treating it as a
    // real result would send the user to an empty Results page instead of back to their setup.
    setResult(hasRunResult ? state.result : null);
    markSetupSaved(dataSources, rules);
    return { hasRunResult };
  }, [clearSourcePreviews, markSetupSaved, setDataSources, setFiles, setPreset, setProjectName, setResult, setRules, setSessionId]);

  return { clearWorkflowState, loadSession };
}
