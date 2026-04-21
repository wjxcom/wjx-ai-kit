import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  extractJsonlMetadata,
  normalizeJsonl,
  MAX_JSONL_SIZE,
  preprocessExamJsonl,
  EXAM_QTYPES,
  createSurveyByJson,
} from "../dist/index.js";

// ═══════════════════════════════════════════════════════════════════════════════
// extractJsonlMetadata
// ═══════════════════════════════════════════════════════════════════════════════

describe("extractJsonlMetadata", () => {
  it("should extract metadata from 问卷基础信息 line", () => {
    const jsonl = [
      '{"qtype":"问卷基础信息","title":"客户满意度","introduction":"请认真填写","endpageinformation":"谢谢","language":"en"}',
      '{"qtype":"单选","title":"性别","select":["男","女"]}',
    ].join("\n");
    const meta = extractJsonlMetadata(jsonl);
    assert.equal(meta.title, "客户满意度");
    assert.equal(meta.description, "请认真填写");
    assert.equal(meta.endpageinformation, "谢谢");
    assert.equal(meta.language, "en");
  });

  it("should return defaults when no metadata line exists", () => {
    const jsonl = '{"qtype":"单选","title":"性别","select":["男","女"]}';
    const meta = extractJsonlMetadata(jsonl);
    assert.equal(meta.title, "");
    assert.equal(meta.description, "");
    assert.equal(meta.endpageinformation, "");
    assert.equal(meta.language, "zh");
  });

  it("should return defaults for empty input", () => {
    const meta = extractJsonlMetadata("");
    assert.equal(meta.title, "");
    assert.equal(meta.language, "zh");
  });

  it("should skip malformed JSON lines gracefully", () => {
    const jsonl = [
      "not valid json",
      '{"qtype":"问卷基础信息","title":"测试问卷"}',
    ].join("\n");
    const meta = extractJsonlMetadata(jsonl);
    assert.equal(meta.title, "测试问卷");
  });

  it("should handle missing optional fields in metadata", () => {
    const jsonl = '{"qtype":"问卷基础信息","title":"标题"}';
    const meta = extractJsonlMetadata(jsonl);
    assert.equal(meta.title, "标题");
    assert.equal(meta.description, "");
    assert.equal(meta.endpageinformation, "");
    assert.equal(meta.language, "zh");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// normalizeJsonl
// ═══════════════════════════════════════════════════════════════════════════════

describe("normalizeJsonl", () => {
  it("should strip BOM", () => {
    const result = normalizeJsonl("\uFEFF{\"qtype\":\"单选\"}");
    assert.equal(result, '{"qtype":"单选"}');
  });

  it("should convert CRLF to LF", () => {
    const result = normalizeJsonl("line1\r\nline2\r\nline3");
    assert.equal(result, "line1\nline2\nline3");
  });

  it("should handle BOM + CRLF together", () => {
    const result = normalizeJsonl("\uFEFFline1\r\nline2");
    assert.equal(result, "line1\nline2");
  });

  it("should return unchanged text when no BOM or CRLF", () => {
    const input = '{"qtype":"单选","title":"测试"}';
    assert.equal(normalizeJsonl(input), input);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// MAX_JSONL_SIZE
// ═══════════════════════════════════════════════════════════════════════════════

describe("MAX_JSONL_SIZE", () => {
  it("should be 1_000_000", () => {
    assert.equal(MAX_JSONL_SIZE, 1_000_000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// preprocessExamJsonl
// ═══════════════════════════════════════════════════════════════════════════════

describe("preprocessExamJsonl", () => {
  it("should detect exam qtypes and inject isquiz=\"1\"", () => {
    const jsonl = [
      '{"qtype":"问卷基础信息","title":"测试"}',
      '{"qtype":"考试判断","title":"地球是圆的","select":["对","错"],"correctselect":["A"]}',
    ].join("\n");
    const { jsonl: out, hasExam } = preprocessExamJsonl(jsonl);
    assert.equal(hasExam, true);
    const examLine = JSON.parse(out.split("\n")[1]);
    assert.equal(examLine.isquiz, "1");
  });

  it("should preserve user-supplied isquiz value", () => {
    const jsonl = '{"qtype":"考试单选","title":"Q1","isquiz":"0"}';
    const { jsonl: out, hasExam } = preprocessExamJsonl(jsonl);
    assert.equal(hasExam, true);
    assert.equal(JSON.parse(out).isquiz, "0");
  });

  it("should not touch non-exam questions", () => {
    const jsonl = [
      '{"qtype":"单选","title":"Q1","select":["A","B"]}',
      '{"qtype":"多选","title":"Q2","select":["A","B"]}',
    ].join("\n");
    const { jsonl: out, hasExam } = preprocessExamJsonl(jsonl);
    assert.equal(hasExam, false);
    assert.equal(out, jsonl);
  });

  it("should preserve empty lines and malformed JSON", () => {
    const jsonl = ["", "not json", '{"qtype":"考试单选","title":"Q"}'].join("\n");
    const { jsonl: out, hasExam } = preprocessExamJsonl(jsonl);
    assert.equal(hasExam, true);
    const lines = out.split("\n");
    assert.equal(lines[0], "");
    assert.equal(lines[1], "not json");
    assert.equal(JSON.parse(lines[2]).isquiz, "1");
  });

  it("EXAM_QTYPES should contain all 9 exam qtypes", () => {
    assert.equal(EXAM_QTYPES.size, 9);
    assert.ok(EXAM_QTYPES.has("考试判断"));
    assert.ok(EXAM_QTYPES.has("考试绘图"));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// createSurveyByJson — exam atype inference + isquiz injection
// ═══════════════════════════════════════════════════════════════════════════════

describe("createSurveyByJson exam handling", () => {
  function makeFakeFetch() {
    const captured = { body: null, url: null };
    const fakeFetch = async (url, init) => {
      captured.url = url;
      captured.body = JSON.parse(init.body);
      return new Response(
        JSON.stringify({ result: true, data: { vid: 1 } }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    return { fakeFetch, captured };
  }

  it("auto-infers atype=6 when JSONL contains exam qtypes", async () => {
    const { fakeFetch, captured } = makeFakeFetch();
    await createSurveyByJson(
      { jsonl: '{"qtype":"考试判断","title":"Q","select":["对","错"]}' },
      { apiKey: "k" },
      fakeFetch,
    );
    assert.equal(captured.body.atype, 6);
    const sentJsonl = captured.body.surveydatajson;
    assert.equal(JSON.parse(sentJsonl).isquiz, "1");
  });

  it("preserves user-supplied atype even when exam qtypes present", async () => {
    const { fakeFetch, captured } = makeFakeFetch();
    await createSurveyByJson(
      { jsonl: '{"qtype":"考试单选","title":"Q","select":["A"]}', atype: 1 },
      { apiKey: "k" },
      fakeFetch,
    );
    assert.equal(captured.body.atype, 1);
  });

  it("defaults atype=1 when no exam qtype present", async () => {
    const { fakeFetch, captured } = makeFakeFetch();
    await createSurveyByJson(
      { jsonl: '{"qtype":"单选","title":"Q","select":["A"]}' },
      { apiKey: "k" },
      fakeFetch,
    );
    assert.equal(captured.body.atype, 1);
  });
});
