/** Input for creating an AI page through OpenAPI action 1000107. */
export interface CreateAiPageInput {
  /** AI page HTML. Either html_content or the compatibility html field is required. */
  html_content?: string;
  /** Compatibility alias for html_content. */
  html?: string;
  /** Optional page title. */
  title?: string;
  /** 0=web, 1=poster, 2=PPT. Defaults to 0 on the server. */
  page_type?: number;
  /** Whether to publish immediately. Defaults to false. */
  publish?: boolean;
  /** Optional sub-account username. */
  creater?: string;
}

/** Input for updating an AI page through OpenAPI action 1000108. */
export interface UpdateAiPageInput {
  /** Traditional numeric questionnaire vid; sid values are not accepted. */
  vid: string | number;
  /** AI page HTML. Either html_content or the compatibility html field is required. */
  html_content?: string;
  /** Compatibility alias for html_content. */
  html?: string;
  /** Optional replacement title. */
  title?: string;
  /** Optional replacement page type: 0=web, 1=poster, 2=PPT. */
  page_type?: number;
}

/** Common response payload returned by AI page create/update APIs. */
export interface AiPageResult {
  vid: number;
  sid: string;
  status: number;
  verify_status: number;
  pc_path: string;
  mobile_path: string;
  activity_domain: string;
  iframe_auto_url: string;
  iframe_noauto_url: string;
}
