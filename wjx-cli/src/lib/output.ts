import { CliError } from "./errors.js";

export interface OutputOpts {
  format?: "json" | "pretty" | "table" | "ndjson" | "csv";
}

const OUTPUT_FORMATS = new Set(["json", "pretty", "table", "ndjson", "csv"]);

/** Validate the user-facing format before any command can perform I/O. */
export function validateOutputFormat(opts: Pick<OutputOpts, "format">): void {
  const format = opts.format ?? "json";
  if (!OUTPUT_FORMATS.has(format)) {
    throw new CliError("INPUT_ERROR", `不支持的输出格式：${String(format)}。可选值：json、pretty、table、ndjson、csv`);
  }
}

function getHttpOrigin(value: string): string | undefined {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : undefined;
  } catch {
    return undefined;
  }
}

function pathExposesVid(pathname: string, vid: string): boolean {
  if (!vid) return false;
  return pathname.split("/").some((segment) => {
    let decoded = segment;
    try {
      decoded = decodeURIComponent(segment);
    } catch {
      // Keep the raw segment when percent encoding is malformed.
    }
    return decoded === vid || decoded.startsWith(`${vid}.`);
  });
}

function validateApiFillUrl(value: unknown, expectedOrigin: string | undefined, vid: string): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    const url = new URL(value.trim());
    if ((url.protocol !== "http:" && url.protocol !== "https:") || (expectedOrigin && url.origin !== expectedOrigin)) {
      return undefined;
    }
    if (!/^\/(?:m|vm|jq)(?:\/|$)/.test(url.pathname) || pathExposesVid(url.pathname, vid)) {
      return undefined;
    }
    return url.href;
  } catch {
    return undefined;
  }
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
    const origin = typeof item.activity_domain === "string"
      ? getHttpOrigin(item.activity_domain)
      : undefined;
    const pcPath = typeof item.pc_path === "string" ? item.pc_path.trim() : "";
    const mobilePath = typeof item.mobile_path === "string" ? item.mobile_path.trim() : "";
    const vid = item.vid === undefined ? "" : String(item.vid).trim();
    const safeItem = { ...item };
    delete safeItem.fill_url;

    let fillUrl = validateApiFillUrl(item.fill_url, origin, vid);
    if (!fillUrl && origin) {
      for (const serverPath of [pcPath, mobilePath]) {
        if (!serverPath) continue;
        try {
          const candidate = new URL(serverPath, `${origin}/`);
          fillUrl = validateApiFillUrl(candidate.href, origin, vid);
        } catch {
          fillUrl = undefined;
        }
        if (fillUrl) break;
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

export function formatOutput(data: unknown, opts: OutputOpts): void {
  const envelope = toResultEnvelope(data);
  const format = opts.format ?? "json";
  validateOutputFormat(opts);
  if (format === "json") process.stdout.write(`${JSON.stringify(envelope, null, 2)}\n`);
  else if (format === "pretty") printPretty(envelope);
  else if (format === "table") printTable(envelope);
  else if (format === "ndjson") printNdjson(envelope);
  else printCsv(envelope);
}

function toResultEnvelope(data: unknown): Record<string, unknown> {
  if (data && typeof data === "object" && "ok" in data) return data as Record<string, unknown>;
  if (data && typeof data === "object" && "result" in data) {
    const raw = data as Record<string, unknown>;
    const meta: Record<string, unknown> = {};
    for (const key of ["result", "errorcode", "errormsg", "traceid"]) if (key in raw) meta[key] = raw[key];
    return { ok: true, data: raw.data ?? raw, ...(Object.keys(meta).length ? { meta: { upstream: meta } } : {}) };
  }
  return { ok: true, data };
}

function printPretty(envelope: Record<string, unknown>): void {
  const payload = envelope.ok === true ? envelope.data : envelope;
  process.stdout.write(`${typeof payload === "string" ? payload : JSON.stringify(payload, null, 2)}\n`);
}

function printNdjson(envelope: Record<string, unknown>): void {
  const payload = envelope.ok === true ? envelope.data : envelope;
  const records = Array.isArray(payload) ? payload : [payload];
  for (const record of records) process.stdout.write(`${JSON.stringify(record)}\n`);
}

function printCsv(envelope: Record<string, unknown>): void {
  const payload = envelope.ok === true ? envelope.data : envelope;
  let values: unknown[];
  if (Array.isArray(payload)) values = payload;
  else if (payload && typeof payload === "object") {
    const object = payload as Record<string, unknown>;
    const listKey = ["rows", "answers", "items", "list", "survey_list"].find((key) => Array.isArray(object[key]));
    if (listKey) values = object[listKey] as unknown[];
    else {
      const mapKey = ["activitys", "activities"].find((key) => object[key] && typeof object[key] === "object" && !Array.isArray(object[key]));
      values = mapKey ? Object.values(object[mapKey] as Record<string, unknown>) : [payload];
    }
  } else values = [payload];
  const records = values.filter((v) => v && typeof v === "object") as Record<string, unknown>[];
  if (records.length === 0) {
    const quote = (value: unknown) => {
      const scalar = value && typeof value === "object" ? JSON.stringify(value) : String(value ?? "");
      return `"${scalar.replaceAll("\"", "\"\"")}"`;
    };
    process.stdout.write(`value\n${quote(values[0])}\n`);
    return;
  }
  const columns = [...new Set(records.flatMap((record) => Object.keys(record)))];
  const quote = (value: unknown) => {
    const scalar = value && typeof value === "object" ? JSON.stringify(value) : String(value ?? "");
    return `"${scalar.replaceAll("\"", "\"\"")}"`;
  };
  process.stdout.write(`${columns.map(quote).join(",")}\n`);
  for (const record of records) process.stdout.write(`${columns.map((key) => quote(record[key])).join(",")}\n`);
}

function printTable(data: unknown): void {
  if (data === null || data === undefined) {
    console.log("(empty)");
    return;
  }

  // If it's an API response with result/data, unwrap
  const obj = data as Record<string, unknown>;
  const payload = obj.ok === true
    ? obj.data
    : obj.result !== undefined && obj.data !== undefined ? obj.data : data;

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
