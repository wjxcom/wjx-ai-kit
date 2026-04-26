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
  submittime?: string;
  /**
   * 问卷版本号。问卷星服务端校验：发布/编辑会让问卷 version 自增，
   * 提交时若不传或传旧值会被服务端拒绝（"问卷已被修改请刷新"）。
   * 推荐先 getSurvey 拿到 data.version 再传入；CLI 默认会自动注入。
   */
  jpmversion?: number;
}

export interface SubmitdataQuestionMeta {
  q_index: number;
  q_type: number;
  q_subtype: number;
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
  type: 1;
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
