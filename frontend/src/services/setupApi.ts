import { apiRequest } from "./apiClient";

export type LegacyDataAction = "move" | "copy" | "skip";

export interface LegacyDataStatus {
  available: boolean;
  session_count: number;
}

export const getLegacyDataStatus = () => apiRequest<LegacyDataStatus>("/setup/legacy-data");

export const applyLegacyDataAction = (action: LegacyDataAction) =>
  apiRequest<{ action: LegacyDataAction; imported_sessions: number }>("/setup/legacy-data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
