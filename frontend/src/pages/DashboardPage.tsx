import { FileCheck2, FileDown, LoaderCircle, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { EmptyState } from "../components/common/EmptyState";
import { StatusBadge } from "../components/common/StatusBadge";
import { PageHeader } from "../components/layout/PageHeader";
import { useSessionActions } from "../features/files/useSessionActions";
import { listRecentSessions, type RecentSession } from "../services/validationApi";

function fileSummary(fileNames: string[]) {
  if (!fileNames.length) return "No file list saved";
  if (fileNames.length === 1) return fileNames[0];
  return `${fileNames.slice(0, 2).join(", ")}${fileNames.length > 2 ? ` +${fileNames.length - 2} more` : ""}`;
}

function formatSessionDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Saved session" : date.toLocaleString();
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { loadSession } = useSessionActions();
  const [sessions, setSessions] = useState<RecentSession[]>([]);
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState("");

  const refreshSessions = () => {
    void listRecentSessions()
      .then((items) => {
        setSessions(items);
        setSessionError("");
      })
      .catch((cause) => setSessionError(cause instanceof Error ? cause.message : "Could not load saved sessions."));
  };

  useEffect(() => { refreshSessions(); }, []);
  useEffect(() => {
    const handleSessionsUpdated = () => refreshSessions();
    window.addEventListener("sessions:updated", handleSessionsUpdated);
    return () => window.removeEventListener("sessions:updated", handleSessionsUpdated);
  }, []);

  const openSession = async (session: RecentSession, destination: "/mapping" | "/results" | "/reports") => {
    setLoadingSessionId(session.id);
    setSessionError("");
    try {
      const { hasRunResult } = await loadSession(session.id);
      window.dispatchEvent(new CustomEvent("sidebar:view", { detail: { view: "workflow" } }));
      navigate(hasRunResult ? destination : "/mapping");
    } catch (cause) {
      setSessionError(cause instanceof Error ? cause.message : "Could not reopen this session.");
    } finally {
      setLoadingSessionId(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Validation sessions"
        description="Open a saved session or start a new validation."
        action={<Link className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600" to="/upload"><Plus aria-hidden="true" className="size-4" /> Start validation</Link>}
      />
      <div className="grid gap-8 pt-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section aria-labelledby="recent-sessions-title">
          <div className="mb-4"><h2 id="recent-sessions-title" className="text-base font-semibold">Recent sessions</h2><p className="mt-1 text-sm text-slate-500">Continue where you left off.</p></div>
          {sessionError ? <p className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700" role="alert">{sessionError}</p> : null}
          {sessions.length ? <ul className="divide-y divide-[var(--color-border)] rounded-2xl border border-slate-200 bg-panel">{sessions.slice(0, 8).map((session) => {
            const loading = loadingSessionId === session.id;
            return (
              <li key={session.id} className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="flex min-w-0 gap-4">
                  <FileCheck2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-emerald-700" />
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="min-w-0 truncate text-sm font-semibold text-slate-950" title={session.project_name}>{session.project_name}</p>
                      <StatusBadge tone={session.discrepancy_count ? "warning" : "neutral"}>{issueLabel(session.discrepancy_count)}</StatusBadge>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{formatSessionDate(session.created_at)}</p>
                    <p className="mt-1 truncate text-xs text-slate-500">{fileSummary(Array.isArray(session.file_names) ? session.file_names : [])}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  {session.latest_report_filename ? (
                    <button type="button" onClick={() => openSession(session, "/reports")} disabled={loading || session.can_reopen === false} title={`Latest report: ${session.latest_report_filename}`} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-300 bg-panel px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-50"><FileDown aria-hidden="true" className="size-4" /> Report</button>
                  ) : null}
                  <button type="button" onClick={() => openSession(session, "/results")} disabled={loading || session.can_reopen === false} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-300 bg-panel px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-50">{loading ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : null} Open session</button>
                </div>
              </li>
            );
          })}</ul> : <EmptyState icon={FileCheck2} title="No sessions yet" description="Choose local spreadsheets, map their data, review discrepancies, and export a report." />}
        </section>
        <aside aria-labelledby="workflow-steps-title" className="h-fit rounded-2xl border border-slate-200 bg-panel p-5"><h2 id="workflow-steps-title" className="text-xs font-bold uppercase tracking-[0.14em] text-slate-600">Workflow</h2><ol className="mt-4 space-y-4 text-sm">{["Upload files", "Row setup", "Comparison builder", "Validation results", "Export report"].map((step, index) => <li className="flex gap-3" key={step}><span className="grid size-6 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">{index + 1}</span><span className="pt-0.5 text-slate-700">{step}</span></li>)}</ol></aside>
      </div>
    </div>
  );
}

function issueLabel(count: number) {
  if (!count) return "No issues";
  return `${count} ${count === 1 ? "issue" : "issues"}`;
}
