import type { WjxApiResponse, WjxCredentials, FetchLike, SignableRecord } from "../../core/types.js";
import { Action } from "../../core/constants.js";
import { callWjxApi, getWjxCredentials } from "../../core/api-client.js";
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
  timestamp?: string,
): Promise<WjxApiResponse<T>> {
  const params: SignableRecord = {
    action: Action.QUERY_RESPONSES,
    vid: input.vid,
  };
  if (input.valid !== undefined) params.valid = input.valid;
  if (input.page_index !== undefined) params.page_index = input.page_index;
  if (input.page_size !== undefined) params.page_size = input.page_size;
  if (input.sort !== undefined) params.sort = input.sort;
  if (input.min_index !== undefined) params.min_index = input.min_index;
  if (input.jid !== undefined) params.jid = input.jid;
  if (input.sojumpparm !== undefined) params.sojumpparm = input.sojumpparm;
  if (input.qid !== undefined) params.qid = input.qid;
  if (input.begin_time !== undefined) params.begin_time = input.begin_time;
  if (input.end_time !== undefined) params.end_time = input.end_time;
  if (input.file_view_expires !== undefined) params.file_view_expires = input.file_view_expires;
  if (input.query_note !== undefined) params.query_note = input.query_note;
  if (input.distinct_user !== undefined) params.distinct_user = input.distinct_user;
  if (input.distinct_sojumpparm !== undefined) params.distinct_sojumpparm = input.distinct_sojumpparm;
  if (input.conds !== undefined) params.conds = input.conds;

  return callWjxApi<T>(params, { credentials, fetchImpl, timestamp });
}

export async function queryResponsesRealtime<T = unknown>(
  input: QueryResponsesRealtimeInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
  timestamp?: string,
): Promise<WjxApiResponse<T>> {
  const params: SignableRecord = {
    action: Action.QUERY_RESPONSES_REALTIME,
    vid: input.vid,
  };
  if (input.count !== undefined) params.count = input.count;

  return callWjxApi<T>(params, { credentials, fetchImpl, timestamp, maxRetries: 0 });
}

export async function downloadResponses<T = unknown>(
  input: DownloadResponsesInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
  timestamp?: string,
): Promise<WjxApiResponse<T>> {
  const params: SignableRecord = {
    action: Action.DOWNLOAD_RESPONSES,
    vid: input.vid,
  };
  if (input.taskid !== undefined) params.taskid = input.taskid;
  if (input.valid !== undefined) params.valid = input.valid;
  if (input.query_count !== undefined) params.query_count = input.query_count;
  if (input.begin_time !== undefined) params.begin_time = input.begin_time;
  if (input.end_time !== undefined) params.end_time = input.end_time;
  if (input.min_index !== undefined) params.min_index = input.min_index;
  if (input.qid !== undefined) params.qid = input.qid;
  if (input.sort !== undefined) params.sort = input.sort;
  if (input.query_type !== undefined) params.query_type = input.query_type;
  if (input.suffix !== undefined) params.suffix = input.suffix;
  if (input.query_record !== undefined) params.query_record = input.query_record;

  return callWjxApi<T>(params, { credentials, fetchImpl, timestamp });
}

export async function getReport<T = unknown>(
  input: GetReportInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
  timestamp?: string,
): Promise<WjxApiResponse<T>> {
  const params: SignableRecord = {
    action: Action.GET_REPORT,
    vid: input.vid,
  };
  if (input.valid !== undefined) params.valid = input.valid;
  if (input.min_index !== undefined) params.min_index = input.min_index;
  if (input.jid !== undefined) params.jid = input.jid;
  if (input.sojumpparm !== undefined) params.sojumpparm = input.sojumpparm;
  if (input.begin_time !== undefined) params.begin_time = input.begin_time;
  if (input.end_time !== undefined) params.end_time = input.end_time;
  if (input.distinct_user !== undefined) params.distinct_user = input.distinct_user;
  if (input.distinct_sojumpparm !== undefined) params.distinct_sojumpparm = input.distinct_sojumpparm;
  if (input.conds !== undefined) params.conds = input.conds;

  return callWjxApi<T>(params, { credentials, fetchImpl, timestamp });
}

export async function submitResponse<T = unknown>(
  input: SubmitResponseInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
  timestamp?: string,
): Promise<WjxApiResponse<T>> {
  const params: SignableRecord = {
    action: Action.SUBMIT_RESPONSE,
    vid: input.vid,
    inputcosttime: input.inputcosttime,
    submitdata: input.submitdata,
  };
  if (input.udsid !== undefined) params.udsid = input.udsid;
  if (input.sojumpparm !== undefined) params.sojumpparm = input.sojumpparm;
  if (input.submittime !== undefined) params.submittime = input.submittime;

  return callWjxApi<T>(params, { credentials, fetchImpl, timestamp, maxRetries: 0 });
}

export async function getFileLinks<T = unknown>(
  input: GetFileLinksInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
  timestamp?: string,
): Promise<WjxApiResponse<T>> {
  const params: SignableRecord = {
    action: Action.GET_FILE_LINKS,
    vid: input.vid,
    file_keys: input.file_keys,
  };
  if (input.file_view_expires !== undefined) params.file_view_expires = input.file_view_expires;

  return callWjxApi<T>(params, { credentials, fetchImpl, timestamp });
}

export async function getWinners<T = unknown>(
  input: GetWinnersInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
  timestamp?: string,
): Promise<WjxApiResponse<T>> {
  const params: SignableRecord = {
    action: Action.GET_WINNERS,
    vid: input.vid,
  };
  if (input.atype !== undefined) params.atype = input.atype;
  if (input.awardstatus !== undefined) params.awardstatus = input.awardstatus;
  if (input.page_index !== undefined) params.page_index = input.page_index;
  if (input.page_size !== undefined) params.page_size = input.page_size;

  return callWjxApi<T>(params, { credentials, fetchImpl, timestamp });
}

export async function modifyResponse<T = unknown>(
  input: ModifyResponseInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
  timestamp?: string,
): Promise<WjxApiResponse<T>> {
  return callWjxApi<T>(
    {
      action: Action.MODIFY_RESPONSE,
      vid: input.vid,
      jid: input.jid,
      type: input.type,
      answers: input.answers,
    },
    { credentials, fetchImpl, timestamp, maxRetries: 0 },
  );
}

export async function get360Report<T = unknown>(
  input: Get360ReportInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
  timestamp?: string,
): Promise<WjxApiResponse<T>> {
  const params: SignableRecord = {
    action: Action.GET_360_REPORT,
    vid: input.vid,
  };
  if (input.taskid !== undefined) params.taskid = input.taskid;

  return callWjxApi<T>(params, { credentials, fetchImpl, timestamp, maxRetries: 0 });
}

export async function clearResponses<T = unknown>(
  input: ClearResponsesInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
  timestamp?: string,
): Promise<WjxApiResponse<T>> {
  return callWjxApi<T>(
    {
      action: Action.CLEAR_RESPONSES,
      username: input.username,
      vid: input.vid,
      reset_to_zero: input.reset_to_zero,
    },
    { credentials, fetchImpl, timestamp, maxRetries: 0 },
  );
}
