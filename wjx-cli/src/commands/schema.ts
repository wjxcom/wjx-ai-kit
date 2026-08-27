import { Command } from "commander";
import { formatOutput } from "../lib/output.js";
import { handleError } from "../lib/errors.js";
import { schemaFor } from "../catalog/schema.js";
export function registerSchemaCommands(program: Command): void {
  program.command("schema").description("查看 Catalog action schema").argument("[action]", "command path 或 action id").action(async (action) => {
    try { formatOutput(action ? schemaFor(action) : { actions: (await import("../catalog/catalog.js")).CATALOG }, program.opts()); }
    catch (error) { handleError(error); }
  });
}
