import { readFileSync, statSync } from "node:fs";
import { Command } from "commander";
import {
  createSurveyByWjxDsl,
  queryWjxDsl,
  updateWjxDsl,
} from "wjx-api-sdk";
import type { FetchLike, WjxCredentials } from "wjx-api-sdk";
import { getCredentials } from "../lib/auth.js";
import {
  createCapturingFetch,
  getMerged,
  isRequestPreview,
  printDryRunPreview,
  requireField,
  strictInt,
} from "../lib/command-helpers.js";
import { CliError, handleError } from "../lib/errors.js";
import { formatOutput } from "../lib/output.js";

const MAX_DSL_BYTES = 4 * 1024 * 1024;

interface DslApiResponse { result: boolean; data?: unknown; errormsg?: string; errorcode?: number }

function redactDslErrorMessage(message: string, input: object, redactDsl: boolean): string {
  if (!redactDsl) return message;
  let safe = message;
  const candidate = input as Record<string, unknown>;
  if (typeof candidate.dsl === "string" && candidate.dsl.length > 0) {
    safe = safe.split(candidate.dsl).join("[redacted DSL]");
  }
  if (typeof candidate.ifMatch === "string" && candidate.ifMatch.length > 0) {
    safe = safe.split(candidate.ifMatch).join("[redacted If-Match]");
  }
  return safe;
}

function getStdinData(command: Command): Record<string, unknown> | undefined {
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

function normalizeDslText(value: string, source: string): string {
  const dsl = value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
  const bytes = Buffer.byteLength(dsl, "utf8");
  if (bytes === 0 || dsl.trim().length === 0) throw new CliError("INPUT_ERROR", `${source} 中的 DSL 不能为空`);
  if (bytes > MAX_DSL_BYTES) throw new CliError("INPUT_ERROR", `${source} 中的 DSL 超过 4 MiB 限制`);
  return dsl;
}

function readDslFile(pathValue: unknown): string {
  if (typeof pathValue !== "string" || pathValue.length === 0) throw new CliError("INPUT_ERROR", "--file 必须是非空路径");
  try {
    if (statSync(pathValue).size > MAX_DSL_BYTES + 3) throw new CliError("INPUT_ERROR", "DSL 文件超过 4 MiB 限制");
    return normalizeDslText(new TextDecoder("utf-8", { fatal: true }).decode(readFileSync(pathValue)), `文件 ${pathValue}`);
  } catch (error) {
    if (error instanceof CliError) throw error;
    throw new CliError("INPUT_ERROR", `无法读取 UTF-8 DSL 文件: ${pathValue}`);
  }
}

function resolveDsl(command: Command): string {
  const stdinData = getStdinData(command);
  const cliDsl = command.getOptionValueSource("dsl") === "cli";
  const cliFile = command.getOptionValueSource("file") === "cli";
  const stdinRequested = hasGlobalFlag(command, "stdin");
  const stdinHasDsl = stdinData !== undefined && Object.prototype.hasOwnProperty.call(stdinData, "dsl");
  const count = Number(cliDsl) + Number(cliFile) + Number(stdinHasDsl);
  if (stdinRequested && (cliDsl || cliFile)) throw new CliError("INPUT_ERROR", "--stdin 与 --dsl/--file 互斥");
  if (count !== 1) throw new CliError("INPUT_ERROR", "必须且只能通过 --dsl、--file 或 stdin JSON 提供 DSL");
  if (cliFile) return readDslFile(command.opts().file);
  const value = cliDsl ? command.opts().dsl : stdinData?.dsl;
  if (typeof value !== "string") throw new CliError("INPUT_ERROR", "DSL 必须是字符串");
  return normalizeDslText(value, cliDsl ? "--dsl" : "stdin JSON");
}

function requireTraditionalVid(merged: Record<string, unknown>): string {
  requireField(merged, "vid", "vid");
  if (typeof merged.vid !== "string" || merged.vid.length === 0 ||
      merged.vid.trim() !== merged.vid || /[\u0000-\u001f\u007f]/.test(merged.vid)) {
    throw new CliError("INPUT_ERROR", "--vid 必须是有效的传统问卷 vid");
  }
  return merged.vid;
}

function validateToken(value: unknown, name: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value || /[\u0000-\u001f\u007f]/.test(value)) throw new CliError("INPUT_ERROR", `--${name} 含有非法字符`);
  return value;
}

async function executeDslCommand<TInput extends object>(
  program: Command,
  sdkFunction: (input: TInput, credentials: WjxCredentials, fetchImpl?: FetchLike) => Promise<DslApiResponse>,
  input: TInput,
  redactDsl = false,
): Promise<void> {
  try {
    const globalOptions = program.opts();
    const credentials = getCredentials(globalOptions);
    if (isRequestPreview(globalOptions)) {
      const { fetchImpl, getCapturedRequest } = createCapturingFetch();
      await sdkFunction(input, credentials, fetchImpl);
      printDryRunPreview(getCapturedRequest(), redactDsl ? { redactBodyFields: ["dsl"] } : undefined);
      return;
    }
    const response = await sdkFunction(input, credentials);
    if (response.result === false) {
      throw new CliError(
        "API_ERROR",
        redactDslErrorMessage(response.errormsg || "WJX DSL API 请求失败", input, redactDsl),
        { errorcode: response.errorcode, data: response.data },
      );
    }
    formatOutput(response, globalOptions);
  } catch (error) {
    handleError(error);
  }
}

function addDslSourceOptions(command: Command): Command {
  if (command.name() === "create") {
    command.option("--type <n>", "atype", strictInt)
      .option("--publish", "publish after create")
      .option("--compress-img", "compress images");
  }
  return command.option("--dsl <xml>", "直接提供 WJX XML DSL").option("--file <path>", "从 UTF-8 文件读取 WJX XML DSL");
}

export function registerDslCommands(program: Command): void {
  const dsl = program.command("dsl").description("使用 WJX XML DSL 查询、创建和修改问卷");

  dsl.command("query").description("查询传统 vid 问卷并返回 DSL").requiredOption("--vid <vid>", "传统编码问卷 vid").action(async (_options, command) => {
    const merged = getMerged(command);
    if (typeof merged.vid !== "string" || merged.vid.length === 0) throw new CliError("INPUT_ERROR", "--vid 必须是传统问卷 vid");
    await executeDslCommand(program, queryWjxDsl, { vid: merged.vid });
  });

  addDslSourceOptions(dsl.command("create").description("使用 WJX XML DSL 创建问卷")).action(async (_options, command) => {
    const merged = getMerged(command);
    const atype = merged.atype ?? merged.type;
    const publish = merged.publish;
    const compressImg = merged.compress_img ?? merged.compressImg;
    await executeDslCommand(program, createSurveyByWjxDsl, {
      dsl: resolveDsl(command),
      ...(typeof atype === "number" ? { atype } : {}),
      ...(typeof publish === "boolean" ? { publish } : {}),
      ...(typeof compressImg === "boolean" ? { compress_img: compressImg } : {}),
    }, true);
  });

  addDslSourceOptions(dsl.command("update").description("使用 WJX XML DSL 修改问卷").requiredOption("--vid <vid>", "传统编码问卷 vid").option("--if-match <etag>", "可选的 If-Match 弱前置校验").option("--allow-breaking-changes", "显式允许 breaking change（仅无答卷时有效）")).action(async (_options, command) => {
    const merged = getMerged(command);
    await executeDslCommand(program, updateWjxDsl, {
      vid: requireTraditionalVid(merged),
      dsl: resolveDsl(command),
      ifMatch: validateToken(merged.ifMatch, "if-match"),
      ...(merged.allowBreakingChanges === true
        ? { allowBreakingChanges: true }
        : {}),
    }, true);
  });
}
