"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

const THEME_STORAGE_KEY = "sumtrack-theme";
const THEME_SWITCHING_CLASS = "theme-switching";

type ThemeMode = "light" | "dark";

function applyTheme(theme: ThemeMode) {
  const root = document.documentElement;
  const isDark = theme === "dark";

  root.classList.add(THEME_SWITCHING_CLASS);
  void root.offsetHeight;
  root.classList.toggle("dark", isDark);
  root.style.colorScheme = isDark ? "dark" : "light";
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      root.classList.remove(THEME_SWITCHING_CLASS);
    });
  });
}

export function ThemeToggle() {
  const toggleTheme = () => {
    const nextTheme: ThemeMode = document.documentElement.classList.contains("dark") ? "light" : "dark";
    applyTheme(nextTheme);
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  };

  return (
    <Button
      aria-label="Toggle theme"
      className="bg-card hover:bg-accent"
      onClick={toggleTheme}
      size="icon"
      suppressHydrationWarning
      type="button"
      variant="outline"
    >
      <Sun className="hidden dark:block" />
      <Moon className="block dark:hidden" />
    </Button>
  );
}
