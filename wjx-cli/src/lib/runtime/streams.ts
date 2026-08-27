export interface RuntimeStreams {
  stdout: NodeJS.WriteStream;
  stderr: NodeJS.WriteStream;
}

export const processStreams: RuntimeStreams = { stdout: process.stdout, stderr: process.stderr };
