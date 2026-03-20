import type {
  GetSurveyRealtimeStatsResponse,
  SingleChoiceQuestionStats,
  ScaleQuestionStats,
  OpenEndedQuestionStats,
} from '../types/survey-realtime-stats';

/**
 * 问卷实时统计 API 的示例返回数据
 */
export const mockSurveyRealtimeStats: GetSurveyRealtimeStatsResponse = {
  surveyId: 'survey_123',
  totalResponses: 120,
  targetResponses: 200,
  questions: [
    {
      questionId: 'q1',
      questionType: 'single_choice',
      stats: {
        questionType: 'single_choice',
        options: [
          { label: '非常满意', count: 60, percentage: 0.5 },
          { label: '满意', count: 36, percentage: 0.3 },
          { label: '一般', count: 18, percentage: 0.15 },
          { label: '不满意', count: 6, percentage: 0.05 },
        ],
      } satisfies SingleChoiceQuestionStats,
    },
    {
      questionId: 'q2',
      questionType: 'scale',
      stats: {
        questionType: 'scale',
        buckets: [
          { value: 1, count: 5 },
          { value: 2, count: 10 },
          { value: 3, count: 25 },
          { value: 4, count: 40 },
          { value: 5, count: 40 },
        ],
        mean: 3.9,
        median: 4,
      } satisfies ScaleQuestionStats,
    },
    {
      questionId: 'q3',
      questionType: 'open_ended',
      stats: {
        questionType: 'open_ended',
        totalAnswers: 80,
        wordCloud: [
          { word: '价格优惠', count: 25 },
          { word: '界面友好', count: 18 },
          { word: '功能丰富', count: 15 },
          { word: '客服专业', count: 10 },
        ],
      } satisfies OpenEndedQuestionStats,
    },
  ],
  timeline: [
    { timestamp: '2026-03-19T00:00:00Z', responses: 10 },
    { timestamp: '2026-03-19T06:00:00Z', responses: 40 },
    { timestamp: '2026-03-19T12:00:00Z', responses: 80 },
    { timestamp: '2026-03-19T18:00:00Z', responses: 110 },
    { timestamp: '2026-03-19T23:00:00Z', responses: 120 },
  ],
  lastUpdatedAt: '2026-03-19T23:00:00Z',
};
