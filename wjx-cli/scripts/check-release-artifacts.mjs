#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
const root = new URL("..", import.meta.url);
const cwd = fileURLToPath(root);
const stage = mkdtempSync(join(tmpdir(), "wjx-cli-pack-"));
const packageStage = join(stage, "package");
const outputStage = join(stage, "output");
const installStage = join(stage, "install");
try {
  mkdirSync(packageStage, { recursive: true });
  mkdirSync(outputStage, { recursive: true });
  mkdirSync(installStage, { recursive: true });
  const packageJson = JSON.parse(readFileSync(join(cwd, "package.json"), "utf8"));
  const sdkJson = JSON.parse(readFileSync(resolve(cwd, "..", "wjx-api-sdk", "package.json"), "utf8"));
  const sdkVersion = sdkJson.version;
  if (!sdkVersion) throw new Error("unable to resolve wjx-api-sdk version");
  const requiredSdkRange = `^${sdkVersion}`;
  const declaredSdkRange = packageJson.dependencies?.["wjx-api-sdk"];
  if (declaredSdkRange !== requiredSdkRange) {
    throw new Error(`wjx-cli must declare wjx-api-sdk ${requiredSdkRange}; found ${declaredSdkRange ?? "missing"}`);
  }
  packageJson.dependencies = { ...packageJson.dependencies, "wjx-api-sdk": `^${sdkVersion}` };
  writeFileSync(join(packageStage, "package.json"), `${JSON.stringify(packageJson, null, 2)}\n`);

  for (const directory of ["dist", "bundled"]) {
    const source = join(cwd, directory);
    if (!readFileSync(join(source, directory === "dist" ? "index.js" : "wjx-cli-expert.md"))) {
      throw new Error(`release staging missing ${directory}`);
    }
    cpSync(source, join(packageStage, directory), { recursive: true });
  }
  // Keep npm's default included files alongside the explicit `files` payload.
  for (const file of ["README.md", "LICENSE", "CHANGELOG.md"]) {
    const source = join(cwd, file);
    try { cpSync(source, join(packageStage, file)); } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }

  const npmArgs = ["pack", "--ignore-scripts", "--pack-destination", outputStage, "--json"];
  // npm.cmd is not directly spawnable with shell=false on Windows. Invoke its
  // JS entry point with the current Node process so paths remain unambiguous.
  const bundledNpmCli = resolve(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
  const npmCommand = process.platform === "win32" && (process.env.npm_execpath || existsSync(bundledNpmCli))
    ? process.execPath
    : "npm";
  const npmBaseArgs = npmCommand === process.execPath
    ? [process.env.npm_execpath || bundledNpmCli]
    : [];
  const npmCommandArgs = [...npmBaseArgs, ...npmArgs];
  const output = execFileSync(npmCommand, npmCommandArgs, { cwd: packageStage, encoding: "utf8" });
  const tarball = JSON.parse(output)[0]?.filename;
  if (!tarball) throw new Error("npm pack did not produce a tarball");
  const tarballPath = join(outputStage, tarball);
  const sdkRoot = resolve(cwd, "..", "wjx-api-sdk");
  const sdkPackOutput = execFileSync(npmCommand, [
    ...npmBaseArgs,
    "pack", "--ignore-scripts", "--pack-destination", outputStage, "--json",
  ], { cwd: sdkRoot, encoding: "utf8" });
  const sdkTarball = JSON.parse(sdkPackOutput)[0]?.filename;
  if (!sdkTarball) throw new Error("wjx-api-sdk npm pack did not produce a tarball");
  const sdkTarballPath = join(outputStage, sdkTarball);
  const listing = execFileSync("tar", ["-tf", tarballPath], { encoding: "utf8" }).split(/\r?\n/).filter(Boolean);
  if (!listing.includes("package/dist/index.js")) throw new Error("release tarball missing dist/index.js");
  for (const forbidden of ["package/manifest/", "package/perf/", "package/src/"]) if (listing.some((item) => item.startsWith(forbidden))) throw new Error(`release tarball contains ${forbidden}`);
  const packedPackage = JSON.parse(execFileSync("tar", ["-xOf", tarballPath, "package/package.json"], { encoding: "utf8" }));
  if (packedPackage.version !== packageJson.version) throw new Error(`release tarball version mismatch: ${packedPackage.version}`);
  if (packedPackage.dependencies?.["wjx-api-sdk"] !== requiredSdkRange) {
    throw new Error(`release tarball must pin wjx-api-sdk to ^${sdkVersion}`);
  }

  // Static tar listing cannot prove the package works after npm resolves its
  // production dependency graph. Install the exact tarball into an isolated
  // prefix and exercise only side-effect-free published entry points.
  execFileSync(npmCommand, [
    ...npmBaseArgs,
    "install", "--ignore-scripts", "--no-audit", "--no-fund",
    "--prefix", installStage, sdkTarballPath, tarballPath,
  ], { cwd: installStage, stdio: "pipe", encoding: "utf8", timeout: 300_000 });
  const installedCli = join(installStage, "node_modules", packageJson.name, "dist", "index.js");
  if (!existsSync(installedCli)) throw new Error("installed package missing dist/index.js");
  const installedSdk = join(installStage, "node_modules", "wjx-api-sdk", "dist", "index.js");
  if (!existsSync(installedSdk)) throw new Error("installed package missing local wjx-api-sdk");
  const sdkExports = await import(pathToFileURL(installedSdk).href);
  if (!(sdkExports.JSONL_SUPPORTED_QTYPES instanceof Set)) {
    throw new Error("installed local wjx-api-sdk is missing JSONL_SUPPORTED_QTYPES");
  }
  const smokeEnv = { ...process.env, WJX_CONFIG_PATH: join(installStage, "missing.wjxrc"), WJX_API_KEY: "" };
  const version = execFileSync(process.execPath, [installedCli, "--version"], {
    cwd: installStage, env: smokeEnv, encoding: "utf8", timeout: 15_000,
  }).trim();
  if (version !== packageJson.version) throw new Error(`installed CLI version mismatch: ${version}`);
  const dryRun = JSON.parse(execFileSync(process.execPath, [installedCli, "--dry-run", "survey", "list"], {
    cwd: installStage, env: smokeEnv, encoding: "utf8", timeout: 15_000,
  }));
  if (dryRun?.ok !== true || dryRun?.data?.kind !== "dry-run") {
    throw new Error("installed CLI dry-run smoke failed");
  }
  // Load a command that imports the SDK's generated JSONL capability set. This
  // catches a CLI/SDK version mismatch that --version and survey list alone
  // would miss because the root entry intentionally lazy-loads commands.
  const reference = execFileSync(process.execPath, [installedCli, "reference", "question-types"], {
    cwd: installStage, env: smokeEnv, encoding: "utf8", timeout: 15_000,
  });
  if (!reference.includes("单选") || !reference.includes("NPS量表")) {
    throw new Error("installed CLI reference smoke failed: SDK JSONL capability export is unavailable");
  }
  const skillRoot = join(installStage, "skill-target");
  const skillInstall = JSON.parse(execFileSync(process.execPath, [
    installedCli, "skill", "install", "--silent", "--target-dir", skillRoot,
  ], { cwd: installStage, env: smokeEnv, encoding: "utf8", timeout: 15_000 }));
  if (skillInstall?.ok !== true || skillInstall?.data?.status !== "installed") {
    throw new Error("installed CLI Skill smoke failed");
  }
  if (!existsSync(join(skillRoot, "skills", "wjx-cli-use", "SKILL.md"))) {
    throw new Error("installed CLI did not expose bundled Skill files");
  }
  const installedSkill = join(skillRoot, "skills", "wjx-cli-use", "SKILL.md");
  const installedClaudeSkill = join(skillRoot, ".claude", "skills", "wjx-cli-use", "SKILL.md");
  if (!existsSync(installedClaudeSkill)) {
    throw new Error("installed CLI did not synchronize the Claude Skill mirror");
  }
  if (readFileSync(installedSkill, "utf8") !== readFileSync(installedClaudeSkill, "utf8")) {
    throw new Error("installed CLI Skill destinations diverged");
  }
  console.log(`release artifacts passed (${tarball}); installed package smoke passed`);
} finally { rmSync(stage, { recursive: true, force: true }); }
