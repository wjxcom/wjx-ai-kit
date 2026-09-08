import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildUnlocked } from "./build.mjs";
import { withBuildLock } from "./build-lock.mjs";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function runTests(args) {
  const testFiles = readdirSync(join(packageRoot, "__tests__"))
    .filter((name) => name.endsWith(".test.mjs"))
    .sort()
    .map((name) => join("__tests__", name));
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, ["--test", ...args, ...testFiles], {
      cwd: packageRoot,
      stdio: "inherit",
      shell: false,
    });
    child.once("error", rejectRun);
    child.once("exit", (code, signal) => {
      if (signal) return resolveRun(1);
      resolveRun(code ?? 1);
    });
  });
}

try {
  const exitCode = await withBuildLock(async () => {
    buildUnlocked();
    return runTests(process.argv.slice(2));
  });
  process.exitCode = exitCode;
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
}
