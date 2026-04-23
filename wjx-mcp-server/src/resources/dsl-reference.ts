export const DSL_SYNTAX_GUIDE = {
  title: "问卷星 DSL 语法参考",
  description: "surveyToText() 输出格式与 TxtToActivityService.cs 输入格式对照",
  syntax: {
    structure: [
      "第一行：问卷标题",
      "空行后：问卷描述（可选）",
      "空行后：题目列表",
      "题目之间用空行分隔",
      "分页用 === 分页 === 标记",
    ],
    question_format: "序号. 题目标题[题型标记]",
    option_format: "每个选项独占一行（无前缀）",
    scale_format: "min~max（如 1~5）",
    page_separator: "=== 分页 ===",
    paragraph: "不带序号的段落为引导语/段落说明",
    optional_mark: "（选填）标记非必填题",
  },
  type_labels: {
    "[单选题]": "q_type=3, q_subtype=3（可省略，默认题型）",
    "[多选题]": "q_type=4, q_subtype=4",
    "[下拉框]": "q_type=3, q_subtype=301",
    "[量表题]": "q_type=3, q_subtype=302",
    "[反向量表题]": "量表题反向计分（API 层无独立编码）",
    "[评分单选]": "q_type=3, q_subtype=303",
    "[情景题]": "q_type=3, q_subtype=304",
    "[判断题]": "q_type=3, q_subtype=305",
    "[评分多选]": "q_type=4, q_subtype=401",
    "[排序题]": "q_type=4, q_subtype=402",
    "[商品题]": "q_type=4, q_subtype=403",
    "[填空题]": "q_type=5, q_subtype=5",
    "[多级下拉题]": "q_type=5, q_subtype=501",
    "[简答题]": "q_type=5 的别名",
    "[问答题]": "q_type=5 的别名",
    "[多项填空题]": "q_type=6, q_subtype=6（q_title 须含填空符 {_}）",
    "[矩阵题]": "q_type=7, q_subtype=7（通用矩阵）",
    "[矩阵单选题]": "q_type=7, q_subtype=702",
    "[矩阵多选题]": "q_type=7, q_subtype=703",
    "[矩阵量表题]": "q_type=7, q_subtype=701",
    "[矩阵填空题]": "q_type=7, q_subtype=704",
    "[矩阵滑动条]": "q_type=7, q_subtype=705",
    "[矩阵数值题]": "q_type=7, q_subtype=706",
    "[表格填空题]": "q_type=7, q_subtype=707",
    "[表格下拉框]": "q_type=7, q_subtype=708",
    "[表格组合题]": "q_type=7, q_subtype=709",
    "[表格自增题]": "q_type=7, q_subtype=710",
    "[多项文件题]": "q_type=7, q_subtype=711",
    "[多项简答题]": "q_type=7, q_subtype=712",
    "[文件上传]": "q_type=8, q_subtype=8",
    "[绘图题]": "q_type=8, q_subtype=801",
    "[比重题]": "q_type=9, q_subtype=9",
    "[滑动条]": "q_type=10, q_subtype=10",
    "[考试多项填空]": "q_type=6, q_subtype=601（q_title 须含填空符 {_}）",
    "[考试完形填空]": "q_type=6, q_subtype=602（q_title 须含填空符 {_}）",
    "[完形填空]": "[考试完形填空] 的别名",
    "[分页栏]": "q_type=1（不出现在 DSL 输出，用 === 分页 === 代替）",
    "[段落说明]": "q_type=2（不带序号的纯文本段落）",
  },
  bracket_compatibility: "TxtToActivityService 支持 [] / 【】 / () / （）四种括号",
  example: `员工满意度调查

请根据您的实际体验填写以下问卷。

1. 您的部门[下拉框]
技术部
市场部
销售部
人事部

2. 您对工作环境的满意度[量表题]
1~5

3. 您认为最重要的福利是？[多选题]
薪资
假期
培训机会
健康保险

=== 分页 ===

4. 请对以下维度评分[矩阵量表题]
行：
- 沟通效率
- 团队协作
- 管理支持

5. 您的改进建议[填空题]`,
  matrix_column_format: {
    description: "矩阵题支持自定义列标签（列头），有3种写法",
    formats: [
      {
        name: "DSL 格式（推荐）",
        description: "使用「行：」和「列：」明确分隔行列",
        example: `1. 评价以下维度[矩阵单选题]
行：
- 沟通效率
- 团队协作
列：
- 非常好
- 好
- 一般
- 差`,
      },
      {
        name: "AI 格式",
        description: "第一行为空格分隔的列头，后续行为行标题",
        example: `1. 评价以下维度[矩阵单选题]
非常好 好 一般 差
沟通效率
团队协作`,
      },
      {
        name: "纯行格式（默认）",
        description: "不指定列标签时，所有行作为行标题，列使用默认编号",
        example: `1. 评价以下维度[矩阵量表题]
沟通效率
团队协作
管理支持`,
      },
    ],
    notes: [
      "列标签在 API 层对应 col_items 字段",
      "如不指定列标签，问卷星前端显示默认列头",
      "矩阵量表题建议使用纯行格式 + 在前端手动设置量表范围",
    ],
  },
  limitations: [
    "DSL 是问卷的「可读摘要」，不是完整序列化",
    "分支逻辑（跳转规则）不在 DSL 中表示",
    "验证规则（正则、长度限制）不在 DSL 中表示",
    "评分规则和权重不在 DSL 中表示",
    "随机化设置不在 DSL 中表示",
    "以上高级设置需通过 get_survey 的 JSON 格式获取",
  ],
};
