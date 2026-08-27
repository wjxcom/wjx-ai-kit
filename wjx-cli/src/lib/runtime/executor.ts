import type { Command } from "commander";
import type { WjxCredentials, WjxApiResponse, RequestOverrides } from "wjx-api-sdk";
import { getCredentials } from "../auth.js";
import { ensureApiSuccess, handleError } from "../errors.js";
import { formatOutput } from "../output.js";
import { getMerged } from "../command-helpers.js";
import { normalizeInput } from "./input.js";
import { renderDryRun } from "./dry-run.js";
import type { RequestPlan } from "./types.js";
import { getCommandMetadata, getCommandPath } from "../command-metadata.js";
import { ensureConfirmation } from "./confirmation.js";
import { createRuntimeContext, type RuntimeContext } from "./context.js";
import { resolveProfile } from "../profiles.js";

interface RuntimeCommandSpec {
  normalize?: (context: { values: Record<string, unknown>; source: Record<string, string> }) => Record<string, unknown>;
  validate?: (input: Record<string, unknown>) => void;
  /** Pure request projection. It must not require credentials or a transport. */
  buildPlans: (input: Record<string, unknown>) => RequestPlan[];
  prepareExecute?: (input: Record<string, unknown>, credentials: WjxCredentials, requestOptions?: RequestOverrides) => Promise<Record<string, unknown>>;
  execute: (input: Record<string, unknown>, credentials: WjxCredentials, requestOptions?: RequestOverrides) => Promise<WjxApiResponse<unknown>>;
  transformResult?: (result: WjxApiResponse<unknown>) => unknown;
  context?: RuntimeContext;
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
    const context = spec.context ?? createRuntimeContext({
      profile: { ...resolveProfile({ profile: program.opts().profile }) },
    });
    const plans = spec.buildPlans(input);

    if (program.opts().dryRun) {
      const dryRun = renderDryRun(plans);
      formatOutput(dryRun, program.opts());
      return;
    }

    const credentials = getCredentials(program.opts());
    await ensureConfirmation({
      command,
      metadata,
      input,
      options: {
        yes: program.opts().yes === true,
        nonInteractive: program.opts().nonInteractive === true,
        dryRun: false,
      },
      policy: context.policy,
      inputStream: context.streams.stdin,
      outputStream: context.streams.stderr,
    });

    const finalInput = spec.prepareExecute
      ? await spec.prepareExecute(input, credentials, context.requestOptions)
      : input;
    const result = await spec.execute(finalInput, credentials, context.requestOptions);
    ensureApiSuccess(result);
    formatOutput(spec.transformResult ? spec.transformResult(result) : result, program.opts());
  } catch (error) {
    handleError(error);
  }
}
