import { Database } from "lucide-react";
import { BuilderDrawer } from "../BuilderDrawer";
import { useDraftEditor } from "../../../hooks/useDraftEditor";
import type { UploadedFile } from "../../../types/file.types";
import type { ComparisonDataSource, DataSourcePreview } from "../../../types/validation.types";
import { sourceConfigSignature, type ConfirmDialogState, type SourceEditorState, validateSource } from "../../../features/validation/builderModel";
import { EditorSection, SelectInput, TextInput } from "./BuilderFormControls";

export function SourceDrawer({
  files,
  editor,
  open,
  onClose,
  onSave,
  requestConfirm,
}: {
  files: UploadedFile[];
  editor: SourceEditorState | null;
  open: boolean;
  onClose: () => void;
  onSave: (source: ComparisonDataSource, preview?: DataSourcePreview | null) => void;
  requestConfirm: (state: ConfirmDialogState) => void;
}) {
  const { draft, setDraft, dirty, reset } = useDraftEditor(editor?.initial ?? null);

  if (!editor || !draft) return null;
  const file = files.find((item) => item.id === draft.file_id) ?? files[0];
  const sheets = file?.sheets ?? [];
  const errors = validateSource(draft, files);
  const configChanged = sourceConfigSignature(editor.initial) !== sourceConfigSignature(draft);
  const footerMessage = errors[0] ?? (configChanged ? "Saving workbook or row-boundary changes clears the current preview. Review row setup from Step 1 or refresh rows in Step 2." : dirty ? "Save changes to update the source card and downstream workflow." : undefined);

  const updateDraft = (next: ComparisonDataSource) => {
    setDraft(next);
  };

  const handleCancel = () => {
    if (dirty) {
      requestConfirm({
        title: "Discard unsaved source changes?",
        description: "Your current source draft will be closed and the last saved version will remain unchanged.",
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
      title: "Discard source draft changes?",
      description: "This will throw away the current source edits and restore the last saved version.",
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
      title={editor.mode === "create" ? "Create source" : "Edit source"}
      description="Choose the workbook section and row boundaries for this comparison source. Draft edits stay local until you save."
      icon={Database}
      open={open}
      dirty={dirty}
      onCancel={handleCancel}
      onDiscard={handleDiscard}
      onSave={() => onSave(draft)}
      saveLabel={editor.mode === "create" ? "Create source" : "Save changes"}
      disableSave={errors.length > 0}
      warningMessage={footerMessage}
    >
      <div className="space-y-5">
        <EditorSection title="Source identity" description="Name the source and choose which uploaded workbook section it should read from.">
          <TextInput
            label="Source name"
            help="A friendly name used in rules and reports. This does not rename the original file."
            value={draft.name}
            onChange={(value) => updateDraft({ ...draft, name: value })}
            error={!draft.name.trim() ? "Source name is required." : undefined}
          />
          <SelectInput
            label="File"
            help="Choose the uploaded workbook or CSV this source will read from."
            value={draft.file_id}
            options={files.map((item) => ({ value: item.id, label: item.name }))}
            onChange={(value) => {
              const nextFile = files.find((item) => item.id === value) ?? files[0];
              if (!nextFile) return;
              const nextSheet = nextFile.sheets[0];
              updateDraft({
                ...draft,
                file_id: nextFile.id,
                file_name: nextFile.name,
                sheet_name: nextSheet?.name ?? "",
                header_row: nextSheet?.detected_header_row ?? 1,
                first_data_row: (nextSheet?.detected_header_row ?? 1) + 1,
                selected_row_numbers: [],
                ignored_row_numbers: [],
              });
            }}
          />
          <SelectInput
            label="Sheet"
            help="Choose the worksheet tab that contains the rows you want to compare."
            value={draft.sheet_name}
            options={sheets.map((sheet) => ({ value: sheet.name, label: sheet.name }))}
            onChange={(value) => updateDraft({ ...draft, sheet_name: value, selected_row_numbers: [], ignored_row_numbers: [] })}
            error={!draft.sheet_name ? "Sheet is required." : undefined}
          />
        </EditorSection>

        <EditorSection title="Row boundaries" description="Set where headers live and where the real data starts.">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <TextInput
              label="Header row"
              help="The Excel row where column labels are located."
              type="number"
              value={String(draft.header_row)}
              onChange={(value) => updateDraft({ ...draft, header_row: Number(value) || 0, selected_row_numbers: [], ignored_row_numbers: [] })}
              error={draft.header_row < 1 ? "Header row must be 1 or greater." : undefined}
            />
            <TextInput
              label="First data row"
              help="The first row that contains real data. Rows above this are skipped."
              type="number"
              value={String(draft.first_data_row)}
              onChange={(value) => updateDraft({ ...draft, first_data_row: Number(value) || 0, selected_row_numbers: [], ignored_row_numbers: [] })}
              error={draft.first_data_row <= draft.header_row ? "First data row must be greater than the header row." : undefined}
            />
          </div>
        </EditorSection>
      </div>
    </BuilderDrawer>
  );
}
