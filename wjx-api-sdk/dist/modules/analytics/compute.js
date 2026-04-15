// ─── decodeResponses ─────────────────────────────────────────────────────────
// Format: "题号$答案}题号$答案"
// Multi-choice answers use pipe separator: "1|2|3"
// Matrix answers use comma-separated sub-answers: "row1_col1,row1_col2"
// Fill-in answers are plain text
//
// NOTE: Without question metadata, type detection is heuristic-based.
// Pure numeric fill-in answers (e.g. "42") will be classified as "single"
// (single-choice) since we cannot distinguish them from option indices.
export function decodeResponses(submitdata) {
    if (!submitdata || submitdata.trim() === "") {
        return { answers: [], count: 0 };
    }
    const segments = submitdata.split("}");
    const answers = [];
    for (const seg of segments) {
        const trimmed = seg.trim();
        if (!trimmed)
            continue;
        const dollarIdx = trimmed.indexOf("$");
        if (dollarIdx === -1)
            continue;
        const qIdx = parseInt(trimmed.substring(0, dollarIdx), 10);
        if (Number.isNaN(qIdx))
            continue;
        const rawValue = trimmed.substring(dollarIdx + 1);
        // Detect type based on content patterns
        if (rawValue.includes("|")) {
            // Multi-choice: values separated by pipe
            answers.push({
                questionIndex: qIdx,
                type: "multi",
                value: rawValue.split("|"),
            });
        }
        else if (rawValue.includes(",") && rawValue.split(",").every((p) => p.includes("_"))) {
            // Matrix: "row_col,row_col" pattern
            const pairs = {};
            for (const pair of rawValue.split(",")) {
                const underIdx = pair.indexOf("_");
                if (underIdx !== -1) {
                    pairs[pair.substring(0, underIdx)] = pair.substring(underIdx + 1);
                }
            }
            answers.push({
                questionIndex: qIdx,
                type: "matrix",
                value: pairs,
            });
        }
        else if (/^\d+$/.test(rawValue)) {
            // Single choice: numeric answer
            answers.push({
                questionIndex: qIdx,
                type: "single",
                value: rawValue,
            });
        }
        else {
            // Fill-in: everything else
            answers.push({
                questionIndex: qIdx,
                type: "fill",
                value: rawValue,
            });
        }
    }
    return { answers, count: answers.length };
}
// ─── calculateNps ────────────────────────────────────────────────────────────
// NPS = %Promoters - %Detractors (scale 0-10)
// Promoters: 9-10, Passives: 7-8, Detractors: 0-6
export function calculateNps(scores) {
    if (scores.length === 0) {
        return {
            score: 0,
            promoters: { count: 0, ratio: 0 },
            passives: { count: 0, ratio: 0 },
            detractors: { count: 0, ratio: 0 },
            total: 0,
            rating: "一般",
        };
    }
    const total = scores.length;
    let promoters = 0;
    let passives = 0;
    let detractors = 0;
    for (const s of scores) {
        if (s >= 9)
            promoters++;
        else if (s >= 7)
            passives++;
        else
            detractors++;
    }
    const score = Math.round(((promoters - detractors) / total) * 100);
    let rating;
    if (score > 70)
        rating = "优秀";
    else if (score >= 50)
        rating = "良好";
    else if (score >= 0)
        rating = "一般";
    else
        rating = "较差";
    return {
        score,
        promoters: { count: promoters, ratio: round4(promoters / total) },
        passives: { count: passives, ratio: round4(passives / total) },
        detractors: { count: detractors, ratio: round4(detractors / total) },
        total,
        rating,
    };
}
// ─── calculateCsat ───────────────────────────────────────────────────────────
// 5-point: satisfied = 4-5; 7-point: satisfied = 5-7
export function calculateCsat(scores, scaleType = "5-point") {
    if (scores.length === 0) {
        return { csat: 0, satisfiedCount: 0, total: 0, distribution: {} };
    }
    const total = scores.length;
    const distribution = {};
    let satisfiedCount = 0;
    const satisfiedMin = scaleType === "5-point" ? 4 : 5;
    for (const s of scores) {
        const key = String(s);
        distribution[key] = (distribution[key] || 0) + 1;
        if (s >= satisfiedMin)
            satisfiedCount++;
    }
    return {
        csat: round4(satisfiedCount / total),
        satisfiedCount,
        total,
        distribution,
    };
}
export function detectAnomalies(responses) {
    const flagged = [];
    // Compute median duration for speed anomaly detection
    const durations = responses
        .map((r) => r.duration_seconds)
        .filter((d) => typeof d === "number" && d > 0);
    const medianDuration = durations.length > 0 ? median(durations) : 0;
    const speedThreshold = medianDuration * 0.3; // < 30% of median is suspicious
    // Build IP+content map for duplicate detection
    const ipContentMap = new Map();
    for (const r of responses) {
        const reasons = [];
        // 1. Straight-lining: all answers identical
        if (r.answers && r.answers.length > 2) {
            const unique = new Set(r.answers.map(String));
            if (unique.size === 1) {
                reasons.push("straight-lining");
            }
        }
        // 2. Speed anomaly: completed too fast
        if (typeof r.duration_seconds === "number" &&
            medianDuration > 0 &&
            r.duration_seconds > 0 &&
            r.duration_seconds < speedThreshold) {
            reasons.push("speed-anomaly");
        }
        // 3. IP + content duplicate
        if (r.ip && r.answers) {
            const contentKey = `${r.ip}:${r.answers.map(String).join(",")}`;
            const existing = ipContentMap.get(contentKey);
            if (existing) {
                existing.push(r.id);
                reasons.push("ip-content-duplicate");
            }
            else {
                ipContentMap.set(contentKey, [r.id]);
            }
        }
        if (reasons.length > 0) {
            flagged.push({ responseId: r.id, reasons });
        }
    }
    return { flagged, totalChecked: responses.length };
}
// ─── compareMetrics ──────────────────────────────────────────────────────────
export function compareMetrics(setA, setB) {
    const allKeys = new Set([...Object.keys(setA), ...Object.keys(setB)]);
    const comparisons = [];
    for (const metric of allKeys) {
        const valueA = setA[metric] ?? 0;
        const valueB = setB[metric] ?? 0;
        const delta = valueB - valueA;
        const changeRate = valueA === 0 ? (valueB === 0 ? 0 : 1) : round4(delta / Math.abs(valueA));
        const significant = Math.abs(changeRate) > 0.1;
        comparisons.push({ metric, valueA, valueB, delta, changeRate, significant });
    }
    return { comparisons };
}
// ─── Helpers ─────────────────────────────────────────────────────────────────
function round4(n) {
    return Math.round(n * 10000) / 10000;
}
function median(arr) {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
//# sourceMappingURL=compute.js.map