import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(packageRoot, "..");
const destination = resolve(packageRoot, "dist/capabilities");
mkdirSync(destination, { recursive: true });
for (const name of ["agent-contract.json", "jsonl-qtypes.json"]) {
  const source = resolve(root, "capabilities", name);
  if (existsSync(source)) cpSync(source, resolve(destination, name));
}
