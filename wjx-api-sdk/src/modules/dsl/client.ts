import type { FetchLike, WjxApiResponse, WjxCredentials } from "../../core/types.js";
import { callWjxApi, getWjxCredentials } from "../../core/api-client.js";
import { Action, LONG_TIMEOUT_MS } from "../../core/constants.js";
import type {
  CreateWjxDslSurveyInput,
  CreateWjxDslSurveyResult,
  QueryWjxDslInput,
  QueryWjxDslResult,
  UpdateWjxDslInput,
  UpdateWjxDslResult,
} from "./types.js";
import { generateWjxDsl } from "./validate.js";

function assertValidDsl(dsl: string): string {
  const result = generateWjxDsl(dsl);
  if (!result.valid) throw new TypeError(result.diagnostics.map((item) => item.message).join("；"));
  return result.dsl;
}

export async function queryWjxDsl<T = QueryWjxDslResult>(input: QueryWjxDslInput, credentials: WjxCredentials = getWjxCredentials(), fetchImpl: FetchLike = fetch): Promise<WjxApiResponse<T>> {
  return callWjxApi<T>({
    action: Action.QUERY_WJX_DSL,
    vid: input.vid,
    get_questions: input.get_questions ?? true,
    get_items: input.get_items ?? true,
    ...(input.get_exts === undefined ? {} : { get_exts: input.get_exts }),
    ...(input.get_setting === undefined ? {} : { get_setting: input.get_setting }),
    ...(input.get_page_cut === undefined ? {} : { get_page_cut: input.get_page_cut }),
    ...(input.get_tags === undefined ? {} : { get_tags: input.get_tags }),
    ...(input.showtitle === undefined ? {} : { showtitle: input.showtitle }),
  }, { credentials, fetchImpl });
}

export async function createSurveyByWjxDsl<T = CreateWjxDslSurveyResult>(input: CreateWjxDslSurveyInput, credentials: WjxCredentials = getWjxCredentials(), fetchImpl: FetchLike = fetch): Promise<WjxApiResponse<T>> {
  if (!input || typeof input.dsl !== "string") throw new TypeError("dsl must be a string");
  const dsl = assertValidDsl(input.dsl);
  return callWjxApi<T>({
    action: Action.CREATE_SURVEY_BY_WJX_DSL,
    dsl,
    ...(input.atype === undefined ? {} : { atype: input.atype }),
    ...(input.publish === undefined ? {} : { publish: input.publish }),
    ...(input.compress_img === undefined ? {} : { compress_img: input.compress_img }),
  }, { credentials, fetchImpl, maxRetries: 0, timeoutMs: LONG_TIMEOUT_MS });
}

export async function updateWjxDsl<T = UpdateWjxDslResult>(input: UpdateWjxDslInput, credentials: WjxCredentials = getWjxCredentials(), fetchImpl: FetchLike = fetch): Promise<WjxApiResponse<T>> {
  if (!input || typeof input.dsl !== "string") throw new TypeError("dsl must be a string");
  if (input.vid === undefined || input.vid === null || String(input.vid).trim() === "") throw new TypeError("vid must be provided");
  const dsl = assertValidDsl(input.dsl);
  return callWjxApi<T>({
    action: Action.UPDATE_WJX_DSL,
    vid: input.vid,
    dsl,
    ...(input.allowBreakingChanges === undefined ? {} : { allowBreakingChanges: input.allowBreakingChanges }),
  }, { credentials, fetchImpl, maxRetries: 0, timeoutMs: LONG_TIMEOUT_MS });
}
