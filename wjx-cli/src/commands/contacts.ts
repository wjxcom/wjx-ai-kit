import { Command } from "commander";
import {
  queryContacts,
  addContacts,
  deleteContacts,
} from "wjx-api-sdk";
import { executeCommand, requireField, ensureJsonString } from "../lib/command-helpers.js";

export function registerContactsCommands(program: Command): void {
  const contacts = program.command("contacts").description("通讯录管理");

  // --- query ---
  contacts
    .command("query")
    .description("查询联系人")
    .option("--uid <s>", "用户ID")
    .option("--corpid <s>", "企业ID")
    .action(async (_opts, cmd) => {
      await executeCommand(program, cmd, queryContacts, (m) => {
        requireField(m, "uid");
        return { uid: m.uid, corpid: m.corpid };
      });
    });

  // --- add ---
  contacts
    .command("add")
    .description("添加联系人")
    .option("--users <json>", "用户JSON数组")
    .option("--corpid <s>", "企业ID")
    .option("--auto_create_udept", "自动创建部门")
    .option("--auto_create_tag", "自动创建标签")
    .action(async (_opts, cmd) => {
      await executeCommand(program, cmd, addContacts, (m) => {
        requireField(m, "users");
        return {
          users: ensureJsonString(m.users, "users"),
          corpid: m.corpid,
          auto_create_udept: m.auto_create_udept,
          auto_create_tag: m.auto_create_tag,
        };
      });
    });

  // --- delete ---
  contacts
    .command("delete")
    .description("删除联系人")
    .option("--uids <s>", "用户ID列表(逗号分隔)")
    .option("--corpid <s>", "企业ID")
    .action(async (_opts, cmd) => {
      await executeCommand(program, cmd, deleteContacts, (m) => {
        requireField(m, "uids");
        return { uids: m.uids, corpid: m.corpid };
      });
    });
}
