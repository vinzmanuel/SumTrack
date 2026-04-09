"use client";

import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";
import styles from "@/components/login/login-page.module.css";

export function LoginSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className={cn(
        styles.baseButton,
        pending && styles.pending,
        "flex w-full items-center justify-center rounded-xl bg-[#d94f1e] px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#d94f1e]/20 hover:bg-[#e8662f] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-80"
      )}
      disabled={pending}
      type="submit"
    >
      <span className={styles.spinner} />
      <span className={styles.btnLabel}>Secure Login</span>
    </button>
  );
}
