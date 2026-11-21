import type { ValidationResult } from "../types/validation.types";
import { apiBlobWithHeaders, apiRequest } from "./apiClient";

export interface ExportedPdfReport {
  blob: Blob;
  filename: string;
}

export interface ReportInfo {
  filename: string;
  createdAt: string;
}

export interface OpenPdfResponse {
  status: "opened";
  filename: string;
}

function filenameFromDisposition(disposition: string | null) {
  if (!disposition) return null;
  const encodedMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (encodedMatch?.[1]) return decodeURIComponent(encodedMatch[1].replace(/"/g, ""));
  const plainMatch = disposition.match(/filename="?([^";]+)"?/i);
  return plainMatch?.[1] ?? null;
}

function fallbackReportFileName(projectName: string) {
  const safeName = projectName.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
  return `${safeName || "validation"}-comparison-report.pdf`;
}

export async function exportPdf(result: ValidationResult): Promise<ExportedPdfReport> {
  const response = await apiBlobWithHeaders(`/reports/pdf?ts=${Date.now()}`, result);
  const headerFilename = response.headers.get("X-Report-Filename");
  return {
    blob: response.blob,
    filename: headerFilename ?? filenameFromDisposition(response.headers.get("Content-Disposition")) ?? fallbackReportFileName(result.project_name),
  };
}

export async function savedReportInfo(resultId: string): Promise<ReportInfo[]> {
  const response = await apiRequest<Array<{ filename: string; created_at: string }>>(`/reports/${encodeURIComponent(resultId)}/saved`);
  return response.map((report) => ({ filename: report.filename, createdAt: report.created_at }));
}

/** Reports are addressed by bare filename; the backend resolves it inside the session's reports folder. */
function postReportAction(resultId: string, action: "open" | "folder", filename?: string | null) {
  return apiRequest<OpenPdfResponse>(`/reports/${encodeURIComponent(resultId)}/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: filename ?? null }),
  });
}

export const openPdfExternally = (resultId: string, filename?: string | null) => postReportAction(resultId, "open", filename);
export const openReportFolderExternally = (resultId: string, filename?: string | null) => postReportAction(resultId, "folder", filename);
