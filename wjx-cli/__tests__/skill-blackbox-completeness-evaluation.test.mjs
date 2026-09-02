import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const CLI = resolve(HERE, "..", "dist", "index.js");
const NO_CONFIG = resolve(HERE, "..", "__skill_blackbox_no_config__");

function runCli(args, { env = {}, input, cwd, timeout = 20_000 } = {}) {
  return new Promise((done) => {
    const child = execFile(process.execPath, [CLI, ...args], {
      cwd,
      env: { ...process.env, WJX_CONFIG_PATH: NO_CONFIG, ...env },
      encoding: "utf8",
      timeout,
    }, (error, stdout, stderr) => done({
      code: error ? (typeof error.code === "number" ? error.code : 1) : 0,
      signal: error?.signal,
      stdout: stdout || "",
      stderr: stderr || "",
    }));
    if (input !== undefined) child.stdin.end(input);
  });
}

function parseSuccess(result) {
  assert.equal(result.code, 0, result.stderr || result.stdout);
  assert.equal(result.stderr.trim(), "", result.stderr);
  const envelope = JSON.parse(result.stdout);
  assert.equal(envelope.ok, true, result.stdout);
  return envelope;
}

function parseProblem(result, code) {
  assert.notEqual(result.code, 0, "expected a failure");
  assert.equal(result.stdout.trim(), "", result.stdout);
  const envelope = JSON.parse(result.stderr);
  assert.equal(envelope.ok, false, result.stderr);
  if (code) assert.equal(envelope.error.code, code, result.stderr);
  return envelope;
}

async function startServer(steps) {
  const requests = [];
  let stepIndex = 0;
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    requests.push({
      method: request.method,
      path: request.url,
      headers: { ...request.headers },
      body: Buffer.concat(chunks).toString("utf8"),
    });
    const step = steps[Math.min(stepIndex++, steps.length - 1)] ?? {};
    if (step.hang) return;
    response.statusCode = step.status ?? 200;
    if (step.headers) {
      for (const [key, value] of Object.entries(step.headers)) response.setHeader(key, value);
    } else {
      response.setHeader("content-type", "application/json");
    }
    response.end(step.body ?? JSON.stringify(step.response ?? { result: true, data: {} }));
  });
  await new Promise((resolveServer, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveServer);
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return {
    apiUrl: `http://127.0.0.1:${address.port}/openapi/default.aspx`,
    requests,
    close: () => new Promise((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose())),
  };
}

describe("Skill black-box completeness: transport states", () => {
  test("retryable HTTP responses retry reads, but never retry response submission", async () => {
    const readServer = await startServer([
      { status: 503, body: "busy" },
      { response: { result: true, data: { total_count: 0, activitys: {} } } },
    ]);
    try {
      const result = await runCli(["survey", "list"], {
        env: { WJX_API_KEY: "retry-read-key", WJX_API_URL: readServer.apiUrl },
      });
      parseSuccess(result);
      assert.equal(readServer.requests.length, 2, "read requests should retry once after 503");
    } finally {
      await readServer.close();
    }

    const submitServer = await startServer([{ status: 503, body: "busy" }]);
    try {
      const result = await runCli([
        "--yes", "response", "submit", "--vid", "42", "--inputcosttime", "2",
        "--submitdata", "1$1", "--jpmversion", "1", "--no-auto-version",
      ], { env: { WJX_API_KEY: "retry-submit-key", WJX_API_URL: submitServer.apiUrl } });
      const problem = parseProblem(result, "API_ERROR");
      assert.equal(problem.error.retryable, true, "HTTP 503 exhaustion must be retryable");
      assert.equal(submitServer.requests.length, 1, "a submission must be sent at most once");
    } finally {
      await submitServer.close();
    }
  });

  test("HTTP 200 non-JSON and malformed success envelopes remain structured API errors", async () => {
    for (const step of [
      { body: "not-json", headers: { "content-type": "text/plain" } },
      { response: { data: { rows: [] } } },
      { response: { result: "true", data: {} } },
    ]) {
      const server = await startServer([step]);
      try {
        const result = await runCli(["survey", "list"], {
          env: { WJX_API_KEY: "malformed-response-key", WJX_API_URL: server.apiUrl },
        });
        const problem = parseProblem(result, "API_ERROR");
        assert.equal(problem.error.retryable, false);
        assert.doesNotMatch(result.stderr, /node_modules[\\/]wjx-api-sdk|at .*wjx-cli/);
        assert.equal(server.requests.length, 1);
      } finally {
        await server.close();
      }
    }
  });

  test("upstream result=false preserves errorcode and traceid without retrying", async () => {
    const server = await startServer([{
      response: { result: false, errormsg: "问卷已暂停", errorcode: "SURVEY_PAUSED", traceid: "trace-paused" },
    }]);
    try {
      const result = await runCli(["survey", "list"], {
        env: { WJX_API_KEY: "upstream-error-key", WJX_API_URL: server.apiUrl },
      });
      const problem = parseProblem(result, "API_ERROR");
      assert.equal(problem.error.message, "问卷已暂停");
      assert.equal(problem.error.errorcode, "SURVEY_PAUSED");
      assert.equal(problem.error.traceid, "trace-paused");
      assert.equal(server.requests.length, 1);
    } finally {
      await server.close();
    }
  });

  test("explicit jpmversion still uses available metadata to normalize submitdata", async () => {
    const server = await startServer([
      {
        response: {
          result: true,
          data: {
            version: 7,
            questions: [
              { q_index: 1, q_type: 1, q_subtype: 0 },
              { q_index: 2, q_type: 7, q_subtype: 702 },
            ],
          },
        },
      },
      { response: { result: true, data: { accepted: true } } },
    ]);
    try {
      const result = await runCli([
        "--yes", "response", "submit", "--vid", "42", "--inputcosttime", "2",
        "--submitdata", "2_1$1}2_2$2", "--jpmversion", "7",
      ], { env: { WJX_API_KEY: "explicit-version-key", WJX_API_URL: server.apiUrl } });
      parseSuccess(result);
      assert.equal(server.requests.length, 2);
      const submitBody = JSON.parse(server.requests[1].body);
      assert.equal(submitBody.jpmversion, 7);
      assert.equal(submitBody.submitdata, "2$1!1,2!2");
    } finally {
      await server.close();
    }
  });
});

describe("Skill black-box completeness: source merge and environment", () => {
  test("explicit CLI values override stdin while stdin values are normalized", async () => {
    const server = await startServer([{ response: { result: true, data: {} } }]);
    try {
      const result = await runCli(["--stdin", "survey", "get", "--vid", "99"], {
        input: JSON.stringify({ vid: "42" }),
        env: { WJX_API_KEY: "merge-key", WJX_API_URL: server.apiUrl },
      });
      parseSuccess(result);
      assert.equal(JSON.parse(server.requests[0].body).vid, 99);
    } finally {
      await server.close();
    }

    const normalized = await runCli(["--stdin", "--dry-run", "survey", "get"], {
      input: JSON.stringify({ vid: "42" }),
      env: { WJX_API_KEY: "merge-key" },
    });
    const plan = parseSuccess(normalized).data.plans[0];
    assert.equal(JSON.parse(plan.body).vid, 42);
  });

  test("stdin rejects arrays, null, and malformed JSON before authentication or transport", async () => {
    for (const input of ["[]", "null", "{bad", "\"scalar\""]) {
      const result = await runCli(["--stdin", "survey", "list"], { input });
      parseProblem(result, "INPUT_ERROR");
    }
  });

  test("CLI api-key wins over environment and selected profile credentials", async () => {
    const root = await mkdtemp(join(tmpdir(), "wjx-profile-blackbox-"));
    const server = await startServer([{ response: { result: true, data: {} } }]);
    const profiles = join(root, "profiles.json");
    await writeFile(profiles, JSON.stringify({
      version: 1,
      defaultProfile: "default",
      profiles: { default: { credentialRef: "DEFAULT" }, alt: { credentialRef: "ALT" } },
    }), "utf8");
    try {
      const result = await runCli(["--api-key", "cli-key", "--profile", "alt", "survey", "list"], {
        env: {
          WJX_API_KEY: "env-key",
          WJX_CREDENTIAL_ALT: "profile-key",
          WJX_PROFILES_PATH: profiles,
          WJX_API_URL: server.apiUrl,
        },
      });
      parseSuccess(result);
      assert.equal(server.requests[0].headers.authorization, "Bearer cli-key");
    } finally {
      await server.close();
      await rm(root, { recursive: true, force: true });
    }
  });

  test("automatic submit version lookup failure prevents the submit side effect", async () => {
    const server = await startServer([{
      response: { result: false, errormsg: "问卷已被修改请刷新", errorcode: "STALE_VERSION", traceid: "trace-version" },
    }]);
    try {
      const result = await runCli([
        "--yes", "response", "submit", "--vid", "42", "--inputcosttime", "2",
        "--submitdata", "1$1",
      ], { env: { WJX_API_KEY: "version-key", WJX_API_URL: server.apiUrl } });
      const problem = parseProblem(result, "API_ERROR");
      assert.equal(problem.error.errorcode, "STALE_VERSION");
      assert.equal(server.requests.length, 1, "version lookup failure must not post a response");
      assert.equal(JSON.parse(server.requests[0].body).action, "1000001");
    } finally {
      await server.close();
    }
  });

  test("automatic submit rejects missing or invalid survey versions before posting", async () => {
    for (const version of [undefined, null, 0, -1, 1.5, "3"]) {
      const server = await startServer([{
        response: {
          result: true,
          data: version === undefined ? { questions: [] } : { version, questions: [] },
        },
      }]);
      try {
        const result = await runCli([
          "--yes", "response", "submit", "--vid", "42", "--inputcosttime", "2", "--submitdata", "1$1",
        ], { env: { WJX_API_KEY: "invalid-version-key", WJX_API_URL: server.apiUrl } });
        parseProblem(result, "API_ERROR");
        assert.equal(server.requests.length, 1, `version=${String(version)} must not submit`);
        assert.equal(JSON.parse(server.requests[0].body).action, "1000001");
      } finally {
        await server.close();
      }
    }
  });

  test("raw api merges params and body from @files with body precedence", async () => {
    const root = await mkdtemp(join(tmpdir(), "wjx-api-file-blackbox-"));
    const server = await startServer([{ response: { result: true, data: { accepted: true } } }]);
    const paramsFile = join(root, "params.json");
    const bodyFile = join(root, "body.json");
    await writeFile(paramsFile, JSON.stringify({ page_index: 1, page_size: 5 }), "utf8");
    await writeFile(bodyFile, JSON.stringify({ page_size: 9, query_all: true }), "utf8");
    try {
      const result = await runCli([
        "api", "--service", "default", "--action", "survey.list",
        "--params", `@${paramsFile}`, "--body", `@${bodyFile}`,
      ], { env: { WJX_API_KEY: "api-file-key", WJX_API_URL: server.apiUrl } });
      parseSuccess(result);
      const body = JSON.parse(server.requests[0].body);
      assert.equal(body.action, "1000002");
      assert.equal(body.page_index, 1);
      assert.equal(body.page_size, 9);
      assert.equal(body.query_all, true);
    } finally {
      await server.close();
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("Skill black-box completeness: install/update side effects", () => {
  test("skill install is idempotent, force updates files, and honors target-dir precedence", async () => {
    const root = await mkdtemp(join(tmpdir(), "wjx-skill-install-blackbox-"));
    const envRoot = await mkdtemp(join(tmpdir(), "wjx-skill-install-env-"));
    const bundled = resolve(HERE, "..", "bundled", "wjx-cli-use", "SKILL.md");
    try {
      const first = await runCli(["skill", "install", "--silent", "--target-dir", root], {
        env: { WJX_INSTALL_ROOT: envRoot },
      });
      const firstEnvelope = parseSuccess(first);
      assert.equal(firstEnvelope.data.status, "installed");
      assert.ok(firstEnvelope.data.files.length >= 2);
      const installed = join(root, "skills", "wjx-cli-use", "SKILL.md");
      assert.equal(await stat(installed).then(() => true), true);
      const claudeInstalled = join(root, ".claude", "skills", "wjx-cli-use", "SKILL.md");
      assert.equal(await stat(claudeInstalled).then(() => true), true);
      assert.equal(await readFile(claudeInstalled, "utf8"), await readFile(bundled, "utf8"));

      await writeFile(installed, "tampered", "utf8");
      await mkdir(join(root, "skills", "wjx-cli-use", "references"), { recursive: true });
      await writeFile(join(root, "skills", "wjx-cli-use", "references", "removed-old-reference.md"), "stale", "utf8");
      const skipped = await runCli(["skill", "install", "--silent", "--target-dir", root], {
        env: { WJX_INSTALL_ROOT: envRoot },
      });
      assert.equal(parseSuccess(skipped).data.status, "skipped");
      assert.equal(await readFile(installed, "utf8"), "tampered");

      const forced = await runCli(["skill", "install", "--silent", "--force", "--target-dir", root]);
      assert.equal(parseSuccess(forced).data.status, "updated");
      assert.equal(await readFile(installed, "utf8"), await readFile(bundled, "utf8"));
      await assert.rejects(() => stat(join(root, "skills", "wjx-cli-use", "references", "removed-old-reference.md")));
      await assert.rejects(() => stat(join(envRoot, "skills", "wjx-cli-use", "SKILL.md")));
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(envRoot, { recursive: true, force: true });
    }
  });

  test("forced install preserves project packaging metadata beside the runtime Skill", async () => {
    const root = await mkdtemp(join(tmpdir(), "wjx-skill-packaging-metadata-"));
    const skillDir = join(root, "skills", "wjx-cli-use");
    try {
      await mkdir(skillDir, { recursive: true });
      await writeFile(join(skillDir, "SKILL.md"), "old", "utf8");
      const metadata = {
        "setup.sh": "#!/bin/sh\necho setup\n",
        "package.json": "{\"name\":\"wjx-cli-use\"}\n",
        "pack_skill.sh": "#!/bin/sh\necho pack\n",
        ".gitignore": "custom-generated/\n",
      };
      for (const [name, content] of Object.entries(metadata)) {
        await writeFile(join(skillDir, name), content, "utf8");
      }

      const result = await runCli(["skill", "install", "--silent", "--force", "--target-dir", root]);
      assert.equal(parseSuccess(result).data.status, "updated");
      for (const [name, content] of Object.entries(metadata)) {
        assert.equal(await readFile(join(skillDir, name), "utf8"), content);
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("forced PPT install preserves project packaging metadata beside the runtime Skill", async () => {
    const root = await mkdtemp(join(tmpdir(), "wjx-ppt-packaging-metadata-"));
    const skillDir = join(root, "skills", "wjx-survey-ppt");
    try {
      await mkdir(skillDir, { recursive: true });
      await writeFile(join(skillDir, "SKILL.md"), "old", "utf8");
      const metadata = {
        "setup.sh": "#!/bin/sh\necho setup\n",
        "package.json": "{\"name\":\"custom-ppt-skill\"}\n",
        "pack_skill.sh": "#!/bin/sh\necho pack\n",
        ".gitignore": "custom-render-output/\n",
      };
      for (const [name, content] of Object.entries(metadata)) {
        await writeFile(join(skillDir, name), content, "utf8");
      }

      const result = await runCli(["skill", "install-ppt", "--silent", "--force", "--skip-pip", "--target-dir", root]);
      assert.equal(parseSuccess(result).data.status, "updated");
      for (const [name, content] of Object.entries(metadata)) {
        assert.equal(await readFile(join(skillDir, name), "utf8"), content);
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("forced reinstall refreshes an existing .claude/skills mirror and removes legacy references", async () => {
    const root = await mkdtemp(join(tmpdir(), "wjx-skill-legacy-mirror-"));
    const bundled = resolve(HERE, "..", "bundled", "wjx-cli-use", "SKILL.md");
    const legacyDir = join(root, ".claude", "skills", "wjx-cli-use");
    const legacySkill = join(legacyDir, "SKILL.md");
    const legacyDsl = join(legacyDir, "references", "dsl-syntax.md");
    try {
      await mkdir(join(legacyDir, "references"), { recursive: true });
      await writeFile(legacySkill, "旧版仍推荐 create-by-json", "utf8");
      await writeFile(legacyDsl, "旧 DSL 创建说明", "utf8");

      const result = await runCli(["skill", "install", "--force", "--silent", "--target-dir", root]);
      assert.ok(["installed", "updated"].includes(parseSuccess(result).data.status));
      assert.equal(await readFile(legacySkill, "utf8"), await readFile(bundled, "utf8"));
      await assert.rejects(() => stat(legacyDsl));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("skill update discovers a Claude-only legacy installation", async () => {
    const root = await mkdtemp(join(tmpdir(), "wjx-skill-claude-only-"));
    const bundled = resolve(HERE, "..", "bundled", "wjx-cli-use", "SKILL.md");
    const claudeDir = join(root, ".claude", "skills", "wjx-cli-use");
    const claudeSkill = join(claudeDir, "SKILL.md");
    try {
      await mkdir(join(claudeDir, "references"), { recursive: true });
      await writeFile(claudeSkill, "旧版 Claude skill", "utf8");
      await writeFile(join(claudeDir, "references", "dsl-syntax.md"), "旧 DSL", "utf8");

      const result = await runCli(["skill", "update", "--silent", "--target-dir", root]);
      assert.equal(parseSuccess(result).data.status, "updated");
      const canonical = join(root, "skills", "wjx-cli-use", "SKILL.md");
      assert.equal(await readFile(canonical, "utf8"), await readFile(bundled, "utf8"));
      assert.equal(await readFile(claudeSkill, "utf8"), await readFile(bundled, "utf8"));
      await assert.rejects(() => stat(join(claudeDir, "references", "dsl-syntax.md")));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("non-force installs repair a missing mirror without overwriting existing skill content", async () => {
    const skillRoot = await mkdtemp(join(tmpdir(), "wjx-skill-mirror-repair-"));
    const pptRoot = await mkdtemp(join(tmpdir(), "wjx-ppt-mirror-repair-"));
    const bundledSkill = resolve(HERE, "..", "bundled", "wjx-cli-use", "SKILL.md");
    const bundledPpt = resolve(HERE, "..", "bundled", "wjx-survey-ppt", "SKILL.md");
    try {
      await runCli(["skill", "install", "--force", "--silent", "--target-dir", skillRoot]);
      const canonicalSkill = join(skillRoot, "skills", "wjx-cli-use", "SKILL.md");
      const claudeSkill = join(skillRoot, ".claude", "skills", "wjx-cli-use");
      await writeFile(canonicalSkill, "user-customized-skill", "utf8");
      await rm(claudeSkill, { recursive: true, force: true });

      const repairedSkill = await runCli(["skill", "install", "--silent", "--target-dir", skillRoot]);
      assert.equal(parseSuccess(repairedSkill).data.status, "updated");
      assert.equal(await readFile(canonicalSkill, "utf8"), "user-customized-skill");
      assert.equal(await readFile(join(claudeSkill, "SKILL.md"), "utf8"), await readFile(bundledSkill, "utf8"));

      const agentDest = join(skillRoot, ".claude", "agents", "wjx-cli-expert.md");
      await rm(agentDest, { force: true });
      await mkdir(agentDest, { recursive: true });
      const repairedAgent = await runCli(["skill", "install", "--silent", "--target-dir", skillRoot]);
      assert.equal(parseSuccess(repairedAgent).data.status, "updated");
      assert.equal((await stat(agentDest)).isFile(), true);

      await runCli(["skill", "install-ppt", "--force", "--silent", "--skip-pip", "--target-dir", pptRoot]);
      const canonicalPpt = join(pptRoot, "skills", "wjx-survey-ppt", "SKILL.md");
      const claudePpt = join(pptRoot, ".claude", "skills", "wjx-survey-ppt");
      await writeFile(canonicalPpt, "user-customized-ppt", "utf8");
      await rm(claudePpt, { recursive: true, force: true });

      const repairedPpt = await runCli(["skill", "install-ppt", "--silent", "--skip-pip", "--target-dir", pptRoot]);
      assert.equal(parseSuccess(repairedPpt).data.status, "updated");
      assert.equal(await readFile(canonicalPpt, "utf8"), "user-customized-ppt");
      assert.equal(await readFile(join(claudePpt, "SKILL.md"), "utf8"), await readFile(bundledPpt, "utf8"));
    } finally {
      await rm(skillRoot, { recursive: true, force: true });
      await rm(pptRoot, { recursive: true, force: true });
    }
  });

  test("skill installers protect conflicting paths unless --force is explicit", async () => {
    const cliRoot = await mkdtemp(join(tmpdir(), "wjx-skill-conflict-"));
    const pptRoot = await mkdtemp(join(tmpdir(), "wjx-ppt-conflict-"));
    try {
      const cliSkillPath = join(cliRoot, "skills", "wjx-cli-use");
      await mkdir(join(cliRoot, "skills"), { recursive: true });
      await writeFile(cliSkillPath, "user data", "utf8");
      const cliConflict = await runCli(["skill", "install", "--target-dir", cliRoot]);
      parseProblem(cliConflict, "INPUT_ERROR");
      assert.equal(await readFile(cliSkillPath, "utf8"), "user data");

      const agentPath = join(cliRoot, ".claude", "agents", "wjx-cli-expert.md");
      await mkdir(agentPath, { recursive: true });
      const forcedCli = await runCli(["skill", "install", "--force", "--silent", "--target-dir", cliRoot]);
      assert.equal(parseSuccess(forcedCli).data.status, "installed");
      assert.equal((await stat(agentPath)).isFile(), true);

      const pptSkillPath = join(pptRoot, "skills", "wjx-survey-ppt");
      await mkdir(join(pptRoot, "skills"), { recursive: true });
      await writeFile(pptSkillPath, "user data", "utf8");
      const pptConflict = await runCli(["skill", "install-ppt", "--skip-pip", "--target-dir", pptRoot]);
      parseProblem(pptConflict, "INPUT_ERROR");
      assert.equal(await readFile(pptSkillPath, "utf8"), "user data");

      const forcedPpt = await runCli(["skill", "install-ppt", "--force", "--silent", "--skip-pip", "--target-dir", pptRoot]);
      assert.equal(parseSuccess(forcedPpt).data.status, "installed");
      assert.equal((await stat(join(pptSkillPath, "SKILL.md"))).isFile(), true);
    } finally {
      await rm(cliRoot, { recursive: true, force: true });
      await rm(pptRoot, { recursive: true, force: true });
    }
  });

  test("forced install is atomic when a later mirror destination is blocked", async () => {
    const root = await mkdtemp(join(tmpdir(), "wjx-skill-atomic-install-"));
    try {
      await mkdir(join(root, ".claude"), { recursive: true });
      await writeFile(join(root, ".claude", "skills"), "blocking file", "utf8");

      const result = await runCli(["skill", "install", "--force", "--silent", "--target-dir", root]);
      const problem = parseProblem(result, "INPUT_ERROR");
      assert.match(problem.error.message, /安装|目标|Skill/i);
      await assert.rejects(() => stat(join(root, "skills", "wjx-cli-use", "SKILL.md")));
      await assert.rejects(() => stat(join(root, ".claude", "agents", "wjx-cli-expert.md")));
      assert.equal(await readFile(join(root, ".claude", "skills"), "utf8"), "blocking file");
      assert.deepEqual((await readdir(root)).filter((name) => name.includes("wjx-install")), []);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("skill install and PPT install execute the merged stdin target and flags", async () => {
    const skillRoot = await mkdtemp(join(tmpdir(), "wjx-skill-stdin-blackbox-"));
    const pptRoot = await mkdtemp(join(tmpdir(), "wjx-ppt-stdin-blackbox-"));
    const ignoredRoot = await mkdtemp(join(tmpdir(), "wjx-skill-stdin-env-"));
    try {
      const skill = await runCli(["--stdin", "skill", "install", "--silent"], {
        input: JSON.stringify({ targetDir: skillRoot }),
        env: { WJX_INSTALL_ROOT: ignoredRoot },
      });
      assert.equal(parseSuccess(skill).data.status, "installed");
      assert.equal(await stat(join(skillRoot, "skills", "wjx-cli-use", "SKILL.md")).then(() => true), true);
      await assert.rejects(() => stat(join(ignoredRoot, "skills", "wjx-cli-use", "SKILL.md")));

      const ppt = await runCli(["--stdin", "skill", "install-ppt"], {
        input: JSON.stringify({ targetDir: pptRoot, silent: true, skipPip: true }),
      });
      assert.equal(parseSuccess(ppt).data.status, "installed");
      assert.equal(await stat(join(pptRoot, "skills", "wjx-survey-ppt", "SKILL.md")).then(() => true), true);
    } finally {
      await rm(skillRoot, { recursive: true, force: true });
      await rm(pptRoot, { recursive: true, force: true });
      await rm(ignoredRoot, { recursive: true, force: true });
    }
  });

  test("update dry-run reflects silent from structured stdin", async () => {
    const result = await runCli(["--stdin", "--dry-run", "update"], {
      input: JSON.stringify({ silent: true }),
    });
    const envelope = parseSuccess(result);
    assert.equal(envelope.data.input.silent, true);
  });

  test("PPT skill skip-pip installs locally, update overwrites, and reports JSON only with --silent", async () => {
    const root = await mkdtemp(join(tmpdir(), "wjx-ppt-install-blackbox-"));
    try {
      const install = await runCli(["skill", "install-ppt", "--silent", "--skip-pip", "--target-dir", root]);
      const installed = parseSuccess(install).data;
      assert.equal(installed.status, "installed");
      assert.equal(installed.pipInstalled, false);
      assert.ok(installed.files.length > 0);
      const skillFile = join(root, "skills", "wjx-survey-ppt", "SKILL.md");
      const claudeSkillFile = join(root, ".claude", "skills", "wjx-survey-ppt", "SKILL.md");
      assert.equal(await stat(claudeSkillFile).then(() => true), true);
      assert.equal(await readFile(claudeSkillFile, "utf8"), await readFile(skillFile, "utf8"));
      await mkdir(join(root, "skills", "wjx-survey-ppt", "references"), { recursive: true });
      await writeFile(join(root, "skills", "wjx-survey-ppt", "references", "removed-old-reference.md"), "stale", "utf8");
      await writeFile(skillFile, "tampered", "utf8");
      const update = await runCli(["skill", "update-ppt", "--silent", "--skip-pip", "--target-dir", root]);
      assert.equal(parseSuccess(update).data.status, "updated");
      assert.notEqual(await readFile(skillFile, "utf8"), "tampered");
      assert.equal(await readFile(claudeSkillFile, "utf8"), await readFile(skillFile, "utf8"));
      await assert.rejects(() => stat(join(root, "skills", "wjx-survey-ppt", "references", "removed-old-reference.md")));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("Skill black-box completeness: local command edges", () => {
  test("all SSO URL variants produce encoded URLs and reject missing identities", async () => {
    const valid = [
      ["sso", "subaccount-url", "--subuser", "子账号", "--role_id", "2", "--admin", "1"],
      ["sso", "user-system-url", "--u", "owner", "--system_id", "9", "--uid", "用户 1", "--is_login", "1"],
      ["sso", "partner-url", "--username", "partner", "--mobile", "13800138000"],
    ];
    for (const args of valid) {
      const result = await runCli(args);
      const data = parseSuccess(result).data;
      assert.match(String(data), /^https?:\/\//);
      if (args.includes("子账号") || args.includes("用户 1")) assert.match(String(data), /%/);
    }
    for (const args of [
      ["sso", "subaccount-url"],
      ["sso", "partner-url", "--username", ""],
      ["sso", "user-system-url", "--u", "owner", "--system_id", "0", "--uid", "u"],
      ["sso", "user-system-url", "--u", "owner", "--system_id", "1", "--uid", "u", "--is_login", "2"],
    ]) parseProblem(await runCli(args), "INPUT_ERROR");
  });

  test("completion generation is deterministic and completion lookup covers root, subcommand, option, and empty input", async () => {
    for (const shell of ["bash", "zsh", "fish"]) {
      const first = await runCli(["completion", shell]);
      const second = await runCli(["completion", shell]);
      assert.equal(first.code, 0);
      assert.equal(first.stdout, second.stdout);
      assert.equal(first.stderr.trim(), "");
      assert.ok(first.stdout.length > 50);
    }
    for (const [point, line, expected] of [
      [4, "wjx ", "survey"],
      [11, "wjx survey ", "create"],
      [20, "wjx survey list --pa", "--page"],
      [0, "", "survey"],
    ]) {
      const result = await runCli(["--get-completions", String(point), line]);
      assert.equal(result.code, 0, result.stderr);
      assert.match(result.stdout, new RegExp(expected.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
    }
  });

  test("large Unicode JSONL previews without truncation or network access", async () => {
    const title = "客户满意度".repeat(2_000);
    const content = `${JSON.stringify({ qtype: "问卷基础信息", title, atype: 1 })}\n${JSON.stringify({ qtype: "单选", title: "是否满意", select: ["是", "否"] })}\n`;
    const result = await runCli(["--dry-run", "survey", "create", "--jsonl", content]);
    const envelope = parseSuccess(result);
    assert.equal(envelope.data.kind, "dry-run");
    const body = JSON.parse(envelope.data.plans[0].body);
    assert.match(body.surveydatajson, /客户满意度/);
    assert.equal(body.surveydatajson.split(/\r?\n/).filter(Boolean).length, 2);
  });

  test("JSONL file size is enforced in UTF-8 bytes", async () => {
    const root = await mkdtemp(join(tmpdir(), "wjx-jsonl-size-blackbox-"));
    const file = join(root, "oversize.jsonl");
    try {
      const content = "测".repeat(400_000);
      assert.ok(content.length < 1_000_000);
      assert.ok(Buffer.byteLength(content, "utf8") > 1_000_000);
      const write = await writeFile(file, content, "utf8");
      void write;
      const result = await runCli(["--dry-run", "survey", "create", "--file", file]);
      const envelope = parseProblem(result);
      assert.match(envelope.error.message, /超过上限/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("init dry-run is side-effect free and masks the API key", async () => {
    const root = await mkdtemp(join(tmpdir(), "wjx-init-dryrun-blackbox-"));
    const configPath = join(root, ".wjxrc");
    try {
      const result = await runCli([
        "--dry-run", "--api-key", "super-secret-key", "init", "--target-dir", root,
      ], { cwd: root, env: { WJX_CONFIG_PATH: configPath } });
      const envelope = parseSuccess(result);
      assert.equal(envelope.data.kind, "dry-run");
      assert.equal(envelope.data.input.apiKey, "****");
      await assert.rejects(() => stat(configPath));
      await assert.rejects(() => stat(join(root, "skills")));

      const stdinResult = await runCli([
        "--stdin", "--dry-run", "--api-key", "super-secret-key", "init",
      ], {
        input: JSON.stringify({
          baseUrl: "https://stdin.example",
          corpId: "stdin-corp",
          installSkill: false,
          installPptSkill: true,
          targetDir: root,
        }),
        env: { WJX_CONFIG_PATH: configPath },
        cwd: root,
      });
      const stdinEnvelope = parseSuccess(stdinResult);
      assert.deepEqual(stdinEnvelope.data.input, {
        apiKey: "****",
        baseUrl: "https://stdin.example",
        corpId: "stdin-corp",
        installSkill: false,
        installPptSkill: true,
        targetDir: root,
      });
      await assert.rejects(() => stat(configPath));
      await assert.rejects(() => stat(join(root, "skills")));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("doctor without credentials exits with a structured diagnostic and no network", async () => {
    const result = await runCli(["doctor"], { env: { WJX_API_KEY: "", WJX_API_URL: "http://127.0.0.1:1" } });
    assert.equal(result.code, 1);
    const envelope = JSON.parse(result.stdout);
    assert.equal(envelope.ok, false);
    const keyCheck = envelope.data.checks.find((check) => check.check === "WJX_API_KEY");
    assert.equal(keyCheck.status, "fail");
    assert.doesNotMatch(result.stdout, /super-secret|Bearer /i);
  });

  test("malformed push payloads are local input errors, not API failures", async () => {
    const result = await runCli(["analytics", "decode-push", "--payload", "bad", "--app_key", "key"]);
    const problem = parseProblem(result, "INPUT_ERROR");
    assert.match(problem.error.message, /Encrypted data too short/i);
  });

  test("extra positional arguments are rejected as input errors", async () => {
    for (const args of [
      ["survey", "list", "unexpected"],
      ["analytics", "nps", "unexpected"],
      ["response", "query", "--vid", "42", "unexpected"],
      ["completion", "install", "unexpected"],
    ]) {
      parseProblem(await runCli(args), "INPUT_ERROR");
    }
  });

  test("missing option values are rejected as input errors", async () => {
    for (const args of [
      ["survey", "get", "--vid"],
      ["survey", "list", "--page_size"],
      ["analytics", "nps", "--scores"],
      ["response", "submit", "--vid"],
    ]) {
      parseProblem(await runCli(args), "INPUT_ERROR");
    }
  });

  test("removed output aliases are rejected as input errors", async () => {
    const help = await runCli(["--help"]);
    assert.equal(help.code, 0);
    assert.doesNotMatch(help.stdout, /--json/);
    assert.doesNotMatch(help.stdout, /--table/);
    for (const alias of ["--json", "--table"]) {
      const result = await runCli([alias, "analytics", "nps", "--scores", "[10]"]);
      parseProblem(result, "INPUT_ERROR");
    }
  });
});

describe("Skill black-box completeness: concurrent response isolation", () => {
  test("parallel no-auto-version submissions are isolated and each sent exactly once", async () => {
    const requests = [];
    const server = createServer(async (request, response) => {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      requests.push({
        authorization: request.headers.authorization,
        body: JSON.parse(Buffer.concat(chunks).toString("utf8")),
      });
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ result: true, data: { submitted: true } }));
    });
    await new Promise((resolveServer, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolveServer);
    });
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const apiUrl = `http://127.0.0.1:${address.port}/openapi/default.aspx`;
    try {
      const results = await Promise.all(Array.from({ length: 8 }, (_, index) => runCli([
        "--yes", "response", "submit", "--vid", String(100 + index),
        "--inputcosttime", "2", "--submitdata", `${index + 1}$1`,
        "--jpmversion", "1", "--no-auto-version",
      ], { env: { WJX_API_KEY: `parallel-key-${index}`, WJX_API_URL: apiUrl } })));
      for (const result of results) parseSuccess(result);
      assert.equal(requests.length, 8);
      assert.equal(new Set(requests.map(({ body }) => body.vid)).size, 8);
      assert.equal(new Set(requests.map(({ authorization }) => authorization)).size, 8);
      assert.ok(requests.every(({ body }) => body.action === "1001001"));
    } finally {
      await new Promise((resolveClose) => server.close(resolveClose));
    }
  });

  test("parallel auto-version submissions keep metadata and submit requests paired", async () => {
    const requests = [];
    const server = createServer(async (request, response) => {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      requests.push({ authorization: request.headers.authorization, body });
      const data = body.action === "1000001"
        ? { version: Number(body.vid) + 10, questions: [] }
        : { submitted: true, vid: body.vid };
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ result: true, data }));
    });
    await new Promise((resolveServer, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolveServer);
    });
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const apiUrl = `http://127.0.0.1:${address.port}/openapi/default.aspx`;
    try {
      const results = await Promise.all(Array.from({ length: 4 }, (_, index) => runCli([
        "--yes", "response", "submit", "--vid", String(200 + index),
        "--inputcosttime", "2", "--submitdata", `${index + 1}$1`,
      ], { env: { WJX_API_KEY: `auto-key-${index}`, WJX_API_URL: apiUrl } })));
      for (const result of results) parseSuccess(result);
      assert.equal(requests.length, 8);
      const grouped = new Map();
      for (const request of requests) {
        const key = request.authorization;
        const entry = grouped.get(key) ?? [];
        entry.push(request.body);
        grouped.set(key, entry);
      }
      assert.equal(grouped.size, 4);
      for (const [authorization, bodies] of grouped) {
        assert.equal(bodies.length, 2, `${authorization} should have lookup + submit`);
        assert.equal(bodies[0].action, "1000001");
        assert.equal(bodies[1].action, "1001001");
        assert.equal(bodies[1].jpmversion, Number(bodies[1].vid) + 10);
      }
    } finally {
      await new Promise((resolveClose) => server.close(resolveClose));
    }
  });
});
