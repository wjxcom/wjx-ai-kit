import type { WjxApiResponse, WjxCredentials, FetchLike } from "../../core/types.js";
import type { AddParticipantsInput, ModifyParticipantsInput, DeleteParticipantsInput, BindActivityInput, QuerySurveyBindingInput, QueryUserSurveysInput } from "./types.js";
export declare function addParticipants<T = unknown>(input: AddParticipantsInput, credentials?: WjxCredentials, fetchImpl?: FetchLike): Promise<WjxApiResponse<T>>;
export declare function modifyParticipants<T = unknown>(input: ModifyParticipantsInput, credentials?: WjxCredentials, fetchImpl?: FetchLike): Promise<WjxApiResponse<T>>;
export declare function deleteParticipants<T = unknown>(input: DeleteParticipantsInput, credentials?: WjxCredentials, fetchImpl?: FetchLike): Promise<WjxApiResponse<T>>;
export declare function bindActivity<T = unknown>(input: BindActivityInput, credentials?: WjxCredentials, fetchImpl?: FetchLike): Promise<WjxApiResponse<T>>;
export declare function querySurveyBinding<T = unknown>(input: QuerySurveyBindingInput, credentials?: WjxCredentials, fetchImpl?: FetchLike): Promise<WjxApiResponse<T>>;
export declare function queryUserSurveys<T = unknown>(input: QueryUserSurveysInput, credentials?: WjxCredentials, fetchImpl?: FetchLike): Promise<WjxApiResponse<T>>;
