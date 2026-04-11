"use client";

import { useEffect, useState } from "react";
import { Toaster as Sonner, toast, type ToasterProps } from "sonner";
import { cn } from "@/lib/utils";

type SonnerTheme = "light" | "dark";

function resolveTheme(): SonnerTheme {
  if (typeof document === "undefined") {
    return "light";
  }

  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function Toaster(props: ToasterProps) {
  const [theme, setTheme] = useState<SonnerTheme>(resolveTheme);

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setTheme(resolveTheme());
    });

    observer.observe(root, {
      attributeFilter: ["class"],
      attributes: true,
    });

    const syncTheme = () => {
      setTheme(resolveTheme());
    };

    window.addEventListener("storage", syncTheme);
    window.addEventListener("focus", syncTheme);

    return () => {
      observer.disconnect();
      window.removeEventListener("storage", syncTheme);
      window.removeEventListener("focus", syncTheme);
    };
  }, []);

  return (
    <Sonner
      closeButton
      position="bottom-right"
      richColors
      theme={theme}
      toastOptions={{
        classNames: {
          toast: cn(
            "group toast group-[.toaster]:rounded-xl group-[.toaster]:border group-[.toaster]:shadow-lg",
            "group-[.toaster]:px-4 group-[.toaster]:py-3 group-[.toaster]:text-[0.95rem]",
            "group-[.toaster]:border-zinc-300/90 group-[.toaster]:bg-zinc-950 group-[.toaster]:text-zinc-50",
            "dark:group-[.toaster]:border-zinc-700 dark:group-[.toaster]:bg-zinc-900 dark:group-[.toaster]:text-zinc-50",
          ),
          title: "text-sm font-semibold text-inherit",
          description: "text-sm text-zinc-200 dark:text-zinc-300",
          actionButton:
            "group-[.toast]:bg-white/12 group-[.toast]:text-white hover:group-[.toast]:bg-white/18",
          cancelButton:
            "group-[.toast]:bg-white/6 group-[.toast]:text-zinc-100 hover:group-[.toast]:bg-white/12",
          closeButton: cn(
            "group-[.toast]:border group-[.toast]:border-zinc-300/80 group-[.toast]:bg-white group-[.toast]:text-zinc-700",
            "group-[.toast]:shadow-none hover:group-[.toast]:bg-zinc-100 hover:group-[.toast]:text-zinc-900",
            "dark:group-[.toast]:border-zinc-600 dark:group-[.toast]:bg-zinc-900 dark:group-[.toast]:text-zinc-200",
            "dark:hover:group-[.toast]:bg-zinc-800 dark:hover:group-[.toast]:text-zinc-50",
          ),
          success: cn(
            "group-[.toaster]:border-emerald-300/90 group-[.toaster]:bg-emerald-950 group-[.toaster]:text-emerald-50",
            "dark:group-[.toaster]:border-emerald-800 dark:group-[.toaster]:bg-emerald-950 dark:group-[.toaster]:text-emerald-50",
          ),
          error: cn(
            "group-[.toaster]:border-rose-300/90 group-[.toaster]:bg-rose-950 group-[.toaster]:text-rose-50",
            "dark:group-[.toaster]:border-rose-800 dark:group-[.toaster]:bg-rose-950 dark:group-[.toaster]:text-rose-50",
          ),
          warning: cn(
            "group-[.toaster]:border-amber-300/90 group-[.toaster]:bg-amber-950 group-[.toaster]:text-amber-50",
            "dark:group-[.toaster]:border-amber-800 dark:group-[.toaster]:bg-amber-950 dark:group-[.toaster]:text-amber-50",
          ),
          info: cn(
            "group-[.toaster]:border-sky-300/90 group-[.toaster]:bg-sky-950 group-[.toaster]:text-sky-50",
            "dark:group-[.toaster]:border-sky-800 dark:group-[.toaster]:bg-sky-950 dark:group-[.toaster]:text-sky-50",
          ),
        },
      }}
      {...props}
    />
  );
}

export { Toaster, toast };
