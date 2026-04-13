import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { getAppSessionAccessState } from "@/app/dashboard/auth";
import { login } from "@/app/login/actions";
import { LoginPasswordField } from "@/components/login/login-password-field";
import styles from "@/components/login/login-page.module.css";
import { LoginSubmitButton } from "@/components/login/login-submit-button";
import { displayFont } from "@/components/marketing/display-font";
import { SumtrackBrand } from "@/components/marketing/sumtrack-brand";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; message?: string; errorType?: string }>;
};

export const metadata: Metadata = {
  title: "Log In | SumTrack",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const authState = await getAppSessionAccessState();
  if (authState.status === "non_admin_authenticated" || authState.status === "admin_otp_verified") {
    redirect("/dashboard");
  }
  if (authState.status === "admin_otp_pending") {
    redirect("/login/verify");
  }

  const { error, message, errorType } = await searchParams;
  const resolvedError =
    error
      ? decodeURIComponent(error)
      : authState.status === "inactive_account" && !authState.auth.ok
        ? authState.auth.message
        : undefined;
  const resolvedMessage = message ? decodeURIComponent(message) : undefined;
  const isDeactivatedError =
    errorType === "inactive_account" ||
    (authState.status === "inactive_account" && !authState.auth.ok && !error);

  return (
    <main className={`${styles.page} ${styles.grain} relative flex items-center justify-center bg-[#0a0e17] font-sans text-slate-300 antialiased`}>
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className={`${styles.animateBlob} absolute -left-20 -top-20 h-[600px] w-[600px] rounded-full bg-teal-500/20 blur-[120px]`} />
        <div className={`${styles.animateBlob} ${styles.animationDelay1000} absolute -right-40 top-1/4 h-[550px] w-[550px] rounded-full bg-[#c43d14]/15 blur-[120px]`} />
        <div className={`${styles.animateBlob} ${styles.animationDelay2000} absolute -bottom-40 left-1/3 h-[500px] w-[500px] rounded-full bg-[#f0a818]/15 blur-[120px]`} />
      </div>

      <div className="relative z-10 flex w-full max-w-md flex-col items-center px-6">
        <div className={`${styles.formEnter} mb-8 flex flex-col items-center`}>
          <SumtrackBrand className="h-10 w-auto drop-shadow-2xl" priority />
        </div>

        <div className={`${styles.formEnterDelayed} ${resolvedError ? styles.shake : ""} w-full rounded-2xl border border-white/[0.08] bg-slate-900/70 p-8 shadow-2xl backdrop-blur-3xl sm:p-10`}>
          <div className="mb-8 text-center">
            <h1 className={`${displayFont.className} mb-2 text-2xl font-bold tracking-tight text-white sm:text-3xl`}>
              Log In
            </h1>
          </div>

          <form action={login} className="space-y-5">
            {resolvedError ? (
              <div
                className={
                  isDeactivatedError
                    ? "mb-5 flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-300"
                    : "mb-5 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400"
                }
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{resolvedError}</span>
              </div>
            ) : null}

            {!resolvedError && resolvedMessage ? (
              <div className="mb-5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                {resolvedMessage}
              </div>
            ) : null}

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-white/80" htmlFor="username">
                Username
              </label>
              <input
                className="block w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white shadow-inner outline-none transition-all placeholder:text-white/20 focus:border-[#d94f1e] focus:ring-1 focus:ring-[#d94f1e] sm:text-sm"
                id="username"
                name="username"
                placeholder="Enter username"
                required
                type="text"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-white/80" htmlFor="password">
                Password
              </label>
              <LoginPasswordField id="password" name="password" placeholder="Enter password" />
            </div>

            <div className="flex items-center justify-end pb-2 pt-1">
              <Link
                className="text-sm font-medium text-[#d94f1e] transition-colors hover:text-[#f5a623]"
                href="/forgot-password"
              >
                Forgot password?
              </Link>
            </div>

            <LoginSubmitButton />
          </form>

          <div className="mt-6 text-center">
            <Link className="group inline-flex items-center gap-2 text-sm font-medium text-white/40 transition-colors hover:text-white" href="/">
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
              Return to website
            </Link>
          </div>
        </div>

        <p className="mt-8 text-center text-[11px] font-medium uppercase tracking-[0.2em] text-white/20">
          Authorized Personnel and Clients Only
        </p>
        <p className="mt-0 text-center text-[14px] font-medium uppercase tracking-[0.2em] text-white/20">
          Sum Finance Services Corp.
        </p>
      </div>
    </main>
  );
}
