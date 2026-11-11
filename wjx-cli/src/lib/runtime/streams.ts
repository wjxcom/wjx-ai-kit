export interface RuntimeStreams {
  stdin: NodeJS.ReadStream;
  stdout: NodeJS.WriteStream;
  stderr: NodeJS.WriteStream;
}

export const processStreams: RuntimeStreams = {
  stdin: process.stdin,
  stdout: process.stdout,
  stderr: process.stderr,
};
