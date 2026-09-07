#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = resolve(root, "capabilities", "agent-contract.json");
const cliOutputPath = resolve(root, "wjx-cli", "dist", "capabilities", "agent-contract.json");
const mcpServerPath = resolve(root, "wjx-mcp-server", "dist", "server.js");
const mcpContractSourcePaths = [
  "wjx-mcp-server/src/server.ts",
  "wjx-mcp-server/src/modules/analytics/tools.ts",
  "wjx-mcp-server/src/modules/contacts/tools.ts",
  "wjx-mcp-server/src/modules/multi-user/tools.ts",
  "wjx-mcp-server/src/modules/response/tools.ts",
  "wjx-mcp-server/src/modules/sso/tools.ts",
  "wjx-mcp-server/src/modules/survey/tools.ts",
  "wjx-mcp-server/src/modules/user-system/tools.ts",
];

const riskRank = { read: 0, write: 1, "high-risk-write": 2 };

function sourceRevision(paths, mcpAnnotationRevision = "") {
  const hash = createHash("sha256");
  for (const relative of paths) {
    const normalized = readFileSync(resolve(root, relative), "utf8").replace(/\r\n/g, "\n");
    hash.update(`${relative}\n${normalized}\n`);
  }
  // The executable MCP surface is part of the contract. Include the
  // normalized listTools annotations so a built-tool drift cannot retain an
  // apparently fresh source revision.
  hash.update(`mcp-annotations\n${mcpAnnotationRevision}\n`);
  return hash.digest("hex");
}

function normalizeMcpTool(tool) {
  if (!tool || typeof tool !== "object" || typeof tool.name !== "string" || !tool.name.trim()) {
    throw new Error("MCP listTools returned a tool without a valid name");
  }
  const annotations = tool.annotations;
  if (!annotations || typeof annotations !== "object") {
    throw new Error(`MCP tool ${tool.name} is missing annotations`);
  }
  for (const field of ["destructiveHint", "idempotentHint"]) {
    if (typeof annotations[field] !== "boolean") {
      throw new Error(`MCP tool ${tool.name} has a non-boolean ${field}`);
    }
  }
  if (annotations.openWorldHint !== undefined && typeof annotations.openWorldHint !== "boolean") {
    throw new Error(`MCP tool ${tool.name} has a non-boolean openWorldHint`);
  }
  return {
    name: tool.name,
    ...(typeof annotations.title === "string" && annotations.title.trim()
      ? { title: annotations.title }
      : {}),
    destructiveHint: annotations.destructiveHint,
    idempotentHint: annotations.idempotentHint,
    ...(annotations.openWorldHint === undefined ? {} : { openWorldHint: annotations.openWorldHint }),
  };
}

/** Read the real registered MCP surface through the protocol, without API calls. */
async function readMcpAnnotations() {
  if (!existsSync(mcpServerPath)) {
    throw new Error(
      `MCP dist missing: ${mcpServerPath}. Run npm run build --workspace=wjx-mcp-server before exporting the agent contract.`,
    );
  }
  let createServer;
  try {
    ({ createServer } = await import(pathToFileURL(mcpServerPath)));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`unable to load MCP server dist at ${mcpServerPath}: ${message}`);
  }
  if (typeof createServer !== "function") throw new Error("MCP server dist does not export createServer");

  let Client;
  let InMemoryTransport;
  try {
    ({ Client } = await import("@modelcontextprotocol/sdk/client/index.js"));
    ({ InMemoryTransport } = await import("@modelcontextprotocol/sdk/inMemory.js"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`unable to load MCP protocol client dependencies: ${message}`);
  }

  const server = createServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "wjx-agent-contract-export", version: "1.0.0" });
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const listed = await client.listTools();
    if (!Array.isArray(listed?.tools)) throw new Error("MCP listTools returned no tools array");
    const normalized = listed.tools
      .map(normalizeMcpTool)
      .sort((a, b) => a.name.localeCompare(b.name));
    const names = new Set();
    const annotations = {};
    for (const tool of normalized) {
      if (names.has(tool.name)) throw new Error(`MCP listTools returned duplicate tool ${tool.name}`);
      names.add(tool.name);
      const { name, ...facts } = tool;
      annotations[name] = facts;
    }
    return annotations;
  } finally {
    await client.close().catch(() => undefined);
    await server.close().catch(() => undefined);
  }
}

function mcpRowsForEntries(entries, capabilityById, mcpAnnotations) {
  return entries.map((entry) => {
    const capability = capabilityById.get(entry.id);
    if (!capability?.mcp) return undefined;
    const annotations = mcpAnnotations[capability.mcp];
    if (!annotations) {
      throw new Error(`capability ${entry.id} maps to missing MCP tool ${capability.mcp}`);
    }
    return { capability, annotations, tool: capability.mcp };
  }).filter(Boolean);
}

function validateMcpAlignment(capabilityRows, commandById, commandMetadata, getAgentExecutionFacts, mcpAnnotations) {
  for (const row of capabilityRows) {
    if (!row.mcp) continue;
    const annotations = mcpAnnotations[row.mcp];
    if (!annotations) throw new Error(`capability ${row.id} maps to missing MCP tool ${row.mcp}`);
    const metadata = row.catalog ? commandMetadata[row.catalog] : undefined;
    if (!metadata || !commandById.has(row.catalog)) continue;
    const facts = getAgentExecutionFacts(metadata);
    // A CLI/SDK unsafe or unknown operation must never be advertised as
    // replay-safe by the MCP surface. A stricter MCP false is intentional.
    if (!facts.idempotent && annotations.idempotentHint) {
      throw new Error(
        `cross-surface drift: ${row.id}/${row.mcp} is non-idempotent in CLI/SDK metadata but MCP idempotentHint=true`,
      );
    }
    if (metadata.risk === "high-risk-write" && !annotations.destructiveHint) {
      throw new Error(
        `cross-surface drift: high-risk capability ${row.id}/${row.mcp} must set MCP destructiveHint=true`,
      );
    }
    // Queue reads remove items server-side; both surfaces must expose that
    // destructive consequence so hosts can require confirmation.
    if (facts.consumesQueue && !annotations.destructiveHint) {
      throw new Error(
        `cross-surface drift: queue-consuming capability ${row.id}/${row.mcp} must set MCP destructiveHint=true`,
      );
    }
  }
}

export async function createContract() {
  const [{ COMMAND_METADATA, getAgentExecutionFacts }, { CATALOG }, { requiresConfirmation }, { normalizeRetryPolicy }, { defaultPolicyEvaluator }, matrix, mcpAnnotations] = await Promise.all([
    import(pathToFileURL(resolve(root, "wjx-cli/dist/lib/command-metadata.js"))),
    import(pathToFileURL(resolve(root, "wjx-cli/dist/catalog/catalog.js"))),
    import(pathToFileURL(resolve(root, "wjx-cli/dist/lib/runtime/risk.js"))),
    import(pathToFileURL(resolve(root, "wjx-cli/dist/lib/runtime/retry.js"))),
    import(pathToFileURL(resolve(root, "wjx-cli/dist/lib/policy.js"))),
    Promise.resolve(JSON.parse(readFileSync(resolve(root, "capabilities/capability-matrix.json"), "utf8"))),
    readMcpAnnotations(),
  ]);
  const capabilityRows = [...(matrix.capabilities ?? [])].sort((a, b) => a.id.localeCompare(b.id));
  const supported = new Set(capabilityRows.map((row) => row.id));
  const commandById = new Map(CATALOG.map((entry) => [entry.id, entry]));
  const capabilityById = new Map(capabilityRows.map((row) => [row.id, row]));
  validateMcpAlignment(capabilityRows, commandById, COMMAND_METADATA, getAgentExecutionFacts, mcpAnnotations);
  const operationGroups = {
    read: ["survey.list", "survey.get", "survey.settings", "response.count", "response.query"],
    create: ["survey.create"],
    submit: ["response.submit"],
    modify: ["response.modify"],
    "update-settings": ["survey.update-settings"],
    "publish/status": ["survey.status"],
    delete: ["survey.delete"],
    clear: ["response.clear", "survey.clear-bin"],
    realtime: ["response.realtime"],
    "async-download": ["response.download"],
    report: ["response.report"],
    "360-report": ["response.360-report"],
    shortlink: ["survey.shortlink"],
  };
  const operations = {};
  for (const [name, ids] of Object.entries(operationGroups)) {
    const entries = ids.map((id) => ({ id, metadata: COMMAND_METADATA[id], catalog: commandById.get(id) })).filter((row) => row.metadata && row.catalog);
    const representative = entries[0];
    if (!representative) continue;
    const factRows = entries.map((entry) => getAgentExecutionFacts(entry.metadata));
    const mcpRows = mcpRowsForEntries(entries, capabilityById, mcpAnnotations);
    const mcpIdempotent = mcpRows.length === 0 || mcpRows.every((row) => row.annotations.idempotentHint);
    const mcpDestructive = mcpRows.some((row) => row.annotations.destructiveHint);
    const idempotent = factRows.every((row) => row.idempotent) && mcpIdempotent;
    const facts = {
      // A grouped operation advertises the strictest common transport facts.
      // This prevents one safe member from masking an unsafe member.
      httpRetryable: factRows.every((row) => row.httpRetryable),
      // MCP annotations are merged fail-closed: one false value wins.
      idempotent,
      consumesQueue: factRows.some((row) => row.consumesQueue),
      preRead: factRows.some((row) => row.preRead),
      postVerify: factRows.some((row) => row.postVerify),
      ambiguousTimeout: !idempotent || factRows.some((row) => row.ambiguousTimeout === "stop-and-report")
        ? "stop-and-report"
        : "read-after-write",
      maxBatch: factRows.map((row) => row.maxBatch).filter((value) => value !== null).sort((a, b) => a - b)[0] ?? null,
    };
    const maxRetries = facts.httpRetryable && facts.idempotent
      ? normalizeRetryPolicy({ maxRetries: 2 }).maxRetries
      : normalizeRetryPolicy({ maxRetries: 0 }).maxRetries;
    const cliRisk = entries
      .map((entry) => entry.metadata.risk)
      .sort((a, b) => riskRank[b] - riskRank[a])[0];
    const risk = mcpDestructive && riskRank["high-risk-write"] > riskRank[cliRisk]
      ? "high-risk-write"
      : cliRisk;
    operations[name] = {
      capabilityIds: entries.map((entry) => entry.id).filter((id) => supported.has(id)).sort(),
      risk,
      confirmation: entries.some((entry) => requiresConfirmation(entry.metadata)) || mcpDestructive
        ? "required"
        : "not-required",
      retry: { maxRetries, httpRetryable: facts.httpRetryable, idempotent: facts.idempotent },
      preRead: facts.preRead,
      postVerify: facts.postVerify,
      ambiguousTimeout: facts.ambiguousTimeout,
      consumesQueue: facts.consumesQueue,
      maxBatch: facts.maxBatch,
      mcp: {
        tools: mcpRows.map((row) => row.tool).sort(),
        destructiveHint: mcpDestructive,
        idempotentHint: mcpIdempotent,
      },
    };
  }

  const intentPrefixes = {
    design: ["survey.get", "survey.settings", "survey.jsonl-template"],
    create: ["survey.create"],
    publish: ["survey.status", "survey.url", "survey.preview-url", "survey.shortlink"],
    collect: ["response.query", "response.realtime", "response.submit", "response.download"],
    analyze: ["response.report", "response.winners", "analytics.nps", "analytics.csat", "analytics.anomalies", "analytics.compare"],
    admin: ["survey.delete", "survey.update-settings", "response.modify", "response.clear", "survey.clear-bin"],
    // These are CLI-only capability IDs in the matrix. Keep the prefix so
    // setup routing remains source-aligned instead of silently exporting an
    // empty route.
    setup: ["cli.init", "cli.diagnostics", "cli.schema-reference"],
  };
  // Ensure the policy module remains part of the source contract and defaults open for discovery.
  if (typeof defaultPolicyEvaluator.evaluate !== "function") throw new Error("invalid default policy evaluator");
  const intentRoutes = Object.fromEntries(Object.entries(intentPrefixes).map(([intent, ids]) => [intent, ids.filter((id) => supported.has(id))]));
  const hostRoutes = {
    "workbuddy": { protocol: "runtime-probe", probe: ["mcp-tools", "mcp-resources", "shell-wjx-version"], selection: "continue-existing-or-cli-setup-mcp-business", setup: "use host-provided credential configuration" },
    "cowork": { protocol: "runtime-probe", probe: ["mcp-tools", "mcp-resources", "shell-wjx-version"], selection: "continue-existing-or-cli-setup-mcp-business", setup: "use host-provided credential configuration" },
    "codex-work": { protocol: "runtime-probe", probe: ["mcp-tools", "mcp-resources", "shell-wjx-version"], selection: "continue-existing-or-cli-setup-mcp-business", setup: "use host-provided credential configuration" },
    "qianwen-work": { protocol: "runtime-probe", probe: ["mcp-tools", "mcp-resources", "shell-wjx-version"], selection: "continue-existing-or-cli-setup-mcp-business", setup: "use host-provided credential configuration" },
  };
  const verificationRules = [
    { id: "create-read-after-write", capabilityIds: ["survey.create", "survey.get", "survey.status", "survey.preview-url"].filter((id) => supported.has(id)) },
    { id: "write-unknown-outcome", capabilityIds: ["survey.create", "response.submit", "survey.update-settings"].filter((id) => supported.has(id)) },
    { id: "modify-response-read-after-write", capabilityIds: ["response.modify", "response.query"].filter((id) => supported.has(id)) },
    { id: "queue-counts", capabilityIds: ["response.realtime"].filter((id) => supported.has(id)) },
  ];
  const stopConditions = [
    "missing-or-invalid-credentials",
    "ambiguous-target-or-publish-intent",
    "unsupported-qtype-or-feature",
    "unsafe-ambiguous-timeout",
    "unverified-count-link-or-status",
  ];
  const generatedFrom = [
    "wjx-cli/src/lib/command-metadata.ts",
    "wjx-cli/src/lib/runtime/risk.ts",
    "wjx-cli/src/lib/runtime/confirmation.ts",
    "wjx-cli/src/lib/runtime/retry.ts",
    "wjx-cli/src/lib/policy.ts",
    "capabilities/capability-matrix.json",
    ...mcpContractSourcePaths,
  ];
  const serializedMcpAnnotations = JSON.stringify(mcpAnnotations);
  return {
    schemaVersion: 1,
    generatedFrom,
    sourceRevision: sourceRevision(generatedFrom, serializedMcpAnnotations),
    mergeRules: {
      scope: "Agent contract safety policy only; does not change CLI metadata or exit codes",
      risk: "max(cli-metadata-risk, high-risk-write when any mapped MCP destructiveHint is true)",
      idempotency: "false when CLI/SDK facts or any mapped MCP idempotentHint is false",
      confirmation: "required when CLI policy or any mapped MCP destructiveHint requires it",
    },
    intentRoutes,
    mcpAnnotations,
    operations: Object.fromEntries(Object.entries(operations).sort(([a], [b]) => a.localeCompare(b))),
    hostRoutes,
    verificationRules,
    stopConditions,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const contract = await createContract();
  const serialized = `${JSON.stringify(contract, null, 2)}\n`;
  writeFileSync(outputPath, serialized, "utf8");
  // CLI builds copy capability files before this exporter runs. Refresh the
  // packaged contract in place so a successful export cannot leave a stale
  // dist/capabilities artifact behind.
  if (existsSync(resolve(root, "wjx-cli", "dist"))) {
    mkdirSync(resolve(root, "wjx-cli", "dist", "capabilities"), { recursive: true });
    copyFileSync(outputPath, cliOutputPath);
  }
}
