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
const RISK_RESPONSE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: {
      type: "string",
      description: "1-2 short sentences only. Keep it concise.",
    },
    overall_tone: {
      type: "string",
      enum: ["neutral", "mixed", "concerning", "severe"],
    },
    severity_score: {
      type: "integer",
      minimum: 1,
      maximum: 50,
    },
    risk_signals: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          signal: {
            type: "string",
            enum: [
              "income_instability",
              "avoidance",
              "health_issue",
              "family_emergency",
              "work_disruption",
              "repeated_promises",
              "other",
            ],
          },
          evidence: {
            type: "string",
          },
        },
        required: ["signal", "evidence"],
      },
    },
    mitigating_signals: {
      type: "array",
      maxItems: 3,
      items: {
        type: "string",
      },
    },
    confidence: {
      type: "string",
      enum: ["low", "medium", "high"],
    },
  },
  required: [
    "summary",
    "overall_tone",
    "severity_score",
    "risk_signals",
    "mitigating_signals",
    "confidence",
  ],
} as const;

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

function normalizeLooseKey(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function parseSeverityScore(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(1, Math.min(50, Math.round(value)));
  }

  if (typeof value === "string") {
    const match = value.match(/-?\d+(\.\d+)?/);
    if (!match) {
      return null;
    }

    const parsed = Number(match[0]);
    if (!Number.isFinite(parsed)) {
      return null;
    }

    return Math.max(1, Math.min(50, Math.round(parsed)));
  }

  return null;
}

function normalizeTone(value: unknown): BorrowerRiskAiTone | null {
  const normalized = normalizeLooseKey(normalizeText(value));
  if (ALLOWED_TONES.has(normalized as BorrowerRiskAiTone)) {
    return normalized as BorrowerRiskAiTone;
  }

  return null;
}

function normalizeConfidence(value: unknown): BorrowerRiskAiConfidence | null {
  const normalized = normalizeLooseKey(normalizeText(value));
  if (ALLOWED_CONFIDENCE.has(normalized as BorrowerRiskAiConfidence)) {
    return normalized as BorrowerRiskAiConfidence;
  }

  return null;
}

function getRecordValue(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (key in record) {
      return record[key];
    }
  }
  return undefined;
}

function normalizeSignalKind(value: unknown): BorrowerRiskSignalKind {
  const normalized = normalizeLooseKey(normalizeText(value));
  if (ALLOWED_SIGNALS.has(normalized as BorrowerRiskSignalKind)) {
    return normalized as BorrowerRiskSignalKind;
  }

  return "other";
}

function normalizeRiskSignals(value: unknown): BorrowerRiskSignal[] {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.entries(value as Record<string, unknown>)
      .map(([signalKey, evidenceValue]) => {
        const evidence = normalizeText(evidenceValue);
        if (!evidence) {
          return null;
        }
        return {
          signal: normalizeSignalKind(signalKey),
          evidence,
        };
      })
      .filter((entry): entry is BorrowerRiskSignal => Boolean(entry))
      .slice(0, 5);
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (typeof entry === "string") {
        const normalizedEvidence = normalizeText(entry);
        if (!normalizedEvidence) {
          return null;
        }
        return {
          signal: "other" as const,
          evidence: normalizedEvidence,
        };
      }

      if (!entry || typeof entry !== "object") {
        return null;
      }

      const signal = normalizeSignalKind((entry as { signal?: unknown }).signal);
      const evidence =
        normalizeText((entry as { evidence?: unknown }).evidence) ||
        normalizeText((entry as { reason?: unknown }).reason) ||
        normalizeText((entry as { detail?: unknown }).detail) ||
        normalizeText((entry as { text?: unknown }).text);

      if (!evidence) {
        return null;
      }

      return { signal, evidence };
    })
    .filter((entry): entry is BorrowerRiskSignal => Boolean(entry))
    .slice(0, 5);
}

function normalizeMitigatingSignals(value: unknown): string[] {
  if (typeof value === "string") {
    const normalized = normalizeText(value);
    if (!normalized) {
      return [];
    }

    return normalized
      .split(/[;\n]/)
      .map((entry) => entry.trim())
      .filter(Boolean)
      .slice(0, 3);
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => normalizeText(entry))
    .filter(Boolean)
    .slice(0, 3);
}

function normalizeGeminiRiskPayload(value: unknown): GeminiRiskPayload | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;

  const summary = normalizeText(
    getRecordValue(record, [
      "summary",
      "Summary",
      "explanation",
      "analysis",
      "reasoning",
      "rationale",
    ]),
  );
  const safeSummary = summary.slice(0, 600);
  const severityScore = parseSeverityScore(
    getRecordValue(record, ["severity_score", "severityScore", "score", "risk_score"]),
  );
  const overallTone =
    normalizeTone(getRecordValue(record, ["overall_tone", "overallTone", "tone"])) ||
    (severityScore !== null
      ? severityScore <= 3
        ? "neutral"
        : severityScore <= 10
          ? "mixed"
          : severityScore <= 35
            ? "concerning"
            : "severe"
      : null);
  const confidence =
    normalizeConfidence(getRecordValue(record, ["confidence", "confidence_level", "confidenceLevel"])) ||
    "medium";
  const riskSignals = normalizeRiskSignals(
    getRecordValue(record, ["risk_signals", "riskSignals", "signals", "riskIndicators"]),
  );
  const mitigatingSignals = normalizeMitigatingSignals(
    getRecordValue(record, ["mitigating_signals", "mitigatingSignals", "mitigations", "protective_factors", "protectiveFactors"]),
  );

  if (!safeSummary) {
    return null;
  }

  if (!overallTone || severityScore === null || !confidence) {
    return null;
  }

  return {
    summary: safeSummary,
    overall_tone: overallTone,
    severity_score: severityScore,
    risk_signals: riskSignals,
    mitigating_signals: mitigatingSignals,
    confidence,
  };
}

function extractPayloadCandidates(value: unknown) {
  if (Array.isArray(value)) {
    return value;
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  const root = value as Record<string, unknown>;
  const candidates: unknown[] = [root];

  for (const key of ["result", "assessment", "data", "output", "response"]) {
    if (root[key] && typeof root[key] === "object") {
      candidates.push(root[key]);
    }
  }

  return candidates;
}

function buildPrompt(notes: string[]) {
  return [
    "Review the borrower missed-payment notes.",
    "Use only evidence present in the note text.",
    "Be conservative and do not exaggerate severity.",
    "Most normal cases should remain in 1 to 10.",
    "Use 11+ only when there is strong repeated avoidance or serious risk behavior.",
    "Use 36+ only for extreme, high-confidence deliberate evasion.",
    "Keep the summary short.",
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
          responseJsonSchema: RISK_RESPONSE_JSON_SCHEMA,
          temperature: 0.1,
          maxOutputTokens: 400,
        },
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      const compactErrorText = errorText.trim().replace(/\s+/g, " ").slice(0, 800);
      const message =
        response.status === 429
          ? "Gemini is temporarily rate-limited right now. AI note analysis was unavailable for this assessment. Please wait a moment before trying again."
          : compactErrorText
            ? `Gemini request failed with status ${response.status}. ${compactErrorText}`
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
    const normalizedPayload = extractPayloadCandidates(parsed)
      .map((candidate) => normalizeGeminiRiskPayload(candidate))
      .find((candidate): candidate is GeminiRiskPayload => Boolean(candidate));

    if (!normalizedPayload) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Gemini raw text:", text);
        console.error("Gemini parsed:", parsed);
      }
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
      summary: normalizedPayload.summary,
      overallTone: normalizedPayload.overall_tone,
      severityScore: Math.max(1, Math.min(50, Math.round(normalizedPayload.severity_score))),
      confidence: normalizedPayload.confidence,
      riskSignals: normalizedPayload.risk_signals,
      mitigatingSignals: normalizedPayload.mitigating_signals.map((signal) => signal.trim()),
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
