import assert from "node:assert/strict";
import { test } from "node:test";
import { JSONL_SUPPORTED_QTYPES } from "wjx-api-sdk";
import { startFixture } from "./fixtures/http-fixture.mjs";

const NON_QUESTION_QTYPES = new Set(["问卷基础信息", "分页栏", "段落说明", "知情同意书"]);
const FRAMEWORK_ONLY_QTYPES = new Set([
  "折叠栏目",
  "轮播图",
  "AI追问",
  "AI处理",
  "AI访谈",
  "图片OCR",
  "VlookUp问卷关联",
  "分页计时器",
]);

function questionFor(qtype) {
  const question = { qtype, title: `全题型评测-${qtype}` };
  if (qtype === "多项填空" || qtype === "考试多项填空") {
    question.title = `全题型评测-${qtype}：字段 {_}，备注 {_}`;
  }
  if (qtype === "NPS量表") question.select = Array.from({ length: 11 }, (_, index) => String(index));
  if (["单选", "多选", "下拉框", "排序", "投票单选", "投票多选", "量表题", "评分单选", "评分多选", "评价题", "情景随机", "商品题", "预约题", "价格断裂点", "选项分类", "CATI调研", "Kano模型", "SUS模型"].includes(qtype)) {
    question.select = ["选项 A", "选项 B", "选项 C"];
  }
  if (qtype.startsWith("考试")) {
    question.select ??= ["选项 A", "选项 B"];
    question.correctselect = ["选项 A"];
    question.quizscore = "5";
  }
  if (["矩阵填空", "矩阵单选", "矩阵多选", "矩阵量表", "矩阵滑动条", "矩阵数值题", "表格数值", "表格填空", "表格下拉框", "表格组合", "自增表格", "邮寄地址", "企业信息", "基本信息", "AI访谈", "循环评价", "PSM模型", "层次分析", "文字点睛"].includes(qtype)) {
    question.rowtitle = ["项目一", "项目二"];
  }
  if (["矩阵单选", "矩阵多选", "矩阵量表", "矩阵数值题"].includes(qtype)) question.select = ["低", "中", "高"];
  if (["矩阵滑动条", "表格数值", "PSM模型"].includes(qtype)) {
    question.minvalue = "0";
    question.maxvalue = "100";
  }
  if (qtype === "比重题") {
    question.rowtitle = ["项目一", "项目二"];
    question.total = "100";
  }
  if (qtype === "滑动条") {
    question.minvalue = "0";
    question.maxvalue = "100";
  }
  if (qtype === "文件上传" || qtype === "多项文件题" || qtype === "考试文件") {
    question.ext = "pdf";
    question.maxsize = "10";
    question.uploadlimit = "1";
  }
  if (qtype === "表格下拉框") question.selects = [["选项 A", "选项 B"], ["选项 C"]];
  if (qtype === "表格组合") {
    question.types = ["文本", "下拉"];
    question.selects = [[], ["选项 A", "选项 B"]];
  }
  if (qtype === "自增表格") {
    question.columntitle = ["列一", "列二"];
    question.selects = [["", "选项 A|选项 B"]];
    question.min_rows = 1;
    question.max_rows = 3;
  }
  if (qtype === "多级下拉") question.leveldata = ["浙江省/杭州市/西湖区"];
  if (qtype === "门店选择") question.stores = ["门店 A", "门店 B"];
  if (["BWS", "MaxDiff", "图片PK", "联合分析", "BPTO模型", "心理学实验"].includes(qtype)) {
    question.mdattr = ["属性 A", "属性 B", "属性 C"];
  }
  if (qtype === "联合分析") question.columntitle = ["品牌", "价格"];
  if (qtype === "品牌漏斗") question.brands = ["品牌 A", "品牌 B"];
  if (qtype === "热力图") question.heatbg = "/images/example.png";
  return question;
}

function parseSuccess(result, label) {
  assert.equal(result.exitCode, 0, `${label}: ${result.stderr}`);
  assert.equal(result.stderr.trim(), "", `${label}: unexpected stderr`);
  const envelope = JSON.parse(result.stdout);
  assert.equal(envelope.ok, true, `${label}: ${result.stdout}`);
  return envelope.data;
}

test("every supported JSONL qtype follows create then get user workflow", async () => {
  const fixture = await startFixture({
    timeout: 120_000,
    env: { WJX_API_KEY: "question-type-workflow-key" },
    response: {
      result: true,
      data: {
        vid: 880001,
        title: "全题型评测",
        atype: 1,
        status: 0,
        questions: [{ q_index: 2, q_type: 3, q_subtype: 3, q_title: "评测题", is_requir: true, items: [] }],
      },
    },
  });

  try {
    const qtypes = [...JSONL_SUPPORTED_QTYPES];
    assert.ok(qtypes.length >= 90, `expected the complete qtype catalog, got ${qtypes.length}`);
    const rows = [{ qtype: "问卷基础信息", title: "全题型评测", atype: 1 }];
    for (const qtype of qtypes) {
      if (qtype !== "问卷基础信息") rows.push(questionFor(qtype));
      if (NON_QUESTION_QTYPES.has(qtype) && qtype !== "问卷基础信息") rows.push(questionFor("单选"));
    }
    rows.push(questionFor("单选"));
    const jsonl = rows.map(JSON.stringify).join("\n");

    const create = await fixture.run(["--yes", "survey", "create", "--jsonl", jsonl]);
    const createData = parseSuccess(create, "create all supported qtypes");
    assert.equal(createData.vid, 880001);
    const createRequest = JSON.parse(fixture.requests().at(-1).body);
    assert.equal(createRequest.action, "1000106");
    assert.equal(createRequest.publish, false, "a survey containing a framework qtype must default to draft");
    const sentQtypes = new Set(createRequest.surveydatajson.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line).qtype));
    for (const qtype of qtypes) {
      if (qtype === "问卷基础信息") continue;
      assert.ok(sentQtypes.has(qtype), `create payload omitted qtype ${qtype}`);
    }

    const get = await fixture.run(["survey", "get", "--vid", "880001"]);
    const getData = parseSuccess(get, "get all-qtype survey");
    assert.equal(getData.vid, 880001);
    assert.ok(Array.isArray(getData.questions));
    assert.equal(fixture.requests().length, 2, "workflow must issue one create and one get request");
  } finally {
    await fixture.close();
  }
});
