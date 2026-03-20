/**
 * 问卷实时统计看板 — 后端单元测试
 *
 * 覆盖:
 * - realtimeStatsService 数据聚合逻辑（单选、量表、开放题、时间线）
 * - API 路由（200 正常响应、404 问卷不存在、500 内部错误）
 * - 边界条件（0 条答卷、大量答卷）
 */
import request from 'supertest';
import express from 'express';
import { realtimeStatsRouter } from '../src/routes/realtimeStats';
import * as service from '../src/services/realtimeStatsService';
import type { SurveyAnswerRecord } from '../src/services/realtimeStatsService';
import type { GetSurveyRealtimeStatsResponse } from '../src/types/survey-realtime-stats';

// ================================================================
// Test app setup
// ================================================================

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/surveys', realtimeStatsRouter);
  return app;
}

// ================================================================
// Mock data helpers
// ================================================================

function makeSingleChoiceRecord(
  surveyId: string,
  questionId: string,
  answer: string,
  answeredAt: string,
): SurveyAnswerRecord {
  return { surveyId, questionId, questionType: 'single_choice', answer, answeredAt };
}

function makeScaleRecord(
  surveyId: string,
  questionId: string,
  answer: string,
  answeredAt: string,
): SurveyAnswerRecord {
  return { surveyId, questionId, questionType: 'scale', answer, answeredAt };
}

function makeOpenEndedRecord(
  surveyId: string,
  questionId: string,
  answer: string,
  answeredAt: string,
): SurveyAnswerRecord {
  return { surveyId, questionId, questionType: 'open_ended', answer, answeredAt };
}

// ================================================================
// 1. Service layer — 单选统计
// ================================================================

describe('aggregateSingleChoice (via getSurveyRealtimeStats)', () => {
  const surveyId = 'survey-sc';

  it('correctly counts single choice options and calculates percentages', async () => {
    const records: SurveyAnswerRecord[] = [
      makeSingleChoiceRecord(surveyId, 'q1', '非常满意', '2026-03-19T10:00:00Z'),
      makeSingleChoiceRecord(surveyId, 'q1', '非常满意', '2026-03-19T10:05:00Z'),
      makeSingleChoiceRecord(surveyId, 'q1', '满意', '2026-03-19T10:10:00Z'),
      makeSingleChoiceRecord(surveyId, 'q1', '一般', '2026-03-19T10:15:00Z'),
    ];

    jest.spyOn(service, 'fetchSurveyAnswersFromDb').mockResolvedValue(records);
    const result = await service.getSurveyRealtimeStats(surveyId);

    expect(result).not.toBeNull();
    expect(result!.totalResponses).toBe(4);

    const q1Stats = result!.questions.find((q) => q.questionId === 'q1');
    expect(q1Stats).toBeDefined();
    expect(q1Stats!.questionType).toBe('single_choice');

    if (q1Stats!.stats.questionType === 'single_choice') {
      const opts = q1Stats!.stats.options;
      const satisfied = opts.find((o) => o.label === '非常满意');
      expect(satisfied!.count).toBe(2);
      expect(satisfied!.percentage).toBe(0.5);
    }
  });
});

// ================================================================
// 2. Service layer — 量表统计
// ================================================================

describe('aggregateScale (via getSurveyRealtimeStats)', () => {
  const surveyId = 'survey-scale';

  it('calculates mean and median correctly for scale questions', async () => {
    const records: SurveyAnswerRecord[] = [
      makeScaleRecord(surveyId, 'q2', '3', '2026-03-19T10:00:00Z'),
      makeScaleRecord(surveyId, 'q2', '5', '2026-03-19T10:05:00Z'),
      makeScaleRecord(surveyId, 'q2', '7', '2026-03-19T10:10:00Z'),
      makeScaleRecord(surveyId, 'q2', '5', '2026-03-19T10:15:00Z'),
    ];

    jest.spyOn(service, 'fetchSurveyAnswersFromDb').mockResolvedValue(records);
    const result = await service.getSurveyRealtimeStats(surveyId);

    const q2Stats = result!.questions.find((q) => q.questionId === 'q2');
    expect(q2Stats).toBeDefined();
    expect(q2Stats!.questionType).toBe('scale');

    if (q2Stats!.stats.questionType === 'scale') {
      // mean = (3+5+7+5)/4 = 5
      expect(q2Stats!.stats.mean).toBe(5);
      // sorted: [3,5,5,7], median = (5+5)/2 = 5
      expect(q2Stats!.stats.median).toBe(5);
      // buckets should have 3 entries: {3:1, 5:2, 7:1}
      expect(q2Stats!.stats.buckets).toHaveLength(3);
    }
  });

  it('handles odd number of records for median', async () => {
    const records: SurveyAnswerRecord[] = [
      makeScaleRecord(surveyId, 'q2', '2', '2026-03-19T10:00:00Z'),
      makeScaleRecord(surveyId, 'q2', '4', '2026-03-19T10:05:00Z'),
      makeScaleRecord(surveyId, 'q2', '6', '2026-03-19T10:10:00Z'),
    ];

    jest.spyOn(service, 'fetchSurveyAnswersFromDb').mockResolvedValue(records);
    const result = await service.getSurveyRealtimeStats(surveyId);

    const q2Stats = result!.questions.find((q) => q.questionId === 'q2');
    if (q2Stats!.stats.questionType === 'scale') {
      // sorted: [2,4,6], median = 4
      expect(q2Stats!.stats.median).toBe(4);
      // mean = (2+4+6)/3 = 4
      expect(q2Stats!.stats.mean).toBe(4);
    }
  });

  it('ignores non-numeric scale answers', async () => {
    const records: SurveyAnswerRecord[] = [
      makeScaleRecord(surveyId, 'q2', '5', '2026-03-19T10:00:00Z'),
      makeScaleRecord(surveyId, 'q2', 'invalid', '2026-03-19T10:05:00Z'),
      makeScaleRecord(surveyId, 'q2', '3', '2026-03-19T10:10:00Z'),
    ];

    jest.spyOn(service, 'fetchSurveyAnswersFromDb').mockResolvedValue(records);
    const result = await service.getSurveyRealtimeStats(surveyId);

    const q2Stats = result!.questions.find((q) => q.questionId === 'q2');
    if (q2Stats!.stats.questionType === 'scale') {
      // Only 2 valid values
      expect(q2Stats!.stats.mean).toBe(4); // (5+3)/2
    }
  });
});

// ================================================================
// 3. Service layer — 时间线生成
// ================================================================

describe('buildTimeline (via getSurveyRealtimeStats)', () => {
  const surveyId = 'survey-tl';

  it('generates cumulative timeline sorted by time', async () => {
    const records: SurveyAnswerRecord[] = [
      makeSingleChoiceRecord(surveyId, 'q1', 'A', '2026-03-19T10:15:00Z'),
      makeSingleChoiceRecord(surveyId, 'q1', 'B', '2026-03-19T10:30:00Z'),
      makeSingleChoiceRecord(surveyId, 'q1', 'A', '2026-03-19T12:00:00Z'),
      makeSingleChoiceRecord(surveyId, 'q1', 'C', '2026-03-19T12:45:00Z'),
    ];

    jest.spyOn(service, 'fetchSurveyAnswersFromDb').mockResolvedValue(records);
    const result = await service.getSurveyRealtimeStats(surveyId);

    expect(result!.timeline.length).toBeGreaterThan(0);
    // Timeline should be sorted
    for (let i = 1; i < result!.timeline.length; i++) {
      expect(result!.timeline[i].responses).toBeGreaterThanOrEqual(
        result!.timeline[i - 1].responses,
      );
    }
    // Last point should equal total
    const lastPoint = result!.timeline[result!.timeline.length - 1];
    expect(lastPoint.responses).toBe(4);
  });
});

// ================================================================
// 4. Service layer — 开放题
// ================================================================

describe('aggregateOpenEnded (via getSurveyRealtimeStats)', () => {
  const surveyId = 'survey-oe';

  it('produces word cloud and totalAnswers', async () => {
    const records: SurveyAnswerRecord[] = [
      makeOpenEndedRecord(surveyId, 'q3', '产品质量很好', '2026-03-19T10:00:00Z'),
      makeOpenEndedRecord(surveyId, 'q3', '质量好 价格也好', '2026-03-19T10:05:00Z'),
      makeOpenEndedRecord(surveyId, 'q3', '', '2026-03-19T10:10:00Z'), // empty
    ];

    jest.spyOn(service, 'fetchSurveyAnswersFromDb').mockResolvedValue(records);
    const result = await service.getSurveyRealtimeStats(surveyId);

    const q3Stats = result!.questions.find((q) => q.questionId === 'q3');
    expect(q3Stats).toBeDefined();
    if (q3Stats!.stats.questionType === 'open_ended') {
      expect(q3Stats!.stats.totalAnswers).toBe(2); // empty excluded
      expect(q3Stats!.stats.wordCloud.length).toBeGreaterThan(0);
    }
  });
});

// ================================================================
// 5. 边界条件
// ================================================================

describe('boundary conditions', () => {
  it('returns empty questions and timeline when no records exist', async () => {
    jest.spyOn(service, 'fetchSurveyAnswersFromDb').mockResolvedValue([]);
    const result = await service.getSurveyRealtimeStats('empty-survey');

    expect(result).not.toBeNull();
    expect(result!.totalResponses).toBe(0);
    expect(result!.questions).toHaveLength(0);
    expect(result!.timeline).toHaveLength(0);
  });

  it('returns null when fetchSurveyAnswersFromDb returns null (survey not found)', async () => {
    jest.spyOn(service, 'fetchSurveyAnswersFromDb').mockResolvedValue(null as any);
    const result = await service.getSurveyRealtimeStats('nonexistent');
    expect(result).toBeNull();
  });

  it('handles large dataset without error', async () => {
    const largeRecords: SurveyAnswerRecord[] = Array.from({ length: 10000 }, (_, i) =>
      makeSingleChoiceRecord(
        'large-survey',
        `q${i % 5}`,
        ['A', 'B', 'C', 'D'][i % 4],
        new Date(2026, 2, 19, Math.floor(i / 100), i % 60).toISOString(),
      ),
    );

    jest.spyOn(service, 'fetchSurveyAnswersFromDb').mockResolvedValue(largeRecords);
    const result = await service.getSurveyRealtimeStats('large-survey');

    expect(result).not.toBeNull();
    expect(result!.totalResponses).toBe(10000);
    expect(result!.questions.length).toBeGreaterThan(0);
    expect(result!.timeline.length).toBeGreaterThan(0);
  });
});

// ================================================================
// 6. API 路由测试
// ================================================================

describe('GET /api/surveys/:id/realtime-stats', () => {
  let app: express.Express;

  beforeEach(() => {
    app = createTestApp();
    jest.restoreAllMocks();
  });

  it('responds 200 with stats when survey exists', async () => {
    const mockResponse: GetSurveyRealtimeStatsResponse = {
      surveyId: 'test-123',
      totalResponses: 42,
      targetResponses: 100,
      questions: [],
      timeline: [],
      lastUpdatedAt: '2026-03-19T12:00:00Z',
    };

    jest.spyOn(service, 'getSurveyRealtimeStats').mockResolvedValue(mockResponse);

    const res = await request(app).get('/api/surveys/test-123/realtime-stats');

    expect(res.status).toBe(200);
    expect(res.body.surveyId).toBe('test-123');
    expect(res.body.totalResponses).toBe(42);
  });

  it('responds 404 when survey does not exist', async () => {
    jest.spyOn(service, 'getSurveyRealtimeStats').mockResolvedValue(null);

    const res = await request(app).get('/api/surveys/nonexistent/realtime-stats');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Survey not found');
  });

  it('responds 500 on internal error', async () => {
    jest.spyOn(service, 'getSurveyRealtimeStats').mockRejectedValue(new Error('DB connection failed'));

    const res = await request(app).get('/api/surveys/error-survey/realtime-stats');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal server error');
  });
});

// ================================================================
// 7. 综合测试 — 多题型混合
// ================================================================

describe('mixed question types', () => {
  const surveyId = 'survey-mixed';

  it('handles mixed single_choice, scale, and open_ended questions', async () => {
    const records: SurveyAnswerRecord[] = [
      makeSingleChoiceRecord(surveyId, 'q1', 'A', '2026-03-19T10:00:00Z'),
      makeSingleChoiceRecord(surveyId, 'q1', 'B', '2026-03-19T10:05:00Z'),
      makeScaleRecord(surveyId, 'q2', '4', '2026-03-19T10:10:00Z'),
      makeScaleRecord(surveyId, 'q2', '5', '2026-03-19T10:15:00Z'),
      makeOpenEndedRecord(surveyId, 'q3', '很好的产品', '2026-03-19T10:20:00Z'),
    ];

    jest.spyOn(service, 'fetchSurveyAnswersFromDb').mockResolvedValue(records);
    const result = await service.getSurveyRealtimeStats(surveyId);

    expect(result).not.toBeNull();
    expect(result!.totalResponses).toBe(5);
    expect(result!.questions).toHaveLength(3);

    const types = result!.questions.map((q) => q.questionType).sort();
    expect(types).toEqual(['open_ended', 'scale', 'single_choice']);
  });
});

// ================================================================
// 8. Response 结构验证
// ================================================================

describe('response structure', () => {
  it('includes all required fields', async () => {
    const records: SurveyAnswerRecord[] = [
      makeSingleChoiceRecord('s1', 'q1', 'A', '2026-03-19T10:00:00Z'),
    ];

    jest.spyOn(service, 'fetchSurveyAnswersFromDb').mockResolvedValue(records);
    const result = await service.getSurveyRealtimeStats('s1');

    expect(result).toHaveProperty('surveyId');
    expect(result).toHaveProperty('totalResponses');
    expect(result).toHaveProperty('targetResponses');
    expect(result).toHaveProperty('questions');
    expect(result).toHaveProperty('timeline');
    expect(result).toHaveProperty('lastUpdatedAt');
  });

  it('lastUpdatedAt is a valid ISO date', async () => {
    jest.spyOn(service, 'fetchSurveyAnswersFromDb').mockResolvedValue([]);
    const result = await service.getSurveyRealtimeStats('s1');

    expect(result).not.toBeNull();
    const date = new Date(result!.lastUpdatedAt);
    expect(date.getTime()).not.toBeNaN();
  });
});
