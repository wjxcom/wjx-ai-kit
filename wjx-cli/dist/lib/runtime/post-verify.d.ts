import type { WjxApiResponse, WjxCredentials, FetchLike } from "wjx-api-sdk";
import type { JsonlQuestionTypeExpectation } from "wjx-api-sdk";
export type VerifiedSurveyStatus = "draft" | "published" | "paused" | "deleted" | "hard-deleted" | "reviewed" | "unknown";
export type VerifiedReviewStatus = "approved" | "reviewing" | "rejected" | "pending-real-name" | "unknown";
export interface PostVerificationResult {
    vid?: number;
    sid?: string;
    fillUrl?: string;
    editUrl?: string;
    status?: VerifiedSurveyStatus;
    verifyStatus?: VerifiedReviewStatus;
    verification: {
        structure: boolean;
        status: boolean;
        link: boolean;
    };
    warnings: string[];
}
interface VerifyInput {
    vid: number;
    sid?: string;
    expectedTitle?: string;
    expectedQuestionCount?: number;
    expectedQtypes?: number[];
    /** JSONL qtype expectations; unknown names are reported and skipped. */
    expectedQuestionTypes?: readonly JsonlQuestionTypeExpectation[];
    /** Permit service-owned expansion/representation rows for unverifiable qtypes. */
    allowAdditionalQuestionRows?: boolean;
    expectedStatus?: VerifiedSurveyStatus;
    baseUrl?: string;
    respondentOrigins?: string[];
    credentials?: WjxCredentials;
    fetchImpl?: FetchLike;
    getSurveyFn?: (input: {
        vid: number;
        get_questions: boolean;
        get_items: boolean;
    }, credentials?: WjxCredentials, fetchImpl?: FetchLike) => Promise<WjxApiResponse<any>>;
    listSurveysFn?: (input: {
        page_index: number;
        page_size: number;
    }, credentials?: WjxCredentials, fetchImpl?: FetchLike) => Promise<WjxApiResponse<any>>;
}
export declare function verifySurveyPostWrite(input: VerifyInput): Promise<PostVerificationResult>;
export {};
