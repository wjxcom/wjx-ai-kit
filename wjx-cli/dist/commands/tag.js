import { executeRuntimeAction } from "../lib/runtime/executor.js";
import { listTags, addTag, modifyTag, deleteTag, } from "wjx-api-sdk";
import { requireField, requireEnum, ensureNonEmptyJsonArray } from "../lib/command-helpers.js";
export function registerTagCommands(program) {
    const tag = program.command("tag").description("标签管理");
    // --- list ---
    tag
        .command("list")
        .description("列出标签")
        .option("--corpid <s>", "企业ID")
        .action(async (_opts, cmd) => {
        await executeRuntimeAction(program, cmd, listTags, (m) => ({
            corpid: m.corpid,
        }));
    });
    // --- add ---
    tag
        .command("add")
        .description("添加标签")
        .option("--child_names <json>", "标签路径JSON数组")
        .option("--corpid <s>", "企业ID")
        .option("--is_radio", "单选标签")
        .action(async (_opts, cmd) => {
        await executeRuntimeAction(program, cmd, addTag, (m) => {
            requireField(m, "child_names");
            return {
                child_names: ensureNonEmptyJsonArray(m.child_names, "child_names"),
                corpid: m.corpid,
                is_radio: m.is_radio,
            };
        });
    });
    // --- modify ---
    tag
        .command("modify")
        .description("修改标签")
        .option("--tp_id <s>", "标签组ID")
        .option("--tp_name <s>", "标签组名称")
        .option("--child_names <json>", "标签对象JSON数组")
        .option("--corpid <s>", "企业ID")
        .action(async (_opts, cmd) => {
        await executeRuntimeAction(program, cmd, modifyTag, (m) => {
            requireField(m, "tp_id");
            return {
                tp_id: m.tp_id,
                tp_name: m.tp_name,
                child_names: m.child_names === undefined ? undefined : ensureNonEmptyJsonArray(m.child_names, "child_names"),
                corpid: m.corpid,
            };
        });
    });
    // --- delete ---
    tag
        .command("delete")
        .description("删除标签")
        .option("--type <s>", "类型: 1=按ID, 2=按名称")
        .option("--tags <json>", "标签标识JSON数组")
        .option("--corpid <s>", "企业ID")
        .action(async (_opts, cmd) => {
        await executeRuntimeAction(program, cmd, deleteTag, (m) => {
            requireField(m, "type");
            requireField(m, "tags");
            requireEnum(m, "type", ["1", "2"]);
            return { type: m.type, tags: ensureNonEmptyJsonArray(m.tags, "tags"), corpid: m.corpid };
        });
    });
}
//# sourceMappingURL=tag.js.map