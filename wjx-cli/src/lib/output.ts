export interface OutputOpts {
  json?: boolean;
  table?: boolean;
}

/** Add respondent-facing URLs without ever exposing a numeric vid as the path. */
export function enrichSurveyListOutput(data: unknown): unknown {
  if (!data || typeof data !== "object") return data;

  const response = data as Record<string, unknown>;
  const payload = response.data;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return data;

  const payloadRecord = payload as Record<string, unknown>;
  const key = ["activitys", "activities"].find((candidate) => {
    const value = payloadRecord[candidate];
    return value && typeof value === "object" && !Array.isArray(value);
  });
  if (!key) return data;

  const activities = payloadRecord[key] as Record<string, unknown>;
  const enriched = Object.fromEntries(Object.entries(activities).map(([id, value]) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [id, value];
    const item = value as Record<string, unknown>;
    const domain = typeof item.activity_domain === "string"
      ? item.activity_domain.replace(/\/$/, "")
      : "";
    const mobilePath = typeof item.mobile_path === "string" ? item.mobile_path.trim() : "";
    const sid = typeof item.sid === "string" ? item.sid.trim() : "";
    const vid = item.vid === undefined ? "" : String(item.vid);

    let fillUrl: string | undefined;
    if (domain && sid && sid !== vid) {
      fillUrl = `${domain}/vm/${encodeURIComponent(sid)}.aspx`;
    } else if (domain && mobilePath && (!vid || !mobilePath.includes(`/${vid}.`))) {
      fillUrl = mobilePath.startsWith("http://") || mobilePath.startsWith("https://")
        ? mobilePath
        : `${domain}/${mobilePath.replace(/^\/+/, "")}`;
    }

    return [id, fillUrl ? { ...item, fill_url: fillUrl } : { ...item }];
  }));

  return {
    ...response,
    data: {
      ...payloadRecord,
      [key]: enriched,
    },
  };
}

export function formatOutput(data: unknown, opts: OutputOpts): void {
  if (opts.table) {
    printTable(data);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

function printTable(data: unknown): void {
  if (data === null || data === undefined) {
    console.log("(empty)");
    return;
  }

  // If it's an API response with result/data, unwrap
  const obj = data as Record<string, unknown>;
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
    const record = payload as Record<string, unknown>;
    // If it contains a list/array field, table that
    for (const key of ["survey_list", "list", "items", "data", "rows"]) {
      if (Array.isArray(record[key])) {
        console.table(record[key] as unknown[]);
        return;
      }
    }
    // activitys is a vid→object map from listSurveys — convert to array
    for (const key of ["activitys", "activities"]) {
      const val = record[key];
      if (val && typeof val === "object" && !Array.isArray(val)) {
        const arr = Object.values(val as Record<string, unknown>);
        if (arr.length > 0 && typeof arr[0] === "object") {
          const simplified = arr.map((item) => {
            const r = item as Record<string, unknown>;
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
