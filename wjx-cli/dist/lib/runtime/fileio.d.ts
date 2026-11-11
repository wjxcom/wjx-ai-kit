export declare function readInput(value: string): string;
export declare function writeAtomic(path: string, content: string | Uint8Array): void;
export declare function openUploadStream(path: string): import("node:fs").ReadStream;
export declare function safeOutputPath(path: string, root?: string): string;
