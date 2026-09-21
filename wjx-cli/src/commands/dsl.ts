import { readFileSync, writeFileSync, statSync } from "node:fs";
import { Command } from "commander";
import {
  createSurveyByWjxDsl,
  generateWjxDsl,
  queryWjxDsl,
  updateWjxDsl,
  verifyWjxDslWrite,
} from "wjx-api-sdk";
import { getMerged, requireField, strictInt } from "../lib/command-helpers.js";
import { CliError, handleError } from "../lib/errors.js";
import { formatOutput } from "../lib/output.js";
import { executeRuntimeAction } from "../lib/runtime/executor.js";
import { materializeDslAssets } from "../lib/dsl-assets.js";

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
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return String(value);
  if (typeof value !== "string" || !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) <= 0) {
    throw new CliError("INPUT_ERROR", "--vid 必须是正整数传统问卷编号，不能使用 sid");
  }
  return value;
}

function addDslInput(command: Command): Command {
  return command.option("--dsl <text>", "AI 生成的 WJX XML DSL").option("--file <path>", "从 UTF-8 文件读取 WJX XML DSL");
}

export function registerDslCommands(program: Command): void {
  const dsl = program.command("dsl").description("使用 WJX XML DSL 查询、校验、创建和修改问卷");

  dsl.command("query").description("查询传统 vid 问卷并返回 DSL")
    .option("--vid <vid>", "传统编码问卷 vid")
    .option("--get-exts", "读取文件扩展名配置")
    .option("--get-setting", "读取问卷设置")
    .option("--get-page-cut", "读取分页和段落结构")
    .option("--get-tags", "读取题目标签")
    .option("--showtitle", "读取标题字段")
    .action(async (_options, command) => {
    const merged = getMerged(command);
    requireField(merged, "vid");
    await executeRuntimeAction(program, command, queryWjxDsl, (values) => ({
      vid: requireTraditionalVid(values.vid),
      ...((values.getExts ?? values.get_exts) === undefined ? {} : { get_exts: values.getExts ?? values.get_exts }),
      ...((values.getSetting ?? values.get_setting) === undefined ? {} : { get_setting: values.getSetting ?? values.get_setting }),
      ...((values.getPageCut ?? values.get_page_cut) === undefined ? {} : { get_page_cut: values.getPageCut ?? values.get_page_cut }),
      ...((values.getTags ?? values.get_tags) === undefined ? {} : { get_tags: values.getTags ?? values.get_tags }),
      ...(values.showtitle === undefined ? {} : { showtitle: values.showtitle }),
    }));
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

  addDslInput(dsl.command("create").description("提交 AI 生成的 WJX XML DSL 创建问卷").option("--type <n>", "问卷类型", strictInt).option("--publish", "创建后发布").option("--compress-img", "压缩图片").option("--assets <path>", "素材清单 JSON；上传并替换 {{asset:id}} 占位符")).action(async (_options, command) => {
    const merged = getMerged(command);
    await executeRuntimeAction(program, command, createSurveyByWjxDsl, () => ({
      dsl: resolveDsl(command, _options),
      ...(merged.type === undefined ? {} : { atype: merged.type as number }),
      ...(merged.publish === undefined ? {} : { publish: merged.publish as boolean }),
      ...((merged.compress_img ?? merged.compressImg) === undefined ? {} : { compress_img: (merged.compress_img ?? merged.compressImg) as boolean }),
    }), {
      postVerify: async (result, input, credentials) => {
        const data = result.result === true && result.data && typeof result.data === "object"
          ? result.data as Record<string, unknown>
          : {};
        const rawVid = data.vid;
        const resolvedVid = typeof rawVid === "number" || typeof rawVid === "string" ? rawVid : undefined;
        if (resolvedVid === undefined) {
          return { verification: { structure: false, status: false, link: false }, outcome: "unknown", warnings: ["DSL create response did not include a verifiable vid"] };
        }
        try {
          const linkHint = [data.fill_url, data.fillUrl, data.pc_path, data.pcPath, data.mobile_path, data.mobilePath, data.sid]
            .find((value): value is string => typeof value === "string" && value.trim().length > 0);
          return await verifyWjxDslWrite({ vid: resolvedVid, expectedDsl: String(input.dsl), ...(linkHint ? { linkHint } : {}), credentials });
        } catch (error) {
          return { verification: { structure: false, status: false, link: false }, outcome: "unknown", warnings: ["DSL create read-back failed", error instanceof Error ? error.message : String(error)] };
        }
      },
      transformInput: async (input, credentials) => {
        if (typeof merged.assets !== "string" || !merged.assets.trim()) return input;
        const materialized = await materializeDslAssets(String(input.dsl), merged.assets, credentials);
        return { ...input, dsl: materialized.dsl };
      },
    });
  });

  addDslInput(dsl.command("update").description("使用 action A1000110 修改传统问卷；AI 主页请使用 survey update-ai-page").option("--vid <vid>", "传统编码问卷 vid").option("--allow-breaking-changes", "显式允许 breaking change（仅无答卷时有效）").option("--assets <path>", "素材清单 JSON；上传并替换 {{asset:id}} 占位符")).action(async (_options, command) => {
    const merged = getMerged(command);
    requireField(merged, "vid");
    await executeRuntimeAction(program, command, updateWjxDsl, (values) => ({
      vid: requireTraditionalVid(merged.vid),
      dsl: resolveDsl(command, _options),
      ...((merged.allowBreakingChanges ?? merged.allow_breaking_changes) === true ? { allowBreakingChanges: true } : {}),
    }), {
      preRead: async (input, credentials) => {
        const current = await queryWjxDsl({ vid: input.vid as string, get_questions: true, get_items: true }, credentials);
        if (current.result !== true) {
          throw new CliError(
            "API_ERROR",
            current.errormsg || `无法读取传统问卷 ${String(input.vid)} 的当前 DSL；AI 主页请改用 survey update-ai-page`,
            {
              action: "1000006",
              intendedAction: "1000110",
              vid: input.vid,
              ...(current.errorcode === undefined ? {} : { errorcode: current.errorcode }),
              ...(current.traceid === undefined ? {} : { traceid: current.traceid }),
            },
          );
        }
        const data = current.data && typeof current.data === "object" ? current.data as unknown as Record<string, unknown> : {};
        const readVid = data.vid ?? data.activity_id ?? data.activityId;
        if (String(readVid ?? "") !== String(input.vid)) throw new CliError("API_ERROR", `问卷 ${String(input.vid)} 的读回身份不匹配或缺少编号，已停止更新`);
        if (String(data.atype ?? data.activity_type ?? "") === "12") {
          throw new CliError("INPUT_ERROR", `问卷 ${String(input.vid)} 是 AI 主页，不能使用 dsl update；请改用 survey update-ai-page`);
        }
        if (typeof data.dsl !== "string" || !data.dsl.trim()) {
          throw new CliError("API_ERROR", `问卷 ${String(input.vid)} 的读回结果缺少完整 DSL，已停止更新；AI 主页请改用 survey update-ai-page`);
        }
        return data;
      },
      requiredVerification: ["structure", "status"],
      postVerify: async (result, input, credentials) => {
        try {
          return await verifyWjxDslWrite({ vid: input.vid as string, expectedDsl: String(input.dsl), requireLink: false, credentials });
        } catch (error) {
          return { verification: { structure: false, status: false, link: true }, outcome: "unknown", warnings: ["DSL update read-back failed", error instanceof Error ? error.message : String(error)] };
        }
      },
      transformInput: async (input, credentials) => {
        if (typeof merged.assets !== "string" || !merged.assets.trim()) return input;
        const materialized = await materializeDslAssets(String(input.dsl), merged.assets, credentials);
        return { ...input, dsl: materialized.dsl };
      },
    });
  });
}
