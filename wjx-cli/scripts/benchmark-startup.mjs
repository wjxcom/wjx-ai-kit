import { execFileSync } from "node:child_process";
import { readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(__dirname, "..");
const CLI = resolve(PACKAGE_ROOT, "dist", "index.js");
const BASELINE = resolve(PACKAGE_ROOT, "perf", "startup-baseline.json");
const BASELINE_SCHEMA_VERSION = 1;
export const MAX_TOTAL_SAMPLES = 1000;

function usageError(message) {
  throw new Error(`${message}\nUsage: node scripts/benchmark-startup.mjs [--samples N] [--discard N] [--report] [--enforce] [--write-baseline] [--write-default]`);
}

export function parseArgs(argv) {
  const options = {
    samples: 20,
    discard: 2,
    report: false,
    writeBaseline: false,
    writeDefault: false,
    enforce: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--report") {
      options.report = true;
      continue;
    }
    if (arg === "--write-baseline") {
      options.writeBaseline = true;
      continue;
    }
    if (arg === "--write-default") {
      options.writeDefault = true;
      continue;
    }
    if (arg === "--enforce") { options.enforce = true; continue; }
    if (arg === "--samples" || arg === "--discard") {
      const value = argv[index + 1];
      index += 1;
      if (value === undefined || !/^\d+$/.test(value)) {
        usageError(`${arg} requires a non-negative integer`);
      }
      const parsed = Number(value);
      if (!Number.isSafeInteger(parsed)) usageError(`${arg} is too large`);
      options[arg.slice(2)] = parsed;
      continue;
    }
    usageError(`Unknown option: ${arg}`);
  }

  if (options.samples < 1) usageError("--samples must be at least 1");
  if (options.discard < 0) usageError("--discard must be non-negative");
  if (options.samples > MAX_TOTAL_SAMPLES - options.discard) {
    usageError(`--samples + --discard must be at most ${MAX_TOTAL_SAMPLES}`);
  }
  return options;
}

function elapsed(command, args) {
  const start = performance.now();
  execFileSync(process.execPath, [command, ...args], {
    cwd: PACKAGE_ROOT,
    env: process.env,
    stdio: "ignore",
  });
  return performance.now() - start;
}

function percentile(values, fraction) {
  const sorted = [...values].sort((left, right) => left - right);
  const index = (sorted.length - 1) * fraction;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function rounded(value) {
  return Math.round(value * 1000) / 1000;
}

function summarize(values) {
  return {
    p50Ms: rounded(percentile(values, 0.5)),
    p95Ms: rounded(percentile(values, 0.95)),
    minMs: rounded(Math.min(...values)),
    maxMs: rounded(Math.max(...values)),
  };
}

function commitSha() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: PACKAGE_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown";
  }
}

export function currentKey() {
  const nodeMajor = process.versions.node.split(".", 1)[0];
  return `${process.platform}-${process.arch}-node${nodeMajor}`;
}

export function runBenchmark({ samples = 20, discard = 2 } = {}) {
  if (!Number.isSafeInteger(samples) || samples < 1) {
    throw new Error("samples must be a positive integer");
  }
  if (!Number.isSafeInteger(discard) || discard < 0) {
    throw new Error("discard must be a non-negative integer");
  }
  if (samples > MAX_TOTAL_SAMPLES - discard) {
    throw new Error(`samples + discard must be at most ${MAX_TOTAL_SAMPLES}`);
  }

  const nodeSamples = [];
  const cliSamples = [];
  for (let index = 0; index < samples + discard; index += 1) {
    // Keep the paired order fixed so both measurements see the same warm-up state.
    const nodeMs = elapsed("-e", [""]);
    const cliMs = elapsed(CLI, ["--version"]);
    if (index >= discard) {
      nodeSamples.push(nodeMs);
      cliSamples.push(cliMs);
    }
  }

  const node = summarize(nodeSamples);
  const cli = summarize(cliSamples);
  return {
    key: currentKey(),
    samples,
    discard,
    nodeVersion: process.version,
    node: process.version,
    nodeMajor: Number(process.versions.node.split(".", 1)[0]),
    platform: process.platform,
    arch: process.arch,
    commit: commitSha(),
    nodeP50Ms: node.p50Ms,
    nodeP95Ms: node.p95Ms,
    nodeMinMs: node.minMs,
    nodeMaxMs: node.maxMs,
    cliP50Ms: cli.p50Ms,
    cliP95Ms: cli.p95Ms,
    cliMinMs: cli.minMs,
    cliMaxMs: cli.maxMs,
    deltaP95Ms: rounded(cli.p95Ms - node.p95Ms),
    nodeStats: node,
    cliStats: cli,
  };
}

export function readBaseline(baselinePath = BASELINE) {
  try {
    const parsed = JSON.parse(readFileSync(baselinePath, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("baseline must be a JSON object");
    }
    if (parsed.baselines !== undefined) {
      if (!parsed.baselines || typeof parsed.baselines !== "object" || Array.isArray(parsed.baselines)) {
        throw new Error("baseline.baselines must be a JSON object");
      }
      return {
        ...parsed,
        schemaVersion: BASELINE_SCHEMA_VERSION,
        baselines: { ...parsed.baselines },
      };
    }

    // Accept the initial empty file and pre-schema flat maps without losing entries.
    return {
      ...parsed,
      schemaVersion: BASELINE_SCHEMA_VERSION,
      baselines: Object.fromEntries(
        Object.entries(parsed).filter(([key]) => !["schemaVersion", "samples", "discard"].includes(key)),
      ),
    };
  } catch (error) {
    if (error?.code === "ENOENT") {
      return { schemaVersion: BASELINE_SCHEMA_VERSION, baselines: {} };
    }
    throw new Error(`Unable to read ${baselinePath}: ${error.message}`);
  }
}

export function writeBaseline(
  report,
  { writeBaseline = false, writeDefault = false } = {},
  baselinePath = BASELINE,
) {
  if (!writeBaseline && !writeDefault) return;
  const baseline = readBaseline(baselinePath);
  baseline.schemaVersion = BASELINE_SCHEMA_VERSION;
  baseline.samples = report.samples;
  baseline.discard = report.discard;
  if (writeBaseline) baseline.baselines[report.key] = report;
  if (writeDefault) baseline.baselines.default = report;
  const temporaryPath = `${baselinePath}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
  try {
    writeFileSync(temporaryPath, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");
    renameSync(temporaryPath, baselinePath);
  } catch (error) {
    try {
      unlinkSync(temporaryPath);
    } catch {
      // Preserve the original write error when cleanup is not possible.
    }
    throw error;
  }
}

export function enforceBaseline(report, baselinePath = BASELINE) {
  const baseline = readBaseline(baselinePath);
  const selected = baseline.baselines[currentKey()] ?? baseline.baselines.default;
  if (!selected) throw new Error(`No startup baseline for ${currentKey()}; add an approved baseline before enforcing`);
  const baselineDelta = selected && typeof selected === "object"
    ? selected.deltaP95Ms
    : undefined;
  if (typeof baselineDelta !== "number" || !Number.isFinite(baselineDelta) || baselineDelta < 0) {
    throw new Error(`Invalid startup baseline for ${currentKey()}: deltaP95Ms must be a finite non-negative number`);
  }
  if (report.deltaP95Ms > baselineDelta * 1.2) {
    throw new Error(`Startup regression: deltaP95Ms=${report.deltaP95Ms} exceeds budget=${rounded(baselineDelta * 1.2)}`);
  }
}

export function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const report = runBenchmark(options);
  if (options.enforce && !options.report) {
    enforceBaseline(report);
  }
  writeBaseline(report, options);
  if (options.report || options.writeBaseline || options.writeDefault) {
    process.stdout.write(`${JSON.stringify(report)}\n`);
  }
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
