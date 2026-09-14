import { readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, isAbsolute, resolve } from "node:path";
import { uploadFile, type WjxCredentials } from "wjx-api-sdk";
import { CliError } from "./errors.js";

const MAX_ASSET_BYTES = 4 * 1024 * 1024;

export interface DslAssetSpec {
  id: string;
  file: string;
  fileName?: string;
}

type AssetUploader = (input: { file_name: string; file: string }, credentials: WjxCredentials) => Promise<unknown>;

interface DslAssetManifest {
  assets: DslAssetSpec[];
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function readManifest(pathValue: string): { manifest: DslAssetManifest; baseDir: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(pathValue, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    throw new CliError("INPUT_ERROR", `无法读取素材清单 JSON: ${pathValue}`);
  }
  const root = record(parsed);
  const assets = root?.assets;
  if (!Array.isArray(assets) || assets.length === 0) {
    throw new CliError("INPUT_ERROR", "素材清单必须包含非空 assets 数组");
  }
  const normalized: DslAssetSpec[] = assets.map((item, index) => {
    const value = record(item);
    const id = typeof value?.id === "string" ? value.id.trim() : "";
    const file = typeof value?.file === "string" ? value.file.trim() : "";
    const fileName = typeof value?.fileName === "string" ? value.fileName.trim() : undefined;
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id)) {
      throw new CliError("INPUT_ERROR", `素材清单第 ${index + 1} 项的 id 无效`);
    }
    if (!file) throw new CliError("INPUT_ERROR", `素材清单第 ${index + 1} 项缺少 file`);
    return { id, file, ...(fileName ? { fileName } : {}) };
  });
  const ids = new Set<string>();
  for (const asset of normalized) {
    if (ids.has(asset.id)) throw new CliError("INPUT_ERROR", `素材 id 重复: ${asset.id}`);
    ids.add(asset.id);
  }
  return { manifest: { assets: normalized }, baseDir: dirname(resolve(pathValue)) };
}

function assetPath(baseDir: string, file: string): string {
  return isAbsolute(file) ? file : resolve(baseDir, file);
}

function uploadPath(value: unknown, credentials: WjxCredentials): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  const root = record(value);
  if (!root) return undefined;
  for (const key of ["path", "url", "file_url", "fileUrl", "relative_path", "relativePath", "src", "file"]) {
    const candidate = uploadPath(root[key], credentials);
    if (candidate) return candidate;
  }
  for (const key of ["data", "result", "payload"]) {
    const candidate = uploadPath(root[key], credentials);
    if (candidate) return candidate;
  }
  return undefined;
}

function readAsset(filePath: string): { base64: string; bytes: number; hash: string } {
  let bytes: number;
  try {
    bytes = statSync(filePath).size;
  } catch {
    throw new CliError("INPUT_ERROR", `无法读取素材文件: ${filePath}`);
  }
  if (!Number.isSafeInteger(bytes) || bytes <= 0) throw new CliError("INPUT_ERROR", `素材文件为空: ${filePath}`);
  if (bytes > MAX_ASSET_BYTES) throw new CliError("INPUT_ERROR", `素材文件超过 4 MiB 限制: ${filePath}`);
  const buffer = readFileSync(filePath);
  return { base64: buffer.toString("base64"), bytes, hash: createHash("sha256").update(buffer).digest("hex") };
}

function normalizeAssetPath(value: string, credentials: WjxCredentials): string {
  const raw = value.trim();
  try {
    const url = new URL(raw);
    const base = credentials.baseUrl ? new URL(credentials.baseUrl) : undefined;
    if (base && url.origin !== base.origin) throw new CliError("API_ERROR", `素材资源路径来自不允许的域名: ${url.origin}`);
    if (!url.pathname) throw new CliError("API_ERROR", "素材上传响应缺少资源路径");
    return url.pathname.replace(/^\/+/, "");
  } catch (error) {
    if (error instanceof CliError) throw error;
    const relative = raw.replace(/^\/+/, "");
    if (!/^upfiles\//i.test(relative)) throw new CliError("API_ERROR", `素材上传响应不是问卷星资源相对路径: ${raw}`);
    return relative;
  }
}

/** Upload manifest assets and replace {{asset:id}} placeholders in a complete DSL. */
export async function materializeDslAssets(
  dsl: string,
  manifestPath: string,
  credentials: WjxCredentials,
  uploader: AssetUploader = async (input, creds) => uploadFile(input, creds),
): Promise<{ dsl: string; assets: Array<{ id: string; file: string; path: string; bytes: number }> }> {
  const { manifest, baseDir } = readManifest(manifestPath);
  let materialized = dsl;
  const uploaded: Array<{ id: string; file: string; path: string; bytes: number }> = [];
  const prepared = manifest.assets.map((asset) => {
    const marker = `{{asset:${asset.id}}}`;
    if (!materialized.includes(marker)) throw new CliError("INPUT_ERROR", `DSL 中未找到素材占位符: ${marker}`);
    const filePath = assetPath(baseDir, asset.file);
    return { asset, filePath, ...readAsset(filePath) };
  });
  const pathByHash = new Map<string, string>();
  for (const item of prepared) {
    const { asset, filePath, base64, bytes, hash } = item;
    let path = pathByHash.get(hash);
    if (!path) {
      try {
        const response = await uploader({
          file_name: asset.fileName || asset.file.split(/[\\/]/).pop() || `${asset.id}.bin`,
          file: base64,
        }, credentials);
        const rawPath = uploadPath(response, credentials);
        if (!rawPath) throw new CliError("API_ERROR", `素材上传成功但未返回可用资源路径: ${asset.id}`, { data: response });
        path = normalizeAssetPath(rawPath, credentials);
        pathByHash.set(hash, path);
      } catch (error) {
        throw new CliError("API_ERROR", `素材流水线在 ${asset.id} 处失败；已上传素材不会自动回收`, {
          data: { uploaded },
          cause_message: error instanceof Error ? error.message : String(error),
        });
      }
    }
    materialized = materialized.split(`{{asset:${asset.id}}}`).join(path);
    uploaded.push({ id: asset.id, file: filePath, path, bytes });
  }
  return { dsl: materialized, assets: uploaded };
}
