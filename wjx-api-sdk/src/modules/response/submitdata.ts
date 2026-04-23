import type { SubmitdataQuestionMeta } from "./types.js";

const MATRIX_PLACEHOLDER_RE = /^__WJX_MATRIX__(\d+)__$/;

type QuestionNumberingMode = "raw" | "answerable";

interface SubmitdataQuestionLookup {
  answerableCount: number;
  hasNonAnswerableQuestions: boolean;
  mode: QuestionNumberingMode;
  rawQuestions: Map<number, SubmitdataQuestionMeta>;
  answerableQuestions: Map<number, SubmitdataQuestionMeta>;
  rawToAnswerable: Map<number, number>;
}

function normalizeMatrixAnswerValue(rawValue: string): string {
  const parts = rawValue
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) return rawValue;

  const normalizedParts: string[] = [];

  for (const part of parts) {
    const bangIdx = part.indexOf("!");
    const underIdx = bangIdx === -1 ? part.indexOf("_") : -1;
    const sepIdx = bangIdx !== -1 ? bangIdx : underIdx;

    if (sepIdx <= 0 || sepIdx >= part.length - 1) {
      return rawValue;
    }

    normalizedParts.push(`${part.slice(0, sepIdx)}!${part.slice(sepIdx + 1)}`);
  }

  return normalizedParts.join(",");
}

function normalizeRankingAnswerValue(rawValue: string): string {
  if (rawValue.includes("|")) return rawValue;

  const parts = rawValue
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length <= 1 || !parts.every((part) => /^-?\d+$/.test(part))) {
    return rawValue;
  }

  return parts.join("|");
}

function isAnswerableQuestion(question: SubmitdataQuestionMeta): boolean {
  return question.q_type !== 1 && question.q_type !== 2;
}

function extractBaseQuestionIndex(rawKey: string): number | null {
  const matrixMatch = /^(\d+)_/.exec(rawKey);
  if (matrixMatch) return parseInt(matrixMatch[1], 10);

  const questionIndex = parseInt(rawKey, 10);
  return Number.isNaN(questionIndex) ? null : questionIndex;
}

function buildQuestionLookup(submitdata: string, questions: SubmitdataQuestionMeta[]): SubmitdataQuestionLookup {
  const rawQuestions = new Map<number, SubmitdataQuestionMeta>();
  const answerableQuestions = new Map<number, SubmitdataQuestionMeta>();
  const rawToAnswerable = new Map<number, number>();
  let hasNonAnswerableQuestions = false;

  let answerableIndex = 0;
  for (const question of questions) {
    rawQuestions.set(question.q_index, question);
    if (isAnswerableQuestion(question)) {
      answerableIndex += 1;
      answerableQuestions.set(answerableIndex, question);
      rawToAnswerable.set(question.q_index, answerableIndex);
    } else {
      hasNonAnswerableQuestions = true;
    }
  }

  const submittedBaseIndices = submitdata
    .split("}")
    .map((segment) => {
      const trimmed = segment.trim();
      if (!trimmed) return null;
      const dollarIdx = trimmed.indexOf("$");
      if (dollarIdx === -1) return null;
      return extractBaseQuestionIndex(trimmed.slice(0, dollarIdx).trim());
    })
    .filter((index): index is number => index !== null);

  const mode: QuestionNumberingMode = hasNonAnswerableQuestions && submittedBaseIndices.some(
    (index) => index > answerableIndex && rawToAnswerable.has(index),
  )
    ? "raw"
    : "answerable";

  return {
    answerableCount: answerableIndex,
    hasNonAnswerableQuestions,
    mode,
    rawQuestions,
    answerableQuestions,
    rawToAnswerable,
  };
}

function resolveQuestion(
  questionIndex: number,
  lookup: SubmitdataQuestionLookup,
): { normalizedIndex: number; question?: SubmitdataQuestionMeta } {
  if (lookup.mode === "raw") {
    return {
      normalizedIndex: lookup.rawToAnswerable.get(questionIndex) ?? questionIndex,
      question: lookup.rawQuestions.get(questionIndex) ?? lookup.answerableQuestions.get(questionIndex),
    };
  }

  return {
    normalizedIndex: questionIndex,
    question: lookup.hasNonAnswerableQuestions
      ? (lookup.answerableQuestions.get(questionIndex) ?? lookup.rawQuestions.get(questionIndex))
      : (lookup.rawQuestions.get(questionIndex) ?? lookup.answerableQuestions.get(questionIndex)),
  };
}

export function normalizeSubmitdata(submitdata: string, questions: SubmitdataQuestionMeta[]): string {
  if (!submitdata || submitdata.trim() === "") return submitdata;
  const lookup = buildQuestionLookup(submitdata, questions);

  const normalizedSegments: string[] = [];
  const matrixBuckets = new Map<number, string[]>();

  for (const segment of submitdata.split("}")) {
    const trimmed = segment.trim();
    if (!trimmed) continue;

    const dollarIdx = trimmed.indexOf("$");
    if (dollarIdx === -1) {
      normalizedSegments.push(trimmed);
      continue;
    }

    const rawKey = trimmed.slice(0, dollarIdx).trim();
    let rawValue = trimmed.slice(dollarIdx + 1).trim();

    const legacyMatrixMatch = /^(\d+)_([^$]+)$/.exec(rawKey);
    if (legacyMatrixMatch) {
      const baseQuestionIndex = parseInt(legacyMatrixMatch[1], 10);
      const { normalizedIndex, question } = resolveQuestion(baseQuestionIndex, lookup);
      if (question?.q_type === 7) {
        const rowIndex = legacyMatrixMatch[2].trim();
        const matrixValue = normalizeMatrixAnswerValue(`${rowIndex}!${rawValue}`);
        const bucket = matrixBuckets.get(normalizedIndex);

        if (bucket) {
          bucket.push(matrixValue);
        } else {
          matrixBuckets.set(normalizedIndex, [matrixValue]);
          normalizedSegments.push(`__WJX_MATRIX__${normalizedIndex}__`);
        }
        continue;
      }
    }

    const questionIndex = parseInt(rawKey, 10);
    if (!Number.isNaN(questionIndex)) {
      const { normalizedIndex, question } = resolveQuestion(questionIndex, lookup);

      if (question?.q_subtype === 402) {
        rawValue = normalizeRankingAnswerValue(rawValue);
      }

      if (question?.q_type === 7) {
        normalizedSegments.push(`${normalizedIndex}$${normalizeMatrixAnswerValue(rawValue)}`);
        continue;
      }

      normalizedSegments.push(`${normalizedIndex}$${rawValue}`);
      continue;
    }

    normalizedSegments.push(`${rawKey}$${rawValue}`);
  }

  return normalizedSegments
    .map((segment) => {
      const placeholderMatch = MATRIX_PLACEHOLDER_RE.exec(segment);
      if (!placeholderMatch) return segment;

      const questionIndex = parseInt(placeholderMatch[1], 10);
      const parts = matrixBuckets.get(questionIndex);
      if (!parts || parts.length === 0) return "";
      return `${questionIndex}$${parts.join(",")}`;
    })
    .filter(Boolean)
    .join("}");
}
