import type { Command } from "commander";
import type { WjxCredentials, WjxApiResponse, RequestOverrides } from "wjx-api-sdk";
import { applyProfileCredentials, applyProfileDefaults, getCredentials, getProfileApiUrl } from "../auth.js";
import { ensureApiSuccess, handleError } from "../errors.js";
import { formatOutput } from "../output.js";
import { createCapturingFetch, getMerged } from "../command-helpers.js";
import { normalizeInput } from "./input.js";
import { renderDryRun } from "./dry-run.js";
import type { RequestPlan } from "./types.js";
import { getCommandMetadata, getCommandPath } from "../command-metadata.js";
import { ensureConfirmation } from "./confirmation.js";
import { createRuntimeContext, type RuntimeContext } from "./context.js";
import { resolveProfile } from "../profiles.js";
import { redactSensitive } from "../mask.js";

interface RuntimeCommandSpec {
  normalize?: (context: { values: Record<string, unknown>; source: Record<string, string> }) => Record<string, unknown>;
  validate?: (input: Record<string, unknown>) => void;
  /** Pure request projection. It must not require credentials or a transport. */
  buildPlans: (input: Record<string, unknown>, context?: { apiUrl?: string }) => RequestPlan[];
  prepareExecute?: (input: Record<string, unknown>, credentials: WjxCredentials, requestOptions?: RequestOverrides) => Promise<Record<string, unknown>>;
  execute: (input: Record<string, unknown>, credentials: WjxCredentials, requestOptions?: RequestOverrides) => Promise<WjxApiResponse<unknown>>;
  transformResult?: (result: WjxApiResponse<unknown>) => unknown;
  context?: RuntimeContext;
}

interface RuntimeActionOptions {
  noAuth?: boolean;
  /** Print only after a successful real execution; never pollutes errors or dry-run output. */
  deprecationWarning?: string;
  /** Add pure local information to a dry-run result without making network requests. */
  dryRunPreview?: (input: Record<string, unknown>) => Record<string, unknown> | undefined;
  /** Transform the successful API response before formatting. */
  transformResult?: (result: WjxApiResponse<unknown>) => unknown;
  /** Skip even the captured transport preview for commands whose dry-run is informational only. */
  dryRunNoRequest?: boolean;
  /** Execution-only input preparation. It may perform network prefetches. */
  transformInput?: (input: Record<string, unknown>, creds: unknown) => Promise<Record<string, unknown>>;
  /** Optional runtime dependencies for tests and embedded callers. */
  context?: RuntimeContext;
  /** Transport metadata for SDK calls made by this command. */
  requestOptions?: RequestOverrides;
}

type RuntimeSdkFunction = (input: any, creds: any, ...rest: any[]) => Promise<WjxApiResponse<any>>;

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
    const routedInput = applyProfileDefaults(input, context.profile);
    const plans = spec.buildPlans(routedInput, { apiUrl: getProfileApiUrl(context.profile) });

    if (program.opts().dryRun) {
      const dryRun = renderDryRun(plans);
      formatOutput(dryRun, program.opts());
      return;
    }

    const credentials = applyProfileCredentials(
      context.credentials ?? getCredentials(program.opts()),
      context.profile,
    );
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
      ? await spec.prepareExecute(routedInput, credentials, context.requestOptions)
      : routedInput;
    const result = await spec.execute(finalInput, credentials, context.requestOptions);
    ensureApiSuccess(result);
    formatOutput(spec.transformResult ? spec.transformResult(result) : result, program.opts());
  } catch (error) {
    handleError(error);
  }
}

/**
 * Execute a legacy-shaped action through the shared runtime lifecycle.
 *
 * This is deliberately kept in the runtime module rather than command helpers:
 * command registration code only supplies input binding and the SDK action,
 * while auth, dry-run, confirmation, transport and output remain centralized.
 */
export async function executeRuntimeAction(
  program: Command,
  actionCommand: Command,
  sdkFn: RuntimeSdkFunction,
  buildInput: (merged: Record<string, unknown>) => Record<string, unknown>,
  options: RuntimeActionOptions = {},
): Promise<void> {
  try {
    const merged = getMerged(actionCommand);
    const input = buildInput(merged);
    const globalOpts = program.opts();

    if (options.noAuth) {
      if (globalOpts.dryRun) {
        formatOutput({
          kind: "dry-run",
          plans: [],
          note: "本地命令，不会发送 API 请求",
          input: redactSensitive(input),
        }, globalOpts);
        return;
      }
      const localFn = sdkFn as unknown as (value: Record<string, unknown>) => unknown;
      formatOutput(localFn(input), globalOpts);
      return;
    }

    const context = options.context ?? createRuntimeContext({
      profile: { ...resolveProfile({ profile: globalOpts.profile }) },
      requestOptions: options.requestOptions,
    });
    const routedInput = applyProfileDefaults(input, context.profile);
    const command = getCommandPath(actionCommand);
    await ensureConfirmation({
      command,
      metadata: getCommandMetadata(command),
      input: routedInput,
      options: {
        yes: globalOpts.yes === true,
        nonInteractive: globalOpts.nonInteractive === true,
        dryRun: globalOpts.dryRun === true,
      },
      policy: context.policy,
      inputStream: context.streams.stdin,
      outputStream: context.streams.stderr,
    });

    if (globalOpts.dryRun) {
      if (options.dryRunNoRequest) {
        formatOutput({ kind: "dry-run", plans: [] }, globalOpts);
        return;
      }
      const { fetchImpl, getCapturedRequest } = createCapturingFetch();
      const dryRunCreds = applyProfileCredentials(
        globalOpts.apiKey ? { apiKey: globalOpts.apiKey } : { apiKey: "dry-run" },
        context.profile,
      );
      await sdkFn(routedInput, dryRunCreds, fetchImpl, context.requestOptions);
      const request = getCapturedRequest();
      const preview = options.dryRunPreview?.(input);
      formatOutput({
        ...(preview ?? {}),
        kind: "dry-run",
        plans: request ? [request] : [],
      }, globalOpts);
      return;
    }

    const creds = applyProfileCredentials(
      context.credentials ?? getCredentials(globalOpts),
      context.profile,
    );
    const finalInput = options.transformInput
      ? await options.transformInput(routedInput, creds)
      : routedInput;
    const result = context.requestOptions
      ? await sdkFn(finalInput, creds, undefined, context.requestOptions)
      : await sdkFn(finalInput, creds);
    ensureApiSuccess(result);

    if (options.deprecationWarning) context.streams.stderr.write(`${options.deprecationWarning}\n`);
    formatOutput(options.transformResult ? options.transformResult(result) : result, globalOpts);
  } catch (error) {
    handleError(error);
  }
}

/** Run a pure/local command through the same output and error boundary. */
export async function executeRuntimeLocal(
  program: Command,
  actionCommand: Command,
  run: (input: Record<string, unknown>, command: Command) => unknown | Promise<unknown>,
  options: {
    rawOutput?: boolean;
    dryRun?: (input: Record<string, unknown>) => Record<string, unknown> | undefined;
    emit?: (result: unknown, input: Record<string, unknown>) => boolean;
    exitCode?: (result: unknown) => number | undefined;
  } = {},
): Promise<void> {
  try {
    const input = getMerged(actionCommand);
    if (program.opts().dryRun && options.dryRun) {
      formatOutput({ kind: "dry-run", plans: [], input: options.dryRun(input) }, program.opts());
      return;
    }
    const result = await run(input, actionCommand);
    if (options.emit && !options.emit(result, input)) return;
    if (options.rawOutput) {
      process.stdout.write(`${String(result ?? "")}\n`);
    } else {
      formatOutput(result, program.opts());
    }
    const exitCode = options.exitCode?.(result);
    if (exitCode !== undefined) process.exitCode = exitCode;
  } catch (error) {
    handleError(error);
  }
}
