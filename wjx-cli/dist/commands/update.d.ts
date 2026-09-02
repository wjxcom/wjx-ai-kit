import { Command } from "commander";
/** Compare two package versions without allowing npm to choose a downgrade. */
export declare function compareVersions(left: string, right: string): -1 | 0 | 1;
export declare function shouldUpdate(currentVersion: string, latestVersion: string): boolean;
export declare function registerUpdateCommands(program: Command): void;
