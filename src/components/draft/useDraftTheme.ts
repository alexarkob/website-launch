import { useEffect, useState } from "react";

export type DraftTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "ff-draft-theme";

export function readStoredTheme(): DraftTheme {
  if (typeof window === "undefined") return "light";
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function applyDraftTheme(theme: DraftTheme) {
  document.documentElement.setAttribute("data-draft-theme", theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // ignore quota / private mode
  }
}

export function useDraftTheme() {
  const [theme, setTheme] = useState<DraftTheme>("light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const initial = readStoredTheme();
    setTheme(initial);
    applyDraftTheme(initial);
    setReady(true);
  }, []);

  function toggleTheme() {
    const next: DraftTheme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyDraftTheme(next);
  }

  return { theme, ready, toggleTheme };
}
