import { Plus, RefreshCw, Search, X } from "lucide-react";
import { SessionOptionsMenu, SessionRenameInput } from "./SessionControls";
import { formatSessionMeta, type SessionLibrary } from "./useSessionLibrary";

interface SidebarSessionsPanelProps {
  collapsed: boolean;
  library: SessionLibrary;
  activeSessionId: string | null;
  openingSessionId: string | null;
  onStartValidation: () => void;
  onOpenSession: (sessionId: string) => void;
}

/** Sidebar "sessions" view: start button, search, and the saved-session list. */
export function SidebarSessionsPanel({ collapsed, library, activeSessionId, openingSessionId, onStartValidation, onOpenSession }: SidebarSessionsPanelProps) {
  return (
    <div className={`flex-1 overflow-y-auto overflow-x-hidden ${collapsed ? "px-2 py-3" : "px-3 py-4"}`}>
      <button
        type="button"
        onClick={onStartValidation}
        className={`flex h-10 items-center rounded-xl bg-brand text-sm font-semibold text-white transition hover:bg-brand-hover active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${collapsed ? "mx-auto w-10 justify-center" : "w-full gap-3 px-3"}`}
        title="Start validation"
        aria-label="Start validation"
      >
        <Plus aria-hidden="true" className="size-[18px] shrink-0" />
        <span className={`min-w-0 overflow-hidden truncate transition-all duration-300 ${collapsed ? "w-0 opacity-0" : "w-[150px] opacity-100"}`}>Start validation</span>
      </button>

      {collapsed ? null : (
        <>
          <div className="mt-4">
            <label className="sr-only" htmlFor="session-search">Search sessions</label>
            <div className="session-search-field flex h-10 w-full items-center gap-2 rounded-xl border border-slate-300 bg-panel px-3 text-left text-slate-800 outline-none transition duration-200 hover:border-slate-400 hover:bg-slate-50 focus-within:border-emerald-600 focus-within:ring-3 focus-within:ring-emerald-100">
              <Search aria-hidden="true" className="size-4 shrink-0" />
              <input
                id="session-search"
                value={library.query}
                onChange={(event) => library.setQuery(event.target.value)}
                placeholder="Search sessions"
                className="session-search-input min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-slate-950 outline-none placeholder:text-slate-500"
              />
              {library.query ? (
                <button
                  type="button"
                  onClick={() => library.setQuery("")}
                  className="grid size-6 shrink-0 place-items-center rounded text-slate-500 hover:filter-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700"
                  aria-label="Clear session search"
                  title="Clear session search"
                >
                  <X aria-hidden="true" className="search-clear-icon size-3.5 text-slate-500 hover:text-red-600" />
                </button>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between px-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
            <span>Sessions</span>
            <button
              type="button"
              onClick={library.loadSessions}
              disabled={library.loading}
              className="grid size-7 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              title="Refresh sessions"
              aria-label="Refresh sessions"
            >
              <RefreshCw aria-hidden="true" className={`size-3.5 ${library.loading ? "animate-spin" : ""}`} />
            </button>
          </div>
          {library.loading ? <p className="mt-3 px-3 text-xs text-slate-500">Loading sessions...</p> : null}
          <ul className="mt-2 space-y-1.5">
            {library.filteredSessions.map((session) => {
              const active = activeSessionId === session.id;
              return (
                <li
                  key={session.id}
                  data-session-menu={session.id}
                  className={`relative flex items-stretch rounded-2xl transition ${active ? "bg-emerald-50 text-emerald-800" : "text-slate-700 hover:bg-slate-100 hover:text-slate-950"}`}
                >
                  <div className="min-w-0 flex-1">
                    {library.editingSessionId === session.id ? (
                      <div className="px-3 py-2.5">
                        <SessionRenameInput
                          session={session}
                          library={library}
                          className="session-rename-input block w-full bg-transparent p-0 text-sm font-semibold leading-5 text-slate-950 outline-none"
                        />
                        <span className="mt-1 block text-xs leading-4 text-slate-500">{formatSessionMeta(session)}</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onOpenSession(session.id)}
                        disabled={openingSessionId === session.id || library.mutatingSessionId === session.id}
                        aria-current={active ? "true" : undefined}
                        className="w-full rounded-2xl px-3 py-2.5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-700 active:scale-[0.99] disabled:opacity-60"
                        title={`Open ${session.project_name}`}
                      >
                        <span className="block truncate text-sm font-semibold">{session.project_name}</span>
                        <span className="mt-1 block text-xs leading-4 text-slate-500">{formatSessionMeta(session)}</span>
                      </button>
                    )}
                  </div>
                  <SessionOptionsMenu
                    session={session}
                    library={library}
                    triggerClassName="group mr-1.5 grid size-10 shrink-0 place-items-center self-center rounded-xl text-slate-500 transition hover:bg-transparent hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-700 disabled:opacity-60"
                    menuClassName="absolute right-1.5 top-11 z-40 w-44 rounded-2xl border border-slate-200 bg-panel p-1.5 shadow-xl shadow-slate-200/70"
                  />
                </li>
              );
            })}
          </ul>
          {!library.loading && !library.filteredSessions.length ? (
            <p className="px-3 py-4 text-xs leading-5 text-slate-500">
              {library.query ? "No sessions match this search." : "No sessions yet. Start validation to create one."}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
