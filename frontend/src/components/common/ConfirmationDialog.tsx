import { useId } from "react";
import { createPortal } from "react-dom";
import { ModalDialog } from "./ModalDialog";
import { type ConfirmDialogState } from "../../features/validation/builderModel";
import { secondaryButtonClass } from "../validation/builder/builderStyles";

export function ConfirmationDialog({ state, onClose }: { state: ConfirmDialogState | null; onClose: () => void }) {
  const titleId = useId();
  if (!state) return null;

  const confirmClass =
    state.tone === "danger"
      ? "rounded-xl bg-danger px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-danger-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
      : "rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600";

  const dialog = (
    <ModalDialog
      labelledBy={titleId}
      onClose={onClose}
      layerClassName="z-[130]"
      className="w-full max-w-md rounded-3xl border border-slate-200 bg-panel p-6 shadow-2xl animate-[builder-dialog-in_180ms_cubic-bezier(0.16,1,0.3,1)_forwards]"
    >
        <h2 id={titleId} className="text-lg font-semibold text-slate-950">
          {state.title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{state.description}</p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" data-autofocus onClick={onClose} className={secondaryButtonClass}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              state.onConfirm();
              onClose();
            }}
            className={confirmClass}
          >
            {state.confirmLabel}
          </button>
        </div>
    </ModalDialog>
  );

  return createPortal(dialog, document.body);
}
