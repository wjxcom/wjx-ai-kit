import { Command } from "commander";
/** 规范化 submitdata 中的题号、矩阵题和排序题答案格式 */
export declare function registerResponseCommands(program: Command): void;
interface SubmitTemplateQuestion {
    q_index: number;
    q_type: number;
    q_subtype?: number;
    q_title?: string;
    /**
     * 非矩阵题：选项列表；
     * 矩阵题（q_type=7）：服务端返回里 items 是**列**（列头），不是行。
     */
    items?: Array<{
        item_index: number;
        item_title?: string;
    }>;
    col_items?: Array<{
        item_index: number;
        item_title?: string;
    }>;
    /** 矩阵题的行标题（q_type=7 时服务端用 item_rows 返回真实行） */
    item_rows?: Array<{
        item_index: number;
        item_title?: string;
    }>;
    gap_count?: number;
}
interface SubmitTemplateOutputQuestion {
    q_index: number;
    q_type: number;
    q_subtype?: number;
    q_title: string;
    placeholder: string;
    hint: string;
}
interface SubmitTemplateResult {
    submitdata: string;
    questions: SubmitTemplateOutputQuestion[];
}
/**
 * 构建 submitdata 模板：跳过 q_type 1（分页栏）/2（段落说明）。
 *
 * 题号策略：**直接使用服务端返回的原始 q_index**（不重排）。
 * 原因：服务端 getSurvey 返回的 q_index 已把"问卷基础信息"占成 1，真实题目从 2 开始；
 * submitResponse 严格校验这个 q_index，重排成 1-based 反而会被服务端拒收"5〒答案不符合要求"。
 */
export declare function buildSubmitTemplate(questions: SubmitTemplateQuestion[]): SubmitTemplateResult;
export {};
