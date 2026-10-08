export interface RuntimeStreams {
    stdin: NodeJS.ReadStream;
    stdout: NodeJS.WriteStream;
    stderr: NodeJS.WriteStream;
}
export declare const processStreams: RuntimeStreams;
