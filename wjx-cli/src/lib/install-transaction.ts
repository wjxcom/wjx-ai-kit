import { copyFileSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, renameSync, rmSync } from "node:fs";
import { dirname, join, relative } from "node:path";

export interface InstallTarget {
  destination: string;
  /** Copy one generated target into the supplied staging path. */
  stage: (stagingPath: string) => string[];
}

function pathExists(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}

function removePath(path: string): void {
  rmSync(path, { recursive: true, force: true });
}

function mapStagedFiles(
  destination: string,
  stagingPath: string,
  files: string[],
): string[] {
  return files.map((file) => {
    const suffix = relative(stagingPath, file);
    return suffix ? join(destination, suffix) : destination;
  });
}

/**
 * Stage all generated files before replacing any destination, then commit the
 * replacements with backups so a later filesystem failure cannot leave only
 * one of the generated mirrors installed.
 */
export function replaceTargetsAtomically(
  targetRoot: string,
  targets: readonly InstallTarget[],
): string[] {
  if (targets.length === 0) return [];
  mkdirSync(targetRoot, { recursive: true });
  const transactionRoot = mkdtempSync(join(targetRoot, ".wjx-install-"));
  const staged: Array<{ target: InstallTarget; stagingPath: string; files: string[]; backupPath: string }> = [];

  try {
    for (const [index, target] of targets.entries()) {
      const stagingPath = join(transactionRoot, `stage-${index}`);
      const files = target.stage(stagingPath);
      staged.push({
        target,
        stagingPath,
        files,
        backupPath: join(transactionRoot, `backup-${index}`),
      });
    }
  } catch (error) {
    removePath(transactionRoot);
    throw error;
  }

  const committed: typeof staged = [];
  try {
    for (const entry of staged) {
      mkdirSync(dirname(entry.target.destination), { recursive: true });
      if (pathExists(entry.target.destination)) {
        renameSync(entry.target.destination, entry.backupPath);
      }
      try {
        renameSync(entry.stagingPath, entry.target.destination);
      } catch (error) {
        if (pathExists(entry.backupPath)) renameSync(entry.backupPath, entry.target.destination);
        throw error;
      }
      committed.push(entry);
    }

    const files = staged.flatMap((entry) =>
      mapStagedFiles(entry.target.destination, entry.stagingPath, entry.files),
    );
    removePath(transactionRoot);
    return files;
  } catch (error) {
    const rollbackErrors: unknown[] = [];
    for (const entry of [...committed].reverse()) {
      try {
        removePath(entry.target.destination);
        if (pathExists(entry.backupPath)) renameSync(entry.backupPath, entry.target.destination);
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }

    const backupsRemain = staged.some((entry) => pathExists(entry.backupPath));
    if (rollbackErrors.length > 0 || backupsRemain) {
      throw new Error(
        `安装失败且回滚未完成；临时备份保留在 ${transactionRoot}。原始错误：${error instanceof Error ? error.message : String(error)}`,
      );
    }
    removePath(transactionRoot);
    throw error;
  }
}

/** Copy a directory recursively and return the copied paths. */
export function copyDirectory(
  source: string,
  destination: string,
  shouldSkip: (name: string) => boolean = () => false,
): string[] {
  const copied: string[] = [];
  mkdirSync(destination, { recursive: true });
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    if (shouldSkip(entry.name)) continue;
    const sourcePath = join(source, entry.name);
    const destinationPath = join(destination, entry.name);
    if (entry.isDirectory()) {
      copied.push(...copyDirectory(sourcePath, destinationPath, shouldSkip));
    } else {
      copyFileSync(sourcePath, destinationPath);
      copied.push(destinationPath);
    }
  }
  return copied;
}
