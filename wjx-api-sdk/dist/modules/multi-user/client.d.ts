import type { WjxApiResponse, WjxCredentials, FetchLike } from "../../core/types.js";
import type { AddSubAccountInput, ModifySubAccountInput, DeleteSubAccountInput, RestoreSubAccountInput, QuerySubAccountsInput } from "./types.js";
export declare function addSubAccount<T = unknown>(input: AddSubAccountInput, credentials?: WjxCredentials, fetchImpl?: FetchLike): Promise<WjxApiResponse<T>>;
export declare function modifySubAccount<T = unknown>(input: ModifySubAccountInput, credentials?: WjxCredentials, fetchImpl?: FetchLike): Promise<WjxApiResponse<T>>;
export declare function deleteSubAccount<T = unknown>(input: DeleteSubAccountInput, credentials?: WjxCredentials, fetchImpl?: FetchLike): Promise<WjxApiResponse<T>>;
export declare function restoreSubAccount<T = unknown>(input: RestoreSubAccountInput, credentials?: WjxCredentials, fetchImpl?: FetchLike): Promise<WjxApiResponse<T>>;
export declare function querySubAccounts<T = unknown>(input: QuerySubAccountsInput, credentials?: WjxCredentials, fetchImpl?: FetchLike): Promise<WjxApiResponse<T>>;
