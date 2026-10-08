export function projectSurface(commands, options = {}) {
    return commands.slice().sort().map((command) => options.concealed?.has(command)
        ? { command, state: "concealed" }
        : options.denied?.has(command) ? { command, state: "denied-visible", reason: "policy" } : { command, state: "available" });
}
//# sourceMappingURL=surface.js.map