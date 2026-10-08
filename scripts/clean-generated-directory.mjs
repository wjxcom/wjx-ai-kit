import { lstatSync, readdirSync, rmdirSync, unlinkSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

function removeEntry(path) {
  const stat = lstatSync(path);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    unlinkSync(path);
    return;
  }

  for (const name of readdirSync(path)) removeEntry(join(path, name));
  rmdirSync(path);
}

export function cleanGeneratedDirectory(packageRoot) {
  const resolvedRoot = resolve(packageRoot);
  const target = resolve(resolvedRoot, "dist");
  if (dirname(target) !== resolvedRoot || basename(target) !== "dist") {
    throw new Error(`Refusing to clean unexpected build directory: ${target}`);
  }

  try {
    // Remove audited entries individually and never follow directory symlinks.
    removeEntry(target);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}
