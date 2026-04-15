/**
 * create_survey_by_text — use-case 测试
 *
 * 从 AI Agent 视角测试 MCP 工具，覆盖典型使用场景：
 * - 基础调查问卷
 * - 考试问卷（atype=6）
 * - 复杂混合题型
 * - 参数校验边界
 * - 错误处理
 *
 * 因为 API 凭据是 dummy 的，实际 API 调用会失败。
 * 但 Zod 校验和参数传递逻辑可以充分验证。
 */
import assert from "node:assert/strict";
import { describe, it, before } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../dist/server.js";

process.env.WJX_APP_ID = process.env.WJX_APP_ID || "test-app-id";
process.env.WJX_APP_KEY = process.env.WJX_APP_KEY || "test-app-key";

async function createTestClient() {
  const server = createServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "test", version: "1.0" });
  await client.connect(clientTransport);
  return { client, server };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Use-case: 输入校验
// ═══════════════════════════════════════════════════════════════════════════════

describe("create_survey_by_text — 输入校验", () => {
  let client;
  before(async () => {
    ({ client } = await createTestClient());
  });

  it("拒绝空参数", async () => {
    const result = await client.callTool({
      name: "create_survey_by_text",
      arguments: {},
    });
    assert.equal(result.isError, true);
  });

  it("拒绝空文本", async () => {
    const result = await client.callTool({
      name: "create_survey_by_text",
      arguments: { text: "" },
    });
    assert.equal(result.isError, true);
  });

  it("拒绝 text 为数字类型", async () => {
    const result = await client.callTool({
      name: "create_survey_by_text",
      arguments: { text: 123 },
    });
    assert.equal(result.isError, true);
  });

  it("拒绝 atype 为字符串", async () => {
    const result = await client.callTool({
      name: "create_survey_by_text",
      arguments: { text: "测试问卷\n\n1. 问题[单选题]\nA\nB", atype: "考试" },
    });
    assert.equal(result.isError, true);
  });

  it("拒绝 publish 为字符串", async () => {
    const result = await client.callTool({
      name: "create_survey_by_text",
      arguments: { text: "测试问卷\n\n1. 问题[单选题]\nA\nB", publish: "true" },
    });
    assert.equal(result.isError, true);
  });

  it("拒绝 atype 为浮点数", async () => {
    const result = await client.callTool({
      name: "create_survey_by_text",
      arguments: { text: "测试问卷\n\n1. 问题[单选题]\nA\nB", atype: 1.5 },
    });
    assert.equal(result.isError, true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Use-case: 基础调查问卷（单选 + 多�� + 填空）
// ═══════════════════════════════════════════════════════════════════════════════

describe("create_survey_by_text — 基础调查问卷", () => {
  let client;
  before(async () => {
    ({ client } = await createTestClient());
  });

  const basicSurveyDSL = [
    "用户满意度调查",
    "",
    "请认真填写以下问卷",
    "",
    "1. 您对产品的总体满意度如何？[单选题]",
    "非常满意",
    "满意",
    "一般",
    "不满意",
    "非常不满意",
    "",
    "2. 您最看重哪些方面？[多选题]",
    "性能",
    "界面",
    "价格",
    "服务",
    "",
    "3. 请留下您的建议[填空题]（选填）",
  ].join("\n");

  it("接受合法的 DSL 文本（返回 API 错误而非校验错误）", async () => {
    const result = await client.callTool({
      name: "create_survey_by_text",
      arguments: { text: basicSurveyDSL },
    });
    // dummy 凭据会导致 API 错误，但不应该是 Zod 校验错误
    // 如果是 isError=true，错误信息应来自 API 而非 Zod
    if (result.isError) {
      const text = result.content[0].text;
      assert.ok(
        !text.includes("Expected"),
        "不应该是 Zod 校验错误: " + text,
      );
    }
  });

  it("默认 atype=1（调查）且 publish=false", async () => {
    const result = await client.callTool({
      name: "create_survey_by_text",
      arguments: { text: "简单问卷\n\n1. 问题[单选题]\n是\n否" },
    });
    // 参数通过 Zod 校验即可，API 错误不影响
    if (result.isError) {
      const text = result.content[0].text;
      assert.ok(!text.includes("Expected"), "不应该是 Zod 校验错误");
    }
  });

  it("显式指定 atype 和 publish", async () => {
    const result = await client.callTool({
      name: "create_survey_by_text",
      arguments: {
        text: basicSurveyDSL,
        atype: 1,
        publish: true,
      },
    });
    if (result.isError) {
      const text = result.content[0].text;
      assert.ok(!text.includes("Expected"), "不应该是 Zod 校验错误");
    }
  });

  it("指定 creater 子账号", async () => {
    const result = await client.callTool({
      name: "create_survey_by_text",
      arguments: {
        text: basicSurveyDSL,
        creater: "subuser01",
      },
    });
    if (result.isError) {
      const text = result.content[0].text;
      assert.ok(!text.includes("Expected"), "不应该是 Zod 校验错误");
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Use-case: 考试问卷（atype=6）
// ══════════════════════════════════════���════════════════════════════════════════

describe("create_survey_by_text — 考试问卷", () => {
  let client;
  before(async () => {
    ({ client } = await createTestClient());
  });

  const examDSL = [
    "期末考试",
    "",
    "请在规定时间内完成",
    "",
    "1. 以下哪个是中国的首都？[单选题]",
    "上海",
    "北京",
    "广州",
    "深圳",
    "",
    "2. 以下哪些是直辖市？[多选题]",
    "北京",
    "上海",
    "天津",
    "重庆",
    "广州",
    "",
    "3. 请简述你对中国历史的理解[填空题]",
  ].join("\n");

  it("atype=6 创建考试问卷", async () => {
    const result = await client.callTool({
      name: "create_survey_by_text",
      arguments: { text: examDSL, atype: 6 },
    });
    if (result.isError) {
      const text = result.content[0].text;
      assert.ok(!text.includes("Expected"), "不应该是 Zod 校验错误");
    }
  });

  it("考试问卷 + 不发布", async () => {
    const result = await client.callTool({
      name: "create_survey_by_text",
      arguments: { text: examDSL, atype: 6, publish: false },
    });
    if (result.isError) {
      const text = result.content[0].text;
      assert.ok(!text.includes("Expected"));
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Use-case: 复杂混合题型
// ═══════════════════════════════════════════════════════════════════════════════

describe("create_survey_by_text — 复杂混合题型", () => {
  let client;
  before(async () => {
    ({ client } = await createTestClient());
  });

  it("量表 + 矩阵 + 下拉框 + 判断题", async () => {
    const dsl = [
      "综合测评",
      "",
      "1. 请为我们的服务打分[量表题]",
      "1~10",
      "",
      "2. 请评价以下维度[矩阵单选题]",
      "非常差 差 一般 好 非常好",
      "- 服务态度",
      "- 响应速度",
      "- 专业能力",
      "",
      "3. 请选择您的城市[下拉框]",
      "北京",
      "上海",
      "广州",
      "深圳",
      "",
      "4. 地球是圆的[判断题]",
      "对",
      "错",
    ].join("\n");

    const result = await client.callTool({
      name: "create_survey_by_text",
      arguments: { text: dsl },
    });
    if (result.isError) {
      const text = result.content[0].text;
      assert.ok(!text.includes("Expected"), "不应该是 Zod 校验错误");
    }
  });

  it("评分单选 + 排序题 + 比重题", async () => {
    const dsl = [
      "产品评估",
      "",
      "1. 产品质量评分[评分单选]",
      "1星",
      "2星",
      "3星",
      "4星",
      "5星",
      "",
      "2. 请对以下功能排序[排序题]",
      "搜索",
      "推荐",
      "收藏",
      "分享",
      "",
      "3. 请分配预算比例[比重题]",
      "研发",
      "市场",
      "运营",
    ].join("\n");

    const result = await client.callTool({
      name: "create_survey_by_text",
      arguments: { text: dsl },
    });
    if (result.isError) {
      const text = result.content[0].text;
      assert.ok(!text.includes("Expected"));
    }
  });

  it("多项填空题（含占位符）", async () => {
    const dsl = [
      "个人信息收集",
      "",
      "1. 请填写您的信息[多项填空题]",
      "姓名{_}，年龄{_}，城市{_}",
    ].join("\n");

    const result = await client.callTool({
      name: "create_survey_by_text",
      arguments: { text: dsl },
    });
    if (result.isError) {
      const text = result.content[0].text;
      assert.ok(!text.includes("Expected"));
    }
  });

  it("段落说明 + 文件上传", async () => {
    const dsl = [
      "作业提交",
      "",
      "1. 以下是作业要求[段落说明]",
      "请认真完成并上传附件",
      "",
      "2. 请上传作业文件[文件上传]",
    ].join("\n");

    const result = await client.callTool({
      name: "create_survey_by_text",
      arguments: { text: dsl },
    });
    if (result.isError) {
      const text = result.content[0].text;
      assert.ok(!text.includes("Expected"));
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Use-case: NPS 标准问卷（AI Agent 最常生成的场景）
// ═══════════════════════════════════════════════════════════════════════════════

describe("create_survey_by_text — NPS 问卷", () => {
  let client;
  before(async () => {
    ({ client } = await createTestClient());
  });

  it("标准 NPS 0~10 量表", async () => {
    const dsl = [
      "NPS 净推荐值调查",
      "",
      "感谢您使用我们的产品",
      "",
      "1. 您有多大可能向朋友或同事推荐我们的产品？[量表题]",
      "0~10",
      "",
      "2. 请告诉我们您打分的原因[填空题]（选填）",
    ].join("\n");

    const result = await client.callTool({
      name: "create_survey_by_text",
      arguments: { text: dsl, atype: 1 },
    });
    if (result.isError) {
      const text = result.content[0].text;
      assert.ok(!text.includes("Expected"), "NPS 问卷应通过校验");
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Use-case: 边界和极端情况
// ═══════════════════════════════════════════════════════════════════════════════

describe("create_survey_by_text — 边界情况", () => {
  let client;
  before(async () => {
    ({ client } = await createTestClient());
  });

  it("仅标题无题目", async () => {
    const result = await client.callTool({
      name: "create_survey_by_text",
      arguments: { text: "空问卷标题" },
    });
    // 纯标题也应通过 Zod 校验（至少 1 个字符），API 端决定是否允许
    if (result.isError) {
      const text = result.content[0].text;
      assert.ok(!text.includes("Expected"));
    }
  });

  it("很长的 DSL 文本（50 题）", async () => {
    const lines = ["大规模问卷", ""];
    for (let i = 1; i <= 50; i++) {
      lines.push(`${i}. 第${i}个问题[单选题]`);
      lines.push("选项A");
      lines.push("选项B");
      lines.push("选项C");
      lines.push("");
    }
    const result = await client.callTool({
      name: "create_survey_by_text",
      arguments: { text: lines.join("\n") },
    });
    if (result.isError) {
      const text = result.content[0].text;
      assert.ok(!text.includes("Expected"), "50 题问卷应通过校验");
    }
  });

  it("包含特殊字符和 emoji 的文本", async () => {
    const dsl = [
      "产品反馈 🎯",
      "",
      "1. 您觉得 UI/UX 设计如何？[单选题]",
      "很棒 👍",
      "一般 😐",
      "需改进 👎",
    ].join("\n");

    const result = await client.callTool({
      name: "create_survey_by_text",
      arguments: { text: dsl },
    });
    if (result.isError) {
      const text = result.content[0].text;
      assert.ok(!text.includes("Expected"));
    }
  });

  it("包含换行和空行的文本", async () => {
    const dsl = "问卷\n\n\n\n1. 问题[单选题]\n\nA\n\nB\n\n";
    const result = await client.callTool({
      name: "create_survey_by_text",
      arguments: { text: dsl },
    });
    if (result.isError) {
      const text = result.content[0].text;
      assert.ok(!text.includes("Expected"));
    }
  });

  it("全部可选参数一起传", async () => {
    const result = await client.callTool({
      name: "create_survey_by_text",
      arguments: {
        text: "完整参数测试\n\n1. 问题[单选题]\n是\n否",
        atype: 7,
        publish: true,
        creater: "admin_user",
      },
    });
    if (result.isError) {
      const text = result.content[0].text;
      assert.ok(!text.includes("Expected"), "全参数应通过校验");
    }
  });

  it("各种 atype 值均能通过校验", async () => {
    const dsl = "测试\n\n1. 问题[单选题]\nA\nB";
    for (const atype of [1, 2, 3, 6, 7]) {
      const result = await client.callTool({
        name: "create_survey_by_text",
        arguments: { text: dsl, atype },
      });
      if (result.isError) {
        const text = result.content[0].text;
        assert.ok(
          !text.includes("Expected"),
          `atype=${atype} 不应触发 Zod 校验错误`,
        );
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Use-case: 考试完形填空（特殊题型）
// ═══════════════════════════════════════════════════════════════════════════════

describe("create_survey_by_text — 特殊考试题型", () => {
  let client;
  before(async () => {
    ({ client } = await createTestClient());
  });

  it("考试多项填空", async () => {
    const dsl = [
      "英语填空测试",
      "",
      "1. 请补全句子[考试多项填空]",
      "The boy {_} a student. He {_} to school every day.",
    ].join("\n");

    const result = await client.callTool({
      name: "create_survey_by_text",
      arguments: { text: dsl, atype: 6 },
    });
    if (result.isError) {
      const text = result.content[0].text;
      assert.ok(!text.includes("Expected"));
    }
  });

  it("考试完形填空", async () => {
    const dsl = [
      "完形填空练习",
      "",
      "1. 阅读并填空[考试完形填空]",
      "中国的首都是{_}，人口最多的城市是{_}。",
    ].join("\n");

    const result = await client.callTool({
      name: "create_survey_by_text",
      arguments: { text: dsl, atype: 6 },
    });
    if (result.isError) {
      const text = result.content[0].text;
      assert.ok(!text.includes("Expected"));
    }
  });
});
