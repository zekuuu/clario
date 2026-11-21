import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { applyLegacyDataAction, getLegacyDataStatus, type LegacyDataAction } from "../../services/setupApi";
import { ModalDialog } from "../common/ModalDialog";
import { useToast } from "../common/Toast";

const buttonBase = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButton = `${buttonBase} border border-slate-300 bg-panel text-slate-700 hover:bg-slate-50 focus-visible:outline-emerald-700`;
const primaryButton = `${buttonBase} bg-brand text-white hover:bg-brand-hover focus-visible:outline-emerald-600`;

const doneMessages: Record<LegacyDataAction, string> = {
  move: "Earlier sessions moved into this installation.",
  copy: "Earlier sessions copied. The old folder was kept as a backup.",
  skip: "Starting fresh. Your earlier data was left untouched.",
};

/** One-time choice for data left in ~/.clario by versions before the installer. */
export function LegacyDataPrompt() {
  const { showToast } = useToast();
  const [sessionCount, setSessionCount] = useState<number | null>(null);
  const [busyAction, setBusyAction] = useState<LegacyDataAction | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void getLegacyDataStatus()
      .then((status) => {
        if (active && status.available) setSessionCount(status.session_count);
      })
      // The prompt is optional: if the backend is unreachable the shell already reports it.
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  if (sessionCount === null) return null;

  const choose = async (action: LegacyDataAction) => {
    setBusyAction(action);
    setError("");
    try {
      await applyLegacyDataAction(action);
      setSessionCount(null);
      window.dispatchEvent(new CustomEvent("sessions:updated"));
      showToast(doneMessages[action], "success");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The earlier data could not be imported.");
    } finally {
      setBusyAction(null);
    }
  };

  const label = `${sessionCount} ${sessionCount === 1 ? "session" : "sessions"}`;
  const busy = busyAction !== null;

  return (
    // Escape counts as "decide later": nothing is stored, so the prompt returns on the next start.
    <ModalDialog labelledBy="legacy-data-title" onClose={() => (busy ? undefined : setSessionCount(null))} layerClassName="z-[125]" className="w-full max-w-lg rounded-3xl border border-slate-200 bg-panel p-6 shadow-2xl">
      <h2 id="legacy-data-title" className="text-lg font-semibold text-slate-950">Bring over your earlier sessions?</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Found {label} from an earlier version of Clario, saved in the old <code className="rounded bg-slate-100 px-1">.clario</code> folder in your user profile.
        Clario now keeps its data in the <code className="rounded bg-slate-100 px-1">data</code> folder of this installation.
      </p>
      <ul className="mt-3 space-y-1.5 text-sm leading-6 text-slate-600">
        <li><strong className="text-slate-900">Move here:</strong> bring everything over and remove the old folder.</li>
        <li><strong className="text-slate-900">Copy:</strong> bring everything over and keep the old folder as a backup.</li>
        <li><strong className="text-slate-900">Start fresh:</strong> leave the old folder untouched and start empty.</li>
      </ul>
      {error ? <p role="alert" className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <button type="button" disabled={busy} onClick={() => void choose("skip")} className={secondaryButton}>
          {busyAction === "skip" ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : null} Start fresh
        </button>
        <button type="button" disabled={busy} onClick={() => void choose("copy")} className={secondaryButton}>
          {busyAction === "copy" ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : null} Copy
        </button>
        <button type="button" data-autofocus disabled={busy} onClick={() => void choose("move")} className={primaryButton}>
          {busyAction === "move" ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : null} Move here
        </button>
      </div>
    </ModalDialog>
  );
}
