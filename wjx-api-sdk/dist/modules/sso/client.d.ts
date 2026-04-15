import type { SsoSubaccountInput, SsoUserSystemInput, SsoPartnerInput, BuildSurveyUrlInput, BuildPreviewUrlInput } from "./types.js";
/**
 * Build sub-account SSO login/create URL.
 */
export declare function buildSsoSubaccountUrl(input: SsoSubaccountInput): string;
/**
 * Build user system participant SSO URL.
 */
export declare function buildSsoUserSystemUrl(input: SsoUserSystemInput): string;
/**
 * Build partner/agent SSO login URL.
 */
export declare function buildSsoPartnerUrl(input: SsoPartnerInput): string;
/**
 * Build quick create/edit survey URL (no signing needed).
 */
export declare function buildSurveyUrl(input: BuildSurveyUrlInput): string;
/**
 * Build a survey preview/fill URL (the respondent-facing page).
 * Pattern: {baseUrl}/vm/{vid}.aspx
 */
export declare function buildPreviewUrl(input: BuildPreviewUrlInput): string;
