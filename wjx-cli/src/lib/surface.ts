export type SurfaceState = "available" | "denied-visible" | "concealed";
export interface SurfaceEntry { command: string; state: SurfaceState; reason?: string; }

export function projectSurface(commands: string[], options: { denied?: Set<string>; concealed?: Set<string> } = {}): SurfaceEntry[] {
  return commands.slice().sort().map((command) => options.concealed?.has(command)
    ? { command, state: "concealed" as const }
    : options.denied?.has(command) ? { command, state: "denied-visible" as const, reason: "policy" } : { command, state: "available" as const });
}
