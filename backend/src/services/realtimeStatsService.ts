import { GetSurveyRealtimeStatsResponse, QuestionType, RealtimeTimelinePoint, SurveyQuestionRealtimeStats } from '../types/survey-realtime-stats';

export interface SurveyAnswerRecord {
  surveyId: string;
  questionId: string;
  questionType: QuestionType;
  /** 单选题: 选项 label；量表题: 分值字符串；开放题: 文本内容 */
  answer: string;
  /** 答题时间戳 */
  answeredAt: string;
}

/**
 * 模拟从数据库查询指定问卷的所有答卷记录。
 * 实际项目中这里应该替换为真实的数据库访问逻辑。
 */
export async function fetchSurveyAnswersFromDb(surveyId: string): Promise<SurveyAnswerRecord[]> {
  // TODO: 替换为真实数据库查询逻辑
  // 这里返回空数组，表示当前没有答卷数据
  return [];
}

function aggregateSingleChoice(questionId: string, records: SurveyAnswerRecord[]): SurveyQuestionRealtimeStats {
  const optionCounts: Record<string, number> = {};
  for (const record of records) {
    const key = record.answer;
    optionCounts[key] = (optionCounts[key] || 0) + 1;
  }

  const total = records.length || 1; // 避免除以 0
  const options = Object.entries(optionCounts).map(([label, count]) => ({
    label,
    count,
    percentage: count / total,
  }));

  return {
    questionId,
    questionType: 'single_choice',
    stats: {
      questionType: 'single_choice',
      options,
    },
  };
}

function aggregateScale(questionId: string, records: SurveyAnswerRecord[]): SurveyQuestionRealtimeStats {
  const valueCounts: Record<number, number> = {};
  const values: number[] = [];

  for (const record of records) {
    const value = Number(record.answer);
    if (!Number.isFinite(value)) {
      continue;
    }
    valueCounts[value] = (valueCounts[value] || 0) + 1;
    values.push(value);
  }

  values.sort((a, b) => a - b);
  const totalCount = values.length;

  let mean = 0;
  let median = 0;

  if (totalCount > 0) {
    const sum = values.reduce((acc, v) => acc + v, 0);
    mean = sum / totalCount;

    const mid = Math.floor(totalCount / 2);
    if (totalCount % 2 === 0) {
      median = (values[mid - 1] + values[mid]) / 2;
    } else {
      median = values[mid];
    }
  }

  const buckets = Object.entries(valueCounts)
    .map(([value, count]) => ({ value: Number(value), count }))
    .sort((a, b) => a.value - b.value);

  return {
    questionId,
    questionType: 'scale',
    stats: {
      questionType: 'scale',
      buckets,
      mean,
      median,
    },
  };
}

function tokenize(text: string): string[] {
  // 简单分词实现：按空白和标点拆分，实际项目中可替换为更复杂的中文分词
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

function aggregateOpenEnded(questionId: string, records: SurveyAnswerRecord[]): SurveyQuestionRealtimeStats {
  const wordCounts: Record<string, number> = {};
  let totalAnswers = 0;

  for (const record of records) {
    const text = record.answer.trim();
    if (!text) continue;
    totalAnswers += 1;
    const tokens = tokenize(text);
    for (const token of tokens) {
      wordCounts[token] = (wordCounts[token] || 0) + 1;
    }
  }

  const wordCloud = Object.entries(wordCounts)
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 100);

  return {
    questionId,
    questionType: 'open_ended',
    stats: {
      questionType: 'open_ended',
      totalAnswers,
      wordCloud,
    },
  };
}

function buildTimeline(records: SurveyAnswerRecord[]): RealtimeTimelinePoint[] {
  // 这里按小时聚合时间线，可根据需要改为按天
  const bucketCounts: Record<string, number> = {};

  for (const record of records) {
    const date = new Date(record.answeredAt);
    if (Number.isNaN(date.getTime())) {
      continue;
    }
    const bucketKey = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      date.getHours(),
      0,
      0,
      0,
    ).toISOString();

    bucketCounts[bucketKey] = (bucketCounts[bucketKey] || 0) + 1;
  }

  const sortedKeys = Object.keys(bucketCounts).sort();
  const points: RealtimeTimelinePoint[] = [];
  let cumulative = 0;

  for (const key of sortedKeys) {
    cumulative += bucketCounts[key];
    points.push({ timestamp: key, responses: cumulative });
  }

  return points;
}

export async function getSurveyRealtimeStats(surveyId: string): Promise<GetSurveyRealtimeStatsResponse | null> {
  const records = await fetchSurveyAnswersFromDb(surveyId);

  if (!records) {
    // 视为问卷不存在
    return null;
  }

  const byQuestion: Record<string, SurveyAnswerRecord[]> = {};

  for (const record of records) {
    if (record.surveyId !== surveyId) continue;
    if (!byQuestion[record.questionId]) {
      byQuestion[record.questionId] = [];
    }
    byQuestion[record.questionId].push(record);
  }

  const questions: SurveyQuestionRealtimeStats[] = [];

  for (const [questionId, questionRecords] of Object.entries(byQuestion)) {
    if (questionRecords.length === 0) continue;
    const type = questionRecords[0].questionType;
    const filtered = questionRecords.filter((r) => r.questionType === type);

    if (type === 'single_choice') {
      questions.push(aggregateSingleChoice(questionId, filtered));
    } else if (type === 'scale') {
      questions.push(aggregateScale(questionId, filtered));
    } else if (type === 'open_ended') {
      questions.push(aggregateOpenEnded(questionId, filtered));
    }
  }

  const totalResponses = records.reduce((acc, r) => (r.surveyId === surveyId ? acc + 1 : acc), 0);
  const timeline = buildTimeline(records.filter((r) => r.surveyId === surveyId));

  const lastUpdatedAt = new Date().toISOString();

  const response: GetSurveyRealtimeStatsResponse = {
    surveyId,
    totalResponses,
    targetResponses: null,
    questions,
    timeline,
    lastUpdatedAt,
  };

  return response;
}
