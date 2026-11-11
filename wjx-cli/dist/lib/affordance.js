import { findCatalogEntry } from "../catalog/catalog.js";
export function resolveAffordance(command) {
    return findCatalogEntry(command) ? { command, when: "when the action is required", prerequisites: [], skill: "wjx-cli-use" } : undefined;
}
//# sourceMappingURL=affordance.js.map