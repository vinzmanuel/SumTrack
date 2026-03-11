"use client";

import { useEffect } from "react";

export function useOnWindowResize(callback: () => void) {
  useEffect(() => {
    callback();
    window.addEventListener("resize", callback);

    return () => {
      window.removeEventListener("resize", callback);
    };
  }, [callback]);
}
