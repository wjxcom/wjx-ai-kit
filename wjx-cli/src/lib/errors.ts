export type ErrorCode = "API_ERROR" | "INPUT_ERROR" | "AUTH_ERROR";

const EXIT_CODES: Record<ErrorCode, number> = {
  API_ERROR: 1,
  AUTH_ERROR: 1,
  INPUT_ERROR: 2,
};

export class CliError extends Error {
  readonly code: ErrorCode;
  readonly exitCode: number;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = "CliError";
    this.code = code;
    this.exitCode = EXIT_CODES[code];
  }
}

/**
 * Write structured JSON error to stderr and exit.
 */
export function stderrJson(code: ErrorCode, message: string): never {
  const exitCode = EXIT_CODES[code];
  process.stderr.write(
    JSON.stringify({ error: true, message, code, exitCode }) + "\n",
  );
  process.exit(exitCode);
}

/**
 * Classify an unknown error into a CliError.
 * SDK validation errors (e.g. validateQuestionsJson) are INPUT_ERROR.
 */
function classifyError(err: unknown): CliError {
  if (err instanceof CliError) return err;

  if (err instanceof SyntaxError) {
    return new CliError("INPUT_ERROR", err.message);
  }

  if (err instanceof Error) {
    // SDK validation errors contain these patterns
    if (
      err.message.includes("must be valid JSON") ||
      err.message.includes("must be a JSON array") ||
      err.message.includes("missing required field")
    ) {
      return new CliError("INPUT_ERROR", err.message);
    }
    return new CliError("API_ERROR", err.message);
  }

  return new CliError("API_ERROR", String(err));
}

/**
 * Central error handler. Classifies the error, writes stderr JSON, exits.
 */
export function handleError(err: unknown): never {
  const cliErr = classifyError(err);
  stderrJson(cliErr.code, cliErr.message);
}
