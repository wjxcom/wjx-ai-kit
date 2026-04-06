import { addParticipants, modifyParticipants, deleteParticipants, bindActivity, querySurveyBinding, queryUserSurveys, } from "wjx-api-sdk";
import { executeCommand, strictInt, requireField } from "../lib/command-helpers.js";
export function registerUserSystemCommands(program) {
    const userSystem = program.command("user-system").description("用户系统管理");
    // --- add-participants ---
    userSystem
        .command("add-participants")
        .description("添加参与者")
        .option("--users <json>", "参与者JSON")
        .option("--sysid <n>", "系统ID", strictInt)
        .action(async (_opts, cmd) => {
        await executeCommand(program, cmd, addParticipants, (m) => {
            requireField(m, "users");
            requireField(m, "sysid");
            return { users: m.users, sysid: m.sysid };
        });
    });
    // --- modify-participants ---
    userSystem
        .command("modify-participants")
        .description("修改参与者")
        .option("--users <json>", "参与者JSON")
        .option("--sysid <n>", "系统ID", strictInt)
        .action(async (_opts, cmd) => {
        await executeCommand(program, cmd, modifyParticipants, (m) => {
            requireField(m, "users");
            requireField(m, "sysid");
            return { users: m.users, sysid: m.sysid };
        });
    });
    // --- delete-participants ---
    userSystem
        .command("delete-participants")
        .description("删除参与者")
        .option("--uids <json>", "用户ID JSON数组")
        .option("--sysid <n>", "系统ID", strictInt)
        .action(async (_opts, cmd) => {
        await executeCommand(program, cmd, deleteParticipants, (m) => {
            requireField(m, "uids");
            requireField(m, "sysid");
            return { uids: m.uids, sysid: m.sysid };
        });
    });
    // --- bind ---
    userSystem
        .command("bind")
        .description("绑定问卷到用户系统")
        .option("--vid <n>", "问卷ID", strictInt)
        .option("--sysid <n>", "系统ID", strictInt)
        .option("--uids <s>", "参与者ID列表")
        .option("--answer_times <n>", "可答次数", strictInt)
        .option("--can_chg_answer", "允许修改答案")
        .option("--can_view_result", "允许查看结果")
        .option("--can_hide_qlist <n>", "隐藏问卷列表", strictInt)
        .action(async (_opts, cmd) => {
        await executeCommand(program, cmd, bindActivity, (m) => {
            requireField(m, "vid");
            requireField(m, "sysid");
            requireField(m, "uids");
            return {
                vid: m.vid,
                sysid: m.sysid,
                uids: m.uids,
                answer_times: m.answer_times,
                can_chg_answer: m.can_chg_answer,
                can_view_result: m.can_view_result,
                can_hide_qlist: m.can_hide_qlist,
            };
        });
    });
    // --- query-binding ---
    userSystem
        .command("query-binding")
        .description("查询问卷绑定关系")
        .option("--vid <n>", "问卷ID", strictInt)
        .option("--sysid <n>", "系统ID", strictInt)
        .option("--join_status <n>", "参与状态: 0=全部, 1=待参与, 2=已参与", strictInt)
        .option("--day <s>", "按天筛选")
        .option("--week <s>", "按周筛选")
        .option("--month <s>", "按月筛选")
        .option("--force_join_times", "强制参与次数")
        .action(async (_opts, cmd) => {
        await executeCommand(program, cmd, querySurveyBinding, (m) => {
            requireField(m, "vid");
            requireField(m, "sysid");
            return {
                vid: m.vid,
                sysid: m.sysid,
                join_status: m.join_status,
                day: m.day,
                week: m.week,
                month: m.month,
                force_join_times: m.force_join_times,
            };
        });
    });
    // --- query-surveys ---
    userSystem
        .command("query-surveys")
        .description("查询用户关联问卷")
        .option("--uid <s>", "参与者ID")
        .option("--sysid <n>", "系统ID", strictInt)
        .action(async (_opts, cmd) => {
        await executeCommand(program, cmd, queryUserSurveys, (m) => {
            requireField(m, "uid");
            requireField(m, "sysid");
            return {
                uid: m.uid,
                sysid: m.sysid,
            };
        });
    });
}
//# sourceMappingURL=user-system.js.map