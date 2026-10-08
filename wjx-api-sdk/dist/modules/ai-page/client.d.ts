import type { WjxApiResponse, WjxCredentials, FetchLike, RequestOverrides } from "../../core/types.js";
import type { AiPageResult, CreateAiPageInput, UpdateAiPageInput } from "./types.js";
export declare function createAiPage<T = AiPageResult>(input: CreateAiPageInput, credentials?: WjxCredentials, fetchImpl?: FetchLike, requestOptions?: RequestOverrides): Promise<WjxApiResponse<T>>;
export declare function updateAiPage<T = AiPageResult>(input: UpdateAiPageInput, credentials?: WjxCredentials, fetchImpl?: FetchLike, requestOptions?: RequestOverrides): Promise<WjxApiResponse<T>>;
