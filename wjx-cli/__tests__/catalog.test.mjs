import { test } from "node:test";
import assert from "node:assert/strict";
import { CATALOG, findCatalogEntry } from "../dist/catalog/catalog.js";
import { schemaFor } from "../dist/catalog/schema.js";
test("catalog ordering and schema are deterministic", () => {
  assert.deepEqual(CATALOG.map((item) => item.id), [...CATALOG].sort((a, b) => a.id.localeCompare(b.id)).map((item) => item.id));
  const schema = schemaFor("survey.list"); assert.equal(schema.action, "1000002"); assert.equal(schema.risk, "read");
});
test("catalog resolves action id and rejects unknown entries", () => { assert.equal(findCatalogEntry("1000002")?.id, "survey.list"); assert.equal(findCatalogEntry("not-real"), undefined); });
