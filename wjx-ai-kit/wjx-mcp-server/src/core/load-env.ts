import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Resolve .env file path. Priority:
 * 1. process.cwd()/.env  (npx / user working directory)
 * 2. Package root .env   (__dirname/../../.env, for local dev)
 */
function findEnvFile(): string | undefined {
  const cwdPath = resolve(process.cwd(), ".env");
  if (existsSync(cwdPath)) return cwdPath;

  const pkgPath = resolve(__dirname, "..", "..", ".env");
  if (existsSync(pkgPath)) return pkgPath;

  return undefined;
}

const envPath = findEnvFile();

if (envPath) {
  try {
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let value = trimmed.slice(eqIdx + 1).trim();
      // Strip inline comments (unquoted values only)
      if (value[0] !== '"' && value[0] !== "'") {
        const commentIdx = value.indexOf(" #");
        if (commentIdx !== -1) value = value.slice(0, commentIdx).trimEnd();
      }
      // Strip surrounding quotes (single or double)
      if (
        value.length >= 2 &&
        ((value[0] === '"' && value[value.length - 1] === '"') ||
          (value[0] === "'" && value[value.length - 1] === "'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env file read error — skip silently
  }
}
