import { Command } from "commander";
import {
  addAdmin,
  deleteAdmin,
  restoreAdmin,
} from "wjx-api-sdk";
import { executeCommand, requireField } from "../lib/command-helpers.js";

export function registerAdminCommands(program: Command): void {
  const admin = program.command("admin").description("管理员管理");

  // --- add ---
  admin
    .command("add")
    .description("添加管理员")
    .option("--users <json>", "管理员JSON数组")
    .option("--corpid <s>", "企业ID")
    .action(async (_opts, cmd) => {
      await executeCommand(program, cmd, addAdmin, (m) => {
        requireField(m, "users");
        return { users: m.users, corpid: m.corpid };
      });
    });

  // --- delete ---
  admin
    .command("delete")
    .description("删除管理员")
    .option("--uids <s>", "用户ID列表(逗号分隔)")
    .option("--corpid <s>", "企业ID")
    .action(async (_opts, cmd) => {
      await executeCommand(program, cmd, deleteAdmin, (m) => {
        requireField(m, "uids");
        return { uids: m.uids, corpid: m.corpid };
      });
    });

  // --- restore ---
  admin
    .command("restore")
    .description("恢复管理员")
    .option("--uids <s>", "用户ID列表(逗号分隔)")
    .option("--corpid <s>", "企业ID")
    .action(async (_opts, cmd) => {
      await executeCommand(program, cmd, restoreAdmin, (m) => {
        requireField(m, "uids");
        return { uids: m.uids, corpid: m.corpid };
      });
    });
}
