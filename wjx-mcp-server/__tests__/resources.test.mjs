import assert from "node:assert/strict";
import test from "node:test";

import {
  SURVEY_TYPES,
  QUESTION_TYPES,
  SURVEY_STATUSES,
  VERIFY_STATUSES,
} from "../dist/resources.js";

test("SURVEY_TYPES", async (t) => {
  await t.test("should contain all standard survey types", () => {
    assert.equal(SURVEY_TYPES[1], "问卷调查");
    assert.equal(SURVEY_TYPES[2], "测评");
    assert.equal(SURVEY_TYPES[3], "投票");
    assert.equal(SURVEY_TYPES[6], "考试");
    assert.equal(SURVEY_TYPES[7], "表单");
  });

  await t.test("should have at least 10 types", () => {
    assert.ok(Object.keys(SURVEY_TYPES).length >= 10);
  });
});

test("QUESTION_TYPES", async (t) => {
  await t.test("should contain core question types", () => {
    assert.equal(QUESTION_TYPES[1].name, "单选题");
    assert.equal(QUESTION_TYPES[2].name, "多选题");
    assert.equal(QUESTION_TYPES[3].name, "填空题");
    assert.equal(QUESTION_TYPES[8].name, "量表题");
    assert.equal(QUESTION_TYPES[10].name, "文件上传题");
  });

  await t.test("should have subtypes for single-choice", () => {
    assert.ok(QUESTION_TYPES[1].subtypes);
    assert.equal(QUESTION_TYPES[1].subtypes[0], "普通单选");
  });

  await t.test("should have at least 15 main types", () => {
    assert.ok(Object.keys(QUESTION_TYPES).length >= 15);
  });
});

test("SURVEY_STATUSES", async (t) => {
  await t.test("should contain all status codes", () => {
    assert.equal(SURVEY_STATUSES[0], "设计中（未发布）");
    assert.equal(SURVEY_STATUSES[1], "收集中（已发布）");
    assert.equal(SURVEY_STATUSES[2], "已暂停");
    assert.equal(SURVEY_STATUSES[3], "已删除（在回收站）");
  });
});

test("VERIFY_STATUSES", async (t) => {
  await t.test("should contain all verify status codes", () => {
    assert.equal(VERIFY_STATUSES[0], "未审核");
    assert.equal(VERIFY_STATUSES[1], "审核通过");
    assert.equal(VERIFY_STATUSES[2], "审核未通过");
    assert.equal(VERIFY_STATUSES[3], "审核中");
  });
});
