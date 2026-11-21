import { useEffect } from "react";
import { createDataSource } from "../validation/builderModel";
import { useWorkflow } from "./WorkflowContext";

/** Every uploaded file gets one data source; new files added later are appended. */
export function useEnsureFileSources() {
  const { files, setDataSources } = useWorkflow();

  useEffect(() => {
    if (!files.length) return;
    setDataSources((current) => {
      const knownFileIds = new Set(current.map((source) => source.file_id));
      const additions = files
        .filter((file) => file.id && !knownFileIds.has(file.id))
        .map((file, index) => createDataSource(file, current.length + index));
      return additions.length ? [...current, ...additions] : current;
    });
  }, [files, setDataSources]);
}
