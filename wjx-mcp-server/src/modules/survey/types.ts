export interface CreateSurveyInput {
  title: string;
  type: number;
  description: string;
  publish?: boolean;
  questions: string;
  creater?: string;
  source_vid?: string;
  compress_img?: boolean;
  is_string?: boolean;
}

export interface UploadFileInput {
  file_name: string;
  file: string;
}

export interface GetSurveyInput {
  vid: number;
  get_questions?: boolean;
  get_items?: boolean;
  get_exts?: boolean;
  get_setting?: boolean;
  get_page_cut?: boolean;
  get_tags?: boolean;
  showtitle?: boolean;
}

export interface ListSurveysInput {
  page_index?: number;
  page_size?: number;
  status?: number;
  atype?: number;
  name_like?: string;
  sort?: number;
  creater?: string;
  folder?: string;
  is_xingbiao?: boolean;
  query_all?: boolean;
  verify_status?: number;
  time_type?: number;
  begin_time?: number;
  end_time?: number;
}

export interface UpdateSurveyStatusInput {
  vid: number;
  state: number; // 1=发布, 2=暂停, 3=删除
}

export interface GetSurveySettingsInput {
  vid: number;
  additional_setting?: string;
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
