"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type ThemeType = "onyx" | "cyberpunk" | "solar";

interface ThemeContextType {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeType>("onyx");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Read from localStorage on mount
    const savedTheme = localStorage.getItem("treecondo-theme") as ThemeType;
    if (savedTheme && ["onyx", "cyberpunk", "solar"].includes(savedTheme)) {
      setThemeState(savedTheme);
      applyTheme(savedTheme);
    } else {
      applyTheme("onyx");
    }
    setMounted(true);
  }, []);

  const applyTheme = (t: ThemeType) => {
    const root = document.documentElement;
    const body = document.body;
    if (!root || !body) return;

    root.classList.remove("theme-onyx", "theme-cyberpunk", "theme-solar", "dark");
    body.classList.remove("theme-onyx", "theme-cyberpunk", "theme-solar", "dark");

    // All 3 themes are dark
    root.classList.add("dark");
    body.classList.add("dark");

    // Only onyx is the active visual theme
    root.classList.add(`theme-onyx`);
    body.classList.add(`theme-onyx`);
  };

  const setTheme = (t: ThemeType) => {
    setThemeState(t);
    localStorage.setItem("treecondo-theme", t);
    applyTheme(t);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {/* Avoid flash of default theme by hiding children until mounted */}
      <div style={{ visibility: mounted ? "visible" : "hidden" }}>{children}</div>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
