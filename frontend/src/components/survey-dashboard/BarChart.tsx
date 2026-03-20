import React, { useMemo } from "react";
import type { ScaleQuestion } from "./types";

export interface BarChartProps {
  question: ScaleQuestion;
  barColor?: string;
  avgLineColor?: string;
  className?: string;
}

export const BarChart: React.FC<BarChartProps> = ({
  question,
  barColor = "#1890ff",
  avgLineColor = "#f5222d",
  className = "",
}) => {
  const { bars, maxCount, avgX, chartWidth, chartHeight, padLeft, padBottom } =
    useMemo(() => {
      const padLeft = 48;
      const padBottom = 36;
      const padTop = 20;
      const padRight = 16;
      const chartWidth = 480;
      const chartHeight = 220;

      const innerW = chartWidth - padLeft - padRight;
      const innerH = chartHeight - padTop - padBottom;

      const keys = Array.from(
        { length: question.max - question.min + 1 },
        (_, i) => String(question.min + i)
      );
      const counts = keys.map((k) => question.distribution[k] ?? 0);
      const maxCount = Math.max(...counts, 1);

      const barW = innerW / keys.length;

      const bars = keys.map((key, i) => {
        const count = counts[i];
        const barH = (count / maxCount) * innerH;
        return {
          key,
          count,
          x: padLeft + i * barW,
          y: padTop + innerH - barH,
          w: barW * 0.72,
          h: barH,
        };
      });

      const avgOffset =
        ((question.average - question.min) / (question.max - question.min)) *
        innerW;
      const avgX = padLeft + avgOffset;

      return {
        bars,
        maxCount,
        avgX,
        chartWidth,
        chartHeight,
        padLeft,
        padBottom,
        padTop,
        padRight,
        innerH,
        innerW,
      };
    }, [question]);

  const innerH = chartHeight - 20 - padBottom;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((p) =>
    Math.round(p * maxCount)
  );

  return (
    <div
      className={`survey-bar-chart ${className}`}
      style={styles.container}
    >
      <h3 style={styles.title}>{question.title}</h3>
      <p style={styles.meta}>
        共 <strong>{question.totalResponses}</strong> 份有效回答 &nbsp;·&nbsp;
        均值 <strong style={{ color: avgLineColor }}>{question.average.toFixed(1)}</strong>
      </p>

      <svg width={chartWidth} height={chartHeight} style={{ overflow: "visible" }}>
        {/* Y 轴刻度线 */}
        {yTicks.map((tick) => {
          const y = 20 + innerH - (tick / maxCount) * innerH;
          return (
            <g key={tick}>
              <line
                x1={padLeft}
                y1={y}
                x2={chartWidth - 16}
                y2={y}
                stroke="#f0f0f0"
                strokeWidth={1}
              />
              <text
                x={padLeft - 6}
                y={y + 4}
                textAnchor="end"
                style={styles.axisTick as React.CSSProperties}
              >
                {tick}
              </text>
            </g>
          );
        })}

        {/* 柱子 */}
        {bars.map((bar) => (
          <g key={bar.key}>
            <rect
              x={bar.x + (bar.w * 0.28) / 2}
              y={bar.y}
              width={bar.w}
              height={bar.h}
              fill={barColor}
              opacity={0.85}
              rx={3}
            >
              <title>
                {bar.key} 分：{bar.count} 人
              </title>
            </rect>
            <text
              x={bar.x + bar.w * 0.86}
              y={chartHeight - padBottom + 16}
              textAnchor="middle"
              style={styles.axisTick as React.CSSProperties}
            >
              {bar.key}
            </text>
            {bar.count > 0 && (
              <text
                x={bar.x + bar.w * 0.86}
                y={bar.y - 4}
                textAnchor="middle"
                style={styles.barLabel as React.CSSProperties}
              >
                {bar.count}
              </text>
            )}
          </g>
        ))}

        {/* 均值线 */}
        <line
          x1={avgX}
          y1={20}
          x2={avgX}
          y2={chartHeight - padBottom}
          stroke={avgLineColor}
          strokeWidth={2}
          strokeDasharray="5 4"
        />
        <text
          x={avgX + 6}
          y={32}
          style={styles.avgLabel as React.CSSProperties}
          fill={avgLineColor}
        >
          均值 {question.average.toFixed(1)}
        </text>

        {/* X 轴底线 */}
        <line
          x1={padLeft}
          y1={chartHeight - padBottom}
          x2={chartWidth - 16}
          y2={chartHeight - padBottom}
          stroke="#d9d9d9"
          strokeWidth={1}
        />
      </svg>
    </div>
  );
};

const styles = {
  container: {
    padding: "20px",
    backgroundColor: "#fff",
    borderRadius: "8px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  } as React.CSSProperties,
  title: {
    fontSize: "15px",
    fontWeight: 600,
    color: "#262626",
    margin: "0 0 4px",
    lineHeight: 1.5,
  } as React.CSSProperties,
  meta: {
    fontSize: "12px",
    color: "#8c8c8c",
    margin: "0 0 12px",
  } as React.CSSProperties,
  axisTick: {
    fontSize: "11px",
    fill: "#8c8c8c",
  },
  barLabel: {
    fontSize: "11px",
    fill: "#595959",
    fontWeight: "600",
  },
  avgLabel: {
    fontSize: "12px",
    fontWeight: "700",
  },
};

export default BarChart;
