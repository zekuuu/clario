import { ArrowLeft, FileOutput, FileSearch, Files, Rows3, SlidersHorizontal, type LucideIcon } from "lucide-react";
import { NavLink } from "react-router-dom";
import type { RecentSession } from "../../../services/validationApi";
import { SessionOptionsMenu, SessionRenameInput } from "./SessionControls";
import type { SessionLibrary } from "./useSessionLibrary";

type NavRequirement = "files" | "result";

const requirementHints: Record<NavRequirement, string> = {
  files: "Upload files first",
  result: "Run validation first",
};

const workflowSteps: Array<{ to: string; label: string; icon: LucideIcon; requires?: NavRequirement }> = [
  { to: "/upload", label: "Upload files", icon: Files },
  { to: "/mapping", label: "Row setup", icon: Rows3, requires: "files" },
  { to: "/builder", label: "Comparison builder", icon: SlidersHorizontal, requires: "files" },
  { to: "/results", label: "Validation results", icon: FileSearch, requires: "result" },
  { to: "/reports", label: "Export report", icon: FileOutput, requires: "result" },
];

interface SidebarWorkflowPanelProps {
  collapsed: boolean;
  library: SessionLibrary;
  activeSession?: RecentSession;
  activeSessionName: string;
  hasFiles: boolean;
  hasResult: boolean;
  onCloseSession: () => void;
}

/** Sidebar "workflow" view: the active session header and the step navigation. */
export function SidebarWorkflowPanel({ collapsed, library, activeSession, activeSessionName, hasFiles, hasResult, onCloseSession }: SidebarWorkflowPanelProps) {
  const meetsRequirement = (requirement?: NavRequirement) => !requirement || (requirement === "files" ? hasFiles : hasResult);
  const itemLayout = collapsed ? "mx-auto w-10 justify-center p-0" : "w-full gap-3 px-3";

  return (
    <>
      <div className={`shrink-0 ${collapsed ? "px-2 py-3" : "px-3 py-4"}`}>
        <div data-session-menu={activeSession?.id} className={`relative flex h-10 items-center ${collapsed ? "justify-center" : "gap-3"}`}>
          <button
            type="button"
            onClick={onCloseSession}
            className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
            title={`Return to sessions from ${activeSessionName}`}
            aria-label={`Return to sessions from ${activeSessionName}`}
          >
            <ArrowLeft aria-hidden="true" className="size-[18px]" />
          </button>
          {activeSession && library.editingSessionId === activeSession.id ? (
            <SessionRenameInput
              session={activeSession}
              library={library}
              className="session-rename-input min-w-0 flex-1 bg-transparent p-0 text-sm font-semibold text-slate-950 outline-none"
            />
          ) : (
            <span className={`min-w-0 overflow-hidden truncate text-sm font-semibold text-slate-600 transition-all duration-300 ${collapsed ? "w-0 opacity-0" : "w-[150px] opacity-100"}`}>{activeSessionName}</span>
          )}
          {!collapsed && activeSession ? (
            <SessionOptionsMenu
              session={activeSession}
              library={library}
              triggerClassName="group ml-auto grid size-8 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-700 disabled:opacity-60"
              menuClassName="absolute right-0 top-11 z-40 w-44 rounded-2xl border border-slate-200 bg-panel p-1.5 shadow-xl shadow-slate-200/70"
            />
          ) : null}
        </div>
      </div>
      <nav aria-label="Workflow navigation" className={`flex-1 overflow-y-auto overflow-x-hidden ${collapsed ? "px-2 py-1" : "px-3 py-1"}`}>
        <div className={`overflow-hidden whitespace-nowrap text-xs font-bold uppercase tracking-[0.16em] text-slate-500 transition-all duration-200 ${collapsed ? "mb-0 h-0 px-0 opacity-0" : "mb-1.5 h-4 px-3 opacity-100"}`}>
          Review workflow
        </div>
        <ol className="space-y-1">
          {workflowSteps.map(({ to, label, icon: Icon, requires }) => (
            <li key={to}>
              {meetsRequirement(requires) ? (
                <NavLink
                  aria-label={label}
                  className={({ isActive }) =>
                    `group flex h-10 items-center rounded-xl text-sm font-medium transition-colors duration-200 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${itemLayout} ${
                      isActive ? "bg-emerald-50 text-emerald-800" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                    }`
                  }
                  title={collapsed ? label : undefined}
                  to={to}
                >
                  <Icon aria-hidden="true" className="size-[18px] shrink-0" />
                  <span className={`min-w-0 overflow-hidden truncate transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${collapsed ? "w-0 -translate-x-2 opacity-0" : "w-[150px] translate-x-0 opacity-100 delay-75"}`}>{label}</span>
                </NavLink>
              ) : (
                <span
                  role="link"
                  aria-disabled="true"
                  aria-label={`${label} (${requirementHints[requires ?? "files"]})`}
                  title={requirementHints[requires ?? "files"]}
                  className={`flex h-10 cursor-not-allowed items-center rounded-xl text-sm font-medium text-slate-500 opacity-70 ${itemLayout}`}
                >
                  <Icon aria-hidden="true" className="size-[18px] shrink-0" />
                  {collapsed ? null : <span className="min-w-0 truncate">{label}</span>}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}
