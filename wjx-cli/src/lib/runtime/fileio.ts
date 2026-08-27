import { createReadStream, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";

export function readInput(value: string): string {
  if (value === "-") throw new Error("stdin input must be read asynchronously by the command");
  if (value.startsWith("@")) return readFileSync(value.slice(1), "utf8");
  return value;
}

export function writeAtomic(path: string, content: string | Uint8Array): void {
  const temp = `${path}.${process.pid}.${Date.now()}.tmp`;
  try { writeFileSync(temp, content); renameSync(temp, path); }
  catch (error) { try { unlinkSync(temp); } catch { /* preserve original */ } throw error; }
}

export function openUploadStream(path: string) { return createReadStream(path); }

export function safeOutputPath(path: string, root = process.cwd()): string {
  const resolved = resolve(root, path);
  const rel = relative(resolve(root), resolved);
  if (rel.startsWith("..") || rel.includes("..\\") || rel.includes("../") || rel.length === 0) throw new Error("output path escapes workspace");
  return resolved;
}
