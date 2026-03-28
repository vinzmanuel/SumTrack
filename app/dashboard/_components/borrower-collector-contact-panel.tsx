"use client";

import { ContactRound, Copy, MapPinned, MessageSquareMore, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { TremorDescription, TremorTitle } from "@/components/tremor/raw/metric-card";
import type { BorrowerOverview } from "@/app/dashboard/overview-types";
import { cn } from "@/lib/utils";

function normalizeContactNumber(value: string | null) {
  if (!value) {
    return null;
  }

  const digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("09")) {
    return `+63${digits.slice(1)}`;
  }

  if (digits.length === 12 && digits.startsWith("639")) {
    return `+${digits}`;
  }

  return null;
}

function formatDisplayContactNumber(value: string | null) {
  if (!value) {
    return "No contact number on file";
  }

  if (value.length === 11 && value.startsWith("09")) {
    return `${value.slice(0, 4)} ${value.slice(4, 7)} ${value.slice(7)}`;
  }

  return value;
}

function InlineNotice({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "warning";
  children: React.ReactNode;
}) {
  return (
    <div
      className={
        tone === "warning"
          ? "rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          : "rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground"
      }
    >
      {children}
    </div>
  );
}

export function BorrowerCollectorContactPanel({ borrower }: { borrower: BorrowerOverview }) {
  const collectorContact = borrower.collectorContact;
  const normalizedContactNumber = collectorContact ? normalizeContactNumber(collectorContact.contactNumber) : null;
  const hasContactNumber = Boolean(normalizedContactNumber);
  const formattedContactNumber = collectorContact
    ? formatDisplayContactNumber(collectorContact.contactNumber)
    : "No contact number on file";

  async function handleCopyNumber(value: string | null) {
    if (!value) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      toast.success("Collector number copied.");
    } catch {
      toast.error("Unable to copy the collector number right now.");
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          className="group flex w-full flex-col justify-between rounded-xl border border-dashed border-border/80 bg-gradient-to-br from-slate-50 via-white to-amber-50/40 p-4 text-left shadow-sm transition-colors hover:border-emerald-200 hover:from-emerald-50/60 hover:to-amber-50/45"
          type="button"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5">
              <TremorTitle>Borrower Support</TremorTitle>
              <div className="space-y-1">
                <p className="text-base font-semibold tracking-tight text-foreground">Need to contact your collector?</p>
                <TremorDescription className="max-w-[28ch] text-xs">
                  Contact your collector for loan concerns or future reapplication guidance.
                </TremorDescription>
              </div>
            </div>
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
              <ContactRound className="size-4" />
            </div>
          </div>

          <div className="mt-3 flex items-end justify-between gap-3">
            <div className="flex min-w-0 flex-wrap gap-2">
              {collectorContact ? (
                <>
                  <Badge variant="outline">
                    {collectorContact.areaLabel}
                  </Badge>
                  <Badge variant="outline">
                    {collectorContact.branchName}
                  </Badge>
                </>
              ) : (
                <Badge variant="outline">Collector unavailable</Badge>
              )}
            </div>

            <span
              className={cn(
                buttonVariants({ size: "sm" }),
                "pointer-events-none shrink-0 bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white",
              )}
            >
              Contact Collector
            </span>
          </div>
        </button>
      </DialogTrigger>

      <DialogContent className="max-h-[calc(100svh-1.5rem)] max-w-[calc(100%-1.5rem)] gap-0 overflow-hidden border-border/70 p-0 sm:max-w-md md:max-w-lg">
        <div className="bg-gradient-to-r from-slate-50 via-white to-amber-50/45 px-4 py-4 sm:px-5 sm:py-4">
          <DialogHeader className="gap-2 pr-10 text-left sm:pr-12">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-[0.28em]">Borrower Support</p>
            <div className="min-w-0 space-y-1">
              <DialogTitle>Contact collector assigned to your area</DialogTitle>
              <DialogDescription className="max-w-full text-pretty leading-relaxed">
                Reach out for loan concerns, payment clarifications, or future reapplication guidance.
              </DialogDescription>
            </div>
          </DialogHeader>
        </div>

        <div className="flex max-h-[calc(100svh-9rem)] flex-col gap-3 overflow-y-auto px-4 py-4 sm:max-h-[calc(100svh-10rem)] sm:gap-4 sm:px-5 sm:py-4">
          {borrower.hasActiveOrOverdueLoan ? (
            <InlineNotice tone="warning">
              You currently have an <span className="font-semibold">{borrower.loanStatus.toLowerCase()}</span> loan.
              You can still contact your collector for account concerns or future reapplication guidance.
            </InlineNotice>
          ) : null}

          {!collectorContact ? (
            <InlineNotice>
              No active collector is currently assigned to your area. Please check back later or contact your branch
              office for assistance.
            </InlineNotice>
          ) : (
            <div className="rounded-2xl border border-border/70 bg-background p-4 shadow-xs sm:p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-emerald-50 p-2 text-emerald-600">
                  <MapPinned className="size-4" />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-semibold text-foreground">Assigned collector details</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-2xl font-semibold tracking-tight text-foreground">{collectorContact.collectorName}</p>
                    <Badge variant="secondary">{collectorContact.collectorCompanyId}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{collectorContact.branchLocation}</p>
                </div>
              </div>

              {collectorContact.hasMultipleActiveCollectors ? (
                <div className="mt-4">
                  <InlineNotice>
                    Multiple active collector assignments were found for your area. Showing the most recent active
                    assignment.
                  </InlineNotice>
                </div>
              ) : null}

              {!hasContactNumber ? (
                <div className="mt-4">
                  <InlineNotice>A collector is assigned to your area, but no contact number is available yet.</InlineNotice>
                </div>
              ) : null}

              <div className="mt-3 grid gap-3 sm:mt-4 sm:grid-cols-2">
                <div className="rounded-xl border border-border/70 bg-muted/15 px-4 py-3">
                  <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-[0.24em]">
                    Assigned area
                  </p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{collectorContact.areaLabel}</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-muted/15 px-4 py-3">
                  <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-[0.24em]">Branch</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{collectorContact.branchName}</p>
                </div>
              </div>

              <div className="mt-3 rounded-2xl border border-border/70 bg-muted/20 p-4 sm:mt-4">
                <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-[0.24em]">
                  Collector contact number
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{formattedContactNumber}</p>

                <div className="mt-3 flex flex-col gap-2.5 sm:mt-4 sm:gap-3">
                  {hasContactNumber ? (
                    <Button
                      asChild
                      className="w-full bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white"
                      type="button"
                    >
                      <a href={`tel:${normalizedContactNumber}`}>
                        <Phone data-icon="inline-start" />
                        Call
                      </a>
                    </Button>
                  ) : (
                    <Button
                      className="w-full bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white"
                      disabled
                      type="button"
                    >
                      <Phone data-icon="inline-start" />
                      Call
                    </Button>
                  )}

                  {hasContactNumber ? (
                    <Button asChild className="w-full" type="button" variant="outline">
                      <a href={`sms:${normalizedContactNumber}`}>
                        <MessageSquareMore data-icon="inline-start" />
                        Text / SMS
                      </a>
                    </Button>
                  ) : (
                    <Button className="w-full" disabled type="button" variant="outline">
                      <MessageSquareMore data-icon="inline-start" />
                      Text / SMS
                    </Button>
                  )}

                  <Button
                    className="w-full"
                    disabled={!hasContactNumber}
                    onClick={() => {
                      void handleCopyNumber(collectorContact.contactNumber);
                    }}
                    type="button"
                    variant="ghost"
                  >
                    <Copy data-icon="inline-start" />
                    Copy number
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
