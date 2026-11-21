

interface LocationCellProps {
  fileName?: string | null;
  sheetName?: string | null;
  rowNumber?: number | null;
}

export function LocationCell({ label, fileName, sheetName, rowNumber }: LocationCellProps & { label: string }) {
  if (!fileName && !sheetName && !rowNumber) {
    return (
      <span className="block">
        <span className="text-slate-500">{label}: </span>
        <span className="font-medium text-slate-500">No matching row</span>
      </span>
    );
  }
  // Full path in the tooltip; long file names used to overlap the neighbouring column.
  const full = `${fileName ?? "-"} / ${sheetName ?? "-"} / row ${rowNumber ?? "blank"}`;
  return (
    <span className="block min-w-0 truncate" title={full}>
      <span className="text-slate-500">{label}: </span>
      <span className="font-medium text-slate-700">{rowNumber ? `Row ${rowNumber}` : "Blank row"}</span>
    </span>
  );
}

function BlankValueBadge() {
  return <span className="font-medium text-slate-500">Blank</span>;
}

export function ValueCell({ value }: { value?: string | null }) {
  const text = value === null || value === undefined ? "" : String(value).trim();
  if (!text || text === "Blank") {
    return <BlankValueBadge />;
  }
  return (
    <span className="block whitespace-pre-wrap break-words">{text}</span>
  );
}
