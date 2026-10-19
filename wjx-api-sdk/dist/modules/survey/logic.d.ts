import type { SurveyDslJson } from "./types.js";
/** 仅校验模块边界；规则语义由服务端现有 DSL 解析器校验。 */
export declare function prepareSurveyDslJson(value: unknown): SurveyDslJson | undefined;
/** 检查请求的规则是否出现在实际 XML 投影中；其他已有规则允许保留。 */
export declare function surveyLogicMatches(expected: string, actual: unknown, questions?: readonly Record<string, unknown>[]): boolean;
