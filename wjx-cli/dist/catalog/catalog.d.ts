import type { ActionCatalogEntry } from "./types.js";
export type CatalogSource = "api" | "shortcut" | "builtin";
type CatalogEntry = ActionCatalogEntry & {
    source: CatalogSource;
};
/** Complete public command catalog used by raw API, schema, completion and manifest checks. */
export declare const CATALOG: readonly CatalogEntry[];
export declare function findCatalogEntry(query: string): CatalogEntry | undefined;
export {};
