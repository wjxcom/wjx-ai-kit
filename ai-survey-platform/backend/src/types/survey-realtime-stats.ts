export type QuestionType = 'single_choice' | 'scale' | 'open_ended';

export interface SingleChoiceOptionStat {
  label: string;
  count: number;
  percentage: number;
}

export interface SingleChoiceQuestionStats {
  questionType: 'single_choice';
  options: SingleChoiceOptionStat[];
}

export interface ScaleBucketStat {
  value: number;
  count: number;
}

export interface ScaleQuestionStats {
  questionType: 'scale';
  buckets: ScaleBucketStat[];
  mean: number;
  median: number;
}

export interface OpenEndedWordCloudItem {
  word: string;
  count: number;
}

export interface OpenEndedQuestionStats {
  questionType: 'open_ended';
  totalAnswers: number;
  wordCloud: OpenEndedWordCloudItem[];
}

export interface SurveyQuestionRealtimeStats {
  questionId: string;
  questionType: QuestionType;
  stats: SingleChoiceQuestionStats | ScaleQuestionStats | OpenEndedQuestionStats;
}

export interface RealtimeTimelinePoint {
  timestamp: string;
  responses: number;
}

export interface GetSurveyRealtimeStatsResponse {
  surveyId: string;
  totalResponses: number;
  targetResponses: number | null;
  questions: SurveyQuestionRealtimeStats[];
  timeline: RealtimeTimelinePoint[];
  lastUpdatedAt: string;
}
