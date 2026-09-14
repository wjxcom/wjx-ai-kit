import { readFileSync, writeFileSync, statSync } from "node:fs";
import { Command } from "commander";
import {
  createSurveyByWjxDsl,
  generateWjxDsl,
  queryWjxDsl,
  updateWjxDsl,
} from "wjx-api-sdk";
import { getMerged, requireField, strictInt } from "../lib/command-helpers.js";
import { CliError, handleError } from "../lib/errors.js";
import { formatOutput } from "../lib/output.js";
import { executeRuntimeAction } from "../lib/runtime/executor.js";

const MAX_DSL_BYTES = 4 * 1024 * 1024;
function stdinData(command: Command): Record<string, unknown> | undefined {
  return (command as unknown as Record<string, unknown>).__stdinData as Record<string, unknown> | undefined;
}

function hasGlobalFlag(command: Command, name: string): boolean {
  let current: Command | null | undefined = command;
  while (current) {
    if ((current.opts() as Record<string, unknown>)[name] === true) return true;
    current = current.parent;
  }
  return false;
}

function normalizeDsl(value: unknown, source: string): string {
  if (typeof value !== "string") throw new CliError("INPUT_ERROR", `${source} 必须是字符串`);
  const dsl = value.replace(/^\uFEFF/, "");
  if (!dsl.trim()) throw new CliError("INPUT_ERROR", `${source} 中的 DSL 不能为空`);
  if (Buffer.byteLength(dsl, "utf8") > MAX_DSL_BYTES) throw new CliError("INPUT_ERROR", `${source} 中的 DSL 超过 4 MiB 限制`);
  return dsl;
}

function readDslFile(pathValue: unknown): string {
  if (typeof pathValue !== "string" || !pathValue.trim()) throw new CliError("INPUT_ERROR", "--file 必须是非空路径");
  try {
    if (statSync(pathValue).size > MAX_DSL_BYTES + 4) throw new CliError("INPUT_ERROR", "DSL 文件超过 4 MiB 限制");
    return normalizeDsl(new TextDecoder("utf-8", { fatal: true }).decode(readFileSync(pathValue)), `文件 ${pathValue}`);
  } catch (error) {
    if (error instanceof CliError) throw error;
    throw new CliError("INPUT_ERROR", `无法读取 UTF-8 DSL 文件: ${pathValue}`);
  }
}

function resolveDsl(command: Command, actionOptions?: unknown): string {
  const actionOpts = actionOptions instanceof Command
    ? actionOptions.opts() as Record<string, unknown>
    : actionOptions && typeof actionOptions === "object" ? actionOptions as Record<string, unknown> : {};
  const fromStdin = stdinData(command);
  // `getMerged()` includes stdin values; use the action options here so a
  // stdin `dsl` field is not mistaken for an explicit `--dsl` flag.
  const hasDsl = typeof actionOpts.dsl === "string" && actionOpts.dsl.length > 0;
  const hasFile = typeof actionOpts.file === "string" && actionOpts.file.length > 0;
  const stdinRequested = hasGlobalFlag(command, "stdin");
  const stdinDsl = Boolean(fromStdin && Object.prototype.hasOwnProperty.call(fromStdin, "dsl"));
  if (stdinRequested && (hasDsl || hasFile)) throw new CliError("INPUT_ERROR", "--stdin 与 --dsl/--file 互斥");
  if (Number(hasDsl) + Number(hasFile) + Number(stdinDsl) !== 1) throw new CliError("INPUT_ERROR", "必须且只能通过 --dsl、--file 或 stdin JSON 提供 DSL");
  if (hasFile) return readDslFile(actionOpts.file);
  return normalizeDsl(hasDsl ? actionOpts.dsl : fromStdin?.dsl, hasDsl ? "--dsl" : "stdin JSON");
}

function requireTraditionalVid(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.trim() !== value || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new CliError("INPUT_ERROR", "--vid 必须是有效的传统问卷 vid");
  }
  return value;
}

function addDslInput(command: Command): Command {
  return command.option("--dsl <text>", "AI 生成的 WJX XML DSL").option("--file <path>", "从 UTF-8 文件读取 WJX XML DSL");
}

export function registerDslCommands(program: Command): void {
  const dsl = program.command("dsl").description("使用 WJX XML DSL 查询、校验、创建和修改问卷");

  dsl.command("query").description("查询传统 vid 问卷并返回 DSL").option("--vid <vid>", "传统编码问卷 vid").action(async (_options, command) => {
    const merged = getMerged(command);
    requireField(merged, "vid");
    await executeRuntimeAction(program, command, queryWjxDsl, (values) => ({ vid: requireTraditionalVid(values.vid) }));
  });

  addDslInput(dsl.command("generate").description("校验并规范化 AI 生成的 DSL").option("--out <path>", "将规范化 DSL 写入文件")).action(async (_options, command) => {
    try {
      const dslText = resolveDsl(command, _options);
      const result = generateWjxDsl(dslText);
      const options = program.opts();
      if (!result.valid) throw new CliError("INPUT_ERROR", result.diagnostics.map((item) => item.message).join("；"), { data: result });
      if (typeof command.opts().out === "string") writeFileSync(command.opts().out, result.dsl, "utf8");
      if (options.format === "table" || command.opts().out === undefined) console.log(result.dsl);
      else formatOutput(result, options);
    } catch (error) { handleError(error); }
  });

  addDslInput(dsl.command("create").description("提交 AI 生成的 WJX XML DSL 创建问卷").option("--type <n>", "问卷类型", strictInt).option("--publish", "创建后发布").option("--compress-img", "压缩图片")).action(async (_options, command) => {
    const merged = getMerged(command);
    await executeRuntimeAction(program, command, createSurveyByWjxDsl, () => ({
      dsl: resolveDsl(command, _options),
      ...(merged.type === undefined ? {} : { atype: merged.type as number }),
      ...(merged.publish === undefined ? {} : { publish: merged.publish as boolean }),
      ...((merged.compress_img ?? merged.compressImg) === undefined ? {} : { compress_img: (merged.compress_img ?? merged.compressImg) as boolean }),
    }));
  });

  addDslInput(dsl.command("update").description("提交 AI 生成的完整 DSL 修改问卷").option("--vid <vid>", "传统编码问卷 vid").option("--allow-breaking-changes", "显式允许 breaking change（仅无答卷时有效）")).action(async (_options, command) => {
    const merged = getMerged(command);
    requireField(merged, "vid");
    await executeRuntimeAction(program, command, updateWjxDsl, (values) => ({
      vid: requireTraditionalVid(merged.vid),
      dsl: resolveDsl(command, _options),
      ...((merged.allowBreakingChanges ?? merged.allow_breaking_changes) === true ? { allowBreakingChanges: true } : {}),
    }));
  });
}
