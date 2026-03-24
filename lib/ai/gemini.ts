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

function extractGeminiText(responseBody: unknown) {
  if (!responseBody || typeof responseBody !== "object") {
    return null;
  }

  const candidates = (responseBody as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return null;
  }

  const firstCandidate = candidates[0];
  if (!firstCandidate || typeof firstCandidate !== "object") {
    return null;
  }

  const content = (firstCandidate as { content?: unknown }).content;
  if (!content || typeof content !== "object") {
    return null;
  }

  const parts = (content as { parts?: unknown }).parts;
  if (!Array.isArray(parts) || parts.length === 0) {
    return null;
  }

  const text = parts
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

  return text || null;
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
    severityScore < 0 ||
    severityScore > 10
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

function buildPrompt(notes: string[]) {
  return [
    "You are helping a lending app review borrower missed-payment notes.",
    "Analyze only the note text provided below. Do not infer facts beyond the notes.",
    "Return strict JSON only.",
    "",
    "Required JSON schema:",
    "{",
    '  "summary": "Concise 1-2 sentence explanation of the note pattern.",',
    '  "overall_tone": "neutral | mixed | concerning | severe",',
    '  "severity_score": 0,',
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
    "- severity_score must be an integer from 0 to 10.",
    "- summary must stay short.",
    "- risk_signals max 5.",
    "- mitigating_signals max 3.",
    "- If notes are repetitive, summarize the repeated pattern rather than inventing new facts.",
    "",
    "Missed-payment notes:",
    ...notes.map((note, index) => `${index + 1}. ${note}`),
  ].join("\n");
}

export async function analyzeBorrowerMissedPaymentNotes(
  notes: string[],
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
            parts: [{ text: buildPrompt(sanitizedNotes) }],
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
    const text = extractGeminiText(responseBody);

    if (!text) {
      return {
        status: "unavailable",
        summary: "AI note analysis was unavailable for this assessment.",
        overallTone: null,
        severityScore: null,
        confidence: null,
        riskSignals: [],
        mitigatingSignals: [],
        notesAnalyzedCount: sanitizedNotes.length,
        message: "Gemini returned an empty response.",
      };
    }

    const parsed = JSON.parse(text) as unknown;
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
      severityScore: Math.max(0, Math.min(10, Math.round(parsed.severity_score))),
      confidence: parsed.confidence,
      riskSignals: parsed.risk_signals,
      mitigatingSignals: parsed.mitigating_signals.map((signal) => signal.trim()),
      notesAnalyzedCount: sanitizedNotes.length,
      message: null,
    };
  } catch {
    return {
      status: "unavailable",
      summary: "AI note analysis was unavailable for this assessment.",
      overallTone: null,
      severityScore: null,
      confidence: null,
      riskSignals: [],
      mitigatingSignals: [],
      notesAnalyzedCount: sanitizedNotes.length,
      message: "Gemini response could not be parsed safely.",
    };
  }
}
