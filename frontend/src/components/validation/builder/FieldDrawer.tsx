import { SlidersHorizontal } from "lucide-react";
import { FieldLabel } from "../../forms/FieldLabel";
import { BuilderDrawer } from "../BuilderDrawer";
import { ColumnPicker } from "../ColumnPicker";
import { useDraftEditor } from "../../../hooks/useDraftEditor";
import type { ComparisonDataSource, ComparisonField, FieldType } from "../../../types/validation.types";
import { fieldTypeLabels, type ConfirmDialogState, type FieldEditorState, validateField } from "../../../features/validation/builderModel";
import { CheckboxCard, EditorSection, SelectInput, TextInput } from "./BuilderFormControls";

export function FieldDrawer({
  editor,
  source,
  open,
  onClose,
  onSave,
  requestConfirm,
}: {
  editor: FieldEditorState | null;
  source: ComparisonDataSource | null;
  open: boolean;
  onClose: () => void;
  onSave: (field: ComparisonField) => void;
  requestConfirm: (state: ConfirmDialogState) => void;
}) {
  const { draft, setDraft, dirty, reset } = useDraftEditor(editor?.initial ?? null);

  if (!editor || !source || !draft) return null;
  const preview = editor.preview;
  const errors = validateField(draft, preview);
  const footerMessage = errors[0] ?? (dirty ? "Save changes to update the field mapping used by rules and reports." : undefined);

  const handleCancel = () => {
    if (dirty) {
      requestConfirm({
        title: "Discard unsaved field changes?",
        description: "Your current field draft will be closed and the last saved mapping will remain unchanged.",
        confirmLabel: "Discard changes",
        tone: "danger",
        onConfirm: () => {
          reset();
          onClose();
        },
      });
      return;
    }
    reset();
    onClose();
  };

  const handleDiscard = () => {
    requestConfirm({
      title: "Discard field draft changes?",
      description: "This will throw away the current field edits and restore the last saved mapping.",
      confirmLabel: "Discard changes",
      tone: "danger",
      onConfirm: () => {
        reset();
        onClose();
      },
    });
  };

  return (
    <BuilderDrawer
      title={editor.mode === "create" ? "Create field" : "Edit field"}
      description="Map one spreadsheet column to a named value used in validation rules and reports."
      icon={SlidersHorizontal}
      open={open}
      dirty={dirty}
      onCancel={handleCancel}
      onDiscard={handleDiscard}
      onSave={() => onSave(draft)}
      saveLabel={editor.mode === "create" ? "Create field" : "Save changes"}
      disableSave={errors.length > 0}
      warningMessage={footerMessage}
    >
      <div className="space-y-5">
        <EditorSection title="Field details" description="Define the business label and comparison behavior for this value.">
          <TextInput
            label="Field name"
            help="The name used in rules and reports, such as Quantity, Unit Cost, or Brand."
            value={draft.field_name}
            onChange={(value) => setDraft({ ...draft, field_name: value, custom_display_name: value })}
            error={!draft.field_name.trim() ? "Field name is required." : undefined}
          />
          <SelectInput
            label="Field type"
            help="Controls how values are normalized and compared."
            value={draft.field_type}
            options={(Object.keys(fieldTypeLabels) as FieldType[]).map((value) => ({ value, label: fieldTypeLabels[value] }))}
            onChange={(value) => setDraft({ ...draft, field_type: value as FieldType })}
          />
          <CheckboxCard
            checked={draft.required}
            onChange={(checked) => setDraft({ ...draft, required: checked })}
            label="Required field"
            help="Flags selected rows where this field is blank."
          />
        </EditorSection>

        <EditorSection title="Column mapping" description="Choose the source column by letter so mapping stays stable even if headers are unclear or duplicated.">
          <div>
            <div className="mb-1.5">
              <FieldLabel help="The spreadsheet column where this value comes from. Column letters are used so mapping still works with unclear or duplicate headers.">
                Column
              </FieldLabel>
            </div>
            {preview ? (
              <ColumnPicker columns={preview.columns} preview={preview} ariaLabel="Spreadsheet column for this field" value={draft.column_letter} onChange={(value) => {
                const column = preview.columns.find((item) => item.letter === value);
                setDraft({ ...draft, column_letter: value, original_header_label: column?.header_label ?? draft.original_header_label });
              }} />
            ) : (
              <p className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">Preview rows for this source before choosing a column.</p>
            )}
          </div>
        </EditorSection>

        <EditorSection title="Normalization" description="Choose how text values should be cleaned before comparison.">
          <div className="space-y-3">
            <CheckboxCard
              checked={draft.normalization.case_insensitive}
              onChange={(checked) => setDraft({ ...draft, normalization: { ...draft.normalization, case_insensitive: checked } })}
              label="Ignore case"
              help="Treat uppercase and lowercase text as equal during comparison."
            />
            <CheckboxCard
              checked={draft.normalization.trim_whitespace}
              onChange={(checked) => setDraft({ ...draft, normalization: { ...draft.normalization, trim_whitespace: checked } })}
              label="Trim spaces"
              help="Remove extra spaces at the start and end."
            />
            <CheckboxCard
              checked={draft.normalization.collapse_whitespace}
              onChange={(checked) => setDraft({ ...draft, normalization: { ...draft.normalization, collapse_whitespace: checked } })}
              label="Collapse spaces"
              help="Treat repeated spaces and line breaks as one space."
            />
          </div>
        </EditorSection>
      </div>
    </BuilderDrawer>
  );
}
