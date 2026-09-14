import { findCatalogEntry } from "./catalog.js";
export declare function loadCatalog(): readonly (import("./types.js").ActionCatalogEntry & {
    source: import("./catalog.js").CatalogSource;
})[];
export { findCatalogEntry };
