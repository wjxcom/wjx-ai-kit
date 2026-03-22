export interface CreateSurveyInput {
  title: string;
  type: number;
  description: string;
  publish?: boolean;
  questions: string;
}

export interface CreateSurveyParams {
  action: string;
  appid: string;
  atype: number;
  desc: string;
  publish: boolean;
  questions: string;
  title: string;
  ts: string;
  sign: string;
}

export interface GetSurveyInput {
  vid: number;
  get_questions?: boolean;
  get_items?: boolean;
}

export interface ListSurveysInput {
  page_index?: number;
  page_size?: number;
  status?: number;
  atype?: number;
  name_like?: string;
  sort?: number;
}

export interface UpdateSurveyStatusInput {
  vid: number;
  state: number; // 1=发布, 2=暂停, 3=删除
}

export interface GetSurveySettingsInput {
  vid: number;
}

export interface UpdateSurveySettingsInput {
  vid: number;
  api_setting?: string;
  after_submit_setting?: string;
  msg_setting?: string;
  sojumpparm_setting?: string;
  time_setting?: string;
}

export interface DeleteSurveyInput {
  vid: number;
  username: string;
  completely_delete?: boolean;
}

export interface GetQuestionTagsInput {
  username: string;
}

export interface GetTagDetailsInput {
  tag_id: number;
}

export interface ClearRecycleBinInput {
  username: string;
  vid?: number;
}
