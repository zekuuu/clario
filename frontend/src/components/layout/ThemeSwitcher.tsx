import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "clario:theme";

// public/theme-init.js applies the theme before first paint; this only keeps it in sync.
function readCurrentTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.themePreference = theme;
  document.documentElement.style.colorScheme = theme;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage unavailable: the theme still applies for this session.
  }
}

export function ThemeSwitcher({ collapsed = false }: { collapsed?: boolean }) {
  const [theme, setTheme] = useState<Theme>(readCurrentTheme);

  useEffect(() => applyTheme(theme), [theme]);

  const Icon = theme === "dark" ? Moon : Sun;
  const nextTheme = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(nextTheme)}
      title={`Switch to ${nextTheme} theme`}
      aria-label={`Switch to ${nextTheme} theme`}
      className={`${collapsed ? "mx-auto" : ""} theme-toggle grid size-10 shrink-0 place-items-center rounded-xl text-slate-600 outline outline-1 outline-slate-200 transition hover:text-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700`}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.8} />
    </button>
  );
}
