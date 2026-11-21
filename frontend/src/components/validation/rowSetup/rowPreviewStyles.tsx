import { AlertTriangle, CheckCircle2, Rows3 } from "lucide-react";
import type { ComparisonDataSource, DataSourcePreview, PreviewRow } from "../../../types/validation.types";
import { isVisualAutoExcludedRow } from "../../../features/validation/rowSetupModel";

export function rowTone(row: PreviewRow, source: ComparisonDataSource, selected: boolean) {
  if (selected) return "row-preview-row row-preview-row--selected";
  if (row.row_number === source.header_row) return "row-preview-row row-preview-row--header";
  if (row.row_number === source.first_data_row) return "row-preview-row row-preview-row--first-data";
  if (isVisualAutoExcludedRow(row, source)) return "row-preview-row row-preview-row--excluded";
  if (row.selected) return "row-preview-row row-preview-row--included";
  return "row-preview-row";
}

export function rowBadge(row: PreviewRow, source: ComparisonDataSource) {
  const className = "inline-flex w-fit max-w-full shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-xs";
  if (row.row_number === source.header_row) return <span className={`${className} bg-sky-100 font-semibold text-sky-700`}>Header row</span>;
  if (row.row_number === source.first_data_row) return <span className={`${className} bg-amber-100 font-semibold text-amber-800`}>First data row</span>;
  if (row.ignored || row.row_number < source.first_data_row || isVisualAutoExcludedRow(row, source)) return <span className={`${className} bg-slate-100 font-medium text-slate-500`}>Excluded row</span>;
  if (row.selected) return <span className={`${className} bg-emerald-50 font-semibold text-emerald-700`}>Selected data</span>;
  return <span className={`${className} bg-slate-100 font-medium text-slate-500`}>Preview row</span>;
}

export function rowAccentClass(row: PreviewRow, source: ComparisonDataSource, selected: boolean) {
  if (selected) return "row-preview-accent--selected";
  if (row.row_number === source.header_row) return "border-l-sky-500";
  if (row.row_number === source.first_data_row) return "border-l-amber-500";
  if (isVisualAutoExcludedRow(row, source)) return "border-l-transparent";
  if (row.selected) return "border-l-emerald-200";
  return "border-l-transparent";
}

export function rowCellClass(selected: boolean) {
  return selected ? "row-preview-cell row-preview-cell--selected" : "row-preview-cell border-b border-slate-100";
}

export function confirmedStatus(source: ComparisonDataSource, preview?: DataSourcePreview) {
  if (source.row_setup_confirmed) {
    return {
      label: "Confirmed",
      className: "bg-emerald-50 text-emerald-700",
      icon: CheckCircle2,
      detail: "This source is ready for rows, fields, and rules.",
    };
  }
  if (preview) {
    return {
      label: "Needs confirmation",
      className: "bg-amber-50 text-amber-700",
      icon: AlertTriangle,
      detail: "Review the highlighted rows, then confirm this source.",
    };
  }
  return {
    label: "Preview needed",
    className: "bg-slate-100 text-slate-700",
    icon: Rows3,
    detail: "Load the spreadsheet preview to see the actual rows.",
  };
}
