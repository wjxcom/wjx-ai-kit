export interface InstallTarget {
    destination: string;
    /** Copy one generated target into the supplied staging path. */
    stage: (stagingPath: string) => string[];
}
/**
 * Stage all generated files before replacing any destination, then commit the
 * replacements with backups so a later filesystem failure cannot leave only
 * one of the generated mirrors installed.
 */
export declare function replaceTargetsAtomically(targetRoot: string, targets: readonly InstallTarget[]): string[];
/** Copy a directory recursively and return the copied paths. */
export declare function copyDirectory(source: string, destination: string, shouldSkip?: (name: string) => boolean): string[];
