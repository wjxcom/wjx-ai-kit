// Re-export from new modular locations for backward compatibility
export { WJX_API_URL, WJX_USER_SYSTEM_API_URL, WJX_SUBUSER_API_URL, WJX_CONTACTS_API_URL, Action } from "./core/constants.js";
export type {
  WjxCredentials,
  WjxApiSuccess,
  WjxApiFailure,
  WjxApiResponse,
  FetchLike,
  RequestOptions,
} from "./core/types.js";
export { getWjxCredentials, validateQuestionsJson, callWjxApi, callWjxUserSystemApi, callWjxSubuserApi, callWjxContactsApi, getCorpId, getUnixTimestamp } from "./core/api-client.js";

// Survey module
export {
  buildCreateSurveyParams,
  createSurvey,
  getSurvey,
  listSurveys,
  updateSurveyStatus,
  getSurveySettings,
  updateSurveySettings,
  deleteSurvey,
  getQuestionTags,
  getTagDetails,
  clearRecycleBin,
} from "./modules/survey/client.js";
export type {
  CreateSurveyInput,
  CreateSurveyParams,
  GetSurveyInput,
  ListSurveysInput,
  UpdateSurveyStatusInput,
  GetSurveySettingsInput,
  UpdateSurveySettingsInput,
  DeleteSurveyInput,
  GetQuestionTagsInput,
  GetTagDetailsInput,
  ClearRecycleBinInput,
} from "./modules/survey/types.js";

// Response module
export {
  queryResponses,
  queryResponsesRealtime,
  downloadResponses,
  getReport,
  submitResponse,
  getFileLinks,
  getWinners,
  modifyResponse,
  get360Report,
  clearResponses,
} from "./modules/response/client.js";
export type {
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
} from "./modules/response/types.js";

// Contacts module
export {
  queryContacts,
  addContacts,
  deleteContacts,
  addAdmin,
  deleteAdmin,
  restoreAdmin,
  listDepartments,
  addDepartment,
  modifyDepartment,
  deleteDepartment,
  listTags,
  addTag,
  modifyTag,
  deleteTag,
} from "./modules/contacts/client.js";
export type {
  QueryContactsInput,
  AddContactsInput,
  DeleteContactsInput,
  AddAdminInput,
  DeleteAdminInput,
  RestoreAdminInput,
  ListDepartmentsInput,
  AddDepartmentInput,
  ModifyDepartmentInput,
  DeleteDepartmentInput,
  ListTagsInput,
  AddTagInput,
  ModifyTagInput,
  DeleteTagInput,
} from "./modules/contacts/types.js";

// User System module
export {
  addParticipants,
  modifyParticipants,
  deleteParticipants,
  querySurveyBinding,
  queryUserSurveys,
} from "./modules/user-system/client.js";
export type {
  AddParticipantsInput,
  ModifyParticipantsInput,
  DeleteParticipantsInput,
  QuerySurveyBindingInput,
  QueryUserSurveysInput,
} from "./modules/user-system/types.js";

// Multi-User module
export {
  addSubAccount,
  modifySubAccount,
  deleteSubAccount,
  restoreSubAccount,
  querySubAccounts,
} from "./modules/multi-user/client.js";
export type {
  AddSubAccountInput,
  ModifySubAccountInput,
  DeleteSubAccountInput,
  RestoreSubAccountInput,
  QuerySubAccountsInput,
} from "./modules/multi-user/types.js";

// SSO module
export {
  buildSsoSubaccountUrl,
  buildSsoUserSystemUrl,
  buildSsoPartnerUrl,
  buildSurveyUrl,
} from "./modules/sso/client.js";
export { buildSsoSignature } from "./modules/sso/sign.js";
export type {
  SsoSubaccountInput,
  SsoUserSystemInput,
  SsoPartnerInput,
  BuildSurveyUrlInput,
} from "./modules/sso/types.js";

// Analytics module
export {
  decodeResponses,
  calculateNps,
  calculateCsat,
  detectAnomalies,
  compareMetrics,
} from "./modules/analytics/compute.js";
export { decodePushPayload } from "./modules/analytics/push-decode.js";
export type {
  DecodedAnswer,
  DecodeResponsesResult,
  NpsResult,
  CsatResult,
  AnomalyFlag,
  AnomalyResult,
  MetricComparison,
  CompareResult,
  PushDecodeResult,
} from "./modules/analytics/types.js";
