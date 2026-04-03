// Core exports
export {
  getWjxBaseUrl,
  getWjxApiUrl,
  getWjxUserSystemApiUrl,
  getWjxSubuserApiUrl,
  getWjxContactsApiUrl,
  getWjxSsoSubaccountUrl,
  getWjxSsoUserSystemUrl,
  getWjxSsoPartnerUrl,
  getWjxSurveyCreateUrl,
  getWjxSurveyEditUrl,
  Action,
  DEFAULT_TIMEOUT_MS,
  LONG_TIMEOUT_MS,
  DEFAULT_MAX_RETRIES,
  RETRY_DELAY_MS,
} from "./core/constants.js";
export type {
  WjxCredentials,
  WjxApiSuccess,
  WjxApiFailure,
  WjxApiResponse,
  FetchLike,
  RequestOptions,
  Logger,
} from "./core/types.js";
export {
  setCredentialProvider,
  getWjxCredentials,
  validateQuestionsJson,
  callWjxApi,
  callWjxUserSystemApi,
  callWjxSubuserApi,
  callWjxContactsApi,
  getCorpId,
} from "./core/api-client.js";

// Survey module
export {
  createSurvey,
  createSurveyByText,
  getSurvey,
  listSurveys,
  updateSurveyStatus,
  getSurveySettings,
  updateSurveySettings,
  deleteSurvey,
  getQuestionTags,
  getTagDetails,
  clearRecycleBin,
  uploadFile,
} from "./modules/survey/client.js";
export { surveyToText, typeToLabel, stripHtml } from "./modules/survey/survey-to-text.js";
export { textToSurvey, parsedQuestionsToWire, LABEL_TO_TYPE, TYPE_MAP } from "./modules/survey/text-to-survey.js";
export type { WireQuestion, WireConversionResult } from "./modules/survey/text-to-survey.js";
export type {
  CreateSurveyInput,
  CreateSurveyByTextInput,
  GetSurveyInput,
  ListSurveysInput,
  UpdateSurveyStatusInput,
  GetSurveySettingsInput,
  UpdateSurveySettingsInput,
  DeleteSurveyInput,
  GetQuestionTagsInput,
  GetTagDetailsInput,
  ClearRecycleBinInput,
  UploadFileInput,
  SurveyQuestionItem,
  SurveyQuestion,
  SurveyDetail,
  ParsedQuestion,
  ParsedSurvey,
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
  bindActivity,
  querySurveyBinding,
  queryUserSurveys,
} from "./modules/user-system/client.js";
export type {
  AddParticipantsInput,
  ModifyParticipantsInput,
  DeleteParticipantsInput,
  BindActivityInput,
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
  buildPreviewUrl,
} from "./modules/sso/client.js";
export type {
  SsoSubaccountInput,
  SsoUserSystemInput,
  SsoPartnerInput,
  BuildSurveyUrlInput,
  BuildPreviewUrlInput,
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
