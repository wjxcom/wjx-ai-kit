import React from "react";

export interface ProgressBarProps {
  collectedCount: number;
  targetCount: number;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  collectedCount,
  targetCount,
  className = "",
}) => {
  const percentage = Math.min(
    Math.round((collectedCount / targetCount) * 100),
    100
  );

  return (
    <div className={`survey-progress-bar ${className}`} style={styles.container}>
      <div style={styles.header}>
        <span style={styles.label}>答题进度</span>
        <span style={styles.stats}>
          <strong>{collectedCount.toLocaleString()}</strong>
          <span style={styles.divider}> / </span>
          <span style={styles.target}>{targetCount.toLocaleString()}</span>
          <span style={styles.unit}> 份</span>
          <span style={styles.percentage}>{percentage}%</span>
        </span>
      </div>
      <div style={styles.track}>
        <div
          style={{
            ...styles.fill,
            width: `${percentage}%`,
            background:
              percentage >= 100
                ? "linear-gradient(90deg, #52c41a, #73d13d)"
                : "linear-gradient(90deg, #1890ff, #40a9ff)",
          }}
          role="progressbar"
          aria-valuenow={collectedCount}
          aria-valuemin={0}
          aria-valuemax={targetCount}
          aria-label={`答题进度 ${percentage}%`}
        />
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: "16px 20px",
    backgroundColor: "#fff",
    borderRadius: "8px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px",
  },
  label: {
    fontSize: "14px",
    color: "#595959",
    fontWeight: 500,
  },
  stats: {
    fontSize: "14px",
    color: "#262626",
  },
  divider: {
    color: "#bfbfbf",
  },
  target: {
    color: "#8c8c8c",
  },
  unit: {
    color: "#8c8c8c",
    marginRight: "8px",
  },
  percentage: {
    fontWeight: 700,
    color: "#1890ff",
    fontSize: "16px",
  },
  track: {
    height: "12px",
    backgroundColor: "#f0f0f0",
    borderRadius: "6px",
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: "6px",
    transition: "width 0.6s ease",
  },
};

export default ProgressBar;
