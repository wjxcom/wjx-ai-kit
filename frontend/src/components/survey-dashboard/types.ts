// TypeScript 类型定义 — 问卷可视化看板

export interface SurveyOption {
  optionId: string;
  label: string;
  count: number;
}

export interface SingleChoiceQuestion {
  questionId: string;
  type: "single_choice";
  title: string;
  options: SurveyOption[];
  totalResponses: number;
}

export interface ScaleQuestion {
  questionId: string;
  type: "scale";
  title: string;
  min: number;
  max: number;
  distribution: Record<string, number>;
  average: number;
  totalResponses: number;
}

export type SurveyQuestion = SingleChoiceQuestion | ScaleQuestion;

export interface TimelinePoint {
  timestamp: string;
  cumulativeCount: number;
}

export interface SurveyDashboardData {
  surveyId: string;
  title: string;
  collectedCount: number;
  targetCount: number;
  questions: SurveyQuestion[];
  timeline: TimelinePoint[];
}

// Mock 数据
export const MOCK_DASHBOARD_DATA: SurveyDashboardData = {
  surveyId: "survey-001",
  title: "2024年用户满意度调查",
  collectedCount: 342,
  targetCount: 500,
  questions: [
    {
      questionId: "q1",
      type: "single_choice",
      title: "您对我们产品的整体满意度如何？",
      options: [
        { optionId: "a", label: "非常满意", count: 120 },
        { optionId: "b", label: "满意", count: 98 },
        { optionId: "c", label: "一般", count: 76 },
        { optionId: "d", label: "不满意", count: 32 },
        { optionId: "e", label: "非常不满意", count: 16 },
      ],
      totalResponses: 342,
    },
    {
      questionId: "q2",
      type: "scale",
      title: "您愿意将我们的产品推荐给朋友的可能性（1-10）",
      min: 1,
      max: 10,
      distribution: {
        "1": 5,
        "2": 8,
        "3": 12,
        "4": 20,
        "5": 35,
        "6": 48,
        "7": 62,
        "8": 75,
        "9": 52,
        "10": 25,
      },
      average: 6.8,
      totalResponses: 342,
    },
  ],
  timeline: [
    { timestamp: "2024-03-01T08:00:00Z", cumulativeCount: 20 },
    { timestamp: "2024-03-01T10:00:00Z", cumulativeCount: 55 },
    { timestamp: "2024-03-01T12:00:00Z", cumulativeCount: 98 },
    { timestamp: "2024-03-01T14:00:00Z", cumulativeCount: 145 },
    { timestamp: "2024-03-01T16:00:00Z", cumulativeCount: 198 },
    { timestamp: "2024-03-01T18:00:00Z", cumulativeCount: 240 },
    { timestamp: "2024-03-01T20:00:00Z", cumulativeCount: 280 },
    { timestamp: "2024-03-01T22:00:00Z", cumulativeCount: 315 },
    { timestamp: "2024-03-02T08:00:00Z", cumulativeCount: 342 },
  ],
};
