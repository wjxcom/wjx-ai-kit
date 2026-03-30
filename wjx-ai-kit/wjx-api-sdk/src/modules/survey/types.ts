export interface CreateSurveyInput {
  title: string;
  type: number;
  description: string;
  publish?: boolean;
  questions: string;
  creater?: string;
  source_vid?: string;
  compress_img?: boolean;
  is_string?: boolean;
}

export interface UploadFileInput {
  file_name: string;
  file: string;
}

export interface GetSurveyInput {
  vid: number;
  get_questions?: boolean;
  get_items?: boolean;
  get_exts?: boolean;
  get_setting?: boolean;
  get_page_cut?: boolean;
  get_tags?: boolean;
  showtitle?: boolean;
}

export interface ListSurveysInput {
  page_index?: number;
  page_size?: number;
  status?: number;
  atype?: number;
  name_like?: string;
  sort?: number;
  creater?: string;
  folder?: string;
  is_xingbiao?: boolean;
  query_all?: boolean;
  verify_status?: number;
  time_type?: number;
  begin_time?: number;
  end_time?: number;
}

export interface UpdateSurveyStatusInput {
  vid: number;
  state: number; // 1=发布, 2=暂停, 3=删除
}

export interface GetSurveySettingsInput {
  vid: number;
  additional_setting?: string;
}

export interface UpdateSurveySettingsInput {
  vid: number;
  api_setting?: string;
  after_submit_setting?: string;
  msg_setting?: string;
  sojumpparm_setting?: string;
  time_setting?: string;
}

export interface DeleteSurveyInput {
  vid: number;
  username: string;
  completely_delete?: boolean;
}

export interface GetQuestionTagsInput {
  username: string;
}

export interface GetTagDetailsInput {
  tag_id: number;
}

export interface ClearRecycleBinInput {
  username: string;
  vid?: number;
}

// ─── textToSurvey parsed types ───────────────────────────────────────

/** A parsed question from DSL text. */
export interface ParsedQuestion {
  /** Question title (plain text, HTML stripped). */
  title: string;
  /**
   * Question type identifier.
   * Skeleton types: "single-choice" | "multi-choice" | "fill-in" | "scale" | "matrix" | "paragraph"
   */
  type: string;
  /** Whether the question is required (default true). */
  required: boolean;
  /** Options/items for choice-type questions. */
  options?: string[];
  /** Scale range for scale-type questions [min, max]. */
  scaleRange?: [string, string];
  /** Matrix row labels. */
  matrixRows?: string[];
}

/** Parsed survey structure from DSL text. */
export interface ParsedSurvey {
  /** Survey title. */
  title: string;
  /** Survey description (may be empty). */
  description: string;
  /** Parsed questions in order. */
  questions: ParsedQuestion[];
}

// ─── get_survey response types (action=1000001) ─────────────────────

/** A single option/item within a question. */
export interface SurveyQuestionItem {
  q_index: number;
  item_index: number;
  item_title: string;
  item_image?: string;
  item_score?: number;
  item_selected?: boolean;
}

/** A question in the flat questions array returned by get_survey. */
export interface SurveyQuestion {
  q_index: number;
  /** 1=分页, 2=段落说明, 3=单选, 4=多选, 5=填空, 6=多项填空, 7=矩阵, 8=文件上传, 9=比重, 10=滑动条 */
  q_type: number;
  /**
   * Sub-type within q_type. Common values:
   * 3→单选, 301→下拉框, 302→量表, 303→评分单选, 304→情景题, 305→判断题,
   * 4→多选, 401→评分多选, 402→排序, 403→商品题,
   * 5→填空, 501→多级下拉,
   * 6→多项填空,
   * 7→矩阵(generic), 701→矩阵量表, 702→矩阵单选, 703→矩阵多选, 704-712→矩阵变体,
   * 8→文件上传, 801→绘图,
   * 9→比重, 10→滑动条.
   *
   * NOTE: The API may normalise subtypes (e.g. 301→3, 701→7) depending on
   * how the survey was created.
   */
  q_subtype: number;
  q_title: string;
  is_requir: boolean;
  has_jump: boolean;
  is_hide?: boolean;

  /** Items / options (for selection-type, ranking, weight questions). */
  items?: SurveyQuestionItem[];

  // ── page-break (q_type=1) specific ──
  is_zhenbie?: boolean;
  min_time?: number;
  max_time?: number;

  // ── fill-in (q_type=5) specific ──
  need_only?: boolean;

  // ── multi-fill (q_type=6) specific ──
  gap_count?: number;

  // ── matrix (q_type=7) specific ──
  matrix_mode?: number;
  table_mode?: number;
  style_mode?: number;

  // ── true/false (q_subtype=305) specific ──
  is_panduan?: boolean;

  // ── weight (q_type=9) specific ──
  total?: number;
  row_width?: number;

  // ── slider (q_type=10) specific ──
  min_value?: number;
  max_value?: number;

  // ── ranking (q_subtype=402) specific ──
  check_mode?: number;
}

/** The `data` payload returned by get_survey (action=1000001). */
export interface SurveyDetail {
  vid: number;
  begin_time: string;
  update_time: string;
  atype: number;
  title: string;
  description: string;
  notes: string;
  version: number;
  answer_valid: number;
  answer_total: number;
  status: number;
  verify_status: number;
  creater: string;
  total_score: number;

  /**
   * Flat array of questions. Page breaks are represented as q_type=1 entries.
   * Present when get_questions=true.
   */
  questions?: SurveyQuestion[];
}
