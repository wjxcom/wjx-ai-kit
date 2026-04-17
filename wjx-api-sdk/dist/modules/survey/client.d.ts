import type { WjxApiResponse, WjxCredentials, FetchLike } from "../../core/types.js";
export { textToSurvey, parsedQuestionsToWire } from "./text-to-survey.js";
export { extractJsonlMetadata, normalizeJsonl } from "./json-to-survey.js";
import type { CreateSurveyInput, CreateSurveyByTextInput, CreateSurveyByJsonInput, GetSurveyInput, ListSurveysInput, UpdateSurveyStatusInput, GetSurveySettingsInput, UpdateSurveySettingsInput, DeleteSurveyInput, GetQuestionTagsInput, GetTagDetailsInput, ClearRecycleBinInput, UploadFileInput } from "./types.js";
export declare function validateQuestionsJson(questions: string): void;
export declare function createSurvey<T = unknown>(input: CreateSurveyInput, credentials?: WjxCredentials, fetchImpl?: FetchLike): Promise<WjxApiResponse<T>>;
export declare function getSurvey<T = unknown>(input: GetSurveyInput, credentials?: WjxCredentials, fetchImpl?: FetchLike): Promise<WjxApiResponse<T>>;
export declare function listSurveys<T = unknown>(input?: ListSurveysInput, credentials?: WjxCredentials, fetchImpl?: FetchLike): Promise<WjxApiResponse<T>>;
export declare function updateSurveyStatus<T = unknown>(input: UpdateSurveyStatusInput, credentials?: WjxCredentials, fetchImpl?: FetchLike): Promise<WjxApiResponse<T>>;
export declare function getSurveySettings<T = unknown>(input: GetSurveySettingsInput, credentials?: WjxCredentials, fetchImpl?: FetchLike): Promise<WjxApiResponse<T>>;
export declare function updateSurveySettings<T = unknown>(input: UpdateSurveySettingsInput, credentials?: WjxCredentials, fetchImpl?: FetchLike): Promise<WjxApiResponse<T>>;
export declare function deleteSurvey<T = unknown>(input: DeleteSurveyInput, credentials?: WjxCredentials, fetchImpl?: FetchLike): Promise<WjxApiResponse<T>>;
export declare function getQuestionTags<T = unknown>(input: GetQuestionTagsInput, credentials?: WjxCredentials, fetchImpl?: FetchLike): Promise<WjxApiResponse<T>>;
export declare function getTagDetails<T = unknown>(input: GetTagDetailsInput, credentials?: WjxCredentials, fetchImpl?: FetchLike): Promise<WjxApiResponse<T>>;
export declare function clearRecycleBin<T = unknown>(input: ClearRecycleBinInput, credentials?: WjxCredentials, fetchImpl?: FetchLike): Promise<WjxApiResponse<T>>;
/**
 * 通过 DSL 文本创建问卷（客户端解析 DSL 后调用 createSurvey API）。
 * 段落说明题会被自动过滤（API 不支持 q_type=2）。
 */
export declare function createSurveyByText<T = unknown>(input: CreateSurveyByTextInput, credentials?: WjxCredentials, fetchImpl?: FetchLike): Promise<WjxApiResponse<T>>;
/**
 * 通过 JSONL 格式创建问卷（纯透传到服务端 action 1000106）。
 * 客户端仅做基本校验（非空、大小限制、BOM/CRLF 标准化），
 * 服务端自行解析 JSONL 并创建问卷。
 */
export declare function createSurveyByJson<T = unknown>(input: CreateSurveyByJsonInput, credentials?: WjxCredentials, fetchImpl?: FetchLike): Promise<WjxApiResponse<T>>;
export declare function uploadFile<T = unknown>(input: UploadFileInput, credentials?: WjxCredentials, fetchImpl?: FetchLike): Promise<WjxApiResponse<T>>;
