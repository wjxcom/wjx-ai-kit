import type { SurveyDetail } from "../survey/types.js";

export type WjxDslStatus =
  | "Success"
  | "InvalidRequest"
  | "Forbidden"
  | "NotFound"
  | "ValidationFailed"
  | "DependencyFailure"
  | "PersistenceFailed"
  | "Unsupported";

export interface WjxDslDiagnostic {
  severity: "Info" | "Warning" | "Error";
  code: string;
  message: string;
  line?: number;
  column?: number;
  path?: string;
}

export interface WjxDslOperationData {
  status: WjxDslStatus;
  correlationId?: string;
  activityId?: number;
  diagnostics?: WjxDslDiagnostic[];
  diagnosticCount?: number;
  diagnosticsTruncated?: boolean;
}

export interface WjxDslLimits {
  maxDslBytes?: number;
  maxDiagnostics?: number;
}

export interface QueryWjxDslInput {
  vid: string | number;
  get_questions?: boolean;
  get_items?: boolean;
  get_exts?: boolean;
  get_setting?: boolean;
  get_page_cut?: boolean;
  get_tags?: boolean;
  showtitle?: boolean;
}

export interface QueryWjxDslResult extends SurveyDetail {
  dsl: string;
}

export interface CreateWjxDslSurveyInput {
  dsl: string;
  atype?: number;
  publish?: boolean;
  compress_img?: boolean;
}

export interface CreateWjxDslSurveyResult extends WjxDslOperationData {
  status: "Success";
  correlationId?: string;
  vid: string | number;
  activityId?: number;
  sid?: string;
  pc_path?: string;
  mobile_path?: string;
  activity_domain?: string;
  iframe_auto_url?: string;
  iframe_noauto_url?: string;
}

export interface UpdateWjxDslInput {
  vid: string | number;
  dsl: string;
  allowBreakingChanges?: boolean;
}

export interface UpdateWjxDslResult extends WjxDslOperationData {
  status: "Success";
  correlationId?: string;
  vid?: string | number;
  activityId?: number;
  noChange?: boolean;
}

export interface WjxDslFailureData extends WjxDslOperationData {
  status: Exclude<WjxDslStatus, "Success">;
}

export interface WjxDslValidationOptions {
  maxBytes?: number;
  maxDiagnostics?: number;
}

export interface WjxDslGenerationResult {
  dsl: string;
  diagnostics: WjxDslDiagnostic[];
  valid: boolean;
  byteLength: number;
}
