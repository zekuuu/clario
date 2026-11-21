import type { UploadedFile } from "../../types/file.types";
import type { ComparisonDataSource, DataSourcePreview, PreviewRow } from "../../types/validation.types";

type SetupConfidenceTone = "high" | "medium" | "low";

interface SetupConfidence {
  label: string;
  score: number;
  tone: SetupConfidenceTone;
  labelClassName: string;
  barClassName: string;
  detail: string;
  checks: string[];
}

export function sourceSignature(source: ComparisonDataSource) {
  return [source.file_id, source.sheet_name, source.header_row, source.first_data_row].join("|");
}

export function sourceFile(source: ComparisonDataSource, files: UploadedFile[]) {
  return files.find((file) => file.id === source.file_id) ?? files[0] ?? null;
}

export function sourceSheet(source: ComparisonDataSource, files: UploadedFile[]) {
  return sourceFile(source, files)?.sheets.find((sheet) => sheet.name === source.sheet_name) ?? null;
}

export function clampRow(value: number) {
  return Math.max(1, Number.isFinite(value) ? Math.trunc(value) : 1);
}

export function rowBoundaryError(source: ComparisonDataSource, files: UploadedFile[], preview?: DataSourcePreview) {
  const sheet = sourceSheet(source, files);
  const rowCount = sheet?.row_count || preview?.total_rows || (preview?.rows.length ? Math.max(...preview.rows.map((row) => row.row_number)) : undefined);
  if (source.header_row < 1) return "Header row must be 1 or higher.";
  if (source.first_data_row <= source.header_row) return "First data row must be below the header row.";
  if (!rowCount) return "";
  if (source.header_row > rowCount) return `Header row ${source.header_row} is outside this worksheet. Choose a row between 1 and ${rowCount}.`;
  if (source.first_data_row > rowCount) return `First data row ${source.first_data_row} is outside this worksheet. Choose a row between ${source.header_row + 1} and ${rowCount}.`;
  return "";
}

function setupBoundaryRows(headerRow: number, firstDataRow: number) {
  return Array.from({ length: Math.max(firstDataRow - 1, 0) }, (_, index) => index + 1).filter((rowNumber) => rowNumber !== headerRow);
}

export function applyRowBoundaries(source: ComparisonDataSource, headerRow: number, firstDataRow: number): ComparisonDataSource {
  const boundaryRows = setupBoundaryRows(headerRow, firstDataRow);
  return {
    ...source,
    header_row: headerRow,
    first_data_row: firstDataRow,
    selected_row_numbers: [],
    ignored_row_numbers: boundaryRows,
    row_selection_mode: "auto_detected",
  };
}

export function displayCell(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function normalizePreviewText(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim().replace(/\s+/g, " ").toLowerCase();
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function meaningfulValues(row?: PreviewRow) {
  if (!row) return [];
  return Object.values(row.cells)
    .map(normalizePreviewText)
    .filter((value) => value && value !== "-" && value !== "—" && value !== "n/a");
}

function isRepeatedSectionRow(row: PreviewRow) {
  const values = meaningfulValues(row);
  return values.length >= 3 && new Set(values).size === 1;
}

function isHeaderLikeRow(row: PreviewRow, headers: string[]) {
  const values = meaningfulValues(row);
  if (!values.length) return false;
  const normalizedHeaders = headers.map(normalizePreviewText).filter(Boolean);
  const exactHits = values.filter((value) => normalizedHeaders.includes(value)).length;
  if (exactHits >= Math.min(2, values.length, normalizedHeaders.length)) return true;
  const rowText = values.join(" / ");
  const wholeWordHits = normalizedHeaders.filter((header) => new RegExp(`(?<![a-z0-9])${escapeRegex(header)}(?![a-z0-9])`).test(rowText)).length;
  return wholeWordHits >= Math.min(2, normalizedHeaders.length);
}

export function sanitizeAutoDetectedPreview(preview: DataSourcePreview): DataSourcePreview {
  const source = preview.data_source;
  const headers = preview.columns.map((column) => column.header_label);
  const ignoredRows = new Set(setupBoundaryRows(source.header_row, source.first_data_row));
  const selectedRows = preview.rows
    .filter((row) => {
      if (row.row_number < source.first_data_row || ignoredRows.has(row.row_number)) return false;
      if (isRepeatedSectionRow(row)) return false;
      return meaningfulValues(row).length > 0 && !isHeaderLikeRow(row, headers);
    })
    .map((row) => row.row_number);
  const selectedRowSet = new Set(selectedRows);
  return {
    ...preview,
    data_source: {
      ...source,
      selected_row_numbers: selectedRows,
      ignored_row_numbers: [...ignoredRows].sort((a, b) => a - b),
      row_selection_mode: "auto_detected",
    },
    rows: preview.rows.map((row) => ({
      ...row,
      selected: selectedRowSet.has(row.row_number),
      ignored: ignoredRows.has(row.row_number),
    })),
    detected_selected_rows: selectedRows,
  };
}

export function isVisualAutoExcludedRow(row: PreviewRow, source: ComparisonDataSource) {
  return row.row_number >= source.first_data_row && isRepeatedSectionRow(row);
}

function confidenceStyle(tone: SetupConfidenceTone) {
  if (tone === "high") return { labelClassName: "text-emerald-700", barClassName: "bg-emerald-500" };
  if (tone === "medium") return { labelClassName: "text-amber-700", barClassName: "bg-amber-500" };
  return { labelClassName: "text-slate-600", barClassName: "bg-slate-400" };
}

export function setupConfidence(source: ComparisonDataSource, files: UploadedFile[], preview: DataSourcePreview | undefined, stalePreview: boolean, boundaryError: string): SetupConfidence {
  if (boundaryError) {
    return {
      label: "Low confidence",
      score: 15,
      tone: "low",
      ...confidenceStyle("low"),
      detail: "Fix the row numbers before confirming this source.",
      checks: ["Header row and first data row must be inside the worksheet range."],
    };
  }

  if (!preview) {
    return {
      label: "Not checked",
      score: 0,
      tone: "low",
      ...confidenceStyle("low"),
      detail: "Load the preview so Clario can inspect the detected rows.",
      checks: ["Preview not loaded yet."],
    };
  }

  if (stalePreview) {
    return {
      label: "Needs refresh",
      score: 25,
      tone: "low",
      ...confidenceStyle("low"),
      detail: "Refresh the preview before confirming this source.",
      checks: ["Preview does not match the current row setup."],
    };
  }

  const sheet = sourceSheet(source, files);
  const headers = preview.columns.map((column) => column.header_label);
  const headerRow = preview.rows.find((row) => row.row_number === source.header_row);
  const firstDataRow = preview.rows.find((row) => row.row_number === source.first_data_row);
  const headerValues = meaningfulValues(headerRow);
  const dataValues = meaningfulValues(firstDataRow);
  const selectedRows = preview.rows.filter((row) => row.selected && !row.ignored).length;
  const checks: string[] = [];
  let score = 40;

  if (headerRow && headerValues.length >= Math.min(2, Math.max(1, preview.columns.length))) {
    score += 20;
    checks.push(`Header row ${source.header_row} has column labels.`);
  } else {
    checks.push(`Header row ${source.header_row} may be blank or incomplete.`);
  }

  if (firstDataRow && dataValues.length >= 2 && !isHeaderLikeRow(firstDataRow, headers) && !isRepeatedSectionRow(firstDataRow)) {
    score += 25;
    checks.push(`First data row ${source.first_data_row} looks like a real item row.`);
  } else {
    checks.push(`First data row ${source.first_data_row} should be reviewed.`);
  }

  if (source.first_data_row === source.header_row + 1) {
    score += 5;
    checks.push("Header and first data row are directly connected.");
  } else {
    checks.push("Rows between header and first data are excluded from validation.");
  }

  if (selectedRows > 0) {
    score += 10;
    checks.push(`${selectedRows} data row${selectedRows === 1 ? "" : "s"} detected for validation.`);
  } else {
    checks.push("No data rows were detected yet.");
  }

  if (sheet?.detected_header_row === source.header_row) score += 5;

  const finalScore = Math.min(100, score);
  const tone: SetupConfidenceTone = finalScore >= 80 ? "high" : finalScore >= 55 ? "medium" : "low";
  const label = tone === "high" ? "High confidence" : tone === "medium" ? "Medium confidence" : "Low confidence";
  const detail = tone === "high"
    ? "Header and first data row look consistent."
    : tone === "medium"
      ? "Most setup signals look usable, but review the highlighted rows."
      : "Review the highlighted rows carefully before confirming.";

  return {
    label,
    score: finalScore,
    tone,
    ...confidenceStyle(tone),
    detail,
    checks: checks.slice(0, 4),
  };
}
