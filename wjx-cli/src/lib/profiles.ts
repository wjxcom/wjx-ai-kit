import { chmodSync, readFileSync, renameSync, writeFileSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { loadConfig } from "./config.js";

export interface ProfileDefinition {
  baseUrl?: string;
  corpId?: string;
  credentialRef?: string;
}

export interface ProfilesDocument {
  version: 1;
  defaultProfile?: string;
  profiles: Record<string, ProfileDefinition>;
}

export interface ResolvedProfile extends ProfileDefinition {
  name: string;
}

export function profilesPath(env: NodeJS.ProcessEnv = process.env): string {
  return env.WJX_PROFILES_PATH || join(homedir(), ".wjx", "profiles.json");
}

export function loadProfiles(path = profilesPath()): ProfilesDocument | null {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<ProfilesDocument>;
    if (parsed.version !== 1 || !parsed.profiles || typeof parsed.profiles !== "object") return null;
    return { version: 1, defaultProfile: parsed.defaultProfile, profiles: parsed.profiles as Record<string, ProfileDefinition> };
  } catch {
    return null;
  }
}

export function saveProfiles(document: ProfilesDocument, path = profilesPath()): void {
  const parent = dirname(path);
  const temp = `${path}.${process.pid}.${Date.now()}.tmp`;
  try {
    // The caller owns the directory; mkdir is intentionally avoided so malformed paths fail loudly.
    writeFileSync(temp, `${JSON.stringify(document, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    renameSync(temp, path);
    chmodSync(path, 0o600);
  } catch (error) {
    try { unlinkSync(temp); } catch { /* preserve original error */ }
    throw error;
  }
}

export function resolveProfile(options: {
  profile?: string;
  profilesPath?: string;
  env?: NodeJS.ProcessEnv;
} = {}): ResolvedProfile {
  const env = options.env ?? process.env;
  const document = loadProfiles(options.profilesPath ?? profilesPath(env));
  const selectedName = options.profile || document?.defaultProfile || "default";
  const definition = document?.profiles[selectedName] ?? {};
  // `.wjxrc` predates named profiles. Treat its routing fields as defaults for
  // the implicit/default profile only; selecting another profile must be able
  // to change tenants without inheriting the legacy host or corp id.
  const legacyConfig = selectedName === "default" ? loadConfig() : null;
  return {
    name: selectedName,
    ...(legacyConfig?.baseUrl ? { baseUrl: legacyConfig.baseUrl } : {}),
    ...(legacyConfig?.corpId ? { corpId: legacyConfig.corpId } : {}),
    ...definition,
    ...(env.WJX_BASE_URL ? { baseUrl: env.WJX_BASE_URL } : {}),
    ...(env.WJX_CORP_ID ? { corpId: env.WJX_CORP_ID } : {}),
  };
}
