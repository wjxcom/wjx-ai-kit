import type { ParsedSurvey, ParsedQuestion } from "./types.js";

// ─── ParsedQuestion → API wire format conversion ──────────────────

/** Internal type → API wire format mapping. Exported for reference tooling. */
export const TYPE_MAP: Record<string, { q_type: number; q_subtype: number }> = {
  "single-choice": { q_type: 3, q_subtype: 3 },
  "dropdown": { q_type: 3, q_subtype: 301 },
  "multi-choice": { q_type: 4, q_subtype: 4 },
  "fill-in": { q_type: 5, q_subtype: 5 },
  "multi-fill": { q_type: 6, q_subtype: 6 },
  "exam-multi-fill": { q_type: 6, q_subtype: 601 },
  "exam-cloze": { q_type: 6, q_subtype: 602 },
  "scale": { q_type: 3, q_subtype: 302 },
  "scoring-single": { q_type: 3, q_subtype: 303 },
  "scoring-multi": { q_type: 4, q_subtype: 401 },
  "sort": { q_type: 4, q_subtype: 402 },
  "commodity": { q_type: 4, q_subtype: 403 },
  "true-false": { q_type: 3, q_subtype: 305 },
  "weight": { q_type: 9, q_subtype: 9 },
  "slider": { q_type: 10, q_subtype: 10 },
  "matrix": { q_type: 7, q_subtype: 7 },
  "matrix-scale": { q_type: 7, q_subtype: 701 },
  "matrix-single": { q_type: 7, q_subtype: 702 },
  "matrix-multi": { q_type: 7, q_subtype: 703 },
  "matrix-fill": { q_type: 7, q_subtype: 704 },
  "paragraph": { q_type: 2, q_subtype: 2 },
  "file-upload": { q_type: 8, q_subtype: 8 },
  "drawing": { q_type: 8, q_subtype: 801 },
  "multi-level-dropdown": { q_type: 5, q_subtype: 501 },
  "scenario": { q_type: 3, q_subtype: 304 },
};

export interface WireQuestionItem {
  q_index: number;
  item_index: number;
  item_title: string;
  item_score?: number;
}

export interface WireQuestion {
  q_index: number;
  q_type: number;
  q_subtype: number;
  q_title: string;
  is_requir: boolean;
  items?: WireQuestionItem[];
  col_items?: WireQuestionItem[];
  total?: number;
}

export interface WireConversionResult {
  questions: WireQuestion[];
  /** 被过滤掉的段落说明题目（API 不支持 q_type=2） */
  skippedParagraphs: ParsedQuestion[];
}

/** Subtypes that need auto-incrementing item_score (1, 2, 3, ...) */
const SCORING_SUBTYPES = new Set([302, 303, 401]);

/**
 * Convert ParsedQuestion array to API wire format (question JSON for createSurvey).
 * 段落说明（q_type=2）会被过滤掉，因为 questions JSON 创建 API 不支持该题型。
 */
export function parsedQuestionsToWire(questions: ParsedQuestion[]): WireConversionResult {
  const unsupported: string[] = [];
  const skippedParagraphs: ParsedQuestion[] = [];
  const filteredQuestions: ParsedQuestion[] = [];

  for (const q of questions) {
    if (!TYPE_MAP[q.type]) {
      unsupported.push(`"${q.title}" (type: ${q.type})`);
    } else if (q.type === "paragraph") {
      skippedParagraphs.push(q);
    } else {
      filteredQuestions.push(q);
    }
  }

  if (unsupported.length > 0) {
    const supported = Object.keys(TYPE_MAP).join(", ");
    throw new Error(
      `DSL 包含不支持的题型，无法创建：${unsupported.join("；")}。` +
      `骨架支持的题型：${supported}`,
    );
  }

  const wire: WireQuestion[] = [];
  let qIdx = 1;

  for (const q of filteredQuestions) {
    const typeInfo = TYPE_MAP[q.type]!;

    const wq: WireQuestion = {
      q_index: qIdx,
      q_type: typeInfo.q_type,
      q_subtype: typeInfo.q_subtype,
      q_title: q.title,
      is_requir: q.required,
    };

    // Multi-fill types (q_type=6) require {_} placeholders in q_title
    if (typeInfo.q_type === 6 && !wq.q_title.includes("{_}")) {
      const count = (q.options && q.options.length > 0) ? q.options.length : 2;
      const placeholders = Array.from({ length: count }, () => "{_}").join("，");
      const separator = /[：:，,、。.；;）)》>\s]$/.test(wq.q_title) ? "" : "：";
      wq.q_title = `${wq.q_title}${separator}${placeholders}`;
    }

    if (q.options && q.options.length > 0) {
      wq.items = q.options.map((opt, i) => ({
        q_index: qIdx,
        item_index: i + 1,
        item_title: opt,
      }));
    }

    if ((q.type === "scale" || q.type === "slider") && q.scaleRange) {
      const [min, max] = q.scaleRange;
      const minNum = parseInt(min, 10);
      const maxNum = parseInt(max, 10);
      const MAX_SCALE_ITEMS = 100;
      if (!isNaN(minNum) && !isNaN(maxNum) && maxNum - minNum + 1 <= MAX_SCALE_ITEMS) {
        wq.items = [];
        for (let v = minNum; v <= maxNum; v++) {
          wq.items.push({ q_index: qIdx, item_index: v - minNum + 1, item_title: String(v) });
        }
      } else {
        wq.items = [
          { q_index: qIdx, item_index: 1, item_title: min },
          { q_index: qIdx, item_index: 2, item_title: max },
        ];
      }
    }

    if (q.type.startsWith("matrix") && q.matrixRows && q.matrixRows.length > 0) {
      wq.items = q.matrixRows.map((row, i) => ({
        q_index: qIdx,
        item_index: i + 1,
        item_title: row,
      }));
    }

    if (q.type.startsWith("matrix") && q.matrixColumns && q.matrixColumns.length > 0) {
      wq.col_items = q.matrixColumns.map((col, i) => ({
        q_index: qIdx,
        item_index: i + 1,
        item_title: col,
      }));
    }

    // Matrix-scale: convert scaleRange to col_items (if no matrixColumns already set)
    if (q.type === "matrix-scale" && q.scaleRange && !wq.col_items) {
      const [min, max] = q.scaleRange;
      const minNum = parseInt(min, 10);
      const maxNum = parseInt(max, 10);
      if (!isNaN(minNum) && !isNaN(maxNum) && maxNum - minNum + 1 <= 100) {
        wq.col_items = [];
        for (let v = minNum; v <= maxNum; v++) {
          wq.col_items.push({ q_index: qIdx, item_index: v - minNum + 1, item_title: String(v) });
        }
      }
    }

    // Auto-assign incrementing item_score for scoring subtypes (量表302, 评分单选303, 评分多选401)
    if (SCORING_SUBTYPES.has(typeInfo.q_subtype) && wq.items) {
      for (const item of wq.items) {
        if (item.item_score === undefined) {
          item.item_score = item.item_index;
        }
      }
    }

    // Weight questions (q_type=9) require total field (default 100)
    if (typeInfo.q_type === 9) {
      wq.total = 100;
    }

    wire.push(wq);
    qIdx++;
  }

  return { questions: wire, skippedParagraphs };
}

// ─── DSL text → ParsedSurvey ──────────────────────────────────────

/**
 * DSL type label → ParsedQuestion.type mapping.
 * Skeleton: 6 core types. Extend as needed.
 */
/** DSL type label → internal type mapping. Exported for reference tooling. */
export const LABEL_TO_TYPE: Record<string, string> = {
  "单选题": "single-choice",
  "下拉框": "dropdown",
  "下拉单选": "dropdown",
  "多选题": "multi-choice",
  "填空题": "fill-in",
  "简答题": "fill-in",
  "问答题": "fill-in",
  "多项填空题": "multi-fill",
  "考试多项填空": "exam-multi-fill",
  "考试完形填空": "exam-cloze",
  "完形填空": "exam-cloze",
  "量表题": "scale",
  "评分单选": "scoring-single",
  "评分多选": "scoring-multi",
  "滑动条": "slider",
  "排序题": "sort",
  "判断题": "true-false",
  "商品题": "commodity",
  "矩阵题": "matrix",
  "矩阵量表题": "matrix-scale",
  "矩阵单选题": "matrix-single",
  "矩阵多选题": "matrix-multi",
  "矩阵填空题": "matrix-fill",
  "段落说明": "paragraph",
  "比重题": "weight",
  "文件上传": "file-upload",
  "绘图题": "drawing",
  "多级下拉题": "multi-level-dropdown",
  "情景题": "scenario",
};

/** Regex to match a numbered question line: "1. Title[标签]（选填）" or "1.Title [标签]" */
const Q_LINE_RE = /^(\d+)\.\s*(.+?)\s*(\[([^\]]+)\])(\s*（选填）)?\s*$/;

/** Regex to match a DSL type label inside brackets: [单选题], [量表题], etc. */
const LABEL_RE = /\[([^\]]+)\]/;

/**
 * Parse DSL text (as produced by surveyToText) back into a ParsedSurvey structure.
 *
 * Skeleton parser: supports single-choice, multi-choice, fill-in, scale, matrix, paragraph.
 * Page breaks ("=== 分页 ===") are recognized but not represented in the output
 * (the flat question list is what the create API consumes).
 */
export function textToSurvey(text: string): ParsedSurvey {
  const lines = text.split("\n");
  if (lines.length === 0) {
    return { title: "", description: "", questions: [] };
  }

  // First non-empty line is the title
  let cursor = 0;
  while (cursor < lines.length && !lines[cursor].trim()) cursor++;
  const title = cursor < lines.length ? lines[cursor].trim() : "";
  cursor++;

  // Collect description lines (between title and first numbered question/page-break)
  const descLines: string[] = [];
  while (cursor < lines.length) {
    const line = lines[cursor].trim();
    // Stop at first numbered question line or page break
    if (Q_LINE_RE.test(line) || line === "=== 分页 ===") {
      break;
    }
    descLines.push(line);
    cursor++;
  }
  const description = descLines.join("\n").trim();

  // Parse questions
  const questions: ParsedQuestion[] = [];

  while (cursor < lines.length) {
    const line = lines[cursor].trim();

    // Skip empty lines and page breaks
    if (!line || line === "=== 分页 ===") {
      cursor++;
      continue;
    }

    const qMatch = line.match(Q_LINE_RE);
    if (qMatch) {
      // Numbered question
      const rawTitle = qMatch[2].trim();
      const label = qMatch[4];
      const isOptional = !!qMatch[5];
      const type = LABEL_TO_TYPE[label] ?? "unknown";

      cursor++;
      const q = parseQuestionBody(type, rawTitle, !isOptional, lines, cursor);
      questions.push(q.question);
      cursor = q.nextCursor;
      continue;
    }

    // Unnumbered text block → paragraph
    if (!Q_LINE_RE.test(line)) {
      questions.push({
        title: line,
        type: "paragraph",
        required: false,
      });
      cursor++;
      continue;
    }

    cursor++;
  }

  return { title, description, questions };
}

interface ParseResult {
  question: ParsedQuestion;
  nextCursor: number;
}

/**
 * Parse the body lines following a question header.
 * Consumes lines until the next question, page break, or end of input.
 */
function parseQuestionBody(
  type: string,
  title: string,
  required: boolean,
  lines: string[],
  cursor: number,
): ParseResult {
  const bodyLines: string[] = [];

  // Collect body lines until we hit a new question, page break, or consecutive empty lines
  while (cursor < lines.length) {
    const line = lines[cursor].trim();

    // Stop at page break
    if (line === "=== 分页 ===") break;

    // Stop at next numbered question
    if (Q_LINE_RE.test(line)) break;

    // Stop at empty line (question boundary), but peek ahead
    if (!line) {
      // Check if next non-empty line is a new question or page break
      let peek = cursor + 1;
      while (peek < lines.length && !lines[peek].trim()) peek++;
      if (peek >= lines.length || Q_LINE_RE.test(lines[peek].trim()) || lines[peek].trim() === "=== ���页 ===") {
        break;
      }
      // For matrix types, continue across empty lines to collect scale range / column options
      if (type.startsWith("matrix")) {
        cursor++;
        continue;
      }
      break;
    }

    bodyLines.push(line);
    cursor++;
  }

  const question = buildQuestion(type, title, required, bodyLines);
  return { question, nextCursor: cursor };
}

/** Regex to strip DSL letter prefix from option lines: "A 选项" or "A. 选项" → "选项" */
const OPTION_PREFIX_RE = /^[A-Za-z][.．、)）]\s*|^[A-Za-z]\s+(?=\S)/;

/**
 * Strip leading DSL letter prefix (e.g. "A ", "B. ", "C）") from an option string.
 * Only matches single-letter prefixes followed by punctuation or space+non-space,
 * so words like "I agree" or "A" alone are preserved.
 */
function stripOptionPrefix(option: string): string {
  return option.replace(OPTION_PREFIX_RE, "");
}

/**
 * Detect if a line looks like space-separated column headers for a matrix question.
 * Heuristic: 3+ tokens separated by spaces.
 *
 * NOTE: This heuristic is intentionally loose — it is ONLY called inside the
 * matrix case branch of buildQuestion(), so non-matrix questions never reach it.
 * In a matrix context, a first body line with 3+ space-separated tokens is very
 * likely to be column headers (e.g. "非常不满意 不满意 一般 满意 非常满意").
 */
function isMatrixColumnHeader(line: string): boolean {
  const tokens = line.split(/\s+/).filter(Boolean);
  return tokens.length >= 3;
}

/**
 * Build a ParsedQuestion from type, title, and body lines.
 */
function buildQuestion(type: string, title: string, required: boolean, body: string[]): ParsedQuestion {
  const q: ParsedQuestion = { title, type, required };

  switch (type) {
    case "single-choice":
    case "multi-choice":
    case "dropdown":
    case "scoring-single":
    case "scoring-multi":
    case "sort":
    case "true-false":
    case "weight":
    case "commodity":
    case "scenario":
      q.options = body.filter((l) => l.length > 0).map(stripOptionPrefix);
      break;

    case "scale":
    case "slider":
      // Scale body is "min~max" on one line, or individual option lines
      if (body.length > 0) {
        const rangeLine = body[0];
        const parts = rangeLine.split("~");
        if (parts.length === 2) {
          q.scaleRange = [parts[0].trim(), parts[1].trim()];
        } else {
          // AI may output scale options as individual lines (e.g. NPS 0-10)
          q.options = body.filter((l) => l.length > 0).map(stripOptionPrefix);
        }
      }
      break;

    case "matrix":
    case "matrix-scale":
    case "matrix-single":
    case "matrix-multi":
    case "matrix-fill":
      // Matrix body: two formats supported
      // Format 1 (DSL): "行：" header, then "- row1", "- row2", ...
      // Format 2 (AI): space-separated column headers on first line, then plain row lines
      q.matrixRows = [];
      if (body.length > 0 && (body[0] === "行：" || body[0].toLowerCase() === "rows:")) {
        // Format 1: DSL format — "行：" / "Rows:" header, then "- row" lines,
        // optionally followed by scale range (1~5) or column option lines
        const colOptions: string[] = [];
        for (const line of body) {
          if (line === "行：" || line.toLowerCase() === "rows:") continue;
          if (line.startsWith("- ")) {
            q.matrixRows.push(line.slice(2).trim());
          } else {
            // Non-row line: could be scale range or column option
            const scaleParts = line.split("~");
            if (scaleParts.length === 2 && /^\d+$/.test(scaleParts[0].trim()) && /^\d+$/.test(scaleParts[1].trim())) {
              q.scaleRange = [scaleParts[0].trim(), scaleParts[1].trim()];
            } else if (line.trim()) {
              colOptions.push(stripOptionPrefix(line.trim()));
            }
          }
        }
        // If we collected column options, set them as matrixColumns
        if (colOptions.length > 0) {
          q.matrixColumns = colOptions;
        }
      } else if (body.length >= 2 && isMatrixColumnHeader(body[0])) {
        // Format 2: AI format - first line is column headers
        q.matrixColumns = body[0].split(/\s+/).filter(Boolean);
        for (let i = 1; i < body.length; i++) {
          const row = body[i].trim();
          if (row) q.matrixRows.push(row);
        }
      } else {
        // Fallback: treat all lines as rows
        for (const line of body) {
          if (line.startsWith("- ")) {
            q.matrixRows.push(line.slice(2).trim());
          } else if (line.trim()) {
            q.matrixRows.push(line.trim());
          }
        }
      }
      break;

    case "fill-in":
    case "multi-fill":
    case "exam-multi-fill":
    case "exam-cloze":
    case "multi-level-dropdown":
    case "file-upload":
    case "drawing":
      // No body for these types
      break;

    case "paragraph":
      // Title is the content
      break;
  }

  return q;
}
