import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { materializeDslAssets } from "../dist/lib/dsl-assets.js";

test("materializeDslAssets uploads manifest files and replaces DSL markers", async () => {
  const root = await mkdtemp(join(tmpdir(), "wjx-dsl-assets-"));
  try {
    const assetFile = join(root, "heatmap.png");
    const manifestFile = join(root, "assets.json");
    await writeFile(assetFile, Buffer.from([0, 1, 2, 3]));
    await writeFile(manifestFile, `\uFEFF${JSON.stringify({ assets: [{ id: "heatmap-bg", file: "heatmap.png" }] })}`);
    const uploaded = await materializeDslAssets(
      'wjx-dsl 1; questionnaire { raw { attr "Background" = "{{asset:heatmap-bg}}"; }; };',
      manifestFile,
      { apiKey: "test" },
      async (input) => {
        assert.equal(input.file_name, "heatmap.png");
        assert.equal(input.file, Buffer.from([0, 1, 2, 3]).toString("base64"));
        return { result: true, data: { path: "upfiles/test/heatmap.png" } };
      },
    );
    assert.match(uploaded.dsl, /upfiles\/test\/heatmap\.png/);
    assert.equal(uploaded.assets[0].bytes, 4);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
