export interface AddParticipantsInput {
  username: string;
  users: string;
  usid: number;
}

export interface ModifyParticipantsInput {
  username: string;
  users: string;
  usid: number;
}

export interface DeleteParticipantsInput {
  username: string;
  uids: string;
  usid: number;
}

export interface QuerySurveyBindingInput {
  username: string;
  vid: number;
  usid: number;
  page_index?: number;
  page_size?: number;
}

export interface QueryUserSurveysInput {
  username: string;
  uid: string;
  usid: number;
  page_index?: number;
  page_size?: number;
}
