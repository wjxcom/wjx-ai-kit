import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  extractJsonlMetadata,
  normalizeJsonl,
  MAX_JSONL_SIZE,
  preprocessExamJsonl,
  EXAM_QTYPES,
  injectDefaultRequir,
  injectAtypeIntoJsonl,
  inferAtypeFromTitle,
  validateSurveyTitle,
  validateSurveyHasQuestions,
  NON_QUESTION_QTYPE_SET,
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
      {
        jsonl: [
          '{"qtype":"问卷基础信息","title":"Python 基础考试"}',
          '{"qtype":"考试判断","title":"Q","select":["对","错"]}',
        ].join("\n"),
      },
      { apiKey: "k" },
      fakeFetch,
    );
    assert.equal(captured.body.atype, 6);
    const sentLines = captured.body.surveydatajson.split("\n");
    assert.equal(JSON.parse(sentLines[1]).isquiz, "1");
  });

  it("preserves user-supplied atype even when exam qtypes present", async () => {
    const { fakeFetch, captured } = makeFakeFetch();
    await createSurveyByJson(
      {
        jsonl: [
          '{"qtype":"问卷基础信息","title":"混合题型调查"}',
          '{"qtype":"考试单选","title":"Q","select":["A"]}',
        ].join("\n"),
        atype: 1,
      },
      { apiKey: "k" },
      fakeFetch,
    );
    assert.equal(captured.body.atype, 1);
  });

  it("defaults atype=1 when no exam qtype present", async () => {
    const { fakeFetch, captured } = makeFakeFetch();
    await createSurveyByJson(
      {
        jsonl: [
          '{"qtype":"问卷基础信息","title":"普通问卷"}',
          '{"qtype":"单选","title":"Q","select":["A"]}',
        ].join("\n"),
      },
      { apiKey: "k" },
      fakeFetch,
    );
    assert.equal(captured.body.atype, 1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// injectDefaultRequir
// ═══════════════════════════════════════════════════════════════════════════════

describe("injectDefaultRequir", () => {
  it("injects requir=true on question lines without requir", () => {
    const jsonl = [
      '{"qtype":"问卷基础信息","title":"测试"}',
      '{"qtype":"单选","title":"Q1","select":["A","B"]}',
    ].join("\n");
    const out = injectDefaultRequir(jsonl);
    const lines = out.split("\n");
    assert.equal(JSON.parse(lines[0]).requir, undefined); // 元数据行不注入
    assert.equal(JSON.parse(lines[1]).requir, true);
  });

  it("preserves user-specified requir value", () => {
    const jsonl = '{"qtype":"单选","title":"Q","select":["A"],"requir":false}';
    const out = injectDefaultRequir(jsonl);
    assert.equal(JSON.parse(out).requir, false);
  });

  it("does not touch 分页栏/段落说明/知情同意书", () => {
    const jsonl = [
      '{"qtype":"分页栏"}',
      '{"qtype":"段落说明","title":"说明"}',
      '{"qtype":"知情同意书","title":"同意","content":"..."}',
    ].join("\n");
    const out = injectDefaultRequir(jsonl);
    for (const line of out.split("\n")) {
      assert.equal(JSON.parse(line).requir, undefined);
    }
  });

  it("preserves empty and malformed lines", () => {
    const jsonl = ["", "not json", '{"qtype":"单选","title":"Q"}'].join("\n");
    const out = injectDefaultRequir(jsonl);
    const lines = out.split("\n");
    assert.equal(lines[0], "");
    assert.equal(lines[1], "not json");
    assert.equal(JSON.parse(lines[2]).requir, true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// inferAtypeFromTitle
// ═══════════════════════════════════════════════════════════════════════════════

describe("inferAtypeFromTitle", () => {
  it("infers 3 (投票) from voting keywords", () => {
    assert.equal(inferAtypeFromTitle("2026华语音乐投票问卷"), 3);
    assert.equal(inferAtypeFromTitle("年度最佳员工投票"), 3);
  });

  it("infers 7 (表单) from form keywords", () => {
    assert.equal(inferAtypeFromTitle("周末踏青表单统计"), 7);
    assert.equal(inferAtypeFromTitle("活动报名表"), 7);
    assert.equal(inferAtypeFromTitle("客户登记表"), 7);
    assert.equal(inferAtypeFromTitle("请假申请表"), 7);
  });

  it("infers 6 (考试) from exam keywords", () => {
    assert.equal(inferAtypeFromTitle("期末考试"), 6);
    assert.equal(inferAtypeFromTitle("英语试卷"), 6);
    assert.equal(inferAtypeFromTitle("Python 测试题"), 6);
  });

  it("infers 2 (测评) from assessment keyword", () => {
    assert.equal(inferAtypeFromTitle("员工能力测评"), 2);
  });

  it("returns undefined for generic titles", () => {
    assert.equal(inferAtypeFromTitle("客户满意度调查"), undefined);
    assert.equal(inferAtypeFromTitle(""), undefined);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// createSurveyByJson — atype inference + default requir + title validation
// ═══════════════════════════════════════════════════════════════════════════════

describe("createSurveyByJson 默认必答 & atype 推断 & 标题校验", () => {
  function makeFakeFetch() {
    const captured = { body: null };
    const fakeFetch = async (_url, init) => {
      captured.body = JSON.parse(init.body);
      return new Response(
        JSON.stringify({ result: true, data: { vid: 1 } }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    return { fakeFetch, captured };
  }

  it("注入默认 requir=true 到题目行", async () => {
    const { fakeFetch, captured } = makeFakeFetch();
    await createSurveyByJson(
      {
        jsonl: [
          '{"qtype":"问卷基础信息","title":"客户满意度"}',
          '{"qtype":"单选","title":"Q1","select":["A","B"]}',
        ].join("\n"),
      },
      { apiKey: "k" },
      fakeFetch,
    );
    const sentLines = captured.body.surveydatajson.split("\n");
    assert.equal(JSON.parse(sentLines[1]).requir, true);
  });

  it("标题含「投票」不再抛错（投票类型已支持，atype 自动推断为 3）", async () => {
    const { fakeFetch, captured } = makeFakeFetch();
    await createSurveyByJson(
      {
        jsonl: [
          '{"qtype":"问卷基础信息","title":"2026华语音乐投票"}',
          '{"qtype":"单选","title":"Q","select":["A"]}',
        ].join("\n"),
      },
      { apiKey: "k" },
      fakeFetch,
    );
    assert.equal(captured.body.atype, 3);
  });

  it("标题含「表单」时推断 atype=7", async () => {
    const { fakeFetch, captured } = makeFakeFetch();
    await createSurveyByJson(
      {
        jsonl: [
          '{"qtype":"问卷基础信息","title":"周末踏青表单统计"}',
          '{"qtype":"单选","title":"Q","select":["A"]}',
        ].join("\n"),
      },
      { apiKey: "k" },
      fakeFetch,
    );
    assert.equal(captured.body.atype, 7);
  });

  it("显式 atype 优先于标题关键字推断", async () => {
    const { fakeFetch, captured } = makeFakeFetch();
    await createSurveyByJson(
      {
        jsonl: '{"qtype":"问卷基础信息","title":"年度投票"}\n{"qtype":"单选","title":"Q","select":["A"]}',
        atype: 1,
      },
      { apiKey: "k" },
      fakeFetch,
    );
    assert.equal(captured.body.atype, 1);
  });

  it("空标题时透传（不校验）", async () => {
    const { fakeFetch, captured } = makeFakeFetch();
    await assert.rejects(
      () =>
        createSurveyByJson(
          { jsonl: '{"qtype":"单选","title":"Q","select":["A"]}' },
          { apiKey: "k" },
          fakeFetch,
        ),
      /标题缺失/,
    );
    // 未触发网络调用
    assert.equal(captured.body, null);
  });

  it("标题为 ??? 等占位符时抛错", async () => {
    const { fakeFetch } = makeFakeFetch();
    await assert.rejects(
      () =>
        createSurveyByJson(
          {
            jsonl: '{"qtype":"问卷基础信息","title":"???"}\n{"qtype":"单选","title":"Q","select":["A"]}',
          },
          { apiKey: "k" },
          fakeFetch,
        ),
      /标题无效/,
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// validateSurveyTitle — 边界覆盖
// ═══════════════════════════════════════════════════════════════════════════════

describe("validateSurveyTitle", () => {
  it("放行真实业务标题", () => {
    assert.doesNotThrow(() => validateSurveyTitle("2026 年员工满意度调查"));
    assert.doesNotThrow(() => validateSurveyTitle("XX 项目用户访谈"));
    assert.doesNotThrow(() => validateSurveyTitle("产品 NPS 测试"));
  });

  it("拒绝空 / 全空白标题", () => {
    assert.throws(() => validateSurveyTitle(""), /标题缺失/);
    assert.throws(() => validateSurveyTitle("   "), /标题缺失/);
    assert.throws(() => validateSurveyTitle(undefined), /标题缺失/);
  });

  it("拒绝 ??? / ？？？ 占位符", () => {
    assert.throws(() => validateSurveyTitle("???"), /标题无效/);
    assert.throws(() => validateSurveyTitle("？？？"), /标题无效/);
    assert.throws(() => validateSurveyTitle("? ？  "), /标题无效/);
  });

  it("拒绝长度 < 2 的标题", () => {
    assert.throws(() => validateSurveyTitle("A"), /过短/);
    assert.throws(() => validateSurveyTitle("我"), /过短/);
  });

  it("拒绝黑名单占位符（大小写不敏感）", () => {
    assert.throws(() => validateSurveyTitle("无标题"), /占位符/);
    assert.throws(() => validateSurveyTitle("未命名"), /占位符/);
    assert.throws(() => validateSurveyTitle("UNTITLED"), /占位符/);
    assert.throws(() => validateSurveyTitle("placeholder"), /占位符/);
    assert.throws(() => validateSurveyTitle("TODO"), /占位符/);
    assert.throws(() => validateSurveyTitle("xxx"), /占位符/);
    assert.throws(() => validateSurveyTitle("新问卷"), /占位符/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// validateSurveyHasQuestions — 题目数 ≥ 1 校验
// ═══════════════════════════════════════════════════════════════════════════════

describe("validateSurveyHasQuestions", () => {
  it("放行包含 ≥1 道真实题目的 JSONL", () => {
    const jsonl = [
      '{"qtype":"问卷基础信息","title":"测试"}',
      '{"qtype":"单选","title":"Q1","select":["A","B"]}',
    ].join("\n");
    assert.doesNotThrow(() => validateSurveyHasQuestions(jsonl));
  });

  it("拒绝只有 _meta 行的 JSONL", () => {
    const jsonl = '{"qtype":"问卷基础信息","title":"客户满意度"}';
    assert.throws(() => validateSurveyHasQuestions(jsonl), /未找到有效题目/);
  });

  it("拒绝只有分页/段落/知情同意书的 JSONL", () => {
    const jsonl = [
      '{"qtype":"问卷基础信息","title":"测试"}',
      '{"qtype":"分页栏"}',
      '{"qtype":"段落说明","title":"说明"}',
      '{"qtype":"知情同意书","title":"同意","content":"..."}',
    ].join("\n");
    assert.throws(() => validateSurveyHasQuestions(jsonl), /未找到有效题目/);
  });

  it("空白行 / 无法解析行不影响计数", () => {
    const jsonl = ["", "not json", '{"qtype":"单选","title":"Q","select":["A"]}'].join("\n");
    assert.doesNotThrow(() => validateSurveyHasQuestions(jsonl));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// createSurveyByJson — 增强校验集成
// ═══════════════════════════════════════════════════════════════════════════════

describe("createSurveyByJson 强化校验", () => {
  function makeFakeFetch() {
    const captured = { body: null };
    const fakeFetch = async (_url, init) => {
      captured.body = JSON.parse(init.body);
      return new Response(
        JSON.stringify({ result: true, data: { vid: 1 } }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    return { fakeFetch, captured };
  }

  it("仅 _meta 行（零题目）被拦截", async () => {
    const { fakeFetch, captured } = makeFakeFetch();
    await assert.rejects(
      () =>
        createSurveyByJson(
          { jsonl: '{"qtype":"问卷基础信息","title":"客户满意度调查"}' },
          { apiKey: "k" },
          fakeFetch,
        ),
      /未找到有效题目/,
    );
    assert.equal(captured.body, null);
  });

  it("黑名单标题（如 TODO）被拦截", async () => {
    const { fakeFetch } = makeFakeFetch();
    await assert.rejects(
      () =>
        createSurveyByJson(
          {
            jsonl:
              '{"qtype":"问卷基础信息","title":"TODO"}\n{"qtype":"单选","title":"Q","select":["A"]}',
          },
          { apiKey: "k" },
          fakeFetch,
        ),
      /占位符/,
    );
  });

  it("input.title 也走标题校验（不仅校验 metadata 中的 title）", async () => {
    const { fakeFetch } = makeFakeFetch();
    await assert.rejects(
      () =>
        createSurveyByJson(
          {
            jsonl: '{"qtype":"问卷基础信息","title":"2026 年员工满意度调查"}\n{"qtype":"单选","title":"Q","select":["A"]}',
            title: "无标题",
          },
          { apiKey: "k" },
          fakeFetch,
        ),
      /占位符/,
    );
  });

  it("NON_QUESTION_QTYPE_SET 暴露 4 个非题目 qtype", () => {
    assert.equal(NON_QUESTION_QTYPE_SET.size, 4);
    assert.ok(NON_QUESTION_QTYPE_SET.has("问卷基础信息"));
    assert.ok(NON_QUESTION_QTYPE_SET.has("分页栏"));
    assert.ok(NON_QUESTION_QTYPE_SET.has("段落说明"));
    assert.ok(NON_QUESTION_QTYPE_SET.has("知情同意书"));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// injectAtypeIntoJsonl + atype 注入到 JSONL（修复服务端忽略顶层 atype 的 bug）
// ═══════════════════════════════════════════════════════════════════════════════

describe("injectAtypeIntoJsonl", () => {
  it("inject atype into existing 问卷基础信息 line", () => {
    const jsonl = [
      '{"qtype":"问卷基础信息","title":"投票"}',
      '{"qtype":"单选","title":"Q","select":["A"]}',
    ].join("\n");
    const out = injectAtypeIntoJsonl(jsonl, 3);
    const meta = JSON.parse(out.split("\n")[0]);
    assert.equal(meta.atype, 3);
    assert.equal(meta.title, "投票");
  });

  it("overwrite existing atype in 问卷基础信息", () => {
    const jsonl = '{"qtype":"问卷基础信息","title":"X","atype":1}\n{"qtype":"单选","title":"Q","select":["A"]}';
    const out = injectAtypeIntoJsonl(jsonl, 7);
    assert.equal(JSON.parse(out.split("\n")[0]).atype, 7);
  });

  it("prepend 问卷基础信息 line when missing", () => {
    const jsonl = '{"qtype":"单选","title":"Q","select":["A"]}';
    const out = injectAtypeIntoJsonl(jsonl, 6);
    const lines = out.split("\n");
    const meta = JSON.parse(lines[0]);
    assert.equal(meta.qtype, "问卷基础信息");
    assert.equal(meta.atype, 6);
    assert.equal(lines[1], jsonl);
  });

  it("skip empty/malformed lines", () => {
    const jsonl = ['', 'not json', '{"qtype":"问卷基础信息","title":"X"}'].join("\n");
    const out = injectAtypeIntoJsonl(jsonl, 2);
    const lines = out.split("\n");
    assert.equal(lines[0], "");
    assert.equal(lines[1], "not json");
    assert.equal(JSON.parse(lines[2]).atype, 2);
  });
});

describe("createSurveyByJson 注入 atype 到 JSONL（修复服务端忽略顶层 atype）", () => {
  function makeFakeFetch() {
    const captured = { body: null };
    const fakeFetch = async (_url, init) => {
      captured.body = JSON.parse(init.body);
      return new Response(
        JSON.stringify({ result: true, data: { vid: 1 } }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    return { fakeFetch, captured };
  }

  it("--type 3 投票：显式请求成功透传到 wire", async () => {
    const { fakeFetch, captured } = makeFakeFetch();
    await createSurveyByJson(
      {
        jsonl: [
          '{"qtype":"问卷基础信息","title":"2026 年度歌手投票"}',
          '{"qtype":"单选","title":"Q","select":["A","B"]}',
        ].join("\n"),
        atype: 3,
      },
      { apiKey: "k" },
      fakeFetch,
    );
    assert.equal(captured.body.atype, 3);
    assert.equal(JSON.parse(captured.body.surveydatajson.split("\n")[0]).atype, 3);
  });

  it("--type 7 表单：顶层和 JSONL 内 atype 双写", async () => {
    const { fakeFetch, captured } = makeFakeFetch();
    await createSurveyByJson(
      {
        jsonl: [
          '{"qtype":"问卷基础信息","title":"活动报名表"}',
          '{"qtype":"单选","title":"Q","select":["A"]}',
        ].join("\n"),
        atype: 7,
      },
      { apiKey: "k" },
      fakeFetch,
    );
    assert.equal(captured.body.atype, 7);
    assert.equal(JSON.parse(captured.body.surveydatajson.split("\n")[0]).atype, 7);
  });

  it("用户在 JSONL 内显式声明 atype 时优先于标题推断", async () => {
    const { fakeFetch, captured } = makeFakeFetch();
    await createSurveyByJson(
      {
        // 标题含「投票」推断 = 3，JSONL 内显式声明 = 1
        jsonl: '{"qtype":"问卷基础信息","title":"年度投票","atype":1}\n{"qtype":"单选","title":"Q","select":["A"]}',
      },
      { apiKey: "k" },
      fakeFetch,
    );
    assert.equal(captured.body.atype, 1);
    assert.equal(JSON.parse(captured.body.surveydatajson.split("\n")[0]).atype, 1);
  });

  it("input.atype=3 优先级最高，覆盖 JSONL 内的 atype=1", async () => {
    const { fakeFetch, captured } = makeFakeFetch();
    await createSurveyByJson(
      {
        jsonl: '{"qtype":"问卷基础信息","title":"客户满意度","atype":1}\n{"qtype":"单选","title":"Q","select":["A"]}',
        atype: 3,
      },
      { apiKey: "k" },
      fakeFetch,
    );
    assert.equal(captured.body.atype, 3);
    assert.equal(JSON.parse(captured.body.surveydatajson.split("\n")[0]).atype, 3);
  });

  it("默认 atype=1（普通调查）也写入 JSONL", async () => {
    const { fakeFetch, captured } = makeFakeFetch();
    await createSurveyByJson(
      {
        jsonl: '{"qtype":"问卷基础信息","title":"客户满意度调查"}\n{"qtype":"单选","title":"Q","select":["A"]}',
      },
      { apiKey: "k" },
      fakeFetch,
    );
    assert.equal(captured.body.atype, 1);
    assert.equal(JSON.parse(captured.body.surveydatajson.split("\n")[0]).atype, 1);
  });
});
