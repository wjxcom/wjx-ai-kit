import React, { useMemo } from "react";
import type { TimelinePoint } from "./types";

export interface TimelineChartProps {
  timeline: TimelinePoint[];
  lineColor?: string;
  areaColor?: string;
  className?: string;
}

export const TimelineChart: React.FC<TimelineChartProps> = ({
  timeline,
  lineColor = "#1890ff",
  areaColor = "rgba(24,144,255,0.12)",
  className = "",
}) => {
  const {
    points,
    svgW,
    svgH,
    padLeft,
    padBottom,
    padTop,
    xLabels,
    yTicks,
    polylinePoints,
    areaPath,
  } = useMemo(() => {
    const svgW = 520;
    const svgH = 220;
    const padLeft = 52;
    const padBottom = 40;
    const padTop = 20;
    const padRight = 16;
    const innerW = svgW - padLeft - padRight;
    const innerH = svgH - padTop - padBottom;

    const maxCount = Math.max(...timeline.map((p) => p.cumulativeCount), 1);

    const points = timeline.map((p, i) => {
      const x = padLeft + (i / (timeline.length - 1 || 1)) * innerW;
      const y = padTop + innerH - (p.cumulativeCount / maxCount) * innerH;
      return { x, y, ...p };
    });

    const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(" ");
    const areaPath = [
      `M ${points[0].x} ${padTop + innerH}`,
      ...points.map((p) => `L ${p.x} ${p.y}`),
      `L ${points[points.length - 1].x} ${padTop + innerH}`,
      "Z",
    ].join(" ");

    // X 轴标签：最多显示 5 个
    const step = Math.ceil(timeline.length / 5);
    const xLabels = points
      .filter((_, i) => i % step === 0 || i === timeline.length - 1)
      .map((p) => ({
        x: p.x,
        label: formatTime(p.timestamp),
      }));

    // Y 轴刻度
    const yTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
      y: padTop + innerH - ratio * innerH,
      value: Math.round(ratio * maxCount),
    }));

    return {
      points,
      svgW,
      svgH,
      padLeft,
      padBottom,
      padTop,
      padRight,
      innerW,
      innerH,
      xLabels,
      yTicks,
      polylinePoints,
      areaPath,
    };
  }, [timeline]);

  if (timeline.length === 0) {
    return (
      <div style={styles.container} className={className}>
        <h3 style={styles.title}>答题趋势</h3>
        <p style={{ color: "#8c8c8c", textAlign: "center", padding: "40px 0" }}>
          暂无数据
        </p>
      </div>
    );
  }

  const latestCount = timeline[timeline.length - 1].cumulativeCount;

  return (
    <div
      className={`survey-timeline-chart ${className}`}
      style={styles.container}
    >
      <h3 style={styles.title}>答题趋势</h3>
      <p style={styles.meta}>
        累计已收集 <strong>{latestCount.toLocaleString()}</strong> 份
      </p>

      <svg width={svgW} height={svgH} style={{ overflow: "visible" }}>
        {/* Y 轴刻度 */}
        {yTicks.map((tick) => (
          <g key={tick.value}>
            <line
              x1={padLeft}
              y1={tick.y}
              x2={svgW - 16}
              y2={tick.y}
              stroke="#f0f0f0"
              strokeWidth={1}
            />
            <text
              x={padLeft - 6}
              y={tick.y + 4}
              textAnchor="end"
              style={styles.axisTick as React.CSSProperties}
            >
              {tick.value}
            </text>
          </g>
        ))}

        {/* 面积填充 */}
        <path d={areaPath} fill={areaColor} />

        {/* 折线 */}
        <polyline
          points={polylinePoints}
          fill="none"
          stroke={lineColor}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* 数据点 */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={4} fill={lineColor} stroke="#fff" strokeWidth={2}>
            <title>
              {formatTime(p.timestamp)}：{p.cumulativeCount} 份
            </title>
          </circle>
        ))}

        {/* X 轴标签 */}
        {xLabels.map((lbl, i) => (
          <text
            key={i}
            x={lbl.x}
            y={svgH - padBottom + 18}
            textAnchor="middle"
            style={styles.axisTick as React.CSSProperties}
          >
            {lbl.label}
          </text>
        ))}

        {/* X 轴底线 */}
        <line
          x1={padLeft}
          y1={svgH - padBottom}
          x2={svgW - 16}
          y2={svgH - padBottom}
          stroke="#d9d9d9"
          strokeWidth={1}
        />
      </svg>
    </div>
  );
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hour = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  if (hour === "00" && min === "00") return `${month}/${day}`;
  return `${month}/${day} ${hour}:${min}`;
}

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
};

export default TimelineChart;
