import { describe, expect, it } from "vitest";
import { setupSignature } from "../features/files/WorkflowContext";
import { validateRule } from "../features/validation/builderModel";
import { plural } from "../features/validation/discrepancyNotes";
import { buildCompareRulesForMatchingFields } from "../features/validation/ruleSuggestions";
import { rowBoundaryError } from "../features/validation/rowSetupModel";
import type { ComparisonDataSource, ComparisonField, DataSourcePreview, PreviewRow } from "../types/validation.types";
import { buildSuggestedFieldsForSource, fieldTypeForLabel } from "../utils/fieldSuggestions";

function field(id: string, sourceId: string, name: string, type: ComparisonField["field_type"] = "text"): ComparisonField {
  return {
    id,
    data_source_id: sourceId,
    field_name: name,
    field_type: type,
    column_letter: "A",
    custom_display_name: name,
    required: false,
    normalization: { case_insensitive: true, trim_whitespace: true, collapse_whitespace: true },
  };
}

function source(id: string, fields: ComparisonField[]): ComparisonDataSource {
  return {
    id,
    name: id,
    file_id: `file-${id}`,
    sheet_name: "Sheet1",
    header_row: 1,
    first_data_row: 2,
    selected_row_numbers: [2, 3],
    ignored_row_numbers: [],
    row_selection_mode: "auto_detected",
    fields,
  };
}

function preview(dataSource: ComparisonDataSource, headers: string[], rows: Array<Array<string | number>>): DataSourcePreview {
  const columns = headers.map((header, index) => ({ index, letter: String.fromCharCode(65 + index), header_label: header, display_label: header }));
  const previewRows: PreviewRow[] = rows.map((values, index) => ({
    row_number: index + 2,
    selected: true,
    ignored: false,
    cells: Object.fromEntries(headers.map((header, column) => [header, values[column] ?? null])),
  }));
  return { data_source: dataSource, columns, rows: previewRows, total_rows: rows.length + 1, detected_selected_rows: previewRows.map((row) => row.row_number) };
}

describe("rule suggestions", () => {
  it("pairs rows by a key field even when the key columns have different names", () => {
    const left = source("left", [field("l-sku", "left", "SKU"), field("l-desc", "left", "Product Description")]);
    const right = source("right", [field("r-code", "right", "Product Code"), field("r-desc", "right", "Product Description")]);
    const rules = buildCompareRulesForMatchingFields(left, right);
    const description = rules.find((rule) => rule.left_field_id === "l-desc");
    expect(description?.match_strategy).toBe("by_item_number_field");
    expect(description?.left_match_field_ids).toEqual(["l-sku"]);
    expect(description?.right_match_field_ids).toEqual(["r-code"]);
    expect(description?.strictness).toBe("similar_text");
  });

  it("requires match keys when a rule does not pair by row order", () => {
    const left = source("left", [field("l-desc", "left", "Description")]);
    const right = source("right", [field("r-desc", "right", "Description")]);
    const [rule] = buildCompareRulesForMatchingFields(left, right);
    expect(rule).toBeDefined();
    const errors = validateRule({ ...rule!, match_strategy: "by_item_number_field", left_match_field_ids: [], right_match_field_ids: [] });
    expect(errors).toContain("Choose the match key fields used to pair rows.");
  });
});

describe("field suggestions", () => {
  it("does not treat item numbers as quantities", () => {
    expect(fieldTypeForLabel("Item No.")).toBe("text");
    expect(fieldTypeForLabel("Qty")).toBe("number");
    expect(fieldTypeForLabel("Unit Price")).toBe("currency");
  });

  it("defaults to optional fields and infers numeric columns from values", () => {
    const dataSource = source("s", []);
    const suggested = buildSuggestedFieldsForSource(
      dataSource,
      preview(dataSource, ["Remarks", "Extended Standard"], [["ok", "1,200.50"], ["", "300"], ["late", "15.25"]]),
      {},
    );
    expect(suggested.every((item) => item.required === false)).toBe(true);
    expect(suggested.find((item) => item.field_name === "Extended Standard")?.field_type).toBe("currency");
    expect(suggested.find((item) => item.field_name === "Remarks")?.field_type).toBe("text");
  });
});

describe("row setup", () => {
  it("rejects a first data row outside the worksheet", () => {
    const dataSource = { ...source("s", []), header_row: 5, first_data_row: 67 };
    const files = [{ id: "file-s", name: "a.xlsx", extension: ".xlsx", size: 1, sheets: [{ name: "Sheet1", row_count: 33, column_count: 8, detected_header_row: 5, headers: [], sample_rows: [] }] }];
    expect(rowBoundaryError(dataSource, files as never)).toMatch(/outside this worksheet/);
  });
});

describe("unsaved setup tracking", () => {
  it("ignores confirmation-only changes but notices rule edits", () => {
    const dataSource = source("s", [field("f", "s", "SKU")]);
    const base = setupSignature([dataSource], []);
    expect(setupSignature([{ ...dataSource, row_setup_confirmed: true }], [])).toBe(base);
    expect(setupSignature([{ ...dataSource, fields: [] }], [])).not.toBe(base);
  });
});

describe("copy helpers", () => {
  it("pluralizes counts", () => {
    expect(plural(1, "discrepancy", "discrepancies")).toBe("1 discrepancy");
    expect(plural(26, "discrepancy", "discrepancies")).toBe("26 discrepancies");
    expect(plural(0, "selected row")).toBe("0 selected rows");
  });
});
