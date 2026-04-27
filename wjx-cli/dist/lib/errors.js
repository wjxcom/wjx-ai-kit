const EXIT_CODES = {
    API_ERROR: 1,
    AUTH_ERROR: 1,
    INPUT_ERROR: 2,
};
export class CliError extends Error {
    code;
    exitCode;
    constructor(code, message) {
        super(message);
        this.name = "CliError";
        this.code = code;
        this.exitCode = EXIT_CODES[code];
    }
}
/**
 * Write structured JSON error to stderr and exit.
 */
export function stderrJson(code, message) {
    const exitCode = EXIT_CODES[code];
    process.stderr.write(JSON.stringify({ error: true, message, code, exitCode }) + "\n");
    process.exit(exitCode);
}
/**
 * Classify an unknown error into a CliError.
 * SDK validation errors (e.g. validateQuestionsJson) are INPUT_ERROR.
 */
function classifyError(err) {
    if (err instanceof CliError)
        return err;
    if (err instanceof SyntaxError) {
        return new CliError("INPUT_ERROR", err.message);
    }
    if (err instanceof Error) {
        // SDK validation errors contain these patterns
        if (err.message.includes("must be valid JSON") ||
            err.message.includes("must be a JSON array") ||
            err.message.includes("missing required field") ||
            // JSONL preflight / 标题 / 题目校验：本地输入错，不是服务端返回
            err.message.includes("JSONL 第") ||
            err.message.includes("问卷标题") ||
            err.message.includes("未找到有效题目") ||
            err.message.includes("optionalTitles") ||
            err.message.startsWith("题目「")) {
            return new CliError("INPUT_ERROR", err.message);
        }
        return new CliError("API_ERROR", err.message);
    }
    return new CliError("API_ERROR", String(err));
}
/**
 * Central error handler. Classifies the error, writes stderr JSON, exits.
 */
export function handleError(err) {
    const cliErr = classifyError(err);
    stderrJson(cliErr.code, cliErr.message);
}
//# sourceMappingURL=errors.js.map