/** Maximum HTML payload accepted by the AI homepage APIs. */
export declare const AI_PAGE_MAX_HTML_LENGTH: 200000;
/** Maximum title length accepted by the AI homepage APIs. */
export declare const AI_PAGE_MAX_TITLE_LENGTH: 100;
/** Supported AI homepage page types: web, poster, and PPT. */
export declare const AI_PAGE_PAGE_TYPES: readonly [0, 1, 2];
export type AiPageType = (typeof AI_PAGE_PAGE_TYPES)[number];
