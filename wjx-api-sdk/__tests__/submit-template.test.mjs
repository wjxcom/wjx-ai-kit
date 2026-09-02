import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSubmitTemplate } from "../dist/index.js";

describe("buildSubmitTemplate", () => {
  it("covers scalar, text, upload, slider, and unknown question types", () => {
    const result = buildSubmitTemplate([
      { q_index: 1, q_type: 3 },
      { q_index: 2, q_type: 5 },
      { q_index: 3, q_type: 8 },
      { q_index: 4, q_type: 10 },
      { q_index: 5, q_type: 99 },
    ]);
    assert.equal(result.submitdata, "1$1}2$__请填写__}3$filename.png}4$5}5$__请填写__");
    assert.equal(result.questions.length, 5);
    assert.match(result.questions[4].hint, /q_type=99/);
  });

  it("renders multi-select, ordering, matrix, multi-gap, and weight templates", () => {
    const result = buildSubmitTemplate([
      { q_index: 1, q_type: 4, q_subtype: 4, items: [{ item_index: 1 }, { item_index: 2 }] },
      { q_index: 2, q_type: 4, q_subtype: 402, items: [{ item_index: 1 }, { item_index: 2 }, { item_index: 3 }] },
      { q_index: 3, q_type: 6, gap_count: 3 },
      { q_index: 4, q_type: 7, q_subtype: 702, item_rows: [{ item_index: 1 }, { item_index: 2 }, { item_index: 3 }] },
      { q_index: 5, q_type: 7, q_subtype: 703, item_rows: [{ item_index: 1 }, { item_index: 2 }] },
      { q_index: 6, q_type: 9, item_rows: [{ item_index: 1 }, { item_index: 2 }, { item_index: 3 }] },
    ]);
    assert.equal(result.submitdata, "1$1|2}2$1|2|3}3$__填空1__|__填空2__|__填空3__}4$1!1,2!1,3!1}5$1!1|2,2!1|2}6$1!33,2!33,3!34");
  });

  it("does not duplicate the final option in a two-option ordering question", () => {
    const result = buildSubmitTemplate([
      { q_index: 1, q_type: 4, q_subtype: 402, items: [{ item_index: 1 }, { item_index: 2 }] },
    ]);
    assert.equal(result.submitdata, "1$1|2");
  });

  it("skips framework questions while preserving service q_index values", () => {
    const result = buildSubmitTemplate([
      { q_index: 1, q_type: 1 },
      { q_index: 2, q_type: 3 },
      { q_index: 3, q_type: 2 },
      { q_index: 4, q_type: 5 },
    ]);
    assert.equal(result.submitdata, "2$1}4$__请填写__");
    assert.deepEqual(result.questions.map((question) => question.q_index), [2, 4]);
  });
});
