import { findCatalogEntry } from "./catalog.js";
export function schemaFor(query: string) {
  const entry = findCatalogEntry(query);
  if (!entry) throw new Error(`Unknown catalog action: ${query}`);
  return { id: entry.id, command: entry.command, service: entry.service, action: entry.action, input: entry.input, response: entry.response ?? {}, risk: entry.risk, identities: entry.identities, pagination: entry.pagination ?? null };
}
