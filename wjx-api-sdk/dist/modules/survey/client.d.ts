import type { WjxApiResponse, WjxCredentials, FetchLike, RequestOverrides } from "../../core/types.js";
export { extractJsonlMetadata, normalizeJsonl } from "./json-to-survey.js";
import type { CreateSurveyByJsonInput, GetSurveyInput, ListSurveysInput, UpdateSurveyStatusInput, GetSurveySettingsInput, UpdateSurveySettingsInput, DeleteSurveyInput, GetQuestionTagsInput, GetTagDetailsInput, ClearRecycleBinInput, UploadFileInput } from "./types.js";
export declare const CREATABLE_SURVEY_ATYPES: ReadonlySet<number>;
export declare function getSurvey<T = unknown>(input: GetSurveyInput, credentials?: WjxCredentials, fetchImpl?: FetchLike, requestOptions?: RequestOverrides): Promise<WjxApiResponse<T>>;
export declare function listSurveys<T = unknown>(input?: ListSurveysInput, credentials?: WjxCredentials, fetchImpl?: FetchLike, requestOptions?: RequestOverrides): Promise<WjxApiResponse<T>>;
export declare function updateSurveyStatus<T = unknown>(input: UpdateSurveyStatusInput, credentials?: WjxCredentials, fetchImpl?: FetchLike): Promise<WjxApiResponse<T>>;
export declare function getSurveySettings<T = unknown>(input: GetSurveySettingsInput, credentials?: WjxCredentials, fetchImpl?: FetchLike): Promise<WjxApiResponse<T>>;
export declare function updateSurveySettings<T = unknown>(input: UpdateSurveySettingsInput, credentials?: WjxCredentials, fetchImpl?: FetchLike): Promise<WjxApiResponse<T>>;
export declare function deleteSurvey<T = unknown>(input: DeleteSurveyInput, credentials?: WjxCredentials, fetchImpl?: FetchLike): Promise<WjxApiResponse<T>>;
export declare function getQuestionTags<T = unknown>(input: GetQuestionTagsInput, credentials?: WjxCredentials, fetchImpl?: FetchLike): Promise<WjxApiResponse<T>>;
export declare function getTagDetails<T = unknown>(input: GetTagDetailsInput, credentials?: WjxCredentials, fetchImpl?: FetchLike): Promise<WjxApiResponse<T>>;
export declare function clearRecycleBin<T = unknown>(input: ClearRecycleBinInput, credentials?: WjxCredentials, fetchImpl?: FetchLike): Promise<WjxApiResponse<T>>;
/**
 * 通过 JSONL 格式创建问卷（纯透传到服务端 action 1000106）。
 * 客户端负责输入边界和 JSONL 语法校验，服务端负责最终题型落库。
 */
export declare function createSurveyByJson<T = unknown>(input: CreateSurveyByJsonInput, credentials?: WjxCredentials, fetchImpl?: FetchLike, requestOptions?: RequestOverrides): Promise<WjxApiResponse<T>>;
export declare function uploadFile<T = unknown>(input: UploadFileInput, credentials?: WjxCredentials, fetchImpl?: FetchLike): Promise<WjxApiResponse<T>>;
