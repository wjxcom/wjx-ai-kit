import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { withBuildLock } from "./build-lock.mjs";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = resolve(packageRoot, "..");

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: packageRoot,
    stdio: "inherit",
    shell: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const signal = result.signal ? ` (signal ${result.signal})` : "";
    throw new Error(`${command} ${args.join(" ")} exited with code ${result.status}${signal}`);
  }
}

function resolveTypeScriptCompiler() {
  const candidates = [
    resolve(packageRoot, "node_modules", "typescript", "bin", "tsc"),
    resolve(workspaceRoot, "node_modules", "typescript", "bin", "tsc"),
  ];
  const compiler = candidates.find((candidate) => existsSync(candidate));
  if (!compiler) throw new Error("TypeScript compiler not found; run npm install first");
  return compiler;
}

export function buildUnlocked() {
  run(process.execPath, [resolve(packageRoot, "scripts", "clean-dist.mjs")]);
  run(process.execPath, [resolveTypeScriptCompiler(), "-p", resolve(packageRoot, "tsconfig.json")]);
  run(process.execPath, [resolve(packageRoot, "scripts", "copy-capabilities.mjs")]);
}

export function build() {
  return withBuildLock(() => buildUnlocked());
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    await build();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
