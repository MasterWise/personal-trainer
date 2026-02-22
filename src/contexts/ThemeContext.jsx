import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { themes } from "../styles/themes.js";

const ThemeContext = createContext(null);

const THEME_KEY = "pt-theme";
const THEME_IDS = Object.keys(themes);

export function ThemeProvider({ children }) {
  const [themeId, setThemeId] = useState(() => {
    const saved = localStorage.getItem(THEME_KEY);
    return saved && themes[saved] ? saved : "warm";
  });

  const theme = themes[themeId];

  useEffect(() => {
    localStorage.setItem(THEME_KEY, themeId);
    const root = document.documentElement;
    const c = theme.colors;

    root.style.setProperty("--pt-color-primary", c.primary);
    root.style.setProperty("--pt-color-primary-light", c.primaryLight);
    root.style.setProperty("--pt-color-primary-bg", c.primaryBg);
    root.style.setProperty("--pt-color-bg", c.bg);
    root.style.setProperty("--pt-color-surface", c.surface);
    root.style.setProperty("--pt-color-text", c.text);
    root.style.setProperty("--pt-color-text-secondary", c.textSecondary);
    root.style.setProperty("--pt-color-text-muted", c.textMuted);
    root.style.setProperty("--pt-color-border", c.border);
    root.style.setProperty("--pt-color-ok", c.ok);
    root.style.setProperty("--pt-color-ok-bg", c.okBg);
    root.style.setProperty("--pt-color-danger", c.danger);
    root.style.setProperty("--pt-font-body", theme.font);
    root.style.setProperty("--pt-font-heading", theme.headingFont);

    document.body.style.background = c.bg;
    document.body.style.color = c.text;
  }, [themeId, theme]);

  const toggleTheme = useCallback(() => {
    setThemeId((prev) => {
      const idx = THEME_IDS.indexOf(prev);
      return THEME_IDS[(idx + 1) % THEME_IDS.length];
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, themeId, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
