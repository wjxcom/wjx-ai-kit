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

function normalizeProfileDefinition(value: unknown): ProfileDefinition {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  const baseUrl = typeof record.baseUrl === "string" && record.baseUrl.trim()
    ? record.baseUrl.trim()
    : undefined;
  const corpId = typeof record.corpId === "string" && record.corpId.trim()
    ? record.corpId.trim()
    : undefined;
  const credentialRef = typeof record.credentialRef === "string" && record.credentialRef.trim()
    ? record.credentialRef.trim()
    : undefined;
  return {
    ...(baseUrl ? { baseUrl } : {}),
    ...(corpId ? { corpId } : {}),
    ...(credentialRef ? { credentialRef } : {}),
  };
}

export function profilesPath(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.WJX_PROFILES_PATH?.trim();
  return configured || join(homedir(), ".wjx", "profiles.json");
}

export function loadProfiles(path = profilesPath()): ProfilesDocument | null {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<ProfilesDocument>;
    if (parsed.version !== 1 || !parsed.profiles || typeof parsed.profiles !== "object") return null;
    if (Array.isArray(parsed.profiles)) return null;
    if (parsed.defaultProfile !== undefined && typeof parsed.defaultProfile !== "string") return null;
    const profiles: Record<string, ProfileDefinition> = {};
    for (const [name, definition] of Object.entries(parsed.profiles as Record<string, unknown>)) {
      if (!name.trim() || !definition || typeof definition !== "object" || Array.isArray(definition)) return null;
      profiles[name] = normalizeProfileDefinition(definition);
    }
    const defaultProfile = parsed.defaultProfile?.trim() || undefined;
    return { version: 1, ...(defaultProfile ? { defaultProfile } : {}), profiles };
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
  const requestedName = options.profile === undefined ? undefined : options.profile.trim();
  if (options.profile !== undefined && !requestedName) {
    throw new Error("profile name must not be blank");
  }
  const configuredName = document?.defaultProfile;
  const selectedName = requestedName || configuredName || "default";
  const hasSelectedProfile = Boolean(document && Object.prototype.hasOwnProperty.call(document.profiles, selectedName));
  if ((requestedName !== undefined || configuredName !== undefined) && !hasSelectedProfile) {
    throw new Error(`profile "${selectedName}" not found`);
  }
  const definition = hasSelectedProfile ? normalizeProfileDefinition(document!.profiles[selectedName]) : {};
  // `.wjxrc` predates named profiles. Treat its routing fields as defaults for
  // the implicit/default profile only; selecting another profile must be able
  // to change tenants without inheriting the legacy host or corp id.
  const legacyConfig = selectedName === "default" ? loadConfig(env) : null;
  const envBaseUrl = typeof env.WJX_BASE_URL === "string" && env.WJX_BASE_URL.trim() ? env.WJX_BASE_URL.trim() : undefined;
  const envCorpId = typeof env.WJX_CORP_ID === "string" && env.WJX_CORP_ID.trim() ? env.WJX_CORP_ID.trim() : undefined;
  return {
    name: selectedName,
    ...(legacyConfig?.baseUrl ? { baseUrl: legacyConfig.baseUrl } : {}),
    ...(legacyConfig?.corpId ? { corpId: legacyConfig.corpId } : {}),
    ...definition,
    ...(envBaseUrl ? { baseUrl: envBaseUrl } : {}),
    ...(envCorpId ? { corpId: envCorpId } : {}),
  };
}
