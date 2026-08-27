#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
const root = new URL("..", import.meta.url);
const cwd = fileURLToPath(root);
const stage = mkdtempSync(join(tmpdir(), "wjx-cli-pack-"));
const packageStage = join(stage, "package");
const outputStage = join(stage, "output");
try {
  mkdirSync(packageStage, { recursive: true });
  mkdirSync(outputStage, { recursive: true });
  const packageJson = JSON.parse(readFileSync(join(cwd, "package.json"), "utf8"));
  const sdkJson = JSON.parse(readFileSync(resolve(cwd, "..", "wjx-api-sdk", "package.json"), "utf8"));
  const sdkVersion = sdkJson.version;
  if (!sdkVersion) throw new Error("unable to resolve wjx-api-sdk version");
  packageJson.dependencies = { ...packageJson.dependencies, "wjx-api-sdk": `^${sdkVersion}` };
  writeFileSync(join(packageStage, "package.json"), `${JSON.stringify(packageJson, null, 2)}\n`);

  for (const directory of ["dist", "bundled"]) {
    const source = join(cwd, directory);
    if (!readFileSync(join(source, directory === "dist" ? "index.js" : "wjx-cli-expert.md"))) {
      throw new Error(`release staging missing ${directory}`);
    }
    cpSync(source, join(packageStage, directory), { recursive: true });
  }
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
  const npmCommandArgs = npmCommand === process.execPath
    ? [process.env.npm_execpath || bundledNpmCli, ...npmArgs]
    : npmArgs;
  const output = execFileSync(npmCommand, npmCommandArgs, { cwd: packageStage, encoding: "utf8" });
  const tarball = JSON.parse(output)[0]?.filename;
  if (!tarball) throw new Error("npm pack did not produce a tarball");
  const tarballPath = join(outputStage, tarball);
  const listing = execFileSync("tar", ["-tf", tarballPath], { encoding: "utf8" }).split(/\r?\n/).filter(Boolean);
  if (!listing.includes("package/dist/index.js")) throw new Error("release tarball missing dist/index.js");
  for (const forbidden of ["package/manifest/", "package/perf/", "package/src/"]) if (listing.some((item) => item.startsWith(forbidden))) throw new Error(`release tarball contains ${forbidden}`);
  const packedPackage = JSON.parse(execFileSync("tar", ["-xOf", tarballPath, "package/package.json"], { encoding: "utf8" }));
  if (packedPackage.version !== packageJson.version) throw new Error(`release tarball version mismatch: ${packedPackage.version}`);
  if (packedPackage.dependencies?.["wjx-api-sdk"] !== `^${sdkVersion}`) {
    throw new Error(`release tarball must pin wjx-api-sdk to ^${sdkVersion}`);
  }
  console.log(`release artifacts passed (${tarball})`);
} finally { rmSync(stage, { recursive: true, force: true }); }
