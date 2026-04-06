import { queryResponses, queryResponsesRealtime, downloadResponses, getReport, submitResponse, getWinners, modifyResponse, get360Report, clearResponses, } from "wjx-api-sdk";
import { executeCommand, strictInt, requireField } from "../lib/command-helpers.js";
export function registerResponseCommands(program) {
    const response = program.command("response").description("答卷管理");
    // --- count ---
    response
        .command("count")
        .description("获取问卷答卷总数")
        .option("--vid <n>", "问卷ID", strictInt)
        .action(async (_opts, cmd) => {
        await executeCommand(program, cmd, queryResponses, (m) => {
            requireField(m, "vid");
            return { vid: m.vid, page_size: 1 };
        }, {
            transformResult: (result) => {
                const data = result.data;
                return {
                    result: true,
                    data: {
                        total_count: data?.total_count ?? 0,
                        join_times: data?.join_times ?? 0,
                    },
                };
            },
        });
    });
    // --- query ---
    response
        .command("query")
        .description("查询答卷")
        .option("--vid <n>", "问卷ID", strictInt)
        .option("--page_index <n>", "页码", strictInt)
        .option("--page_size <n>", "每页数量", strictInt)
        .option("--sort <n>", "排序", strictInt)
        .option("--min_index <n>", "最小序号", strictInt)
        .option("--jid <s>", "答卷ID")
        .option("--sojumpparm <s>", "自定义参数")
        .option("--qid <s>", "题目ID")
        .option("--begin_time <n>", "开始时间", strictInt)
        .option("--end_time <n>", "结束时间", strictInt)
        .option("--file_view_expires <n>", "文件链接有效期", strictInt)
        .option("--query_note", "查询备注")
        .option("--distinct_user", "去重用户")
        .option("--distinct_sojumpparm", "去重参数")
        .option("--conds <s>", "查询条件")
        .action(async (_opts, cmd) => {
        await executeCommand(program, cmd, queryResponses, (m) => {
            requireField(m, "vid");
            return {
                vid: m.vid,
                page_index: m.page_index,
                page_size: m.page_size,
                sort: m.sort,
                min_index: m.min_index,
                jid: m.jid,
                sojumpparm: m.sojumpparm,
                qid: m.qid,
                begin_time: m.begin_time,
                end_time: m.end_time,
                file_view_expires: m.file_view_expires,
                query_note: m.query_note,
                distinct_user: m.distinct_user,
                distinct_sojumpparm: m.distinct_sojumpparm,
                conds: m.conds,
            };
        });
    });
    // --- realtime ---
    response
        .command("realtime")
        .description("实时查询最新答卷")
        .option("--vid <n>", "问卷ID", strictInt)
        .option("--count <n>", "数量", strictInt)
        .action(async (_opts, cmd) => {
        await executeCommand(program, cmd, queryResponsesRealtime, (m) => {
            requireField(m, "vid");
            return { vid: m.vid, count: m.count };
        });
    });
    // --- download ---
    response
        .command("download")
        .description("下载答卷")
        .option("--vid <n>", "问卷ID", strictInt)
        .option("--taskid <s>", "任务ID")
        .option("--query_count <n>", "查询数量", strictInt)
        .option("--begin_time <n>", "开始时间", strictInt)
        .option("--end_time <n>", "结束时间", strictInt)
        .option("--min_index <n>", "最小序号", strictInt)
        .option("--qid <s>", "题目ID")
        .option("--sort <n>", "排序", strictInt)
        .option("--query_type <n>", "查询类型", strictInt)
        .option("--suffix <n>", "文件后缀", strictInt)
        .option("--query_record", "查询记录")
        .action(async (_opts, cmd) => {
        await executeCommand(program, cmd, downloadResponses, (m) => {
            requireField(m, "vid");
            return {
                vid: m.vid,
                taskid: m.taskid,
                query_count: m.query_count,
                begin_time: m.begin_time,
                end_time: m.end_time,
                min_index: m.min_index,
                qid: m.qid,
                sort: m.sort,
                query_type: m.query_type,
                suffix: m.suffix,
                query_record: m.query_record,
            };
        });
    });
    // --- submit ---
    response
        .command("submit")
        .description("提交答卷")
        .option("--vid <n>", "问卷ID", strictInt)
        .option("--inputcosttime <n>", "填写耗时(秒)", strictInt)
        .option("--submitdata <s>", "提交数据")
        .option("--udsid <n>", "用户系统ID", strictInt)
        .option("--sojumpparm <s>", "自定义参数")
        .option("--submittime <s>", "提交时间")
        .action(async (_opts, cmd) => {
        await executeCommand(program, cmd, submitResponse, (m) => {
            requireField(m, "vid");
            requireField(m, "inputcosttime");
            requireField(m, "submitdata");
            return {
                vid: m.vid,
                inputcosttime: m.inputcosttime,
                submitdata: m.submitdata,
                udsid: m.udsid,
                sojumpparm: m.sojumpparm,
                submittime: m.submittime,
            };
        });
    });
    // --- modify ---
    response
        .command("modify")
        .description("修改答卷")
        .option("--vid <n>", "问卷ID", strictInt)
        .option("--jid <n>", "答卷ID", strictInt)
        .option("--answers <s>", "答案数据")
        .action(async (_opts, cmd) => {
        await executeCommand(program, cmd, modifyResponse, (m) => {
            requireField(m, "vid");
            requireField(m, "jid");
            requireField(m, "answers");
            return { vid: m.vid, jid: m.jid, type: 1, answers: m.answers };
        });
    });
    // --- clear ---
    response
        .command("clear")
        .description("清空答卷")
        .option("--username <s>", "用户名")
        .option("--vid <n>", "问卷ID", strictInt)
        .option("--reset_to_zero", "重置序号")
        .action(async (_opts, cmd) => {
        await executeCommand(program, cmd, clearResponses, (m) => {
            requireField(m, "username");
            requireField(m, "vid");
            return {
                username: m.username,
                vid: m.vid,
                reset_to_zero: m.reset_to_zero ?? false,
            };
        });
    });
    // --- report ---
    response
        .command("report")
        .description("获取统计报告")
        .option("--vid <n>", "问卷ID", strictInt)
        .option("--min_index <n>", "最小序号", strictInt)
        .option("--jid <s>", "答卷ID")
        .option("--sojumpparm <s>", "自定义参数")
        .option("--begin_time <n>", "开始时间", strictInt)
        .option("--end_time <n>", "结束时间", strictInt)
        .option("--distinct_user", "去重用户")
        .option("--distinct_sojumpparm", "去重参数")
        .option("--conds <s>", "查询条件")
        .action(async (_opts, cmd) => {
        await executeCommand(program, cmd, getReport, (m) => {
            requireField(m, "vid");
            return {
                vid: m.vid,
                min_index: m.min_index,
                jid: m.jid,
                sojumpparm: m.sojumpparm,
                begin_time: m.begin_time,
                end_time: m.end_time,
                distinct_user: m.distinct_user,
                distinct_sojumpparm: m.distinct_sojumpparm,
                conds: m.conds,
            };
        });
    });
    // --- files (已移除 — 仅限混合云/私有化场景) ---
    // --- winners ---
    response
        .command("winners")
        .description("获取中奖名单")
        .option("--vid <n>", "问卷ID", strictInt)
        .option("--atype <n>", "活动类型", strictInt)
        .option("--awardstatus <n>", "领奖状态", strictInt)
        .option("--page_index <n>", "页码", strictInt)
        .option("--page_size <n>", "每页数量", strictInt)
        .action(async (_opts, cmd) => {
        await executeCommand(program, cmd, getWinners, (m) => {
            requireField(m, "vid");
            return {
                vid: m.vid,
                atype: m.atype,
                awardstatus: m.awardstatus,
                page_index: m.page_index,
                page_size: m.page_size,
            };
        });
    });
    // --- 360-report ---
    response
        .command("360-report")
        .description("获取360度报告")
        .option("--vid <n>", "问卷ID", strictInt)
        .option("--taskid <s>", "任务ID")
        .action(async (_opts, cmd) => {
        await executeCommand(program, cmd, get360Report, (m) => {
            requireField(m, "vid");
            return { vid: m.vid, taskid: m.taskid };
        });
    });
}
//# sourceMappingURL=response.js.map