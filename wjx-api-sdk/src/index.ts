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
  RequestOverrides,
  Logger,
} from "./core/types.js";
export {
  setCredentialProvider,
  getWjxCredentials,
  callWjxApi,
  callWjxUserSystemApi,
  callWjxSubuserApi,
  callWjxContactsApi,
  getCorpId,
  assignDefined,
} from "./core/api-client.js";

// Survey module
export {
  createSurveyByJson,
  CREATABLE_SURVEY_ATYPES,
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
export {
  extractJsonlMetadata,
  normalizeJsonl,
  MAX_JSONL_SIZE,
  parseJsonl,
  jsonToSurvey,
  EXAM_QTYPES,
  preprocessExamJsonl,
  hasVoteJsonlQtype,
  injectDefaultRequir,
  injectAtypeIntoJsonl,
  inferAtypeFromTitle,
  validateSurveyTitle,
  validateSurveyHasQuestions,
  NON_QUESTION_QTYPE_SET,
  JSONL_SUPPORTED_QTYPES,
  FRAMEWORK_ONLY_JSONL_QTYPES,
  hasFrameworkOnlyJsonlQtype,
  resolveJsonlPublish,
  preflightJsonl,
} from "./modules/survey/json-to-survey.js";
export type {
  JsonSurveyMetadata,
  JsonSurveyQuestion,
  JsonParsedSurvey,
} from "./modules/survey/json-to-survey.js";
export type {
  CreateSurveyByJsonInput,
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
} from "./modules/survey/types.js";

// AI homepage module
export { createAiPage, updateAiPage } from "./modules/ai-page/client.js";
export {
  AI_PAGE_MAX_HTML_LENGTH,
  AI_PAGE_MAX_TITLE_LENGTH,
  AI_PAGE_PAGE_TYPES,
} from "./modules/ai-page/constants.js";
export type { AiPageType } from "./modules/ai-page/constants.js";
export type { AiPageResult, CreateAiPageInput, UpdateAiPageInput } from "./modules/ai-page/types.js";

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
export { normalizeSubmitdata } from "./modules/response/submitdata.js";
export { buildSubmitTemplate } from "./modules/response/submit-template.js";
export type {
  SubmitTemplateQuestion,
  SubmitTemplateOutputQuestion,
  SubmitTemplateResult,
} from "./modules/response/submit-template.js";
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
  SubmitdataQuestionMeta,
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
