function getHttpOrigin(value) {
    try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:" ? url.origin : undefined;
    }
    catch {
        return undefined;
    }
}
function pathExposesVid(pathname, vid) {
    if (!vid)
        return false;
    return pathname.split("/").some((segment) => {
        let decoded = segment;
        try {
            decoded = decodeURIComponent(segment);
        }
        catch {
            // Keep the raw segment when percent encoding is malformed.
        }
        return decoded === vid || decoded.startsWith(`${vid}.`);
    });
}
/** Add respondent-facing URLs without ever exposing a numeric vid as the path. */
export function enrichSurveyListOutput(data) {
    if (!data || typeof data !== "object")
        return data;
    const response = data;
    const payload = response.data;
    if (!payload || typeof payload !== "object" || Array.isArray(payload))
        return data;
    const payloadRecord = payload;
    const key = ["activitys", "activities"].find((candidate) => {
        const value = payloadRecord[candidate];
        return value && typeof value === "object" && !Array.isArray(value);
    });
    if (!key)
        return data;
    const activities = payloadRecord[key];
    const enriched = Object.fromEntries(Object.entries(activities).map(([id, value]) => {
        if (!value || typeof value !== "object" || Array.isArray(value))
            return [id, value];
        const item = value;
        const origin = typeof item.activity_domain === "string"
            ? getHttpOrigin(item.activity_domain)
            : undefined;
        const mobilePath = typeof item.mobile_path === "string" ? item.mobile_path.trim() : "";
        const sid = typeof item.sid === "string" ? item.sid.trim() : "";
        const vid = item.vid === undefined ? "" : String(item.vid).trim();
        const safeItem = { ...item };
        delete safeItem.fill_url;
        let fillUrl;
        if (origin && sid) {
            const sidPath = `/vm/${encodeURIComponent(sid)}.aspx`;
            if (!pathExposesVid(sidPath, vid))
                fillUrl = new URL(sidPath, origin).href;
        }
        if (!fillUrl && origin && mobilePath) {
            try {
                const candidate = new URL(mobilePath, `${origin}/`);
                if (candidate.origin === origin && !pathExposesVid(candidate.pathname, vid)) {
                    fillUrl = candidate.href;
                }
            }
            catch {
                // Invalid server paths are omitted from the output.
            }
        }
        return [id, fillUrl ? { ...safeItem, fill_url: fillUrl } : safeItem];
    }));
    return {
        ...response,
        data: {
            ...payloadRecord,
            [key]: enriched,
        },
    };
}
export function formatOutput(data, opts) {
    if (opts.table) {
        printTable(data);
    }
    else {
        console.log(JSON.stringify(data, null, 2));
    }
}
function printTable(data) {
    if (data === null || data === undefined) {
        console.log("(empty)");
        return;
    }
    // If it's an API response with result/data, unwrap
    const obj = data;
    const payload = obj.result !== undefined && obj.data !== undefined ? obj.data : data;
    if (Array.isArray(payload)) {
        if (payload.length === 0) {
            console.log("(empty)");
            return;
        }
        console.table(payload);
        return;
    }
    if (typeof payload === "object" && payload !== null) {
        const record = payload;
        // If it contains a list/array field, table that
        for (const key of ["survey_list", "list", "items", "data", "rows"]) {
            if (Array.isArray(record[key])) {
                console.table(record[key]);
                return;
            }
        }
        // activitys is a vid→object map from listSurveys — convert to array
        for (const key of ["activitys", "activities"]) {
            const val = record[key];
            if (val && typeof val === "object" && !Array.isArray(val)) {
                const arr = Object.values(val);
                if (arr.length > 0 && typeof arr[0] === "object") {
                    const simplified = arr.map((item) => {
                        const r = item;
                        return { vid: r.vid, title: r.title, status: r.status, answers: r.answer_valid, created: r.create_date, creator: r.creater, fill_url: r.fill_url };
                    });
                    console.table(simplified);
                    return;
                }
            }
        }
        // Single object — show key/value pairs
        const rows = Object.entries(record).map(([k, v]) => ({
            key: k,
            value: typeof v === "object" ? JSON.stringify(v) : String(v ?? ""),
        }));
        console.table(rows);
        return;
    }
    console.log(String(payload));
}
//# sourceMappingURL=output.js.map