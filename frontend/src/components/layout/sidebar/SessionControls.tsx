import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import type { RecentSession } from "../../../services/validationApi";
import type { SessionLibrary } from "./useSessionLibrary";

const menuItemClass = "session-options-item flex min-h-10 w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold transition focus:outline-none";

/** "More options" trigger plus its Rename / Delete menu. The parent marks itself with data-session-menu. */
export function SessionOptionsMenu({
  session,
  library,
  triggerClassName,
  menuClassName,
}: {
  session: RecentSession;
  library: SessionLibrary;
  triggerClassName: string;
  menuClassName: string;
}) {
  const open = library.menuSessionId === session.id;
  return (
    <>
      <button
        type="button"
        onClick={() => library.toggleMenu(session.id)}
        disabled={library.mutatingSessionId === session.id}
        aria-label={`More options for ${session.project_name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        className={triggerClassName}
        title={`More options for ${session.project_name}`}
      >
        <MoreVertical aria-hidden="true" className="size-4 transition-transform duration-150 group-hover:scale-110" />
      </button>
      {open ? (
        <div role="menu" className={menuClassName}>
          <button role="menuitem" type="button" onClick={() => library.startRename(session)} className={`${menuItemClass} text-slate-700`}>
            <Pencil aria-hidden="true" className="size-3.5" /> Rename
          </button>
          <button role="menuitem" type="button" onClick={() => library.requestDelete(session)} className={`${menuItemClass} text-red-700`}>
            <Trash2 aria-hidden="true" className="size-3.5" /> Delete
          </button>
        </div>
      ) : null}
    </>
  );
}

/** Inline rename field: Enter or blur commits. */
export function SessionRenameInput({ session, library, className }: { session: RecentSession; library: SessionLibrary; className: string }) {
  return (
    <input
      // Focus follows the user's explicit "Rename" action, so autofocus is expected here.
      // eslint-disable-next-line jsx-a11y/no-autofocus
      autoFocus
      type="text"
      value={library.renameValue}
      onChange={(event) => library.setRenameValue(event.target.value)}
      onFocus={(event) => event.currentTarget.select()}
      onBlur={() => void library.commitRename(session)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
      maxLength={160}
      aria-label={`Rename ${session.project_name}`}
      className={className}
    />
  );
}
