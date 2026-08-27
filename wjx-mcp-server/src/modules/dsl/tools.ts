import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { queryWjxDsl, createSurveyByWjxDsl, updateWjxDsl } from "./client.js";
import { toolResult, toolError } from "../../helpers.js";

const MAX_DSL_BYTES = 4 * 1024 * 1024;
const dslSchema = z.string().min(1).refine((v) => Buffer.byteLength(v, "utf8") <= MAX_DSL_BYTES, "DSL exceeds 4 MiB");
const vidSchema = z.union([z.string().min(1), z.number().int().positive()]);

/** Retained as a response-shaping helper for hosts that cap large payloads. */
export function limitWjxDslResult<T>(result: T, _detailLimit: number): T {
  return result;
}

async function invoke(fn: (input: any) => Promise<unknown>, input: unknown) {
  try {
    const result = await fn(input);
    return toolResult(result, typeof result === "object" && result !== null && (result as any).result === false);
  } catch (error) {
    return toolError(error);
  }
}

export interface WjxDslToolClient {
  queryWjxDsl: typeof queryWjxDsl;
  createSurveyByWjxDsl: typeof createSurveyByWjxDsl;
  updateWjxDsl: typeof updateWjxDsl;
}

const defaultClient: WjxDslToolClient = { queryWjxDsl, createSurveyByWjxDsl, updateWjxDsl };

export function registerDslTools(server: McpServer, client: WjxDslToolClient = defaultClient): void {
  server.registerTool("query_wjx_dsl", {
    title: "查询 WJX XML DSL 问卷",
    description: "使用传统编码 vid 查询问卷，并返回兼容旧查询 DTO 的完整 DSL。",
    inputSchema: { vid: vidSchema },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true, title: "查询 WJX XML DSL 问卷" },
  }, async (args) => invoke(client.queryWjxDsl, { vid: args.vid }));

  server.registerTool("create_survey_by_wjx_dsl", {
    title: "使用 WJX XML DSL 创建问卷",
    description: "使用现有问卷创建链路创建问卷，不提供服务端幂等 ID。",
    inputSchema: {
      dsl: dslSchema,
      atype: z.number().int().positive().optional(),
      publish: z.boolean().optional(),
      compress_img: z.boolean().optional(),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true, title: "使用 WJX XML DSL 创建问卷" },
  }, async (args) => invoke(client.createSurveyByWjxDsl, {
    dsl: args.dsl,
    ...(args.atype === undefined ? {} : { atype: args.atype }),
    ...(args.publish === undefined ? {} : { publish: args.publish }),
    ...(args.compress_img === undefined ? {} : { compress_img: args.compress_img }),
  }));

  server.registerTool("update_wjx_dsl", {
    title: "使用 WJX XML DSL 修改问卷",
    description: "使用现有问卷修改链路写入完整 DSL；If-Match 为可选弱前置校验。",
    inputSchema: {
      vid: vidSchema,
      dsl: dslSchema,
      if_match: z.string().min(1).max(200).optional(),
      allow_breaking_changes: z.boolean().optional(),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true, title: "使用 WJX XML DSL 修改问卷" },
  }, async (args) => invoke(client.updateWjxDsl, {
    vid: args.vid,
    dsl: args.dsl,
    ...(args.if_match === undefined ? {} : { ifMatch: args.if_match }),
    ...(args.allow_breaking_changes === undefined
      ? {}
      : { allowBreakingChanges: args.allow_breaking_changes }),
  }));
}
