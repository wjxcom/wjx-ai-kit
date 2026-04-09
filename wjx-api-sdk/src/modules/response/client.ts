import type { WjxApiResponse, WjxCredentials, FetchLike } from "../../core/types.js";
import { Action, LONG_TIMEOUT_MS } from "../../core/constants.js";
import { callWjxApi, getWjxCredentials, assignDefined } from "../../core/api-client.js";
import type {
  QueryResponsesInput,
  QueryResponsesRealtimeInput,
  DownloadResponsesInput,
  GetReportInput,
  SubmitResponseInput,
  GetFileLinksInput,
  GetWinnersInput,
  ModifyResponseInput,
  Get360ReportInput,
  ClearResponsesInput,
} from "./types.js";

export async function queryResponses<T = unknown>(
  input: QueryResponsesInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
): Promise<WjxApiResponse<T>> {
  const params: Record<string, unknown> = {
    action: Action.QUERY_RESPONSES,
    vid: input.vid,
  };
  assignDefined(params, input, [
    "valid", "page_index", "page_size", "sort", "min_index", "jid",
    "sojumpparm", "qid", "begin_time", "end_time", "file_view_expires",
    "query_note", "distinct_user", "distinct_sojumpparm", "conds",
  ]);

  return callWjxApi<T>(params, { credentials, fetchImpl });
}

export async function queryResponsesRealtime<T = unknown>(
  input: QueryResponsesRealtimeInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
): Promise<WjxApiResponse<T>> {
  const params: Record<string, unknown> = {
    action: Action.QUERY_RESPONSES_REALTIME,
    vid: input.vid,
  };
  if (input.count !== undefined) params.count = input.count;

  return callWjxApi<T>(params, { credentials, fetchImpl, maxRetries: 0 });
}

export async function downloadResponses<T = unknown>(
  input: DownloadResponsesInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
): Promise<WjxApiResponse<T>> {
  const params: Record<string, unknown> = {
    action: Action.DOWNLOAD_RESPONSES,
    vid: input.vid,
  };
  assignDefined(params, input, [
    "taskid", "valid", "query_count", "begin_time", "end_time",
    "min_index", "qid", "sort", "query_type", "suffix", "query_record",
  ]);

  return callWjxApi<T>(params, { credentials, fetchImpl, timeoutMs: LONG_TIMEOUT_MS });
}

export async function getReport<T = unknown>(
  input: GetReportInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
): Promise<WjxApiResponse<T>> {
  const params: Record<string, unknown> = {
    action: Action.GET_REPORT,
    vid: input.vid,
  };
  assignDefined(params, input, [
    "valid", "min_index", "jid", "sojumpparm", "begin_time", "end_time",
    "distinct_user", "distinct_sojumpparm", "conds",
  ]);

  return callWjxApi<T>(params, { credentials, fetchImpl, timeoutMs: LONG_TIMEOUT_MS });
}

export async function submitResponse<T = unknown>(
  input: SubmitResponseInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
): Promise<WjxApiResponse<T>> {
  const params: Record<string, unknown> = {
    action: Action.SUBMIT_RESPONSE,
    vid: input.vid,
    inputcosttime: input.inputcosttime,
    submitdata: input.submitdata,
  };
  assignDefined(params, input, ["udsid", "sojumpparm", "submittime"]);

  return callWjxApi<T>(params, { credentials, fetchImpl, maxRetries: 0 });
}

export async function getFileLinks<T = unknown>(
  input: GetFileLinksInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
): Promise<WjxApiResponse<T>> {
  const params: Record<string, unknown> = {
    action: Action.GET_FILE_LINKS,
    vid: input.vid,
    file_keys: input.file_keys,
  };
  assignDefined(params, input, ["file_view_expires"]);

  return callWjxApi<T>(params, { credentials, fetchImpl });
}

export async function getWinners<T = unknown>(
  input: GetWinnersInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
): Promise<WjxApiResponse<T>> {
  const params: Record<string, unknown> = {
    action: Action.GET_WINNERS,
    vid: input.vid,
  };
  assignDefined(params, input, ["atype", "awardstatus", "page_index", "page_size"]);

  return callWjxApi<T>(params, { credentials, fetchImpl });
}

export async function modifyResponse<T = unknown>(
  input: ModifyResponseInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
): Promise<WjxApiResponse<T>> {
  return callWjxApi<T>(
    {
      action: Action.MODIFY_RESPONSE,
      vid: input.vid,
      jid: input.jid,
      type: input.type,
      answers: input.answers,
    },
    { credentials, fetchImpl, maxRetries: 0 },
  );
}

export async function get360Report<T = unknown>(
  input: Get360ReportInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
): Promise<WjxApiResponse<T>> {
  const params: Record<string, unknown> = {
    action: Action.GET_360_REPORT,
    vid: input.vid,
  };
  assignDefined(params, input, ["taskid"]);

  return callWjxApi<T>(params, { credentials, fetchImpl, maxRetries: 0, timeoutMs: LONG_TIMEOUT_MS });
}

export async function clearResponses<T = unknown>(
  input: ClearResponsesInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
): Promise<WjxApiResponse<T>> {
  return callWjxApi<T>(
    {
      action: Action.CLEAR_RESPONSES,
      username: input.username,
      vid: input.vid,
      reset_to_zero: input.reset_to_zero,
    },
    { credentials, fetchImpl, maxRetries: 0 },
  );
}
