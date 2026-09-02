import { Command } from "commander";
import { execFileSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin, stderr } from "node:process";
import { updateSkill, getVersion } from "../lib/install-skill.js";
import { CliError } from "../lib/errors.js";
import { executeRuntimeLocal } from "../lib/runtime/executor.js";

const SEMVER_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

function parseVersion(version: string): [number, number, number] {
  const match = SEMVER_PATTERN.exec(version.trim());
  if (!match) throw new Error(`版本 "${version}" 必须是有效的 semver（x.y.z）`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** Compare two package versions without allowing npm to choose a downgrade. */
export function compareVersions(left: string, right: string): -1 | 0 | 1 {
  const a = parseVersion(left);
  const b = parseVersion(right);
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] < b[index]) return -1;
    if (a[index] > b[index]) return 1;
  }
  return 0;
}

export function shouldUpdate(currentVersion: string, latestVersion: string): boolean {
  return compareVersions(latestVersion, currentVersion) > 0;
}

function npmExecutable(): string {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function runNpm(args: string[], options: Parameters<typeof execFileSync>[2] = {}): ReturnType<typeof execFileSync> {
  if (process.platform === "win32") {
    // Batch files need cmd.exe on Windows; invoking it explicitly avoids Node's
    // shell=true deprecation warning leaking into the CLI error channel.
    return execFileSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", [npmExecutable(), ...args].join(" ")], options);
  }
  return execFileSync(npmExecutable(), args, options);
}

function readLatestVersion(): string {
  let raw: string;
  try {
    raw = String(runNpm(["view", "wjx-cli@latest", "version", "--json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })).trim();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new CliError("API_ERROR", `无法检查 wjx-cli 的 registry 最新版本: ${detail}`);
  }

  let parsed: unknown = raw;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    // npm can return a plain version string when its output is not JSON encoded.
  }
  const candidate = typeof parsed === "string"
    ? parsed
    : parsed && typeof parsed === "object" && !Array.isArray(parsed) && typeof (parsed as { version?: unknown }).version === "string"
      ? (parsed as { version: string }).version
      : "";
  try {
    parseVersion(candidate);
  } catch {
    throw new CliError("API_ERROR", `registry 返回了无效的 wjx-cli 版本: ${candidate || raw || "<empty>"}`);
  }
  return candidate.trim();
}

function readInstalledVersion(global: boolean): string {
  let raw: string;
  try {
    raw = String(runNpm(
      global
        ? ["list", "wjx-cli", "--global", "--depth=0", "--json"]
        : ["list", "wjx-cli", "--depth=0", "--json"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    )).trim();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new CliError("API_ERROR", `无法验证 wjx-cli 实际安装版本: ${detail}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new CliError("API_ERROR", `无法验证 wjx-cli 实际安装版本: npm list 返回了无效 JSON`);
  }
  const dependencies = parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as { dependencies?: unknown }).dependencies
    : undefined;
  const dependency = dependencies && typeof dependencies === "object" && !Array.isArray(dependencies)
    ? (dependencies as Record<string, unknown>)["wjx-cli"]
    : undefined;
  const candidate = dependency && typeof dependency === "object" && !Array.isArray(dependency)
    ? (dependency as { version?: unknown }).version
    : parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as { version?: unknown }).version
      : undefined;
  if (typeof candidate !== "string") {
    throw new CliError("API_ERROR", "无法验证 wjx-cli 实际安装版本: npm list 未返回 wjx-cli.version");
  }
  try {
    parseVersion(candidate);
  } catch {
    throw new CliError("API_ERROR", `无法验证 wjx-cli 实际安装版本: ${candidate}`);
  }
  return candidate.trim();
}

function installLatest(global: boolean): void {
  runNpm(global
    ? ["install", "wjx-cli@latest", "--global"]
    : ["install", "wjx-cli@latest"], { stdio: "pipe" });
}

export function registerUpdateCommands(program: Command): void {
  program
    .command("update")
    .description("自更新 wjx-cli 到最新版本")
    .option("--silent", "静默执行，不询问 skill update")
    .action(async (_opts: { silent?: boolean }, cmd) => {
      const oldVersion = getVersion();
      await executeRuntimeLocal(program, cmd, async (input) => {
        const silent = input.silent === true;
        const latestVersion = readLatestVersion();
        if (!shouldUpdate(oldVersion, latestVersion)) {
          if (!silent) {
            stderr.write(`当前版本: v${oldVersion}\n`);
            stderr.write(`registry 最新版本: v${latestVersion}，未执行更新。\n`);
          }
          return {
            status: "up-to-date",
            oldVersion,
            newVersion: oldVersion,
            latestVersion,
          };
        }

        let globalError: string | undefined;
        let installedVersion: string;
        try {
          installLatest(true);
          installedVersion = readInstalledVersion(true);
        } catch (e) {
          globalError = e instanceof Error ? e.message : String(e);
          try {
            installLatest(false);
            installedVersion = readInstalledVersion(false);
          } catch (err) {
            const msg = `更新失败: ${err instanceof Error ? err.message : String(err)}`;
            throw new CliError("API_ERROR", msg, globalError ? { globalError } : undefined);
          }
        }

        if (compareVersions(installedVersion, latestVersion) < 0) {
          throw new CliError(
            "API_ERROR",
            `更新失败: registry 要求 v${latestVersion}，但实际安装版本为 v${installedVersion}`,
            { installed_version: installedVersion, latest_version: latestVersion },
          );
        }

        const newVersion = installedVersion;
        if (!silent) {
          stderr.write(`当前版本: v${oldVersion}\n`);
          stderr.write("正在更新 wjx-cli...\n");
        }
        if (silent) return { status: "updated", oldVersion, newVersion };

        stderr.write(`更新完成: v${oldVersion} → v${newVersion}\n`);
        if (!stdin.isTTY) return undefined;
        const rl = createInterface({ input: stdin, output: stderr });
        try {
          const answer = await rl.question("是否同时更新技能？(y/n) ");
          if (answer.trim().toLowerCase() === "y") {
            const result = updateSkill(process.cwd());
            if (result.status === "error") stderr.write("提示: 可运行 wjx skill install 先安装技能\n");
          }
        } finally {
          rl.close();
        }
        return undefined;
      }, {
        dryRun: (input) => ({ command: "update", silent: input.silent === true, currentVersion: oldVersion }),
        emit: (_result, input) => input.silent === true,
      });
    });
}
