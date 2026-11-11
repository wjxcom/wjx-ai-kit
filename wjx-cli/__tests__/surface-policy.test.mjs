import { test } from "node:test";
import assert from "node:assert/strict";
import { projectSurface } from "../dist/lib/surface.js";
import { createStaticPolicy } from "../dist/lib/policy.js";
import { resolveAffordance } from "../dist/lib/affordance.js";
test("surface has stable visibility states and affordances omit unknown commands", () => {
  assert.deepEqual(projectSurface(["b", "a"], { denied: new Set(["b"]) }), [{ command: "a", state: "available" }, { command: "b", state: "denied-visible", reason: "policy" }]);
  assert.equal(resolveAffordance("not-real"), undefined);
});
test("static policy returns machine-readable denial reasons", async () => {
  const policy = createStaticPolicy([{ command: "survey.*", maxRisk: "read" }]);
  const decision = await policy.evaluate({ path: "survey.delete", risk: "high-risk-write", identities: ["user"], targetFields: [] }, { command: "survey.delete", input: {}, options: {} });
  assert.equal(decision.allowed, false); assert.equal(decision.source, "static");
});
