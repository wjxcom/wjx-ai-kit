import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { verifySurveyPostWrite } from "../dist/lib/runtime/post-verify.js";
import { extractJsonlQuestionTypeExpectations } from "wjx-api-sdk";

const ok = (data) => ({ result: true, data });

describe("verifySurveyPostWrite", () => {
  it("fails closed when the read-back survey identity differs from the requested vid", async () => {
    const result = await verifySurveyPostWrite({
      vid: 42,
      expectedTitle: "满意度",
      expectedQuestionCount: 1,
      expectedStatus: "published",
      baseUrl: "https://www.wjx.cn",
      getSurveyFn: async () => ok({
        vid: 99,
        sid: "wrongSurveySid",
        title: "满意度",
        status: 1,
        questions: [{ q_type: 3 }],
        fill_url: "https://www.wjx.cn/vm/wrongSurveySid.aspx",
      }),
    });
    assert.equal(result.verification.structure, false);
    assert.equal(result.verification.status, true);
    assert.equal(result.verification.link, true);
    assert.ok(result.warnings.some((warning) => /identity|survey.*id|问卷编号|身份/i.test(warning)));
  });

  it("fails closed when the read-back survey has no explicit identity", async () => {
    const result = await verifySurveyPostWrite({
      vid: 42,
      expectedTitle: "满意度",
      expectedQuestionCount: 1,
      expectedStatus: "published",
      baseUrl: "https://www.wjx.cn",
      getSurveyFn: async () => ok({
        sid: "missingIdentitySid",
        title: "满意度",
        status: 1,
        questions: [{ q_type: 3 }],
        fill_url: "https://www.wjx.cn/vm/missingIdentitySid.aspx",
      }),
    });
    assert.equal(result.verification.structure, false);
    assert.equal(result.verification.status, true);
    assert.ok(result.warnings.some((warning) => /identity|survey.*id|问卷编号|身份/i.test(warning)));
  });

  it("does not infer a public link from vid alone", async () => {
    const result = await verifySurveyPostWrite({
      vid: 42,
      baseUrl: "https://www.wjx.cn",
      getSurveyFn: async () => ok({ vid: 42, title: "满意度", status: 0, questions: [{ q_type: 3 }] }),
    });
    assert.equal(result.verification.structure, true);
    assert.equal(result.verification.link, false);
    assert.equal(result.fillUrl, undefined);
    assert.match(result.warnings.join(" "), /sid|link/i);
  });

  it("accepts a server short id and verifies structure and status", async () => {
    const result = await verifySurveyPostWrite({
      vid: 42,
      expectedTitle: "满意度",
      expectedQuestionCount: 1,
      baseUrl: "https://www.wjx.cn",
      getSurveyFn: async () => ok({ vid: 42, sid: "Y3eWs", title: "满意度", status: 1, questions: [{ q_type: 3 }] }),
    });
    assert.equal(result.sid, "Y3eWs");
    assert.equal(result.fillUrl, "https://www.wjx.cn/vm/Y3eWs.aspx");
    assert.deepEqual(result.verification, { structure: true, status: true, link: true });
    assert.equal(result.status, "published");
  });

  it("rejects links outside the configured respondent origin", async () => {
    const result = await verifySurveyPostWrite({
      vid: 42,
      baseUrl: "https://www.wjx.cn",
      getSurveyFn: async () => ok({ vid: 42, sid: "Y3eWs", status: 3, fill_url: "https://evil.example/vm/Y3eWs.aspx", questions: [] }),
    });
    assert.equal(result.status, "deleted");
    assert.equal(result.verification.link, false);
    assert.ok(result.warnings.some((warning) => /origin|route/i.test(warning)));
  });

  it("maps terminal and review statuses from the API", async () => {
    const statusCases = [
      [4, "hard-deleted"],
      [5, "reviewed"],
    ];
    for (const [code, expected] of statusCases) {
      const result = await verifySurveyPostWrite({
        vid: 42,
        baseUrl: "https://www.wjx.cn",
        getSurveyFn: async () => ok({ vid: 42, status: code, questions: [] }),
      });
      assert.equal(result.status, expected);
      assert.equal(result.verification.status, true);
    }

    const reviewCases = [
      [1, "approved"],
      [2, "reviewing"],
      [3, "rejected"],
      [4, "pending-real-name"],
    ];
    for (const [code, expected] of reviewCases) {
      const result = await verifySurveyPostWrite({
        vid: 43,
        baseUrl: "https://www.wjx.cn",
        getSurveyFn: async () => ok({ vid: 43, status: 1, verify_status: code, questions: [] }),
      });
      assert.equal(result.verifyStatus, expected);
    }
  });

  it("resolves server paths and edit links while reporting structure mismatches", async () => {
    const result = await verifySurveyPostWrite({
      vid: 42,
      expectedTitle: "满意度",
      expectedQuestionCount: 2,
      expectedQtypes: [3, 4],
      baseUrl: "https://www.wjx.cn",
      getSurveyFn: async () => ok({
        vid: 42,
        sid: "AbC123",
        title: "满意度",
        status: 0,
        questions: [{ q_type: 3 }, { q_type: 5 }],
        activity_domain: "https://www.wjx.cn",
        pc_path: "/vm/AbC123.aspx?source=agent",
        edit_url: "https://www.wjx.cn/newwjx/manage/myquestionnaire.aspx?activity=42",
      }),
    });

    assert.equal(result.fillUrl, "https://www.wjx.cn/vm/AbC123.aspx?source=agent");
    assert.equal(result.editUrl, "https://www.wjx.cn/newwjx/manage/myquestionnaire.aspx?activity=42");
    assert.equal(result.verification.structure, false);
    assert.match(result.warnings.join(" "), /structure/i);
  });

  it("verifies JSONL qtypes and reports unmapped advanced qtypes", async () => {
    const expectedQuestionTypes = extractJsonlQuestionTypeExpectations([
      '{"qtype":"问卷基础信息","title":"题型校验"}',
      '{"qtype":"多选","title":"Q1"}',
      '{"qtype":"AI访谈","title":"Q2"}',
    ].join("\n"));
    const result = await verifySurveyPostWrite({
      vid: 42,
      expectedQuestionTypes,
      expectedQuestionCount: 2,
      baseUrl: "https://www.wjx.cn",
      getSurveyFn: async () => ok({
        vid: 42,
        sid: "AbC123",
        title: "题型校验",
        status: 1,
        questions: [
          { q_type: 3, q_subtype: 3 },
          { q_type: 5, q_subtype: 5 },
        ],
      }),
    });
    assert.equal(result.verification.structure, false);
    assert.ok(result.warnings.some((warning) => /q_type|题目/.test(warning)));
    assert.ok(result.warnings.some((warning) => /AI访谈|跳过/.test(warning)));
  });

  it("allows service expansion rows when the source contains an unverifiable qtype", async () => {
    const expectedQuestionTypes = extractJsonlQuestionTypeExpectations([
      '{"qtype":"问卷基础信息","title":"框架题"}',
      '{"qtype":"品牌漏斗","title":"模型"}',
      '{"qtype":"单选","title":"锚点"}',
    ].join("\n"));
    const result = await verifySurveyPostWrite({
      vid: 42,
      expectedTitle: "框架题",
      expectedQuestionCount: 1,
      expectedQuestionTypes,
      allowAdditionalQuestionRows: true,
      baseUrl: "https://www.wjx.cn",
      getSurveyFn: async () => ok({
        vid: 42,
        sid: "AbC123",
        title: "框架题",
        status: 1,
        questions: [
          { q_type: 4, q_subtype: 4 },
          { q_type: 4, q_subtype: 4 },
          { q_type: 3, q_subtype: 3 },
          { q_type: 3, q_subtype: 3 },
        ],
      }),
    });
    assert.equal(result.verification.structure, true);
    assert.equal(result.verification.status, true);
    assert.ok(result.warnings.some((warning) => /品牌漏斗|跳过/.test(warning)));
  });

  it("falls back to a matching list record when get_survey has no respondent path", async () => {
    let listCalls = 0;
    const result = await verifySurveyPostWrite({
      vid: 42,
      baseUrl: "https://www.wjx.cn",
      getSurveyFn: async () => ok({ vid: 42, sid: "AbC123", status: 1, questions: [] }),
      listSurveysFn: async () => {
        listCalls += 1;
        return ok({
          page_index: 1,
          page_size: 10,
          total_count: 1,
          activitys: {
            "42": {
              vid: 42,
              sid: "AbC123",
              activity_domain: "https://www.wjx.cn",
              mobile_path: "/m/AbC123.aspx",
            },
          },
        });
      },
    });

    assert.equal(listCalls, 1);
    assert.equal(result.fillUrl, "https://www.wjx.cn/m/AbC123.aspx");
    assert.equal(result.verification.link, true);
  });

  it("accepts an official respondent origin supplied by the list fallback", async () => {
    const result = await verifySurveyPostWrite({
      vid: 42,
      baseUrl: "https://www.wjx.cn",
      getSurveyFn: async () => ok({
        vid: 42,
        title: "官方域名回退",
        status: 1,
        questions: [],
      }),
      listSurveysFn: async () => ok({
        page_index: 1,
        page_size: 50,
        total_count: 1,
        activitys: {
          "42": {
            vid: 42,
            sid: "officialFallbackSid",
            activity_domain: "https://v.wjx.cn",
            pc_path: "/vm/officialFallbackSid.aspx",
          },
        },
      }),
    });

    assert.equal(result.fillUrl, "https://v.wjx.cn/vm/officialFallbackSid.aspx");
    assert.equal(result.sid, "officialFallbackSid");
    assert.equal(result.verification.link, true);
  });

  it("accepts the wjx.top respondent origin returned by real survey lists", async () => {
    const result = await verifySurveyPostWrite({
      vid: 43,
      baseUrl: "https://www.wjx.cn",
      getSurveyFn: async () => ok({
        vid: 43,
        status: 1,
        questions: [],
      }),
      listSurveysFn: async () => ok({
        page_index: 1,
        page_size: 50,
        total_count: 1,
        activitys: {
          "43": {
            vid: 43,
            sid: "topFallbackSid",
            activity_domain: "https://www.wjx.top",
            pc_path: "/vm/topFallbackSid.aspx",
          },
        },
      }),
    });

    assert.equal(result.fillUrl, "https://www.wjx.top/vm/topFallbackSid.aspx");
    assert.equal(result.verification.link, true);
  });

  it("rejects numeric respondent paths and cross-origin edit links", async () => {
    const result = await verifySurveyPostWrite({
      vid: 42,
      baseUrl: "https://www.wjx.cn",
      getSurveyFn: async () => ok({
        vid: 42,
        status: 1,
        questions: [],
        activity_domain: "https://www.wjx.cn",
        pc_path: "/vm/42.aspx",
        edit_url: "https://evil.example/newwjx/manage/myquestionnaire.aspx?activity=42",
      }),
    });

    assert.equal(result.fillUrl, undefined);
    assert.equal(result.editUrl, undefined);
    assert.equal(result.verification.link, false);
    assert.ok(result.warnings.some((warning) => /origin|route|sid/i.test(warning)));
  });
});
