import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { getPasswordRecoveryVerifiedChallenge } from "@/lib/auth/password-recovery";
import { LoginPasswordField } from "@/components/login/login-password-field";
import styles from "@/components/login/login-page.module.css";
import { displayFont } from "@/components/marketing/display-font";
import { SumtrackBrand } from "@/components/marketing/sumtrack-brand";

type ForgotPasswordResetPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export const metadata: Metadata = {
  title: "Reset Password | SumTrack",
};

export default async function ForgotPasswordResetPage({
  searchParams,
}: ForgotPasswordResetPageProps) {
  const [verifiedChallenge, params] = await Promise.all([
    getPasswordRecoveryVerifiedChallenge(),
    searchParams,
  ]);

  if (!verifiedChallenge?.userId) {
    redirect("/forgot-password");
  }

  const resolvedError = params.error ? decodeURIComponent(params.error) : undefined;

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
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
                <ShieldCheck className="h-6 w-6" />
              </div>
            </div>
            <h1
              className={`${displayFont.className} mb-2 text-2xl font-bold tracking-tight text-white sm:text-3xl`}
            >
              Set a New Password
            </h1>
            <p className="text-sm text-white/55">
              Choose a new password for your SumTrack account.
            </p>
          </div>

          <form action="/forgot-password/reset/submit" className="space-y-5" method="post">
            {resolvedError ? (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {resolvedError}
              </div>
            ) : null}

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-white/80" htmlFor="new_password">
                New Password
              </label>
              <LoginPasswordField
                id="new_password"
                name="new_password"
                placeholder="Enter new password"
              />
            </div>

            <div className="space-y-1.5">
              <label
                className="block text-sm font-medium text-white/80"
                htmlFor="confirm_password"
              >
                Confirm New Password
              </label>
              <LoginPasswordField
                id="confirm_password"
                name="confirm_password"
                placeholder="Confirm new password"
              />
            </div>

            <button
              className={`${styles.baseButton} flex w-full items-center justify-center rounded-xl bg-[#d94f1e] px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#d94f1e]/20 hover:bg-[#e8662f] active:scale-[0.98]`}
              type="submit"
            >
              Update Password
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
