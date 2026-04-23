export const ANALYSIS_METHODS = {
    NPS: {
        name: "净推荐值 (Net Promoter Score)",
        formula: "NPS = 推荐者比例 - 贬损者比例",
        scale: "0-10分",
        categories: {
            promoters: "9-10分（推荐者）",
            passives: "7-8分（被动者）",
            detractors: "0-6分（贬损者）",
        },
        benchmarks: {
            excellent: ">70",
            good: "50-70",
            average: "0-50",
            poor: "<0",
        },
    },
    CSAT: {
        name: "客户满意度 (Customer Satisfaction)",
        formula: "CSAT = 满意回答数 / 总回答数 × 100%",
        typical_scale: "1-5分或1-7分",
        benchmarks: {
            excellent: ">90%",
            good: "75-90%",
            average: "50-75%",
            poor: "<50%",
        },
    },
    CES: {
        name: "客户费力度 (Customer Effort Score)",
        formula: "CES = 所有回答的平均分（1-7量表）",
        typical_scale: "1-7分",
        interpretation: "分数越低越好（客户越省力）",
        benchmarks: {
            excellent: "<2",
            good: "2-3",
            average: "3-5",
            poor: ">5",
        },
    },
};
export const RESPONSE_FORMAT_GUIDE = {
    format: "题号$答案}题号$答案",
    separators: {
        question: "}",
        answer: "$",
        option: "|",
        matrix_pair: "!",
    },
    examples: {
        single_choice: "1$1（第1题选第1项）",
        multiple_choice: "2$1|3（第2题选第1和第3项）",
        fill_in: "3$答案文本",
        scale: "4$8（第4题选8分）",
        ranking: "5$2|3|1（排序题按名次顺序使用竖线分隔）",
        matrix_scale: "6$1!3,2!3,3!4,4!3（第6题矩阵量表：第1行选3，第2行选3，第3行选4，第4行选3）",
    },
    notes: [
        "矩阵/矩阵量表题使用 ! 连接“行号”和“值”，整体格式为 题号$行号!值,行号!值",
        "旧的 row_col 写法（如 1_3）在 submit_response / response submit 中会被自动归一化为 ! 格式",
    ],
};
//# sourceMappingURL=analysis-reference.js.map