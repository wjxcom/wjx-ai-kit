export interface QueryResponsesInput {
  vid: number;
  valid?: boolean;
  page_index?: number;
  page_size?: number;
  sort?: number;
  min_index?: number;
  jid?: string;
  sojumpparm?: string;
  qid?: string;
  begin_time?: number;
  end_time?: number;
  file_view_expires?: number;
  query_note?: boolean;
  distinct_user?: boolean;
  distinct_sojumpparm?: boolean;
  conds?: string;
}

export interface QueryResponsesRealtimeInput {
  vid: number;
  count?: number;
}

export interface DownloadResponsesInput {
  vid: number;
  taskid?: string;
  valid?: boolean;
  query_count?: number;
  begin_time?: number;
  end_time?: number;
  min_index?: number;
  qid?: string;
  sort?: number;
  query_type?: number;
  suffix?: number;
  query_record?: boolean;
}

export interface GetReportInput {
  vid: number;
  valid?: boolean;
  min_index?: number;
  jid?: string;
  sojumpparm?: string;
  begin_time?: number;
  end_time?: number;
  distinct_user?: boolean;
  distinct_sojumpparm?: boolean;
  conds?: string;
}

export interface SubmitResponseInput {
  vid: number;
  inputcosttime: number;
  submitdata: string;
  udsid?: number;
  sojumpparm?: string;
}

export interface GetFileLinksInput {
  vid: number;
  file_keys: string;
  file_view_expires?: number;
}

export interface GetWinnersInput {
  vid: number;
  atype?: number;
  awardstatus?: number;
  page_index?: number;
  page_size?: number;
}

export interface ModifyResponseInput {
  vid: number;
  jid: number;
  type: number;
  answers: string;
}

export interface Get360ReportInput {
  vid: number;
  taskid?: string;
}

export interface ClearResponsesInput {
  username: string;
  vid: number;
  reset_to_zero: boolean;
}
