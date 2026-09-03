import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const packageJson = require("../../package.json") as { version?: unknown };

export const CLI_CLIENT_NAME = "wjx-cli";
export const CLI_CLIENT_VERSION = typeof packageJson.version === "string" && packageJson.version.trim()
  ? packageJson.version.trim()
  : "0.4.2";
