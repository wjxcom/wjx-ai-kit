export interface AddParticipantsInput {
  username: string;
  users: string;
  sysid: number;
}

export interface ModifyParticipantsInput {
  username: string;
  users: string;
  sysid: number;
  auto_create_udept?: boolean;
}

export interface DeleteParticipantsInput {
  username: string;
  uids: string; // JSON array of user IDs
  sysid: number;
}

export interface BindActivityInput {
  username: string;
  vid: number;
  sysid: number;
  uids: string;
  answer_times?: number;
  can_chg_answer?: boolean;
  can_view_result?: boolean;
  can_hide_qlist?: number;
}

export interface QuerySurveyBindingInput {
  username: string;
  vid: number;
  sysid: number;
  join_status?: number;
  day?: string;
  week?: string;
  month?: string;
  force_join_times?: boolean;
}

export interface QueryUserSurveysInput {
  username: string;
  uid: string;
  sysid: number;
}
