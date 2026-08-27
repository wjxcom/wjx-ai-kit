import type { Command } from "commander";
import type { WjxCredentials, WjxApiResponse } from "wjx-api-sdk";
import { getCredentials } from "../auth.js";
import { handleError } from "../errors.js";
import { formatOutput } from "../output.js";
import { getMerged } from "../command-helpers.js";
import { normalizeInput } from "./input.js";
import { renderDryRun } from "./dry-run.js";
import type { RequestPlan } from "./types.js";
import { getCommandMetadata, getCommandPath } from "../command-metadata.js";
import { ensureConfirmation } from "./confirmation.js";

interface RuntimeCommandSpec {
  normalize?: (context: { values: Record<string, unknown>; source: Record<string, string> }) => Record<string, unknown>;
  validate?: (input: Record<string, unknown>) => void;
  buildPlans: (input: Record<string, unknown>, credentials: WjxCredentials) => RequestPlan[];
  prepareExecute?: (input: Record<string, unknown>, credentials: WjxCredentials) => Promise<Record<string, unknown>>;
  execute: (input: Record<string, unknown>, credentials: WjxCredentials) => Promise<WjxApiResponse<unknown>>;
  transformResult?: (result: WjxApiResponse<unknown>) => unknown;
}

/** Internal facade used by migrated commands; it has no public protocol of its own. */
export async function executeRuntimeCommand(
  program: Command,
  actionCommand: Command,
  spec: RuntimeCommandSpec,
): Promise<void> {
  try {
    const merged = getMerged(actionCommand);
    const normalized = normalizeInput({ values: merged });
    const input = spec.normalize
      ? spec.normalize({ values: normalized.values, source: normalized.source })
      : normalized.values;
    spec.validate?.(input);
    const command = getCommandPath(actionCommand);
    const metadata = getCommandMetadata(command);
    const credentials = getCredentials(program.opts());
    const plans = spec.buildPlans(input, credentials);

    if (program.opts().dryRun) {
      const dryRun = renderDryRun(plans);
      const request = plans.length === 1 ? { request: dryRun.plans[0] } : { plans: dryRun.plans };
      // Preserve the existing CLI dry-run channel until the unified result protocol lands.
      process.stderr.write(JSON.stringify({ dry_run: true, ...request }, null, 2) + "\n");
      return;
    }

    await ensureConfirmation({
      command,
      metadata,
      input,
      options: {
        yes: program.opts().yes === true,
        nonInteractive: program.opts().nonInteractive === true,
        dryRun: false,
      },
    });

    const finalInput = spec.prepareExecute
      ? await spec.prepareExecute(input, credentials)
      : input;
    const result = await spec.execute(finalInput, credentials);
    if (result.result === false) {
      throw new Error(result.errormsg || "API 请求失败");
    }
    formatOutput(spec.transformResult ? spec.transformResult(result) : result, program.opts());
  } catch (error) {
    handleError(error);
  }
}
