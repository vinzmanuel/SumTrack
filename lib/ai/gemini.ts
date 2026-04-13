import "server-only";

import type {
  BorrowerRiskAiConfidence,
  BorrowerRiskAiResult,
  BorrowerRiskAiTone,
  BorrowerRiskSignal,
  BorrowerRiskSignalKind,
} from "@/app/dashboard/borrowers/types";

type GeminiRiskPayload = {
  summary: string;
  overall_tone: BorrowerRiskAiTone;
  severity_score: number;
  risk_signals: BorrowerRiskSignal[];
  mitigating_signals: string[];
  confidence: BorrowerRiskAiConfidence;
};
type BorrowerRiskPromptContext = {
  totalMissedPayments: number;
  totalCollectionEntries: number;
  missedPaymentRatio: number;
  missedPaymentsLast30Days: number;
  missedPaymentsLast90Days: number;
  loansWithMissedPayments: number;
  overdueLoans: number;
  abandonedLoans: number;
};

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_GEMINI_MODEL = "gemini-3-flash-preview";
const ALLOWED_TONES = new Set<BorrowerRiskAiTone>(["neutral", "mixed", "concerning", "severe"]);
const ALLOWED_CONFIDENCE = new Set<BorrowerRiskAiConfidence>(["low", "medium", "high"]);
const ALLOWED_SIGNALS = new Set<BorrowerRiskSignalKind>([
  "income_instability",
  "avoidance",
  "health_issue",
  "family_emergency",
  "work_disruption",
  "repeated_promises",
  "other",
]);

function extractGeminiTexts(responseBody: unknown) {
  if (!responseBody || typeof responseBody !== "object") {
    return [];
  }

  const candidates = (responseBody as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return [];
  }

  return candidates
    .map((candidate) => {
      if (!candidate || typeof candidate !== "object") {
        return "";
      }

      const content = (candidate as { content?: unknown }).content;
      if (!content || typeof content !== "object") {
        return "";
      }

      const parts = (content as { parts?: unknown }).parts;
      if (!Array.isArray(parts) || parts.length === 0) {
        return "";
      }

      return parts
        .map((part) => {
          if (!part || typeof part !== "object") {
            return "";
          }

          return typeof (part as { text?: unknown }).text === "string"
            ? (part as { text: string }).text
            : "";
        })
        .join("")
        .trim();
    })
    .filter((text) => text.length > 0);
}

function extractGeminiBlockReason(responseBody: unknown) {
  if (!responseBody || typeof responseBody !== "object") {
    return null;
  }

  const promptFeedback = (responseBody as { promptFeedback?: unknown }).promptFeedback;
  if (promptFeedback && typeof promptFeedback === "object") {
    const blockReason = (promptFeedback as { blockReason?: unknown }).blockReason;
    if (typeof blockReason === "string" && blockReason.trim().length > 0) {
      return blockReason.trim();
    }
  }

  const candidates = (responseBody as { candidates?: unknown }).candidates;
  if (Array.isArray(candidates)) {
    for (const candidate of candidates) {
      if (!candidate || typeof candidate !== "object") {
        continue;
      }
      const finishReason = (candidate as { finishReason?: unknown }).finishReason;
      if (typeof finishReason === "string" && finishReason !== "STOP") {
        return finishReason;
      }
    }
  }

  return null;
}

function parseJsonLikeText(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const candidates: string[] = [trimmed];
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    candidates.push(fencedMatch[1].trim());
  }
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as unknown;
    } catch {
      continue;
    }
  }

  return null;
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isBorrowerRiskSignal(value: unknown): value is BorrowerRiskSignal {
  if (!value || typeof value !== "object") {
    return false;
  }

  const signal = normalizeText((value as { signal?: unknown }).signal);
  const evidence = normalizeText((value as { evidence?: unknown }).evidence);

  return ALLOWED_SIGNALS.has(signal as BorrowerRiskSignalKind) && evidence.length > 0;
}

function isGeminiRiskPayload(value: unknown): value is GeminiRiskPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const summary = normalizeText((value as { summary?: unknown }).summary);
  const overallTone = normalizeText((value as { overall_tone?: unknown }).overall_tone);
  const severityScore = (value as { severity_score?: unknown }).severity_score;
  const riskSignals = (value as { risk_signals?: unknown }).risk_signals;
  const mitigatingSignals = (value as { mitigating_signals?: unknown }).mitigating_signals;
  const confidence = normalizeText((value as { confidence?: unknown }).confidence);

  if (!summary || summary.length > 600) {
    return false;
  }

  if (!ALLOWED_TONES.has(overallTone as BorrowerRiskAiTone)) {
    return false;
  }

  if (
    typeof severityScore !== "number" ||
    !Number.isFinite(severityScore) ||
    severityScore < 1 ||
    severityScore > 50
  ) {
    return false;
  }

  if (!Array.isArray(riskSignals) || riskSignals.length > 5 || !riskSignals.every(isBorrowerRiskSignal)) {
    return false;
  }

  if (
    !Array.isArray(mitigatingSignals) ||
    mitigatingSignals.length > 3 ||
    !mitigatingSignals.every((signal) => typeof signal === "string" && signal.trim().length > 0)
  ) {
    return false;
  }

  if (!ALLOWED_CONFIDENCE.has(confidence as BorrowerRiskAiConfidence)) {
    return false;
  }

  return true;
}

function buildPrompt(notes: string[], context?: BorrowerRiskPromptContext) {
  const ratioPercent = context ? (context.missedPaymentRatio * 100).toFixed(1) : "N/A";
  const contextLines = context
    ? [
      `- total_missed_payments: ${context.totalMissedPayments}`,
      `- total_collection_entries: ${context.totalCollectionEntries}`,
      `- missed_payment_ratio_percent: ${ratioPercent}`,
      `- missed_payments_last_30_days: ${context.missedPaymentsLast30Days}`,
      `- missed_payments_last_90_days: ${context.missedPaymentsLast90Days}`,
      `- loans_with_missed_payments: ${context.loansWithMissedPayments}`,
      `- overdue_loans: ${context.overdueLoans}`,
      `- abandoned_loans: ${context.abandonedLoans}`,
    ]
    : ["- context_unavailable"];

  return [
    "You are helping a lending app review borrower missed-payment notes.",
    "Analyze note text and borrower payment context below.",
    "Do not invent facts that are not supported by the notes/context.",
    "Return strict JSON only.",
    "",
    "Required JSON schema:",
    "{",
    '  "summary": "Concise 1-2 sentence explanation of the note pattern.",',
    '  "overall_tone": "neutral | mixed | concerning | severe",',
    '  "severity_score": 1,',
    '  "risk_signals": [',
    "    {",
    '      "signal": "income_instability | avoidance | health_issue | family_emergency | work_disruption | repeated_promises | other",',
    '      "evidence": "Short plain-language evidence from the notes"',
    "    }",
    "  ],",
    '  "mitigating_signals": ["Short plain-language positive/contextual factors if present"],',
    '  "confidence": "low | medium | high"',
    "}",
    "",
    "Rules:",
    "- severity_score must be an integer from 1 to 50.",
    "- Most normal cases MUST stay in 1 to 10.",
    "- Use 1 to 3 for isolated/light reasons with no strong avoidance pattern.",
    "- Use 4 to 6 for moderate but explainable missed-payment reasons.",
    "- Use 7 to 10 for repeated reliability concerns without confirmed severe evasion.",
    "- Only use 11+ when there is strong evidence of serious risk behavior.",
    "- Use 11 to 20 for persistent non-response/repeated avoidance patterns.",
    "- Use 21 to 35 for deliberate evasion signs (e.g., sustained AWOL pattern, intentional disappearance indicators).",
    "- Use 36 to 50 only for extreme/high-confidence cases such as fleeing, hiding to avoid legal process, or severe deliberate evasion with clear evidence.",
    "- summary must stay short.",
    "- risk_signals max 5.",
    "- mitigating_signals max 3.",
    "- If notes are repetitive, summarize the repeated pattern rather than inventing new facts.",
    "",
    "Borrower payment context:",
    ...contextLines,
    "",
    "Missed-payment notes:",
    ...notes.map((note, index) => `${index + 1}. ${note}`),
  ].join("\n");
}

export async function analyzeBorrowerMissedPaymentNotes(
  notes: string[],
  context?: BorrowerRiskPromptContext,
): Promise<BorrowerRiskAiResult> {
  const sanitizedNotes = notes.map((note) => note.trim()).filter(Boolean);

  if (sanitizedNotes.length === 0) {
    return {
      status: "skipped_no_notes",
      summary: "No missed-payment notes were available for AI review.",
      overallTone: null,
      severityScore: null,
      confidence: null,
      riskSignals: [],
      mitigatingSignals: [],
      notesAnalyzedCount: 0,
      message: "Gemini review was skipped because there were no missed-payment notes to analyze.",
    };
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const configuredModel = process.env.GEMINI_MODEL?.trim();
  const model = configuredModel || DEFAULT_GEMINI_MODEL;

  if (!apiKey) {
    return {
      status: "unavailable",
      summary: "AI note analysis was unavailable for this assessment.",
      overallTone: null,
      severityScore: null,
      confidence: null,
      riskSignals: [],
      mitigatingSignals: [],
      notesAnalyzedCount: sanitizedNotes.length,
      message: "Gemini API key is not configured.",
    };
  }

  try {
    const response = await fetch(`${GEMINI_API_URL}/models/${model}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: buildPrompt(sanitizedNotes, context) }],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
          maxOutputTokens: 700,
        },
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const message =
        response.status === 429
          ? "Gemini is temporarily rate-limited right now. AI note analysis was unavailable for this assessment. Please wait a moment before trying again."
          : `Gemini request failed with status ${response.status}.`;

      return {
        status: "unavailable",
        summary: "AI note analysis was unavailable for this assessment.",
        overallTone: null,
        severityScore: null,
        confidence: null,
        riskSignals: [],
        mitigatingSignals: [],
        notesAnalyzedCount: sanitizedNotes.length,
        message,
      };
    }

    const responseBody = (await response.json()) as unknown;
    const texts = extractGeminiTexts(responseBody);
    const text = texts[0] ?? null;

    if (!text) {
      const blockReason = extractGeminiBlockReason(responseBody);
      return {
        status: "unavailable",
        summary: "AI note analysis was unavailable for this assessment.",
        overallTone: null,
        severityScore: null,
        confidence: null,
        riskSignals: [],
        mitigatingSignals: [],
        notesAnalyzedCount: sanitizedNotes.length,
        message: blockReason
          ? `Gemini response was blocked (${blockReason}).`
          : "Gemini returned an empty response.",
      };
    }

    const parsed = parseJsonLikeText(text);
    if (!isGeminiRiskPayload(parsed)) {
      return {
        status: "unavailable",
        summary: "AI note analysis was unavailable for this assessment.",
        overallTone: null,
        severityScore: null,
        confidence: null,
        riskSignals: [],
        mitigatingSignals: [],
        notesAnalyzedCount: sanitizedNotes.length,
        message: "Gemini returned JSON in an unexpected format.",
      };
    }

    return {
      status: "success",
      summary: parsed.summary,
      overallTone: parsed.overall_tone,
      severityScore: Math.max(1, Math.min(50, Math.round(parsed.severity_score))),
      confidence: parsed.confidence,
      riskSignals: parsed.risk_signals,
      mitigatingSignals: parsed.mitigating_signals.map((signal) => signal.trim()),
      notesAnalyzedCount: sanitizedNotes.length,
      message: null,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown exception";
    return {
      status: "unavailable",
      summary: "AI note analysis was unavailable for this assessment.",
      overallTone: null,
      severityScore: null,
      confidence: null,
      riskSignals: [],
      mitigatingSignals: [],
      notesAnalyzedCount: sanitizedNotes.length,
      message:
        process.env.NODE_ENV === "production"
          ? "Gemini response could not be parsed safely."
          : `Gemini response could not be parsed safely. (${detail})`,
    };
  }
}
