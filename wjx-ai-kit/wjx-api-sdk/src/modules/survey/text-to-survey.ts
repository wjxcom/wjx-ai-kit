import type { ParsedSurvey, ParsedQuestion } from "./types.js";

/**
 * DSL type label → ParsedQuestion.type mapping.
 * Skeleton: 6 core types. Extend as needed.
 */
const LABEL_TO_TYPE: Record<string, string> = {
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

/** Regex to match a numbered question line: "1. Title[标签]（选填）" */
const Q_LINE_RE = /^(\d+)\.\s+(.+?)(\[([^\]]+)\])(\s*（选填）)?\s*$/;

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
      // Otherwise this empty line is within the question body (shouldn't happen in clean DSL)
      break;
    }

    bodyLines.push(line);
    cursor++;
  }

  const question = buildQuestion(type, title, required, bodyLines);
  return { question, nextCursor: cursor };
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
      q.options = body.filter((l) => l.length > 0);
      break;

    case "scale":
    case "slider":
      // Scale body is "min~max" on one line
      if (body.length > 0) {
        const rangeLine = body[0];
        const parts = rangeLine.split("~");
        if (parts.length === 2) {
          q.scaleRange = [parts[0].trim(), parts[1].trim()];
        }
      }
      break;

    case "matrix":
    case "matrix-scale":
    case "matrix-single":
    case "matrix-multi":
    case "matrix-fill":
      // Matrix body: "行：" header, then "- row1", "- row2", ...
      q.matrixRows = [];
      for (const line of body) {
        if (line === "行：") continue;
        if (line.startsWith("- ")) {
          q.matrixRows.push(line.slice(2).trim());
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
