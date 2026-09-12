
export interface GetShortLinkInput {
  /** Long respondent-facing survey URL, for example https://www.wjx.cn/vm/w4GZh.aspx. */
  url: string;
}

export interface ShortLinkSuccess {
  success: true;
  msg: string | null;
  data: string;
}

export interface ShortLinkFailure {
  success: false;
  msg?: string | null;
  data?: unknown;
  [key: string]: unknown;
}

export type ShortLinkResponse = ShortLinkSuccess | ShortLinkFailure;
