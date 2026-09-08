import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const lockKey = createHash("sha256")
  .update(process.platform === "win32" ? packageRoot.toLowerCase() : packageRoot)
  .digest("hex")
  .slice(0, 20);

export const BUILD_LOCK_PATH = resolve(tmpdir(), `wjx-cli-build-${lockKey}.lock`);

const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000;
const DEFAULT_POLL_MS = 50;

function parsePositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function readOwner(lockPath) {
  try {
    const owner = JSON.parse(readFileSync(resolve(lockPath, "owner.json"), "utf8"));
    return owner && typeof owner === "object" ? owner : undefined;
  } catch {
    return undefined;
  }
}

function processIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // ESRCH means the process is gone. Treat every other error as alive so a
    // transient Windows permission/inspection error fails closed.
    return error?.code !== "ESRCH";
  }
}

function removeStaleLock(lockPath, owner) {
  if (!owner || processIsAlive(owner.pid)) return false;
  try {
    rmSync(lockPath, { recursive: true, force: true });
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return true;
    return false;
  }
}

function lockDescription(owner) {
  if (!owner) return "owner details unavailable";
  const command = typeof owner.command === "string" && owner.command ? ` (${owner.command})` : "";
  return `pid ${owner.pid ?? "unknown"}${command}`;
}

function releaseLock(lockPath) {
  try {
    rmSync(lockPath, {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 25,
    });
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

/**
 * Serialize operations that delete or replace the shared CLI dist directory.
 * mkdir is atomic on Windows and POSIX, while the owner record makes abandoned
 * locks recoverable after a killed process.
 */
export async function withBuildLock(operation, options = {}) {
  const lockPath = options.lockPath ?? BUILD_LOCK_PATH;
  const timeoutMs = parsePositiveInteger(options.timeoutMs ?? process.env.WJX_CLI_BUILD_LOCK_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
  const pollMs = parsePositiveInteger(options.pollMs ?? process.env.WJX_CLI_BUILD_LOCK_POLL_MS, DEFAULT_POLL_MS);
  const startedAt = Date.now();
  let acquired = false;

  while (!acquired) {
    try {
      mkdirSync(lockPath);
      try {
        writeFileSync(
          resolve(lockPath, "owner.json"),
          `${JSON.stringify({
            pid: process.pid,
            command: process.argv.slice(1).join(" "),
            startedAt: new Date().toISOString(),
          })}\n`,
          "utf8",
        );
      } catch (writeError) {
        releaseLock(lockPath);
        throw writeError;
      }
      acquired = true;
      break;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      const owner = readOwner(lockPath);
      if (removeStaleLock(lockPath, owner)) continue;
      if (Date.now() - startedAt >= timeoutMs) {
        throw new Error(`Timed out waiting for CLI build lock held by ${lockDescription(owner)}`);
      }
      await sleep(pollMs);
    }
  }

  try {
    return await operation();
  } finally {
    releaseLock(lockPath);
  }
}

export const _test = {
  processIsAlive,
  readOwner,
  removeStaleLock,
};
