import React, { useMemo } from "react";
import type { SingleChoiceQuestion, SurveyOption } from "./types";

export interface PieChartProps {
  question: SingleChoiceQuestion;
  width?: number;
  height?: number;
  className?: string;
}

const COLORS = [
  "#1890ff",
  "#52c41a",
  "#faad14",
  "#f5222d",
  "#722ed1",
  "#13c2c2",
  "#eb2f96",
  "#fa8c16",
];

interface PieSlice {
  option: SurveyOption;
  startAngle: number;
  endAngle: number;
  color: string;
  percentage: number;
}

function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number
): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number
): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
}

export const PieChart: React.FC<PieChartProps> = ({
  question,
  width = 360,
  height = 260,
  className = "",
}) => {
  const cx = width * 0.38;
  const cy = height / 2;
  const radius = Math.min(cx, cy) - 16;

  const slices = useMemo<PieSlice[]>(() => {
    const total = question.totalResponses || 1;
    let cumulativeAngle = 0;
    return question.options.map((opt, i) => {
      const pct = opt.count / total;
      const angleDeg = pct * 360;
      const slice: PieSlice = {
        option: opt,
        startAngle: cumulativeAngle,
        endAngle: cumulativeAngle + angleDeg,
        color: COLORS[i % COLORS.length],
        percentage: Math.round(pct * 100),
      };
      cumulativeAngle += angleDeg;
      return slice;
    });
  }, [question]);

  return (
    <div
      className={`survey-pie-chart ${className}`}
      style={styles.container}
    >
      <h3 style={styles.title}>{question.title}</h3>
      <p style={styles.meta}>
        共 <strong>{question.totalResponses}</strong> 份有效回答
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <svg width={width * 0.75} height={height} overflow="visible">
          {slices.map((slice) => (
            <path
              key={slice.option.optionId}
              d={describeArc(cx, cy, radius, slice.startAngle, slice.endAngle)}
              fill={slice.color}
              stroke="#fff"
              strokeWidth={2}
              opacity={0.92}
            >
              <title>
                {slice.option.label}: {slice.option.count} 人 (
                {slice.percentage}%)
              </title>
            </path>
          ))}
          {/* 内圆 — 甜甜圈效果 */}
          <circle cx={cx} cy={cy} r={radius * 0.52} fill="#fff" />
          <text x={cx} y={cy - 8} textAnchor="middle" style={styles.centerLabel}>
            {question.totalResponses}
          </text>
          <text x={cx} y={cy + 14} textAnchor="middle" style={styles.centerSub}>
            总回答
          </text>
        </svg>

        {/* 图例 */}
        <div style={styles.legend}>
          {slices.map((slice) => (
            <div key={slice.option.optionId} style={styles.legendItem}>
              <span
                style={{ ...styles.legendDot, background: slice.color }}
              />
              <span style={styles.legendLabel}>{slice.option.label}</span>
              <span style={styles.legendValue}>
                {slice.percentage}%
                <span style={styles.legendCount}>
                  ({slice.option.count})
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: "20px",
    backgroundColor: "#fff",
    borderRadius: "8px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  },
  title: {
    fontSize: "15px",
    fontWeight: 600,
    color: "#262626",
    margin: "0 0 4px",
    lineHeight: 1.5,
  },
  meta: {
    fontSize: "12px",
    color: "#8c8c8c",
    margin: "0 0 16px",
  },
  centerLabel: {
    fontSize: "20px",
    fontWeight: 700,
    fill: "#262626",
  } as unknown as React.CSSProperties,
  centerSub: {
    fontSize: "11px",
    fill: "#8c8c8c",
  } as unknown as React.CSSProperties,
  legend: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    minWidth: "140px",
  },
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  legendDot: {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    flexShrink: 0,
  },
  legendLabel: {
    fontSize: "12px",
    color: "#595959",
    flex: 1,
  },
  legendValue: {
    fontSize: "12px",
    fontWeight: 600,
    color: "#262626",
    whiteSpace: "nowrap",
  },
  legendCount: {
    fontWeight: 400,
    color: "#8c8c8c",
    marginLeft: "2px",
  },
};

export default PieChart;
