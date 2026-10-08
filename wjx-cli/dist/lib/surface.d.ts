export type SurfaceState = "available" | "denied-visible" | "concealed";
export interface SurfaceEntry {
    command: string;
    state: SurfaceState;
    reason?: string;
}
export declare function projectSurface(commands: string[], options?: {
    denied?: Set<string>;
    concealed?: Set<string>;
}): SurfaceEntry[];
