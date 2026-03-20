/**
 * 问卷实时统计 API 请求参数
 */
export interface GetSurveyRealtimeStatsRequest {
  /** 问卷 ID */
  surveyId: string;
}

/**
 * 问题类型
 * - single_choice: 单选题
 * - scale: 量表题
 * - open_ended: 开放题
 */
export type QuestionType = 'single_choice' | 'scale' | 'open_ended';

/**
 * 单选题选项统计
 */
export interface SingleChoiceOptionStat {
  /** 选项显示文案 */
  label: string;
  /** 选择该选项的答题数量 */
  count: number;
  /** 选择该选项的占比（0-1 之间的小数） */
  percentage: number;
}

/**
 * 单选题统计结果
 */
export interface SingleChoiceQuestionStats {
  /** 问题类型：单选题 */
  questionType: 'single_choice';
  /** 选项统计列表 */
  options: SingleChoiceOptionStat[];
}

/**
 * 量表题桶统计
 */
export interface ScaleBucketStat {
  /** 量表分值，例如 1-5 */
  value: number;
  /** 选择该分值的答题数量 */
  count: number;
}

/**
 * 量表题统计结果
 */
export interface ScaleQuestionStats {
  /** 问题类型：量表题 */
  questionType: 'scale';
  /** 每个分值对应的答题数量 */
  buckets: ScaleBucketStat[];
  /** 平均分 */
  mean: number;
  /** 中位数 */
  median: number;
}

/**
 * 开放题词云条目
 */
export interface OpenEndedWordCloudItem {
  /** 关键词文本 */
  word: string;
  /** 该词出现次数 */
  count: number;
}

/**
 * 开放题统计结果
 */
export interface OpenEndedQuestionStats {
  /** 问题类型：开放题 */
  questionType: 'open_ended';
  /** 有效回答总数 */
  totalAnswers: number;
  /** 词云数据 */
  wordCloud: OpenEndedWordCloudItem[];
}

/**
 * 单个问题的实时统计信息
 */
export interface SurveyQuestionRealtimeStats {
  /** 问题唯一标识 */
  questionId: string;
  /** 问题类型 */
  questionType: QuestionType;
  /**
   * 题目统计数据，根据问题类型不同而变化：
   * - 单选题: SingleChoiceQuestionStats
   * - 量表题: ScaleQuestionStats
   * - 开放题: OpenEndedQuestionStats
   */
  stats: SingleChoiceQuestionStats | ScaleQuestionStats | OpenEndedQuestionStats;
}

/**
 * 时间序列数据点
 */
export interface RealtimeTimelinePoint {
  /** 时间戳（ISO 8601 字符串） */
  timestamp: string;
  /** 截止该时间的累计答题数 */
  responses: number;
}

/**
 * 问卷实时统计 API 响应数据
 */
export interface GetSurveyRealtimeStatsResponse {
  /** 问卷 ID */
  surveyId: string;
  /** 当前已收集的答卷数量 */
  totalResponses: number;
  /** 目标回收数量（若未知则为 null） */
  targetResponses: number | null;
  /** 每道题的实时统计结果 */
  questions: SurveyQuestionRealtimeStats[];
  /** 回答数量随时间变化的时间线 */
  timeline: RealtimeTimelinePoint[];
  /** 最近一次统计更新时间（ISO 8601 字符串） */
  lastUpdatedAt: string;
}
