import { createInterface } from "node:readline/promises";
import { CliError } from "../errors.js";
import { defaultPolicyEvaluator } from "../policy.js";
import { requiresConfirmation } from "./risk.js";
export class ConfirmationRequiredError extends CliError {
    constructor(request, target) {
        super("CONFIRMATION_REQUIRED", `confirmation_required: command=${request.command} risk=${request.metadata.risk} target=${target} confirmation_source=missing; pass --yes or run interactively`, {
            type: "confirmation_required",
            command: request.command,
            risk: request.metadata.risk,
            target,
            confirmation_source: "missing",
        });
    }
}
function maskTargetValue(key, value) {
    if (/(api.?key|token|secret|password)/i.test(key))
        return "****";
    if (Array.isArray(value))
        return value.length > 20 ? `[${value.length} items]` : value;
    if (value && typeof value === "object")
        return "[object]";
    return value;
}
export function summarizeTarget(input, fields) {
    const target = Object.fromEntries(fields
        .filter((field) => input[field] !== undefined && input[field] !== null)
        .map((field) => [field, maskTargetValue(field, input[field])]));
    if (Object.keys(target).length === 0)
        return "(unspecified)";
    const serialized = JSON.stringify(target);
    return serialized.length > 512 ? `${serialized.slice(0, 509)}...` : serialized;
}
async function askInteractive(request, target) {
    const input = request.inputStream ?? process.stdin;
    const output = request.outputStream ?? process.stderr;
    output.write(`确认执行高风险命令 ${request.command} (${request.metadata.risk}) target=${target}? [y/N] `);
    const readline = createInterface({ input, output });
    try {
        const answer = await readline.question("");
        return /^(y|yes)$/i.test(answer.trim());
    }
    finally {
        readline.close();
    }
}
export async function ensureConfirmation(request) {
    if (!requiresConfirmation(request.metadata, request.options))
        return "not_required";
    const target = summarizeTarget(request.input, request.metadata.targetFields);
    const policy = request.policy ?? defaultPolicyEvaluator;
    const decision = await policy.evaluate(request.metadata, {
        command: request.command,
        input: request.input,
        options: request.options,
    });
    if (!decision.allowed) {
        throw new CliError("POLICY_DENIED", `policy_denied: command=${request.command} risk=${request.metadata.risk} target=${target} confirmation_source=policy${decision.reason ? ` reason=${decision.reason}` : ""}`, {
            type: "policy_denied",
            command: request.command,
            risk: request.metadata.risk,
            target,
            confirmation_source: "policy",
        });
    }
    if (request.options.yes === true)
        return "cli_yes";
    const input = request.inputStream ?? process.stdin;
    if (request.options.nonInteractive === true || input.isTTY !== true) {
        throw new ConfirmationRequiredError(request, target);
    }
    if (await askInteractive(request, target))
        return "interactive";
    throw new ConfirmationRequiredError(request, target);
}
//# sourceMappingURL=confirmation.js.map