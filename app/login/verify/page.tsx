import type { Metadata } from "next";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { resolvePendingAdminVerificationContext } from "@/app/login/verify/helpers";
import type { AdminOtpChannel } from "@/lib/auth/admin-otp-channels";
import { OtpCodeInput } from "@/components/login/otp-code-input";
import styles from "@/components/login/login-page.module.css";
import { displayFont } from "@/components/marketing/display-font";
import { SumtrackBrand } from "@/components/marketing/sumtrack-brand";

type VerifyLoginPageProps = {
  searchParams: Promise<{
    channel?: string;
    choose?: string;
    error?: string;
    resent?: string;
    sent?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Verify Login | SumTrack",
};

export default async function VerifyLoginPage({ searchParams }: VerifyLoginPageProps) {
  const [{ availability, pendingChallenge }, params] = await Promise.all([
    resolvePendingAdminVerificationContext(),
    searchParams,
  ]);

  const resolvedError = params.error ? decodeURIComponent(params.error) : undefined;
  const codeWasSent = params.sent === "1" || params.resent === "1";
  const requestedChannel =
    params.channel === "sms" || params.channel === "email"
      ? (params.channel as AdminOtpChannel)
      : null;
  const activeChannel = pendingChallenge?.channel ?? requestedChannel ?? null;
  const hasChannelChoice = availability.hasChoice;
  const shouldChooseChannel = hasChannelChoice && !pendingChallenge?.channel;
  const destinationLabel =
    activeChannel === "email"
      ? availability.maskedEmail
      : activeChannel === "sms"
        ? availability.maskedPhone
        : null;
  const channelLabel = activeChannel === "email" ? "Email" : "SMS";
  const alternateChannel =
    activeChannel === "sms" ? "email" : activeChannel === "email" ? "sms" : null;
  const alternateChannelLabel = alternateChannel === "email" ? "Email" : "SMS";

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
            <h1 className={`${displayFont.className} mb-2 text-2xl font-bold tracking-tight text-white sm:text-3xl`}>
              Verify Login
            </h1>
            <p className="text-sm text-white/55">
              {shouldChooseChannel
                ? "Choose where to send your verification code."
                : activeChannel && destinationLabel
                  ? `Enter the ${channelLabel} code sent to `
                  : availability.defaultChannel
                    ? `Send a verification code via ${
                        availability.defaultChannel === "email" ? "Email" : "SMS"
                      } to continue.`
                    : "No verification destination is currently available."}
              {activeChannel && destinationLabel ? (
                <span className="font-medium text-white/80">{destinationLabel}</span>
              ) : null}
            </p>
          </div>

          <div className="space-y-5">
            {resolvedError ? (
              <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{resolvedError}</span>
              </div>
            ) : null}

            {!resolvedError && codeWasSent ? (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                A verification code has been sent via {channelLabel}.
              </div>
            ) : null}

            {availability.errorMessage ? (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                {availability.errorMessage}
              </div>
            ) : null}

            {shouldChooseChannel ? (
              <div className="space-y-3">
                {availability.maskedPhone ? (
                  <form action="/login/verify/send" method="post">
                    <input name="channel" type="hidden" value="sms" />
                    <button
                      className={`${styles.baseButton} flex w-full items-center justify-center rounded-xl bg-[#d94f1e] px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#d94f1e]/20 hover:bg-[#e8662f] active:scale-[0.98]`}
                      type="submit"
                    >
                      Send code via SMS
                    </button>
                  </form>
                ) : null}

                {availability.maskedEmail ? (
                  <form action="/login/verify/send" method="post">
                    <input name="channel" type="hidden" value="email" />
                    <button
                      className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-medium text-white/75 transition-colors hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
                      type="submit"
                    >
                      Send code via Email
                    </button>
                  </form>
                ) : null}
              </div>
            ) : !pendingChallenge?.channel && availability.defaultChannel ? (
              <form action="/login/verify/send" method="post">
                <input name="channel" type="hidden" value={availability.defaultChannel} />
                <button
                  className={`${styles.baseButton} flex w-full items-center justify-center rounded-xl bg-[#d94f1e] px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#d94f1e]/20 hover:bg-[#e8662f] active:scale-[0.98]`}
                  type="submit"
                >
                  Send code via {availability.defaultChannel === "email" ? "Email" : "SMS"}
                </button>
              </form>
            ) : activeChannel ? (
              <>
                <form action="/login/verify/submit" className="space-y-5" method="post">
                  <OtpCodeInput label="Verification Code" name="code" />

                  <button
                    className={`${styles.baseButton} flex w-full items-center justify-center rounded-xl bg-[#d94f1e] px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#d94f1e]/20 hover:bg-[#e8662f] active:scale-[0.98]`}
                    type="submit"
                  >
                    Verify Code
                  </button>
                </form>

                <div className="space-y-3">
                  <form action="/login/verify/resend" method="post">
                    <button
                      className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-medium text-white/75 transition-colors hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
                      type="submit"
                    >
                      Resend via {channelLabel}
                    </button>
                  </form>

                  {hasChannelChoice && alternateChannel ? (
                    <form action="/login/verify/send" method="post">
                      <input name="channel" type="hidden" value={alternateChannel} />
                      <button
                        className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-medium text-white/75 transition-colors hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
                        type="submit"
                      >
                        Send code via {alternateChannelLabel} instead
                      </button>
                    </form>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>

          <div className="mt-6 space-y-3 text-center">
            <form action="/auth/signout" method="post">
              <input name="redirectTo" type="hidden" value="/login" />
              <button
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-medium text-white/75 transition-colors hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
                type="submit"
              >
                Use another account
              </button>
            </form>
            <p className="text-xs text-white/40">
              This signs you out, clears the pending verification step, and returns you to login.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
