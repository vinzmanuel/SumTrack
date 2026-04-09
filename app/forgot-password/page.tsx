import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, KeyRound } from "lucide-react";
import styles from "@/components/login/login-page.module.css";
import { displayFont } from "@/components/marketing/display-font";
import { SumtrackBrand } from "@/components/marketing/sumtrack-brand";

type ForgotPasswordPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export const metadata: Metadata = {
  title: "Forgot Password | SumTrack",
};

export default async function ForgotPasswordPage({
  searchParams,
}: ForgotPasswordPageProps) {
  const { error } = await searchParams;
  const resolvedError = error ? decodeURIComponent(error) : undefined;

  return (
    <main
      className={`${styles.page} ${styles.grain} relative flex items-center justify-center bg-[#0a0e17] font-sans text-slate-300 antialiased`}
    >
      <div aria-hidden="true" className={styles.pageCurtain} />

      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div
          className={`${styles.animateBlob} absolute -left-20 -top-20 h-[600px] w-[600px] rounded-full bg-teal-500/20 blur-[120px]`}
        />
        <div
          className={`${styles.animateBlob} ${styles.animationDelay1000} absolute -right-40 top-1/4 h-[550px] w-[550px] rounded-full bg-[#c43d14]/15 blur-[120px]`}
        />
        <div
          className={`${styles.animateBlob} ${styles.animationDelay2000} absolute -bottom-40 left-1/3 h-[500px] w-[500px] rounded-full bg-[#f0a818]/15 blur-[120px]`}
        />
      </div>

      <div className="relative z-10 flex w-full max-w-md flex-col items-center px-6">
        <div className={`${styles.formEnter} mb-8 flex flex-col items-center`}>
          <SumtrackBrand className="h-10 w-auto drop-shadow-2xl" priority />
        </div>

        <div
          className={`${styles.formEnterDelayed} w-full rounded-2xl border border-white/[0.08] bg-slate-900/70 p-8 shadow-2xl backdrop-blur-3xl sm:p-10`}
        >
          <div className="mb-8 text-center">
            <div className="mb-4 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#d94f1e]/20 bg-[#d94f1e]/10 text-[#f5a623]">
                <KeyRound className="h-6 w-6" />
              </div>
            </div>
            <h1
              className={`${displayFont.className} mb-2 text-2xl font-bold tracking-tight text-white sm:text-3xl`}
            >
              Forgot Password
            </h1>
            <p className="text-sm text-white/55">
              Enter your email or mobile number and we&apos;ll send a verification code if a
              matching account exists.
            </p>
          </div>

          <form action="/forgot-password/start" className="space-y-5" method="post">
            {resolvedError ? (
              <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{resolvedError}</span>
              </div>
            ) : null}

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-white/80" htmlFor="identifier">
                Email or Mobile Number
              </label>
              <input
                className="block w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white shadow-inner outline-none transition-all placeholder:text-white/20 focus:border-[#d94f1e] focus:ring-1 focus:ring-[#d94f1e] sm:text-sm"
                id="identifier"
                name="identifier"
                placeholder="Enter email or 09XXXXXXXXX"
                required
                type="text"
              />
            </div>

            <button
              className={`${styles.baseButton} flex w-full items-center justify-center rounded-xl bg-[#d94f1e] px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#d94f1e]/20 hover:bg-[#e8662f] active:scale-[0.98]`}
              type="submit"
            >
              Send Recovery Code
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link
              className="group inline-flex items-center gap-2 text-sm font-medium text-white/40 transition-colors hover:text-white"
              href="/login"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
              Back to login
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
