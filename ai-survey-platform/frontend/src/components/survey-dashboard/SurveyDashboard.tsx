import React, { useState, useEffect, useCallback } from "react";
import { ProgressBar } from "./ProgressBar";
import { PieChart } from "./PieChart";
import { BarChart } from "./BarChart";
import { TimelineChart } from "./TimelineChart";
import type {
  SurveyDashboardData,
  SingleChoiceQuestion,
  ScaleQuestion,
} from "./types";

export interface SurveyDashboardProps {
  /** 初始数据（用于 mock/SSR）。若提供 fetchData，将被自动刷新覆盖 */
  initialData: SurveyDashboardData;
  /** 异步数据获取函数，返回最新看板数据 */
  fetchData?: () => Promise<SurveyDashboardData>;
  /** 轮询间隔（毫秒），默认 30000（30 秒） */
  pollInterval?: number;
  className?: string;
}

export const SurveyDashboard: React.FC<SurveyDashboardProps> = ({
  initialData,
  fetchData,
  pollInterval = 30_000,
  className = "",
}) => {
  const [data, setData] = useState<SurveyDashboardData>(initialData);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!fetchData) return;
    setLoading(true);
    setError(null);
    try {
      const fresh = await fetchData();
      setData(fresh);
      setLastUpdated(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "刷新失败");
    } finally {
      setLoading(false);
    }
  }, [fetchData]);

  useEffect(() => {
    if (!fetchData) return;
    refresh();
    const id = setInterval(refresh, pollInterval);
    return () => clearInterval(id);
  }, [fetchData, pollInterval, refresh]);

  const singleChoiceQuestions = data.questions.filter(
    (q): q is SingleChoiceQuestion => q.type === "single_choice"
  );
  const scaleQuestions = data.questions.filter(
    (q): q is ScaleQuestion => q.type === "scale"
  );

  return (
    <div
      className={`survey-dashboard ${className}`}
      style={styles.wrapper}
    >
      {/* 看板标题栏 */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.heading}>{data.title}</h1>
          <p style={styles.subheading}>
            问卷实时数据看板 &nbsp;·&nbsp; 最后更新:{" "}
            {lastUpdated.toLocaleTimeString("zh-CN")}
          </p>
        </div>
        <div style={styles.headerRight}>
          {fetchData && (
            <button
              onClick={refresh}
              disabled={loading}
              style={loading ? { ...styles.refreshBtn, opacity: 0.6 } : styles.refreshBtn}
              aria-label="手动刷新"
            >
              {loading ? "刷新中…" : "↻ 刷新"}
            </button>
          )}
          {fetchData && (
            <span style={styles.pollBadge}>
              每 {Math.round(pollInterval / 1000)}s 自动更新
            </span>
          )}
        </div>
      </div>

      {error && <div style={styles.errorBanner}>{error}</div>}

      {/* 进度条 */}
      <div style={styles.section}>
        <ProgressBar
          collectedCount={data.collectedCount}
          targetCount={data.targetCount}
        />
      </div>

      {/* 单选题饼图 */}
      {singleChoiceQuestions.length > 0 && (
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>单选题分布</h2>
          <div style={styles.grid}>
            {singleChoiceQuestions.map((q) => (
              <PieChart key={q.questionId} question={q} />
            ))}
          </div>
        </div>
      )}

      {/* 量表题柱状图 */}
      {scaleQuestions.length > 0 && (
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>量表题分布</h2>
          <div style={styles.grid}>
            {scaleQuestions.map((q) => (
              <BarChart key={q.questionId} question={q} />
            ))}
          </div>
        </div>
      )}

      {/* 答题趋势 */}
      <div style={styles.section}>
        <TimelineChart timeline={data.timeline} />
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "24px 16px",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    backgroundColor: "#f5f6fa",
    minHeight: "100vh",
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: "24px",
    flexWrap: "wrap",
    gap: "12px",
  },
  heading: {
    fontSize: "22px",
    fontWeight: 700,
    color: "#262626",
    margin: "0 0 4px",
  },
  subheading: {
    fontSize: "13px",
    color: "#8c8c8c",
    margin: 0,
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexShrink: 0,
  },
  refreshBtn: {
    padding: "6px 16px",
    fontSize: "13px",
    fontWeight: 500,
    color: "#1890ff",
    background: "#e6f7ff",
    border: "1px solid #91d5ff",
    borderRadius: "6px",
    cursor: "pointer",
    transition: "background 0.2s",
  },
  pollBadge: {
    fontSize: "12px",
    color: "#8c8c8c",
    background: "#f0f0f0",
    padding: "4px 10px",
    borderRadius: "12px",
  },
  errorBanner: {
    background: "#fff2f0",
    border: "1px solid #ffccc7",
    borderRadius: "6px",
    color: "#cf1322",
    padding: "10px 16px",
    marginBottom: "16px",
    fontSize: "13px",
  },
  section: {
    marginBottom: "24px",
  },
  sectionTitle: {
    fontSize: "15px",
    fontWeight: 600,
    color: "#595959",
    margin: "0 0 12px",
    borderLeft: "3px solid #1890ff",
    paddingLeft: "10px",
  } as React.CSSProperties,
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))",
    gap: "16px",
  },
};

export default SurveyDashboard;
