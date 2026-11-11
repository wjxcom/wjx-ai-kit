import type { UpdateSurveyByJsonInput } from "./types.js";
import type { FetchLike, WjxCredentials } from "../../core/types.js";
/** 通过普通查询读取真实 XML 投影，验证 JSON 更新；不依赖提交时的 DSL 影子副本。 */
export declare function verifySurveyJsonUpdate(input: UpdateSurveyByJsonInput, before: Record<string, unknown>, credentials?: WjxCredentials, fetchImpl?: FetchLike): Promise<{
    verification: {
        structure: boolean;
        status: boolean;
        count: boolean;
        link: boolean;
    };
    outcome: "unknown" | "verified";
    warnings: string[];
}>;
