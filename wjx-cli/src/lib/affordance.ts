import { findCatalogEntry } from "../catalog/catalog.js";
export interface Affordance { command: string; when: string; prerequisites?: string[]; skill?: string; }
export function resolveAffordance(command: string): Affordance | undefined {
  return findCatalogEntry(command) ? { command, when: "when the action is required", prerequisites: [], skill: "wjx-cli-use" } : undefined;
}
