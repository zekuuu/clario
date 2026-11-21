import { useWorkflow } from "../files/WorkflowContext";
import type { RuleDiscrepancy, RuleType } from "../../types/validation.types";

export const ruleLabels: Record<RuleType, string> = {
  compare_values: "Compare two fields",
  formula_check: "Formula check",
  required_field_check: "Required field check",
  duplicate_check: "Duplicate check",
};

const severityOrder: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

interface SmartNote {
  title: string;
  detail: string;
}

function valueText(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function numberValue(value: unknown) {
  const text = valueText(value).replace(/,/g, "");
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function alphaNumericSignature(value: unknown) {
  return valueText(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function compactWhitespace(value: unknown) {
  return valueText(value).replace(/\s+/g, " ");
}

function fieldPair(item: RuleDiscrepancy) {
  return {
    expectedField: item.left_field_name || "expected field",
    actualField: item.right_field_name || "actual field",
  };
}

function ruleTypeNote(item: RuleDiscrepancy): SmartNote | null {
  if (item.rule_type === "required_field_check") {
    return {
      title: "Required value is missing",
      detail: `Fill in ${item.left_field_name || "the required field"}, or exclude the row if it is not a real data row.`,
    };
  }

  if (item.rule_type === "duplicate_check") {
    return {
      title: "Duplicate selected row",
      detail: "This value appears more than once in the selected rows. Keep one valid row or merge duplicate entries.",
    };
  }

  if (item.rule_type === "formula_check") {
    return {
      title: "Formula result does not match",
      detail: item.notes || `Recheck the source numbers used to calculate ${item.left_field_name || "the result field"}.`,
    };
  }

  return null;
}

function compareValueNote(item: RuleDiscrepancy): SmartNote {
  const expected = valueText(item.expected_value);
  const actual = valueText(item.actual_value);
  const { expectedField, actualField } = fieldPair(item);
  const expectedNumber = numberValue(expected);
  const actualNumber = numberValue(actual);
  const missingLeftLocation = !item.left_row_number;
  const missingRightLocation = !item.right_row_number;

  if (missingLeftLocation || missingRightLocation) {
    const missingSide = missingLeftLocation ? "left" : "right";
    const presentSide = missingSide === "left" ? "right" : "left";
    return {
      title: "Missing row match",
      detail: `The ${presentSide} side has a selected row, but the ${missingSide} side has no row with the same match key. The missing side is shown as Blank; check the match field or exclude the row if it should not be compared.`,
    };
  }

  if (!expected && actual) {
    return {
      title: "Unexpected value found",
      detail: `${actualField} has a value, but the trusted ${expectedField} is blank. Confirm the row pairing and selected rows.`,
    };
  }

  if (expected && !actual) {
    return {
      title: "Actual value is blank",
      detail: `${actualField} is missing. Copy or encode the trusted ${expectedField} value if the row should match.`,
    };
  }

  if (expectedNumber !== null && actualNumber !== null && expectedNumber !== actualNumber) {
    const difference = actualNumber - expectedNumber;
    const direction = difference > 0 ? "higher" : "lower";
    return {
      title: `Actual value is ${direction}`,
      detail: `${actualField} differs from ${expectedField} by ${Math.abs(difference).toLocaleString()}. Expected ${expected}, found ${actual}.`,
    };
  }

  if (expected && actual) {
    const expectedCase = compactWhitespace(expected).toLowerCase();
    const actualCase = compactWhitespace(actual).toLowerCase();
    const expectedSignature = alphaNumericSignature(expected);
    const actualSignature = alphaNumericSignature(actual);

    if (expectedCase === actualCase && compactWhitespace(expected) !== compactWhitespace(actual)) {
      return {
        title: "Capitalization or spacing only",
        detail: "The words appear the same after ignoring capitalization or extra spaces. Adjust the rule if this should be accepted.",
      };
    }

    if (expectedSignature && expectedSignature === actualSignature) {
      return {
        title: "Formatting difference only",
        detail: "The letters and numbers match, but punctuation, symbols, spacing, or unit formatting differ. Review whether formatting must match exactly.",
      };
    }

    return {
      title: "Text content does not match",
      detail: `Review wording, units, model details, or spelling in ${actualField}. Use the trusted ${expectedField} value if this row should match exactly.`,
    };
  }

  return {
    title: "Review this row pairing",
    detail: item.notes || item.suggested_correction || "The rule found a mismatch. Check the selected rows, fields, and match strategy.",
  };
}

export function smartNoteFor(item: RuleDiscrepancy): SmartNote {
  return ruleTypeNote(item) ?? compareValueNote(item);
}

function firstDiscrepancyRow(item: RuleDiscrepancy) {
  const rows = [item.left_row_number, item.right_row_number].filter((row): row is number => typeof row === "number");
  return rows.length ? Math.min(...rows) : Number.MAX_SAFE_INTEGER;
}

export function compareDiscrepancies(left: RuleDiscrepancy, right: RuleDiscrepancy) {
  const severityDelta = (severityOrder[left.severity] ?? 99) - (severityOrder[right.severity] ?? 99);
  if (severityDelta !== 0) return severityDelta;

  const rowDelta = firstDiscrepancyRow(left) - firstDiscrepancyRow(right);
  if (rowDelta !== 0) return rowDelta;

  return left.rule_name.localeCompare(right.rule_name, undefined, { sensitivity: "base" });
}

export function compareRuleSummaries(
  left: NonNullable<ReturnType<typeof useWorkflow>["result"]>["rule_summaries"][number],
  right: NonNullable<ReturnType<typeof useWorkflow>["result"]>["rule_summaries"][number],
) {
  const countDelta = right.discrepancy_count - left.discrepancy_count;
  if (countDelta !== 0) return countDelta;

  const severityDelta = (severityOrder[left.severity] ?? 99) - (severityOrder[right.severity] ?? 99);
  if (severityDelta !== 0) return severityDelta;

  return left.rule_name.localeCompare(right.rule_name, undefined, { sensitivity: "base" });
}

export const severityText: Record<string, string> = { high: "High", medium: "Medium", low: "Low" };

export function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

export function severityPillClass(severity: string) {
  if (severity === "high") return "bg-red-50 text-red-700";
  if (severity === "medium") return "bg-amber-50 text-amber-700";
  return "bg-slate-100 text-slate-600";
}
