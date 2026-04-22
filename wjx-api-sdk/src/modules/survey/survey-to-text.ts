import type { SurveyDetail, SurveyQuestion, SurveyQuestionItem } from "./types.js";

/**
 * Map `${q_type}_${q_subtype}` to a human-readable DSL label.
 * Falls back to `[未知题型:q_type/q_subtype]` for unknown combinations.
 */
export function typeToLabel(q_type: number, q_subtype: number): string {
  const key = `${q_type}_${q_subtype}`;
  const label = TYPE_LABEL_MAP[key] ?? TYPE_LABEL_MAP[`${q_type}_${q_type}`];
  if (label) return label;
  return `[未知题型:${q_type}/${q_subtype}]`;
}

const TYPE_LABEL_MAP: Record<string, string> = {
  // q_type=1: 分页
  "1_1": "[分页栏]",
  // q_type=2: 段落说明
  "2_2": "[段落说明]",
  // q_type=3: 单选 family
  "3_3": "[单选题]",
  "3_301": "[下拉框]",
  "3_302": "[量表题]",
  "3_303": "[评分单选]",
  "3_304": "[情景题]",
  "3_305": "[判断题]",
  // q_type=4: 多选 family
  "4_4": "[多选题]",
  "4_401": "[评分多选]",
  "4_402": "[排序题]",
  "4_403": "[商品题]",
  // q_type=5: 填空 family
  "5_5": "[填空题]",
  "5_501": "[多级下拉题]",
  // q_type=6: 多项填空
  "6_6": "[多项填空题]",
  // q_type=7: 矩阵 family
  "7_7": "[矩阵题]",
  "7_701": "[矩阵量表题]",
  "7_702": "[矩阵单选题]",
  "7_703": "[矩阵多选题]",
  "7_704": "[矩阵填空题]",
  "7_705": "[矩阵滑动条]",
  "7_706": "[矩阵数值题]",
  "7_707": "[表格填空题]",
  "7_708": "[表格下拉框]",
  "7_709": "[表格组合题]",
  "7_710": "[表格自增题]",
  "7_711": "[多项文件题]",
  "7_712": "[多项简答题]",
  // q_type=8: 文件上传 family
  "8_8": "[文件上传]",
  "8_801": "[绘图题]",
  // q_type=9: 比重
  "9_9": "[比重题]",
  // q_type=10: 滑动条
  "10_10": "[滑动条]",
};

/**
 * Strip HTML tags from a string, replacing <br> variants with newline.
 */
export function stripHtml(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .trim();
}

/**
 * Render a single question item as a line of text.
 */
function renderItem(item: SurveyQuestionItem): string {
  return stripHtml(item.item_title);
}

/**
 * Convert a SurveyDetail (from get_survey API) into a human-readable DSL text.
 *
 * The output is a "readable summary" of the survey, not a complete serialisation.
 * Branch logic, validation rules, scoring, randomisation etc. are not represented.
 */
export function surveyToText(survey: SurveyDetail): string {
  const lines: string[] = [];

  // Title
  lines.push(stripHtml(survey.title));

  // Description (if non-empty)
  if (survey.description) {
    lines.push("");
    lines.push(stripHtml(survey.description));
  }

  const questions = survey.questions;
  if (!questions || questions.length === 0) {
    return lines.join("\n");
  }

  // Separate page breaks from real questions so we can render page separators
  // between groups and number only real questions.
  const segments = splitByPages(questions);

  let qNumber = 1;

  for (let si = 0; si < segments.length; si++) {
    const segment = segments[si];

    // Add page separator between pages (not before the first or after the last)
    if (si > 0) {
      lines.push("");
      lines.push("=== 分页 ===");
    }

    for (const q of segment) {
      lines.push("");

      // Paragraph / description (q_type=2): no number
      if (q.q_type === 2) {
        lines.push(stripHtml(q.q_title));
        continue;
      }

      const label = typeToLabel(q.q_type, q.q_subtype);
      const title = stripHtml(q.q_title);
      const requiredMark = q.is_requir ? "" : "（选填）";

      lines.push(`${qNumber}. ${title}${label}${requiredMark}`);
      qNumber++;

      // Render question-type-specific content
      renderQuestionBody(q, lines);
    }
  }

  return lines.join("\n").trim();
}

/**
 * Split the flat questions array into segments separated by page breaks (q_type=1).
 * Page break entries themselves are excluded from segments.
 */
function splitByPages(questions: SurveyQuestion[]): SurveyQuestion[][] {
  const segments: SurveyQuestion[][] = [];
  let current: SurveyQuestion[] = [];

  for (const q of questions) {
    if (q.q_type === 1) {
      // Start a new page — always push the current segment
      segments.push(current);
      current = [];
      continue;
    }
    current.push(q);
  }

  // Push the last segment
  segments.push(current);

  // If the first segment is empty (leading page break), remove it
  // so we don't get a separator before the first real content.
  if (segments.length > 0 && segments[0].length === 0) {
    segments.shift();
  }

  // Ensure at least one segment
  if (segments.length === 0) {
    segments.push([]);
  }

  return segments;
}

/**
 * Append question-body lines (options, scale range, matrix rows, etc.)
 */
function renderQuestionBody(q: SurveyQuestion, lines: string[]): void {
  switch (q.q_type) {
    case 3: // single-choice family
    case 4: // multi-choice family
      renderChoiceItems(q, lines);
      break;

    case 5: // fill-in (no body needed)
      break;

    case 6: // multi-fill
      renderMultiFillItems(q, lines);
      break;

    case 7: // matrix family
      renderMatrixItems(q, lines);
      break;

    case 8: // file upload (no body)
      break;

    case 9: // weight distribution
      renderWeightItems(q, lines);
      break;

    case 10: // slider
      renderSlider(q, lines);
      break;

    default:
      // For unknown types, still try to render items if present
      if (q.items && q.items.length > 0) {
        for (const item of q.items) {
          lines.push(renderItem(item));
        }
      }
      break;
  }
}

function renderChoiceItems(q: SurveyQuestion, lines: string[]): void {
  // Scale-type (302): render as range "min~max"
  if (q.q_subtype === 302 && q.items && q.items.length > 0) {
    const first = q.items[0];
    const last = q.items[q.items.length - 1];
    lines.push(`${stripHtml(first.item_title)}~${stripHtml(last.item_title)}`);
    return;
  }

  if (!q.items || q.items.length === 0) return;

  for (const item of q.items) {
    lines.push(renderItem(item));
  }
}

function renderMultiFillItems(q: SurveyQuestion, lines: string[]): void {
  if (!q.items || q.items.length === 0) {
    // gap_count may indicate the number of blanks
    if (q.gap_count && q.gap_count > 0) {
      lines.push(`（${q.gap_count} 个填空项）`);
    }
    return;
  }
  for (const item of q.items) {
    lines.push(`____${renderItem(item)}`);
  }
}

function renderMatrixItems(q: SurveyQuestion, lines: string[]): void {
  if (!q.items || q.items.length === 0) {
    // Matrix without items — just note the mode
    return;
  }

  // Matrix questions use items as rows.
  // The columns aren't always in the response (col_items from creation may be lost).
  // We render rows as bullet items.
  lines.push("行：");
  for (const item of q.items) {
    lines.push(`- ${renderItem(item)}`);
  }
}

function renderWeightItems(q: SurveyQuestion, lines: string[]): void {
  if (q.total != null) {
    lines.push(`总分：${q.total}`);
  }
  if (!q.items || q.items.length === 0) return;
  for (const item of q.items) {
    lines.push(renderItem(item));
  }
}

function renderSlider(q: SurveyQuestion, lines: string[]): void {
  const min = q.min_value ?? 0;
  const max = q.max_value ?? 100;
  lines.push(`${min}~${max}`);
}
