import type { SurveyDetail } from "../survey/types.js";

export type WjxDslStatus =
  | "Success"
  | "InvalidRequest"
  | "FeatureDisabled"
  | "Forbidden"
  | "NotFound"
  | "PreconditionRequired"
  | "PreconditionFailed"
  | "ValidationFailed"
  | "DependencyFailure"
  | "PersistenceFailed"
  | "Unsupported";

export interface WjxDslDiagnostic {
  severity: "Info" | "Warning" | "Error";
  code: string;
  message: string;
  line: number;
  column: number;
  path: string;
}

export interface WjxDslLimits {
  maxDslBytes?: number;
  maxDiagnostics?: number;
  maxDiffEntries?: number;
  maxIndexEntries?: number;
  maxMatrixCells?: number;
}

export interface WjxDslOperationData {
  status: WjxDslStatus;
  correlationId?: string;
  activityId?: number;
  diagnostics?: WjxDslDiagnostic[];
  diagnosticCount?: number;
  diagnosticsTruncated?: boolean;
  limits?: WjxDslLimits;
}

/** The query API accepts the same traditional encoded vid as the legacy API. */
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

/** Legacy query DTO plus a complete XML DSL round-trip representation. */
export interface QueryWjxDslResult extends SurveyDetail {
  dsl: string;
}

export interface CreateWjxDslSurveyInput {
  dsl: string;
  /** Legacy questionnaire type; defaults to 1 (survey). */
  atype?: number;
  /** Publish immediately after the existing create workflow completes. */
  publish?: boolean;
  /** Preserve the legacy image-compression option. */
  compress_img?: boolean;
}

export interface CreateWjxDslSurveyResult extends WjxDslOperationData {
  status: "Success";
  correlationId: string;
  /** Traditional encoded questionnaire vid returned by create. */
  vid: string | number;
  /** Internal id may be present for diagnostics; callers must use vid. */
  activityId?: number;
  sid?: string;
  pc_path?: string;
  mobile_path?: string;
  activity_domain?: string;
  iframe_auto_url?: string;
  iframe_noauto_url?: string;
}

export interface UpdateWjxDslInput {
  /** Traditional encoded questionnaire vid. */
  vid: string | number;
  dsl: string;
  ifMatch?: string;
  /** Explicitly approve breaking index changes when the questionnaire has no answers. */
  allowBreakingChanges?: boolean;
}

export interface UpdateWjxDslResult extends WjxDslOperationData {
  status: "Success";
  correlationId: string;
  vid?: string | number;
  activityId?: number;
  noChange?: boolean;
}

export interface WjxDslFailureData extends WjxDslOperationData {
  status: Exclude<WjxDslStatus, "Success">;
}
