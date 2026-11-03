import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanGeneratedDirectory } from "../../scripts/clean-generated-directory.mjs";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
cleanGeneratedDirectory(packageRoot);
