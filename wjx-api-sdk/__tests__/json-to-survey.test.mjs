import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  extractJsonlMetadata,
  normalizeJsonl,
  MAX_JSONL_SIZE,
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
