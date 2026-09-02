import { Command } from "commander";
import { JSONL_SUPPORTED_QTYPES } from "wjx-api-sdk";
import { CliError } from "../lib/errors.js";
import { executeRuntimeLocal } from "../lib/runtime/executor.js";

const qtypeList = [...JSONL_SUPPORTED_QTYPES].sort().join("、");

const TOPICS: Record<string, { title: string; content: string }> = {
  "question-types": {
    title: "JSONL 题型参考",
    content: `# create 题型参考

action 1000106 接受 JSONL：首行必须是 qtype="问卷基础信息"，后续每行一个题目。
题型名称由服务端 JSONL 解析器决定，CLI 会在发送前校验以下完整文档清单：

${qtypeList}

JSONL 使用中文 qtype、title、select、rowtitle、columntitle 等字段；原始字段会透传给服务端。不要填写旧接口的 q_type、q_subtype、q_title、items 字段。

普通题型未指定 publish 时默认发布；包含折叠栏目、轮播图、AI追问、AI处理、AI访谈、图片OCR、VlookUp问卷关联或分页计时器时默认保持草稿，待编辑页完善后再由用户明确授权发布。`,
  },
  survey: {
    title: "survey 模块命令参考",
    content: `# survey 模块命令参考

## wjx survey list
列出问卷列表。

## wjx survey get
获取问卷详情（含题目和选项）。

## wjx survey create
唯一的问卷创建入口：使用 action 1000106 的 JSONL 文本。
  --jsonl <s>      JSONL 字符串内容
  --file <path>    从文件读取 JSONL
  --title <s>      覆盖 JSONL 中的问卷标题
  --type <n>       问卷类型：1=调查, 2=测评, 3=投票, 4=360度评估, 5=360评估无测评关系, 6=考试, 7=表单, 9=教学评估, 10=量表, 11=民主评议
  --optional_titles <json> 允许设为选填的题目标题 JSON 数组
  --publish        显式要求创建后立即发布（纯框架题型默认不发布）
  --creater <s>    创建者子账号

## 其他 survey 命令
delete、status、settings、update-settings、tags、tag-details、clear-bin、upload、export-text 和 url 的参数以各自 --help 为准。`,
  },
  response: {
    title: "response 模块命令参考",
    content: `# response 模块命令参考

count、query、realtime、download、submit、modify、clear、report、winners、submit-template 和 360-report 的参数以各自 --help 为准。`,
  },
  analytics: {
    title: "analytics 模块命令参考",
    content: `# analytics 模块命令参考

analytics 命令为本地计算，不需要 API Key。支持 decode、nps、csat、anomalies、compare 和 decode-push。`,
  },
  topics: {
    title: "可用参考主题列表",
    content: `# wjx reference 可用主题

question-types   JSONL 题型清单
survey           survey 模块命令参数
response         response 模块参数
analytics        analytics 本地分析命令`,
  },
};

export function registerReferenceCommands(program: Command): void {
  program
    .command("reference")
    .description("输出命令参考文档（JSONL 题型、命令参数等）")
    .argument("[topic]", "主题：question-types, survey, response, analytics（默认列出所有主题）")
    .action(async (_topic: string | undefined, _opts: Record<string, unknown>, cmd: Command) => {
      await executeRuntimeLocal(program, cmd, (_input, command) => {
        const topic = command.args[0] as string | undefined;
        if (!topic) return TOPICS.topics.content;
        const entry = TOPICS[topic];
        if (!entry) {
          throw new CliError("INPUT_ERROR", `未知主题: ${topic}\n可用主题: ${Object.keys(TOPICS).filter((key) => key !== "topics").join(", ")}`);
        }
        return entry.content;
      });
    });
}
