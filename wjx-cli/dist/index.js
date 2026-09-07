#!/usr/bin/env node
import { createRequire } from "node:module";
import { getCompletionScript } from "./lib/completions.js";
const require = createRequire(import.meta.url);
const { version } = require("../package.json");
const args = process.argv.slice(2);
// Version checks are common in package managers and should not load the command graph.
if (args[0] === "--version" || args[0] === "-V") {
    process.stdout.write(`${version}\n`);
}
else if (args.length === 2 && args[0] === "completion") {
    // Shell snippets are static. Keep this common path independent of the
    // Commander/API command graph so interactive completion starts quickly.
    const script = getCompletionScript(args[1]);
    if (script === undefined) {
        await import("./cli.js");
    }
    else {
        process.stdout.write(`${script}\n`);
    }
}
else {
    await import("./cli.js");
}
//# sourceMappingURL=index.js.map