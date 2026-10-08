import type { FetchLike, WjxApiResponse, WjxCredentials } from "../../core/types.js";
import type { CreateWjxDslSurveyInput, CreateWjxDslSurveyResult, QueryWjxDslInput, QueryWjxDslResult, UpdateWjxDslInput, UpdateWjxDslResult } from "./types.js";
export declare function queryWjxDsl<T = QueryWjxDslResult>(input: QueryWjxDslInput, credentials?: WjxCredentials, fetchImpl?: FetchLike): Promise<WjxApiResponse<T>>;
export declare function createSurveyByWjxDsl<T = CreateWjxDslSurveyResult>(input: CreateWjxDslSurveyInput, credentials?: WjxCredentials, fetchImpl?: FetchLike): Promise<WjxApiResponse<T>>;
export declare function updateWjxDsl<T = UpdateWjxDslResult>(input: UpdateWjxDslInput, credentials?: WjxCredentials, fetchImpl?: FetchLike): Promise<WjxApiResponse<T>>;
