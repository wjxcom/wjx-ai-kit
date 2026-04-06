import { Command } from "commander";
import {
  listDepartments,
  addDepartment,
  modifyDepartment,
  deleteDepartment,
} from "wjx-api-sdk";
import { executeCommand, requireField } from "../lib/command-helpers.js";

export function registerDepartmentCommands(program: Command): void {
  const department = program.command("department").description("部门管理");

  // --- list ---
  department
    .command("list")
    .description("列出部门")
    .option("--corpid <s>", "企业ID")
    .action(async (_opts, cmd) => {
      await executeCommand(program, cmd, listDepartments, (m) => ({
        corpid: m.corpid,
      }));
    });

  // --- add ---
  department
    .command("add")
    .description("添加部门")
    .option("--depts <json>", "部门路径JSON数组")
    .option("--corpid <s>", "企业ID")
    .action(async (_opts, cmd) => {
      await executeCommand(program, cmd, addDepartment, (m) => {
        requireField(m, "depts");
        return { depts: m.depts, corpid: m.corpid };
      });
    });

  // --- modify ---
  department
    .command("modify")
    .description("修改部门")
    .option("--depts <json>", "部门对象JSON数组")
    .option("--corpid <s>", "企业ID")
    .action(async (_opts, cmd) => {
      await executeCommand(program, cmd, modifyDepartment, (m) => {
        requireField(m, "depts");
        return { depts: m.depts, corpid: m.corpid };
      });
    });

  // --- delete ---
  department
    .command("delete")
    .description("删除部门")
    .option("--type <s>", "类型: 1=按ID, 2=按名称")
    .option("--depts <json>", "部门标识JSON数组")
    .option("--corpid <s>", "企业ID")
    .option("--del_child", "删除子部门")
    .action(async (_opts, cmd) => {
      await executeCommand(program, cmd, deleteDepartment, (m) => {
        requireField(m, "type");
        requireField(m, "depts");
        return {
          type: m.type,
          depts: m.depts,
          corpid: m.corpid,
          del_child: m.del_child,
        };
      });
    });
}
