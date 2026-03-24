export interface AddParticipantsInput {
  username: string;
  users: string;
  sysid: number;
}

export interface ModifyParticipantsInput {
  username: string;
  users: string;
  sysid: number;
}

export interface DeleteParticipantsInput {
  username: string;
  uids: string; // JSON array of user IDs
  sysid: number;
}

export interface QuerySurveyBindingInput {
  username: string;
  vid: number;
  sysid: number;
  page_index?: number;
  page_size?: number;
}

export interface QueryUserSurveysInput {
  username: string;
  uid: string;
  sysid: number;
  page_index?: number;
  page_size?: number;
}
