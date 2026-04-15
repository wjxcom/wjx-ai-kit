import { Command } from "commander";
import {
  addParticipants,
  modifyParticipants,
  deleteParticipants,
  bindActivity,
  querySurveyBinding,
  queryUserSurveys,
} from "wjx-api-sdk";
import { executeCommand, strictInt, requireField, ensureJsonString } from "../lib/command-helpers.js";

export function registerUserSystemCommands(program: Command): void {
  const userSystem = program.command("user-system").description("用户系统管理");

  // --- add-participants ---
  userSystem
    .command("add-participants")
    .description("添加参与者")
    .option("--users <json>", "参与者JSON")
    .option("--sysid <n>", "系统ID", strictInt)
    .option("--auto_create_udept", "部门不存在时自动创建")
    .action(async (_opts, cmd) => {
      await executeCommand(program, cmd, addParticipants, (m) => {
        requireField(m, "users");
        requireField(m, "sysid");
        return {
          users: ensureJsonString(m.users, "users"),
          sysid: m.sysid,
          auto_create_udept: m.auto_create_udept,
        };
      });
    });

  // --- modify-participants ---
  userSystem
    .command("modify-participants")
    .description("修改参与者")
    .option("--users <json>", "参与者JSON")
    .option("--sysid <n>", "系统ID", strictInt)
    .option("--auto_create_udept", "部门不存在时自动创建")
    .action(async (_opts, cmd) => {
      await executeCommand(program, cmd, modifyParticipants, (m) => {
        requireField(m, "users");
        requireField(m, "sysid");
        return {
          users: ensureJsonString(m.users, "users"),
          sysid: m.sysid,
          auto_create_udept: m.auto_create_udept,
        };
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
        return {
          uids: ensureJsonString(m.uids, "uids"),
          sysid: m.sysid,
        };
      });
    });

  // --- bind ---
  userSystem
    .command("bind")
    .description("绑定问卷到用户系统")
    .option("--vid <n>", "问卷ID", strictInt)
    .option("--sysid <n>", "系统ID", strictInt)
    .option("--uids <json>", "参与者ID JSON数组")
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
          uids: ensureJsonString(m.uids, "uids"),
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
