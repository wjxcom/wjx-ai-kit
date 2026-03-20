/**
 * 问卷实时统计看板 — 前端组件测试
 *
 * 覆盖:
 * - 各组件可正常渲染
 * - Props 传入 mock 数据后显示正确
 * - 进度条百分比计算正确
 * - 自动刷新机制（timer mock）
 */
import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import { SurveyDashboard } from '../src/components/survey-dashboard/SurveyDashboard';
import { ProgressBar } from '../src/components/survey-dashboard/ProgressBar';
import { PieChart } from '../src/components/survey-dashboard/PieChart';
import { BarChart } from '../src/components/survey-dashboard/BarChart';
import { TimelineChart } from '../src/components/survey-dashboard/TimelineChart';
import type {
  SurveyDashboardData,
  SingleChoiceQuestion,
  ScaleQuestion,
  TimelinePoint,
} from '../src/components/survey-dashboard/types';
import { MOCK_DASHBOARD_DATA } from '../src/components/survey-dashboard/types';

// ================================================================
// Mock data
// ================================================================

const mockSingleChoiceQuestion: SingleChoiceQuestion = {
  questionId: 'q1',
  type: 'single_choice',
  title: '测试单选题',
  options: [
    { optionId: 'a', label: '选项A', count: 40 },
    { optionId: 'b', label: '选项B', count: 30 },
    { optionId: 'c', label: '选项C', count: 20 },
    { optionId: 'd', label: '选项D', count: 10 },
  ],
  totalResponses: 100,
};

const mockScaleQuestion: ScaleQuestion = {
  questionId: 'q2',
  type: 'scale',
  title: '测试量表题',
  min: 1,
  max: 5,
  distribution: { '1': 10, '2': 20, '3': 30, '4': 25, '5': 15 },
  average: 3.15,
  totalResponses: 100,
};

const mockTimeline: TimelinePoint[] = [
  { timestamp: '2026-03-01T08:00:00Z', cumulativeCount: 20 },
  { timestamp: '2026-03-01T12:00:00Z', cumulativeCount: 60 },
  { timestamp: '2026-03-01T16:00:00Z', cumulativeCount: 100 },
];

const mockDashboardData: SurveyDashboardData = {
  surveyId: 'test-survey',
  title: '测试问卷',
  collectedCount: 75,
  targetCount: 100,
  questions: [mockSingleChoiceQuestion, mockScaleQuestion],
  timeline: mockTimeline,
};

// ================================================================
// 1. ProgressBar 组件测试
// ================================================================

describe('ProgressBar', () => {
  it('renders without crashing', () => {
    render(<ProgressBar collectedCount={50} targetCount={100} />);
    expect(screen.getByText('答题进度')).toBeInTheDocument();
  });

  it('displays correct count values', () => {
    render(<ProgressBar collectedCount={342} targetCount={500} />);
    expect(screen.getByText('342')).toBeInTheDocument();
    expect(screen.getByText('500')).toBeInTheDocument();
  });

  it('calculates percentage correctly (normal case)', () => {
    render(<ProgressBar collectedCount={75} targetCount={100} />);
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('caps percentage at 100% when over target', () => {
    render(<ProgressBar collectedCount={150} targetCount={100} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('shows 0% when no responses', () => {
    render(<ProgressBar collectedCount={0} targetCount={100} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('renders progressbar role with correct aria attributes', () => {
    render(<ProgressBar collectedCount={50} targetCount={200} />);
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '50');
    expect(progressbar).toHaveAttribute('aria-valuemin', '0');
    expect(progressbar).toHaveAttribute('aria-valuemax', '200');
  });

  it('applies custom className', () => {
    const { container } = render(
      <ProgressBar collectedCount={50} targetCount={100} className="custom" />
    );
    expect(container.firstChild).toHaveClass('custom');
  });
});

// ================================================================
// 2. PieChart 组件测试
// ================================================================

describe('PieChart', () => {
  it('renders without crashing', () => {
    render(<PieChart question={mockSingleChoiceQuestion} />);
    expect(screen.getByText('测试单选题')).toBeInTheDocument();
  });

  it('displays total responses', () => {
    render(<PieChart question={mockSingleChoiceQuestion} />);
    expect(screen.getByText(/100/)).toBeInTheDocument();
  });

  it('renders all option labels in legend', () => {
    render(<PieChart question={mockSingleChoiceQuestion} />);
    expect(screen.getByText('选项A')).toBeInTheDocument();
    expect(screen.getByText('选项B')).toBeInTheDocument();
    expect(screen.getByText('选项C')).toBeInTheDocument();
    expect(screen.getByText('选项D')).toBeInTheDocument();
  });

  it('shows correct percentages in legend', () => {
    render(<PieChart question={mockSingleChoiceQuestion} />);
    // 40/100 = 40%, 30/100 = 30%, etc.
    expect(screen.getByText('40%')).toBeInTheDocument();
    expect(screen.getByText('30%')).toBeInTheDocument();
  });

  it('renders SVG paths for each option', () => {
    const { container } = render(<PieChart question={mockSingleChoiceQuestion} />);
    const paths = container.querySelectorAll('path');
    expect(paths.length).toBe(mockSingleChoiceQuestion.options.length);
  });
});

// ================================================================
// 3. BarChart 组件测试
// ================================================================

describe('BarChart', () => {
  it('renders without crashing', () => {
    render(<BarChart question={mockScaleQuestion} />);
    expect(screen.getByText('测试量表题')).toBeInTheDocument();
  });

  it('displays total responses count', () => {
    render(<BarChart question={mockScaleQuestion} />);
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('displays average value', () => {
    render(<BarChart question={mockScaleQuestion} />);
    expect(screen.getByText('3.2')).toBeInTheDocument(); // toFixed(1)
  });

  it('renders bar rects for each scale value', () => {
    const { container } = render(<BarChart question={mockScaleQuestion} />);
    const rects = container.querySelectorAll('rect');
    // 5 bars for values 1-5
    expect(rects.length).toBe(5);
  });

  it('shows dashed average line', () => {
    const { container } = render(<BarChart question={mockScaleQuestion} />);
    const avgLine = container.querySelector('line[stroke-dasharray]');
    expect(avgLine).toBeTruthy();
  });
});

// ================================================================
// 4. TimelineChart 组件测试
// ================================================================

describe('TimelineChart', () => {
  it('renders without crashing with data', () => {
    render(<TimelineChart timeline={mockTimeline} />);
    expect(screen.getByText('答题趋势')).toBeInTheDocument();
  });

  it('shows cumulative count', () => {
    render(<TimelineChart timeline={mockTimeline} />);
    // Last point = 100
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('renders "暂无数据" when timeline is empty', () => {
    render(<TimelineChart timeline={[]} />);
    expect(screen.getByText('暂无数据')).toBeInTheDocument();
  });

  it('renders data point circles', () => {
    const { container } = render(<TimelineChart timeline={mockTimeline} />);
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBe(mockTimeline.length);
  });

  it('renders polyline for the trend line', () => {
    const { container } = render(<TimelineChart timeline={mockTimeline} />);
    const polyline = container.querySelector('polyline');
    expect(polyline).toBeTruthy();
  });

  it('renders area path fill', () => {
    const { container } = render(<TimelineChart timeline={mockTimeline} />);
    const paths = container.querySelectorAll('path');
    expect(paths.length).toBeGreaterThan(0);
  });
});

// ================================================================
// 5. SurveyDashboard 组件测试
// ================================================================

describe('SurveyDashboard', () => {
  it('renders without crashing with initial data', () => {
    render(<SurveyDashboard initialData={mockDashboardData} />);
    expect(screen.getByText('测试问卷')).toBeInTheDocument();
  });

  it('renders ProgressBar section', () => {
    render(<SurveyDashboard initialData={mockDashboardData} />);
    expect(screen.getByText('答题进度')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('renders single choice section', () => {
    render(<SurveyDashboard initialData={mockDashboardData} />);
    expect(screen.getByText('单选题分布')).toBeInTheDocument();
  });

  it('renders scale section', () => {
    render(<SurveyDashboard initialData={mockDashboardData} />);
    expect(screen.getByText('量表题分布')).toBeInTheDocument();
  });

  it('renders timeline section', () => {
    render(<SurveyDashboard initialData={mockDashboardData} />);
    expect(screen.getByText('答题趋势')).toBeInTheDocument();
  });

  it('does not show refresh button without fetchData', () => {
    render(<SurveyDashboard initialData={mockDashboardData} />);
    expect(screen.queryByLabelText('手动刷新')).not.toBeInTheDocument();
  });

  it('shows refresh button when fetchData is provided', () => {
    const fetchData = jest.fn().mockResolvedValue(mockDashboardData);
    render(
      <SurveyDashboard initialData={mockDashboardData} fetchData={fetchData} />
    );
    expect(screen.getByLabelText('手动刷新')).toBeInTheDocument();
  });

  it('shows poll interval badge when fetchData is provided', () => {
    const fetchData = jest.fn().mockResolvedValue(mockDashboardData);
    render(
      <SurveyDashboard
        initialData={mockDashboardData}
        fetchData={fetchData}
        pollInterval={15000}
      />
    );
    expect(screen.getByText(/每 15s 自动更新/)).toBeInTheDocument();
  });

  it('displays error banner when fetch fails', async () => {
    const fetchData = jest.fn().mockRejectedValue(new Error('网络错误'));
    render(
      <SurveyDashboard initialData={mockDashboardData} fetchData={fetchData} />
    );
    await waitFor(() => {
      expect(screen.getByText('网络错误')).toBeInTheDocument();
    });
  });

  it('applies custom className', () => {
    const { container } = render(
      <SurveyDashboard initialData={mockDashboardData} className="my-class" />
    );
    expect(container.firstChild).toHaveClass('my-class');
  });
});

// ================================================================
// 6. 自动刷新机制测试
// ================================================================

describe('SurveyDashboard auto-refresh', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('calls fetchData on mount', async () => {
    const fetchData = jest.fn().mockResolvedValue(mockDashboardData);
    render(
      <SurveyDashboard
        initialData={mockDashboardData}
        fetchData={fetchData}
        pollInterval={5000}
      />
    );

    await waitFor(() => {
      expect(fetchData).toHaveBeenCalledTimes(1);
    });
  });

  it('calls fetchData at each poll interval', async () => {
    const fetchData = jest.fn().mockResolvedValue(mockDashboardData);

    render(
      <SurveyDashboard
        initialData={mockDashboardData}
        fetchData={fetchData}
        pollInterval={5000}
      />
    );

    // Wait for initial call
    await waitFor(() => {
      expect(fetchData).toHaveBeenCalledTimes(1);
    });

    // Advance by one interval
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    await waitFor(() => {
      expect(fetchData).toHaveBeenCalledTimes(2);
    });

    // Advance by another interval
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    await waitFor(() => {
      expect(fetchData).toHaveBeenCalledTimes(3);
    });
  });

  it('cleans up interval on unmount', async () => {
    const fetchData = jest.fn().mockResolvedValue(mockDashboardData);

    const { unmount } = render(
      <SurveyDashboard
        initialData={mockDashboardData}
        fetchData={fetchData}
        pollInterval={5000}
      />
    );

    await waitFor(() => {
      expect(fetchData).toHaveBeenCalledTimes(1);
    });

    unmount();

    act(() => {
      jest.advanceTimersByTime(10000);
    });

    // Should not be called again after unmount
    expect(fetchData).toHaveBeenCalledTimes(1);
  });

  it('updates data when fetchData returns new values', async () => {
    const updatedData: SurveyDashboardData = {
      ...mockDashboardData,
      collectedCount: 95,
    };

    const fetchData = jest.fn().mockResolvedValue(updatedData);

    render(
      <SurveyDashboard
        initialData={mockDashboardData}
        fetchData={fetchData}
        pollInterval={5000}
      />
    );

    // Initially shows 75%
    expect(screen.getByText('75%')).toBeInTheDocument();

    // After fetch completes, should show 95%
    await waitFor(() => {
      expect(screen.getByText('95%')).toBeInTheDocument();
    });
  });
});

// ================================================================
// 7. MOCK_DASHBOARD_DATA 使用测试
// ================================================================

describe('MOCK_DASHBOARD_DATA integration', () => {
  it('renders correctly with built-in mock data', () => {
    render(<SurveyDashboard initialData={MOCK_DASHBOARD_DATA} />);
    expect(screen.getByText('2024年用户满意度调查')).toBeInTheDocument();
    expect(screen.getByText('答题进度')).toBeInTheDocument();
  });
});
