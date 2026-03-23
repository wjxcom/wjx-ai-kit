/** Input for generating a sub-account SSO login/create URL. */
export interface SsoSubaccountInput {
  /** Sub-account username (required). */
  subuser: string;
  /** Mobile number. */
  mobile?: string;
  /** Email address. */
  email?: string;
  /** Role ID (1-4). */
  role_id?: number;
  /** Redirect URL after login. */
  url?: string;
  /** Set to 1 for master account login. */
  admin?: number;
}

/** Input for generating a user system participant SSO URL. */
export interface SsoUserSystemInput {
  /** Account username (fixed). */
  u: string;
  /** Must be 1 (user system flag). */
  user_system: number;
  /** User system ID. */
  system_id: number;
  /** Participant ID. */
  uid: string;
  /** Participant name. */
  uname?: string;
  /** Participant department. */
  udept?: string;
  /** Extended field. */
  uextf?: string;
  /** Password. */
  upass?: string;
  /** Whether to login (0 or 1). */
  is_login?: number;
  /** Survey vid to jump to. */
  activity?: number;
  /** Return URL. */
  return_url?: string;
}

/** Input for generating a partner/agent SSO login URL. */
export interface SsoPartnerInput {
  /** Partner account username (required). */
  username: string;
  /** Mobile number. */
  mobile?: string;
  /** Sub-account username. */
  subuser?: string;
}

/** Input for generating quick create/edit survey URL. */
export interface BuildSurveyUrlInput {
  /** Mode: "create" or "edit". */
  mode: "create" | "edit";
  /** Survey name (create mode). */
  name?: string;
  /** Survey type (create mode). */
  qt?: number;
  /** Set to 1 to auto-publish (create mode). */
  osa?: number;
  /** Redirect URL after operation. */
  redirect_url?: string;
  /** Survey vid (required for edit mode). */
  activity?: number;
  /** Edit mode (edit mode). */
  editmode?: number;
  /** Run protect flag (edit mode). */
  runprotect?: number;
}
