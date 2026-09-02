export interface SubmitTemplateQuestion {
  q_index: number;
  q_type: number;
  q_subtype?: number;
  q_title?: string;
  /** Non-matrix option list; matrix questions may use items for column headers. */
  items?: Array<{ item_index: number; item_title?: string }>;
  col_items?: Array<{ item_index: number; item_title?: string }>;
  /** Matrix row labels returned by getSurvey. */
  item_rows?: Array<{ item_index: number; item_title?: string }>;
  gap_count?: number;
}

export interface SubmitTemplateOutputQuestion {
  q_index: number;
  q_type: number;
  q_subtype?: number;
  q_title: string;
  placeholder: string;
  hint: string;
}

export interface SubmitTemplateResult {
  submitdata: string;
  questions: SubmitTemplateOutputQuestion[];
}

function placeholderForQuestion(q: SubmitTemplateQuestion): { value: string; hint: string } {
  const itemCount = Array.isArray(q.items) ? q.items.length : 0;
  const rowCount = Array.isArray(q.item_rows) ? q.item_rows.length : 0;
  switch (q.q_type) {
    case 3:
      return { value: "1", hint: "选项序号（1-based），例：1=第1个选项" };
    case 4:
      if (q.q_subtype === 402) {
        const order = itemCount >= 2
          ? Array.from({ length: itemCount }, (_, index) => index + 1).join("|")
          : "1|2";
        return { value: order, hint: "排序：用 | 分隔，按名次列出选项序号（1-based）" };
      }
      return { value: "1|2", hint: "多选：用 | 分隔多个选项序号（1-based）" };
    case 5:
      return { value: "__请填写__", hint: "填空：直接写答案文本" };
    case 6: {
      const gaps = q.gap_count && q.gap_count > 0 ? q.gap_count : 2;
      return {
        value: Array.from({ length: gaps }, (_, i) => `__填空${i + 1}__`).join("|"),
        hint: `多项填空：${gaps} 个空，用 | 分隔每个空的答案`,
      };
    }
    case 7: {
      const rows = rowCount > 0 ? rowCount : (itemCount > 0 ? itemCount : 2);
      const isMulti = q.q_subtype === 703;
      const cellPlaceholder = isMulti ? "1|2" : "1";
      const segments = Array.from({ length: rows }, (_, i) => `${i + 1}!${cellPlaceholder}`);
      return {
        value: segments.join(","),
        hint: isMulti
          ? "矩阵多选：行号!列号|列号 用 , 分隔多行（行号/列号都是 1-based）"
          : "矩阵单选/量表：行号!列号 用 , 分隔多行（行号/列号都是 1-based）",
      };
    }
    case 8:
      return { value: "filename.png", hint: "文件上传：文件名（实际上传请用 wjx survey upload）" };
    case 9: {
      const rows = rowCount > 0 ? rowCount : (itemCount > 0 ? itemCount : 2);
      const each = Math.floor(100 / rows);
      const last = 100 - each * (rows - 1);
      const parts = Array.from({ length: rows }, (_, i) => `${i + 1}!${i === rows - 1 ? last : each}`);
      return { value: parts.join(","), hint: "比重题：行号!分值，所有行分值之和需等于 100" };
    }
    case 10:
      return { value: "5", hint: "滑动条：min~max 之间的整数" };
    default:
      return { value: "__请填写__", hint: `未知题型 q_type=${q.q_type}，请按问卷星协议手动填写` };
  }
}

/**
 * Build a submitdata template from the raw question list returned by getSurvey.
 * Framework questions (q_type 1/2) are skipped and original q_index values are preserved.
 */
export function buildSubmitTemplate(questions: SubmitTemplateQuestion[]): SubmitTemplateResult {
  const segments: string[] = [];
  const output: SubmitTemplateOutputQuestion[] = [];
  for (const question of questions) {
    if (question.q_type === 1 || question.q_type === 2) continue;
    const { value, hint } = placeholderForQuestion(question);
    const qIndex = question.q_index;
    segments.push(`${qIndex}$${value}`);
    output.push({
      q_index: qIndex,
      q_type: question.q_type,
      q_subtype: question.q_subtype,
      q_title: question.q_title ?? "",
      placeholder: `${qIndex}$${value}`,
      hint,
    });
  }
  return { submitdata: segments.join("}"), questions: output };
}
