#!/usr/bin/env node
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { version } = require("../package.json");
const args = process.argv.slice(2);
// Version checks are common in package managers and should not load the command graph.
if (args.includes("--version") || args.includes("-V")) {
    process.stdout.write(`${version}\n`);
}
else {
    await import("./cli.js");
}
//# sourceMappingURL=index.js.map