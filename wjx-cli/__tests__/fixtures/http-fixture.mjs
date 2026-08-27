import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI = resolve(__dirname, "..", "..", "dist", "index.js");

let activeFixture;

/**
 * Start a localhost HTTP recorder and an isolated subprocess environment.
 * The returned object owns all resources and must be closed by the caller.
 */
export async function startFixture({
  response = { result: true, data: {} },
  timeout = 10_000,
  env = {},
} = {}) {
  const recorded = [];
  const server = createServer(async (request, responseStream) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const headers = {};
    for (const [name, value] of Object.entries(request.headers)) {
      if (value !== undefined) headers[name] = Array.isArray(value) ? value.join(", ") : value;
    }
    recorded.push({
      method: request.method ?? "GET",
      path: request.url ?? "/",
      headers,
      body: Buffer.concat(chunks).toString("utf8"),
    });

    responseStream.statusCode = 200;
    responseStream.setHeader("content-type", "application/json");
    responseStream.end(JSON.stringify(response));
  });

  await new Promise((resolveServer, rejectServer) => {
    server.once("error", rejectServer);
    server.listen(0, "127.0.0.1", resolveServer);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    await new Promise((resolveClose) => server.close(resolveClose));
    throw new Error("HTTP fixture did not receive an ephemeral port");
  }

  const tempDir = await mkdtemp(join(tmpdir(), "wjx-cli-contract-"));
  const fixture = {
    baseUrl: `http://127.0.0.1:${address.port}`,
    url: `http://127.0.0.1:${address.port}`,
    tempDir,
    timeout,
    env: {
      ...process.env,
      WJX_API_URL: `http://127.0.0.1:${address.port}/openapi/default.aspx`,
      WJX_BASE_URL: `http://127.0.0.1:${address.port}`,
      WJX_CONFIG_PATH: join(tempDir, ".wjxrc"),
      ...env,
    },
    requests() {
      return recorded.map((request) => ({ ...request, headers: { ...request.headers } }));
    },
    run(args = [], { input, cwd, env: extraEnv = {}, timeout: runTimeout = timeout } = {}) {
      return new Promise((resolveRun) => {
        const child = execFile("node", [CLI, ...args], {
          cwd,
          env: { ...fixture.env, ...extraEnv },
          encoding: "utf8",
          timeout: runTimeout,
        }, (error, stdout, stderr) => {
          resolveRun({
            exitCode: error && typeof error.code === "number" ? error.code : error ? 1 : 0,
            stdout: stdout || "",
            stderr: stderr || "",
          });
        });
        if (input !== undefined) {
          child.stdin.write(input);
          child.stdin.end();
        }
      });
    },
    async close() {
      await new Promise((resolveClose, rejectClose) => {
        server.close((error) => (error ? rejectClose(error) : resolveClose()));
      });
      await rm(tempDir, { recursive: true, force: true });
      if (activeFixture === fixture) activeFixture = undefined;
    },
  };

  activeFixture = fixture;
  fixture.runCli = fixture.run;
  return fixture;
}

/** Return requests from the most recently started fixture. */
export function requests() {
  if (!activeFixture) throw new Error("No active HTTP fixture");
  return activeFixture.requests();
}

/** Close the most recently started fixture. */
export async function close() {
  if (activeFixture) await activeFixture.close();
}

/**
 * Replace global fetch with a deterministic failure for in-process tests.
 * The returned function restores the exact previous implementation.
 */
export function installFetchSentinel(
  message = "network disabled by architecture contract",
) {
  const previous = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error(message);
  };
  return () => {
    globalThis.fetch = previous;
  };
}
