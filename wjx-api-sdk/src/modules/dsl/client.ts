import type {
  FetchLike,
  WjxApiResponse,
  WjxCredentials,
} from "../../core/types.js";
import { callWjxApi, getWjxCredentials } from "../../core/api-client.js";
import { Action, LONG_TIMEOUT_MS } from "../../core/constants.js";
import type {
  CreateWjxDslSurveyInput,
  CreateWjxDslSurveyResult,
  QueryWjxDslInput,
  QueryWjxDslResult,
  UpdateWjxDslInput,
  UpdateWjxDslResult,
  WjxDslFailureData,
} from "./types.js";

export async function queryWjxDsl<T = QueryWjxDslResult>(
  input: QueryWjxDslInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
): Promise<WjxApiResponse<T, WjxDslFailureData>> {
  const params: Record<string, unknown> = {
    action: Action.QUERY_WJX_DSL,
    vid: input.vid,
    get_questions: input.get_questions ?? true,
    get_items: input.get_items ?? true,
  };
  if (input.get_exts !== undefined) params.get_exts = input.get_exts;
  if (input.get_setting !== undefined) params.get_setting = input.get_setting;
  if (input.get_page_cut !== undefined) params.get_page_cut = input.get_page_cut;
  if (input.get_tags !== undefined) params.get_tags = input.get_tags;
  if (input.showtitle !== undefined) params.showtitle = input.showtitle;
  return callWjxApi<T, WjxDslFailureData>(params, { credentials, fetchImpl });
}

export async function createSurveyByWjxDsl<T = CreateWjxDslSurveyResult>(
  input: CreateWjxDslSurveyInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
): Promise<WjxApiResponse<T, WjxDslFailureData>> {
  return callWjxApi<T, WjxDslFailureData>(
    {
      action: Action.CREATE_SURVEY_BY_WJX_DSL,
      dsl: input.dsl,
      ...(input.atype !== undefined ? { atype: input.atype } : {}),
      ...(input.publish !== undefined ? { publish: input.publish } : {}),
      ...(input.compress_img !== undefined ? { compress_img: input.compress_img } : {}),
    },
    {
      credentials,
      fetchImpl,
      maxRetries: 0,
      timeoutMs: LONG_TIMEOUT_MS,
    },
  );
}

export async function updateWjxDsl<T = UpdateWjxDslResult>(
  input: UpdateWjxDslInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
): Promise<WjxApiResponse<T, WjxDslFailureData>> {
  return callWjxApi<T, WjxDslFailureData>(
    {
      action: Action.UPDATE_WJX_DSL,
      vid: input.vid,
      dsl: input.dsl,
      ...(input.allowBreakingChanges === undefined
        ? {}
        : { allowBreakingChanges: input.allowBreakingChanges }),
    },
    {
      credentials,
      fetchImpl,
      ifMatch: input.ifMatch,
      maxRetries: 0,
      timeoutMs: LONG_TIMEOUT_MS,
    },
  );
}
