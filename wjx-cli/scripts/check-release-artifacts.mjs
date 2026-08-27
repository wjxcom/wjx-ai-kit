#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
const root = new URL("..", import.meta.url);
const cwd = fileURLToPath(root);
const stage = mkdtempSync(join(tmpdir(), "wjx-cli-pack-"));
try {
  const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";
  const output = execFileSync(npmBin, ["pack", "--ignore-scripts", "--pack-destination", stage, "--json"], { cwd, encoding: "utf8", shell: process.platform === "win32" });
  const tarball = JSON.parse(output)[0]?.filename;
  if (!tarball) throw new Error("npm pack did not produce a tarball");
  const listing = execFileSync("tar", ["-tf", join(stage, tarball)], { encoding: "utf8" }).split(/\r?\n/).filter(Boolean);
  if (!listing.includes("package/dist/index.js")) throw new Error("release tarball missing dist/index.js");
  for (const forbidden of ["package/manifest/", "package/perf/", "package/src/"]) if (listing.some((item) => item.startsWith(forbidden))) throw new Error(`release tarball contains ${forbidden}`);
  console.log(`release artifacts passed (${tarball})`);
} finally { rmSync(stage, { recursive: true, force: true }); }
