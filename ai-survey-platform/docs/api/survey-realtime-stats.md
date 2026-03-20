# 问卷实时统计 API

## 概述

获取指定问卷的实时答题统计数据，包括答题进度、各题型统计结果和答题趋势时间线。适用于实时可视化看板展示。

## 端点信息

| 属性 | 值 |
|------|-----|
| **URL** | `GET /api/surveys/{id}/realtime-stats` |
| **方法** | GET |
| **认证** | 无（当前版本） |
| **Content-Type** | `application/json` |

## 请求参数

### Path 参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `id` | string | 是 | 问卷唯一标识 ID |

## 响应

### 成功响应 (200 OK)

返回 `GetSurveyRealtimeStatsResponse` 对象。

#### 响应字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `surveyId` | `string` | 问卷 ID |
| `totalResponses` | `number` | 当前已收集的答卷数量 |
| `targetResponses` | `number \| null` | 目标回收数量，未设置时为 `null` |
| `questions` | `SurveyQuestionRealtimeStats[]` | 每道题的实时统计结果 |
| `timeline` | `RealtimeTimelinePoint[]` | 回答数量随时间变化的时间线（按小时聚合） |
| `lastUpdatedAt` | `string` | 最近一次统计更新时间（ISO 8601 格式） |

#### SurveyQuestionRealtimeStats

| 字段 | 类型 | 说明 |
|------|------|------|
| `questionId` | `string` | 问题唯一标识 |
| `questionType` | `QuestionType` | 问题类型：`single_choice` / `scale` / `open_ended` |
| `stats` | `object` | 统计数据，结构因 `questionType` 不同而变化（见下文） |

#### 单选题统计 (SingleChoiceQuestionStats)

当 `questionType` 为 `single_choice` 时，`stats` 结构如下：

| 字段 | 类型 | 说明 |
|------|------|------|
| `questionType` | `"single_choice"` | 问题类型标识 |
| `options` | `SingleChoiceOptionStat[]` | 选项统计列表 |

**SingleChoiceOptionStat：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `label` | `string` | 选项显示文案 |
| `count` | `number` | 选择该选项的答题数量 |
| `percentage` | `number` | 选择该选项的占比（0-1 之间的小数） |

#### 量表题统计 (ScaleQuestionStats)

当 `questionType` 为 `scale` 时，`stats` 结构如下：

| 字段 | 类型 | 说明 |
|------|------|------|
| `questionType` | `"scale"` | 问题类型标识 |
| `buckets` | `ScaleBucketStat[]` | 每个分值对应的答题数量 |
| `mean` | `number` | 平均分 |
| `median` | `number` | 中位数 |

**ScaleBucketStat：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `value` | `number` | 量表分值（例如 1-5） |
| `count` | `number` | 选择该分值的答题数量 |

#### 开放题统计 (OpenEndedQuestionStats)

当 `questionType` 为 `open_ended` 时，`stats` 结构如下：

| 字段 | 类型 | 说明 |
|------|------|------|
| `questionType` | `"open_ended"` | 问题类型标识 |
| `totalAnswers` | `number` | 有效回答总数 |
| `wordCloud` | `OpenEndedWordCloudItem[]` | 词云数据（按出现频次降序，最多 100 条） |

**OpenEndedWordCloudItem：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `word` | `string` | 关键词文本 |
| `count` | `number` | 该词出现次数 |

#### RealtimeTimelinePoint

| 字段 | 类型 | 说明 |
|------|------|------|
| `timestamp` | `string` | 时间戳（ISO 8601 格式，按小时对齐） |
| `responses` | `number` | 截止该时间的累计答题数 |

### 响应示例

```json
{
  "surveyId": "survey_123",
  "totalResponses": 120,
  "targetResponses": 200,
  "questions": [
    {
      "questionId": "q1",
      "questionType": "single_choice",
      "stats": {
        "questionType": "single_choice",
        "options": [
          { "label": "非常满意", "count": 60, "percentage": 0.5 },
          { "label": "满意", "count": 36, "percentage": 0.3 },
          { "label": "一般", "count": 18, "percentage": 0.15 },
          { "label": "不满意", "count": 6, "percentage": 0.05 }
        ]
      }
    },
    {
      "questionId": "q2",
      "questionType": "scale",
      "stats": {
        "questionType": "scale",
        "buckets": [
          { "value": 1, "count": 5 },
          { "value": 2, "count": 10 },
          { "value": 3, "count": 25 },
          { "value": 4, "count": 40 },
          { "value": 5, "count": 40 }
        ],
        "mean": 3.9,
        "median": 4
      }
    },
    {
      "questionId": "q3",
      "questionType": "open_ended",
      "stats": {
        "questionType": "open_ended",
        "totalAnswers": 80,
        "wordCloud": [
          { "word": "价格优惠", "count": 25 },
          { "word": "界面友好", "count": 18 },
          { "word": "功能丰富", "count": 15 },
          { "word": "客服专业", "count": 10 }
        ]
      }
    }
  ],
  "timeline": [
    { "timestamp": "2026-03-19T00:00:00.000Z", "responses": 10 },
    { "timestamp": "2026-03-19T06:00:00.000Z", "responses": 40 },
    { "timestamp": "2026-03-19T12:00:00.000Z", "responses": 80 },
    { "timestamp": "2026-03-19T18:00:00.000Z", "responses": 110 },
    { "timestamp": "2026-03-19T23:00:00.000Z", "responses": 120 }
  ],
  "lastUpdatedAt": "2026-03-19T23:00:00.000Z"
}
```

## 错误响应

### 404 Not Found

当指定的问卷 ID 不存在时返回。

```json
{
  "error": "Survey not found"
}
```

### 500 Internal Server Error

服务器内部错误，通常由数据库查询失败或数据聚合异常引起。

```json
{
  "error": "Internal server error"
}
```

## 使用示例

### curl

```bash
# 获取问卷 survey_123 的实时统计
curl -X GET http://localhost:3200/api/surveys/survey_123/realtime-stats

# 使用 jq 格式化输出
curl -s http://localhost:3200/api/surveys/survey_123/realtime-stats | jq .
```

### JavaScript (fetch)

```javascript
const response = await fetch('/api/surveys/survey_123/realtime-stats');

if (!response.ok) {
  const error = await response.json();
  console.error('请求失败:', error.error);
  return;
}

const stats = await response.json();
console.log(`已收集 ${stats.totalResponses} 份答卷`);
```

### TypeScript

```typescript
import type { GetSurveyRealtimeStatsResponse } from '@/types/survey-realtime-stats';

async function fetchRealtimeStats(surveyId: string): Promise<GetSurveyRealtimeStatsResponse> {
  const res = await fetch(`/api/surveys/${surveyId}/realtime-stats`);

  if (!res.ok) {
    throw new Error(`请求失败: ${res.status}`);
  }

  return res.json();
}
```

## TypeScript 类型定义

完整的类型定义位于以下文件：

- 后端：`backend/src/types/survey-realtime-stats.ts`
- 前端：`frontend/src/types/survey-realtime-stats.ts`

```typescript
type QuestionType = 'single_choice' | 'scale' | 'open_ended';

interface GetSurveyRealtimeStatsResponse {
  surveyId: string;
  totalResponses: number;
  targetResponses: number | null;
  questions: SurveyQuestionRealtimeStats[];
  timeline: RealtimeTimelinePoint[];
  lastUpdatedAt: string;
}
```

完整类型定义请参考源码文件。

## 注意事项

- `timeline` 中的时间线数据按**小时**聚合，`responses` 值为**累计**答题数
- `percentage` 字段为 0-1 之间的小数，非百分比数值（例如 50% 表示为 `0.5`）
- `targetResponses` 为 `null` 时表示该问卷未设置目标回收数量
- 开放题词云最多返回 **100** 个高频词，按出现频次降序排列
- `lastUpdatedAt` 为服务器处理请求时的当前时间，非缓存时间
