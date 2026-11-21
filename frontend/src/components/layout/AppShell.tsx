import { LockKeyhole, Menu, PanelLeftOpen } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { appConfig } from "../../app/config";
import { useSessionActions } from "../../features/files/useSessionActions";
import { useWorkflow } from "../../features/files/WorkflowContext";
import type { ConfirmDialogState } from "../../features/validation/builderModel";
import type { RecentSession } from "../../services/validationApi";
import { ConfirmationDialog } from "../common/ConfirmationDialog";
import { ToastProvider, useToast } from "../common/Toast";
import { CommonFieldsChooser } from "../validation/CommonFieldsChooser";
import { LegacyDataPrompt } from "./LegacyDataPrompt";
import { SidebarSessionsPanel } from "./sidebar/SidebarSessionsPanel";
import { SidebarWorkflowPanel } from "./sidebar/SidebarWorkflowPanel";
import { useSessionLibrary } from "./sidebar/useSessionLibrary";
import { ThemeSwitcher } from "./ThemeSwitcher";

type SidebarView = "sessions" | "workflow";

const logoLightSrc = "/assets/clario-logo_light.png";
const logoDarkSrc = "/assets/clario-logo_dark.png";

function Logo({ className = "size-7 object-contain" }: { className?: string }) {
  return (
    <>
      <img src={logoLightSrc} alt="" aria-hidden="true" className={`clario-logo clario-logo--light ${className}`} />
      <img src={logoDarkSrc} alt="" aria-hidden="true" className={`clario-logo clario-logo--dark ${className}`} />
    </>
  );
}

function AppShellContent() {
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarView, setSidebarView] = useState<SidebarView>("sessions");
  const [openingSessionId, setOpeningSessionId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { sessionId, projectName, setProjectName, preset, files, result, setResult, hasUnsavedSetup } = useWorkflow();
  const { clearWorkflowState, loadSession } = useSessionActions();

  const activeSessionId = result?.id || sessionId;
  const activeSessionName = result?.project_name || projectName || "No active session";

  const leaveWorkflow = (nextView: SidebarView, destination: string) => {
    clearWorkflowState();
    setSidebarView(nextView);
    if (nextView === "sessions") window.dispatchEvent(new CustomEvent("sessions:updated"));
    navigate(destination);
  };

  // Fields and rules are only saved when validation runs, so leaving with unrun changes asks first.
  const guardLeave = (action: () => void) => {
    if (!hasUnsavedSetup) {
      action();
      return;
    }
    setConfirmDialog({
      title: "Discard unsaved setup?",
      description: "Fields and rules are saved when you run validation. Leaving now discards the setup you have not run yet.",
      confirmLabel: "Discard setup",
      tone: "danger",
      onConfirm: action,
    });
  };

  const library = useSessionLibrary({
    activeSessionId,
    onActiveRenamed: (name) => {
      setProjectName(name);
      if (result) setResult({ ...result, project_name: name });
    },
    onActiveDeleted: () => leaveWorkflow("sessions", "/"),
    onRequestDelete: (session, confirm) =>
      setConfirmDialog({
        title: "Delete session?",
        description: `This permanently removes "${session.project_name}" and its saved files.`,
        confirmLabel: "Delete session",
        tone: "danger",
        onConfirm: confirm,
      }),
  });

  const activeSession: RecentSession | undefined = activeSessionId
    ? library.sessions.find((session) => session.id === activeSessionId) ?? {
        id: activeSessionId,
        project_name: activeSessionName,
        mode: result?.preset || preset || "custom_comparison_builder",
        file_names: [],
        discrepancy_count: result?.discrepancies.length ?? 0,
        created_at: result?.created_at || new Date().toISOString(),
      }
    : undefined;

  useEffect(() => {
    if (location.pathname === "/upload") setSidebarView("workflow");
  }, [location.pathname]);

  useEffect(() => {
    const handleSidebarViewRequest = (event: Event) => {
      const view = (event as CustomEvent<{ view?: SidebarView }>).detail?.view;
      if (view) setSidebarView(view);
    };
    window.addEventListener("sidebar:view", handleSidebarViewRequest);
    return () => window.removeEventListener("sidebar:view", handleSidebarViewRequest);
  }, []);

  const openSession = async (id: string) => {
    library.closeMenu();
    setOpeningSessionId(id);
    try {
      const { hasRunResult } = await loadSession(id);
      setSidebarView("workflow");
      navigate(hasRunResult ? "/results" : "/mapping");
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : "Could not open this session.", "error");
    } finally {
      setOpeningSessionId(null);
    }
  };

  const shellStyle = { "--app-sidebar-offset": collapsed ? "72px" : "272px" } as CSSProperties;

  return (
    <div className="min-h-[100dvh] overflow-x-clip bg-slate-50 text-slate-950" style={shellStyle}>
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex flex-col overflow-hidden border-r border-slate-200 bg-panel transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${collapsed ? "w-[72px]" : "w-[272px]"}`}
      >
        <div className={`relative flex h-[72px] shrink-0 items-center border-b border-slate-100 ${collapsed ? "justify-center px-3" : "px-4"}`}>
          {collapsed ? (
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              aria-label="Expand sidebar"
              title="Expand sidebar"
              className="group relative grid size-10 place-items-center rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
            >
              <span className="relative grid size-8 place-items-center overflow-hidden rounded-[10px] bg-panel transition-transform duration-200 group-hover:scale-105 group-active:scale-95">
                <Logo className="size-7 object-contain transition-all duration-200 group-hover:-translate-x-2 group-hover:opacity-0 group-focus-visible:-translate-x-2 group-focus-visible:opacity-0" />
                <PanelLeftOpen aria-hidden="true" className="absolute size-[17px] translate-x-2 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100" />
              </span>
            </button>
          ) : (
            <>
              <div className="sidebar-expand-enter grid size-8 shrink-0 place-items-center rounded-[10px] bg-panel">
                <Logo />
              </div>
              <div className="sidebar-expand-enter absolute left-[60px] right-[56px] min-w-0">
                <p className="truncate text-sm font-semibold">{appConfig.displayName}</p>
                <p className="truncate text-xs text-slate-500">{sidebarView === "sessions" ? "Sessions workspace" : "Active workflow"}</p>
              </div>
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
                className="sidebar-expand-enter ml-auto grid size-8 shrink-0 place-items-center rounded-lg text-slate-500 transition-colors duration-200 hover:bg-slate-100 hover:text-emerald-700 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
              >
                <Menu aria-hidden="true" className="size-[18px]" />
              </button>
            </>
          )}
        </div>

        {sidebarView === "sessions" ? (
          <SidebarSessionsPanel
            collapsed={collapsed}
            library={library}
            activeSessionId={activeSessionId}
            openingSessionId={openingSessionId}
            onStartValidation={() => guardLeave(() => leaveWorkflow("workflow", "/upload"))}
            onOpenSession={(id) => void openSession(id)}
          />
        ) : (
          <SidebarWorkflowPanel
            collapsed={collapsed}
            library={library}
            activeSession={activeSession}
            activeSessionName={activeSessionName}
            hasFiles={files.length > 0}
            hasResult={Boolean(result)}
            onCloseSession={() => guardLeave(() => leaveWorkflow("sessions", "/"))}
          />
        )}

        <div className={`flex shrink-0 items-center gap-2 ${collapsed ? "flex-col p-2" : "p-3"}`}>
          <ThemeSwitcher collapsed={collapsed} />
          <div title="Your data stays local" className={`min-w-0 overflow-hidden border border-emerald-100 bg-emerald-50 text-emerald-800 transition-all duration-300 ${collapsed ? "grid size-10 shrink-0 place-items-center rounded-xl p-0" : "flex min-h-10 flex-1 items-center rounded-xl px-3"}`}>
            {collapsed ? (
              <LockKeyhole aria-hidden="true" className="size-4" />
            ) : (
              <div className="flex min-w-0 items-center gap-2">
                <LockKeyhole aria-hidden="true" className="size-4 shrink-0" />
                <span className="min-w-0 truncate text-xs font-semibold">Your data stays local</span>
              </div>
            )}
          </div>
        </div>
      </aside>

      <main className={`min-w-0 px-3 py-10 pb-8 transition-[margin-left] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] sm:px-4 lg:px-6 lg:py-12 lg:pb-10 ${collapsed ? "ml-[72px]" : "ml-[272px]"}`}>
        <div className="mx-auto min-w-0 max-w-[1500px]">
          {sidebarView === "workflow" && result ? (
            <div className="mb-6 flex items-center gap-3 border-b border-slate-200 pb-4">
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold text-slate-950">{result.project_name}</p>
                <p className="text-xs text-slate-500">Last run {new Date(result.created_at).toLocaleDateString()}</p>
              </div>
              <span className="ml-auto text-xs font-medium text-emerald-700">Active session</span>
            </div>
          ) : null}
          <div key={location.pathname} className="app-route-fade">
            <Outlet />
          </div>
        </div>
      </main>
      <ConfirmationDialog state={confirmDialog} onClose={() => setConfirmDialog(null)} />
      <CommonFieldsChooser />
      <LegacyDataPrompt />
    </div>
  );
}

export function AppShell() {
  return (
    <ToastProvider>
      <AppShellContent />
    </ToastProvider>
  );
}
