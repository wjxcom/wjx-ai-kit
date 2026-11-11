import type { FetchLike, RequestOverrides, WjxCredentials } from "../../core/types.js";
import type { GetShortLinkInput, ShortLinkResponse } from "./types.js";
/** Convert a respondent-facing WJX survey URL into a short link. */
export declare function getShortLink(input: GetShortLinkInput, credentials?: WjxCredentials, fetchImpl?: FetchLike, requestOptions?: RequestOverrides): Promise<ShortLinkResponse>;
