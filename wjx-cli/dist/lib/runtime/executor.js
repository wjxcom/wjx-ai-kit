import { WjxAmbiguousOutcomeError } from "wjx-api-sdk";
import { applyProfileCredentials, applyProfileDefaults, getCredentials, getProfileApiUrl, getProfileBaseUrl } from "../auth.js";
import { CliError, ensureApiSuccess, handleError } from "../errors.js";
import { formatOutput } from "../output.js";
import { createCapturingFetch, getMerged, redactCapturedRequest } from "../command-helpers.js";
import { normalizeInput } from "./input.js";
import { renderDryRun } from "./dry-run.js";
import { getCommandMetadata, getCommandPath } from "../command-metadata.js";
import { ensureConfirmation } from "./confirmation.js";
import { createRuntimeContext } from "./context.js";
import { resolveProfile } from "../profiles.js";
import { redactSensitive } from "../mask.js";
function isRecord(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
/** Keep post-write evidence inside the payload consumed by formatOutput. */
function appendVerification(output, verified) {
    const evidence = isRecord(verified) ? verified : { verification: verified };
    if (!isRecord(output))
        return { value: output, ...evidence };
    if ("result" in output) {
        const payload = isRecord(output.data)
            ? output.data
            : output.data === undefined
                ? {}
                : { value: output.data };
        return { ...output, data: { ...payload, ...evidence } };
    }
    if (output.ok === true && "data" in output) {
        const payload = isRecord(output.data)
            ? output.data
            : output.data === undefined
                ? {}
                : { value: output.data };
        return { ...output, data: { ...payload, ...evidence } };
    }
    return { ...output, ...evidence };
}
/** A write cannot be reported as successful without all required read-back evidence. */
function isUnverifiedPostWrite(verified, requiredVerification = ["structure", "status", "link"]) {
    if (!isRecord(verified))
        return true;
    if (verified.outcome === "unknown")
        return true;
    const checks = verified.verification;
    if (!isRecord(checks))
        return true;
    const required = requiredVerification.length > 0
        ? requiredVerification
        : ["structure", "status", "link"];
    return required.some((field) => checks[field] !== true
        && !(field === "link" && verified.status === "draft"));
}
function verificationErrorDetails(verified) {
    const evidence = isRecord(verified) ? verified : { verification: verified };
    return { ...evidence, outcome: "unknown" };
}
/** Internal facade used by migrated commands; it has no public protocol of its own. */
export async function executeRuntimeCommand(program, actionCommand, spec) {
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
            formatOutput({ ...dryRun, input: redactSensitive(routedInput) }, program.opts());
            return;
        }
        const credentials = spec.noAuth
            ? (() => {
                const baseUrl = getProfileBaseUrl(context.profile);
                return { apiKey: "", ...(baseUrl ? { baseUrl } : {}) };
            })()
            : applyProfileCredentials(context.credentials ?? getCredentials(program.opts()), context.profile);
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
        const preReadResult = spec.preRead
            ? await spec.preRead(routedInput, credentials, context.requestOptions)
            : undefined;
        const finalInput = spec.prepareExecute
            ? await spec.prepareExecute(routedInput, credentials, context.requestOptions, preReadResult)
            : routedInput;
        let result;
        try {
            result = await spec.execute(finalInput, credentials, context.requestOptions);
        }
        catch (error) {
            if (error instanceof WjxAmbiguousOutcomeError && spec.postVerify) {
                let verification;
                try {
                    // Verification is read-only and must never replay the ambiguous
                    // write. A failure-shaped response preserves the callback contract.
                    verification = await spec.postVerify({
                        result: false,
                        errormsg: error.message,
                        traceid: error.traceId,
                    }, finalInput, credentials, preReadResult);
                }
                catch (verificationError) {
                    verification = {
                        verification: { structure: false, status: false, link: false },
                        warnings: [
                            "read-after-write verification failed after an ambiguous write",
                            verificationError instanceof Error ? verificationError.message : String(verificationError),
                        ],
                    };
                }
                // A successful read-back is sufficient to report the operation as
                // verified even though the original write response was ambiguous.
                if (!isUnverifiedPostWrite(verification, spec.requiredVerification)) {
                    formatOutput(appendVerification({ result: true, data: {} }, verification), program.opts());
                    return;
                }
                throw new CliError("API_ERROR", `${error.message}; outcome remains unknown after read-after-write verification`, {
                    outcome: error.outcome,
                    action: error.action,
                    traceid: error.traceId,
                    attempts: error.attempts,
                    recommendation: "read-after-write verification",
                    verification,
                });
            }
            throw error;
        }
        if (spec.validateResult)
            spec.validateResult(result);
        else
            ensureApiSuccess(result);
        const output = spec.transformResult ? spec.transformResult(result) : result;
        const verified = spec.postVerify
            ? await spec.postVerify(result, finalInput, credentials, preReadResult)
            : undefined;
        if (spec.postVerify && isUnverifiedPostWrite(verified, spec.requiredVerification)) {
            throw new CliError("API_ERROR", "API 请求成功但读回验证未能证明写入结果，结果未知", verificationErrorDetails(verified));
        }
        formatOutput(verified === undefined ? output : appendVerification(output, verified), program.opts());
    }
    catch (error) {
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
export async function executeRuntimeAction(program, actionCommand, sdkFn, buildInput, options = {}) {
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
            const localFn = sdkFn;
            formatOutput(await localFn(input), globalOpts);
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
            const dryRunCreds = applyProfileCredentials(globalOpts.apiKey ? { apiKey: globalOpts.apiKey } : { apiKey: "dry-run" }, context.profile);
            await sdkFn(routedInput, dryRunCreds, fetchImpl, context.requestOptions);
            const request = getCapturedRequest();
            const preview = options.dryRunPreview?.(input);
            formatOutput({
                ...(preview ?? {}),
                kind: "dry-run",
                plans: request ? [redactCapturedRequest(request)] : [],
            }, globalOpts);
            return;
        }
        const creds = applyProfileCredentials(context.credentials ?? getCredentials(globalOpts), context.profile);
        const preReadResult = options.preRead
            ? await options.preRead(routedInput, creds, context.requestOptions)
            : undefined;
        const finalInput = options.transformInput
            ? await options.transformInput(routedInput, creds, context.requestOptions, preReadResult)
            : routedInput;
        let result;
        try {
            result = context.requestOptions
                ? await sdkFn(finalInput, creds, undefined, context.requestOptions)
                : await sdkFn(finalInput, creds);
        }
        catch (error) {
            if (error instanceof WjxAmbiguousOutcomeError && options.postVerify) {
                let verification;
                try {
                    // The callback is read-only by contract. Passing a failure-shaped
                    // response lets create/status callbacks reuse the same verifier
                    // without replaying the ambiguous write.
                    verification = await options.postVerify({
                        result: false,
                        errormsg: error.message,
                        traceid: error.traceId,
                    }, finalInput, creds, preReadResult);
                }
                catch (verificationError) {
                    verification = {
                        verification: { structure: false, status: false, link: false },
                        warnings: [
                            "read-after-write verification failed after an ambiguous write",
                            verificationError instanceof Error ? verificationError.message : String(verificationError),
                        ],
                    };
                }
                // A read-back that proves every required field lets the CLI report a
                // durable success even when the original write response was lost.
                if (!isUnverifiedPostWrite(verification, options.requiredVerification)) {
                    if (options.deprecationWarning)
                        context.streams.stderr.write(`${options.deprecationWarning}\n`);
                    formatOutput(appendVerification({ result: true, data: {} }, verification), globalOpts);
                    return;
                }
                const details = {
                    outcome: error.outcome,
                    action: error.action,
                    traceid: error.traceId,
                    attempts: error.attempts,
                    recommendation: "read-after-write verification",
                    verification,
                };
                throw new CliError("API_ERROR", `${error.message}; outcome remains unknown after read-after-write verification`, details);
            }
            throw error;
        }
        ensureApiSuccess(result);
        const output = options.transformResult ? options.transformResult(result) : result;
        const verified = options.postVerify
            ? await options.postVerify(result, finalInput, creds, preReadResult)
            : undefined;
        if (options.postVerify && isUnverifiedPostWrite(verified, options.requiredVerification)) {
            throw new CliError("API_ERROR", "API 请求成功但读回验证未能证明写入结果，结果未知", verificationErrorDetails(verified));
        }
        if (options.deprecationWarning)
            context.streams.stderr.write(`${options.deprecationWarning}\n`);
        formatOutput(verified === undefined ? output : appendVerification(output, verified), globalOpts);
    }
    catch (error) {
        handleError(error);
    }
}
/** Run a pure/local command through the same output and error boundary. */
export async function executeRuntimeLocal(program, actionCommand, run, options = {}) {
    try {
        const input = getMerged(actionCommand);
        if (program.opts().dryRun && options.dryRun) {
            formatOutput({ kind: "dry-run", plans: [], input: options.dryRun(input) }, program.opts());
            return;
        }
        const result = await run(input, actionCommand);
        if (options.emit && !options.emit(result, input))
            return;
        if (options.rawOutput) {
            process.stdout.write(`${String(result ?? "")}\n`);
        }
        else {
            formatOutput(result, program.opts());
        }
        const exitCode = options.exitCode?.(result);
        if (exitCode !== undefined)
            process.exitCode = exitCode;
    }
    catch (error) {
        handleError(error);
    }
}
//# sourceMappingURL=executor.js.map