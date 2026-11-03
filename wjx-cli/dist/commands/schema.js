import { schemaFor } from "../catalog/schema.js";
import { CliError } from "../lib/errors.js";
import { executeRuntimeLocal } from "../lib/runtime/executor.js";
export function registerSchemaCommands(program) {
    program.command("schema").description("查看 Catalog action schema").argument("[action]", "command path 或 action id").action(async (_action, _opts, command) => {
        await executeRuntimeLocal(program, command, async (_input, actionCommand) => {
            const action = actionCommand.args[0];
            try {
                return action ? schemaFor(action) : { actions: (await import("../catalog/catalog.js")).CATALOG };
            }
            catch (error) {
                if (error instanceof Error && error.message.startsWith("Unknown catalog action:")) {
                    throw new CliError("INPUT_ERROR", error.message);
                }
                throw error;
            }
        });
    });
}
//# sourceMappingURL=schema.js.map