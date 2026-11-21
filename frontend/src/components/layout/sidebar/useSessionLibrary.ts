import { useCallback, useEffect, useMemo, useState } from "react";
import { deleteSession, listRecentSessions, renameSession, type RecentSession } from "../../../services/validationApi";
import { useToast } from "../../common/Toast";

interface SessionLibraryOptions {
  activeSessionId: string | null;
  /** Keep the open workflow in sync when the active session is renamed (or the rename is rolled back). */
  onActiveRenamed: (projectName: string) => void;
  onActiveDeleted: () => void;
  /** Ask the user to confirm; call the given function to actually delete. */
  onRequestDelete: (session: RecentSession, confirm: () => void) => void;
}

/** Saved-session list for the sidebar: loading, search, the options menu, rename, and delete. */
export function useSessionLibrary({ activeSessionId, onActiveRenamed, onActiveDeleted, onRequestDelete }: SessionLibraryOptions) {
  const { showToast } = useToast();
  const [sessions, setSessions] = useState<RecentSession[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [menuSessionId, setMenuSessionId] = useState<string | null>(null);
  const [mutatingSessionId, setMutatingSessionId] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const filteredSessions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return sessions;
    return sessions.filter((session) => session.project_name.toLowerCase().includes(normalized));
  }, [query, sessions]);

  const loadSessions = useCallback(() => {
    setLoading(true);
    void listRecentSessions()
      .then(setSessions)
      .catch((cause) => showToast(cause instanceof Error ? cause.message : "Could not load sessions.", "error"))
      .finally(() => setLoading(false));
  }, [showToast]);

  useEffect(() => {
    loadSessions();
    window.addEventListener("sessions:updated", loadSessions);
    return () => window.removeEventListener("sessions:updated", loadSessions);
  }, [loadSessions]);

  useEffect(() => {
    if (!menuSessionId) return undefined;
    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && !target.closest(`[data-session-menu="${menuSessionId}"]`)) setMenuSessionId(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuSessionId(null);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuSessionId]);

  const toggleMenu = (sessionId: string) => setMenuSessionId((current) => (current === sessionId ? null : sessionId));

  const startRename = (session: RecentSession) => {
    setMenuSessionId(null);
    setRenameValue(session.project_name);
    setEditingSessionId(session.id);
  };

  /** Optimistic rename with rollback on failure. */
  const commitRename = async (session: RecentSession) => {
    const projectName = renameValue.trim();
    setEditingSessionId(null);
    if (!projectName || projectName === session.project_name) return;
    const apply = (name: string) => {
      setSessions((current) => current.map((item) => (item.id === session.id ? { ...item, project_name: name } : item)));
      if (activeSessionId === session.id) onActiveRenamed(name);
    };
    setMutatingSessionId(session.id);
    apply(projectName);
    try {
      await renameSession(session.id, projectName);
      showToast("Session renamed.", "success");
    } catch (cause) {
      apply(session.project_name);
      showToast(cause instanceof Error ? cause.message : "Could not rename this session.", "error");
    } finally {
      setMutatingSessionId(null);
    }
  };

  const deleteNow = async (session: RecentSession) => {
    setMutatingSessionId(session.id);
    try {
      await deleteSession(session.id);
      setSessions((current) => current.filter((item) => item.id !== session.id));
      if (activeSessionId === session.id) onActiveDeleted();
      showToast("Session deleted.", "success");
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : "Could not delete this session.", "error");
    } finally {
      setMutatingSessionId(null);
    }
  };

  const requestDelete = (session: RecentSession) => {
    setMenuSessionId(null);
    onRequestDelete(session, () => void deleteNow(session));
  };

  return {
    sessions,
    filteredSessions,
    query,
    setQuery,
    loading,
    loadSessions,
    menuSessionId,
    toggleMenu,
    closeMenu: () => setMenuSessionId(null),
    mutatingSessionId,
    editingSessionId,
    renameValue,
    setRenameValue,
    startRename,
    commitRename,
    requestDelete,
  };
}

export type SessionLibrary = ReturnType<typeof useSessionLibrary>;

export function formatSessionMeta(session: RecentSession) {
  const date = new Date(session.created_at);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : `${date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} · ${date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}
