export interface AddParticipantsInput {
  users: string;
  sysid: number;
}

export interface ModifyParticipantsInput {
  users: string;
  sysid: number;
  auto_create_udept?: boolean;
}

export interface DeleteParticipantsInput {
  uids: string; // JSON array of user IDs
  sysid: number;
}

export interface BindActivityInput {
  vid: number;
  sysid: number;
  uids: string;
  answer_times?: number;
  can_chg_answer?: boolean;
  can_view_result?: boolean;
  can_hide_qlist?: number;
}

export interface QuerySurveyBindingInput {
  vid: number;
  sysid: number;
  join_status?: number;
  day?: string;
  week?: string;
  month?: string;
  force_join_times?: boolean;
}

export interface QueryUserSurveysInput {
  uid: string;
  sysid: number;
}
