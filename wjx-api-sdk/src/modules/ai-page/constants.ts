/** Maximum HTML payload accepted by the AI homepage APIs. */
export const AI_PAGE_MAX_HTML_LENGTH = 200_000 as const;

/** Maximum title length accepted by the AI homepage APIs. */
export const AI_PAGE_MAX_TITLE_LENGTH = 100 as const;

/** Supported AI homepage page types: web, poster, and PPT. */
export const AI_PAGE_PAGE_TYPES = [0, 1, 2] as const;

export type AiPageType = (typeof AI_PAGE_PAGE_TYPES)[number];
