import type { WjxCredentials } from "wjx-api-sdk";
import type { ResolvedProfile } from "./profiles.js";
import { loadConfig } from "./config.js";

export interface CredentialProvider {
  get(profile: ResolvedProfile, identity: "user" | "bot" | "unknown"): WjxCredentials;
}

export class EnvCredentialProvider implements CredentialProvider {
  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}

  get(profile: ResolvedProfile): WjxCredentials {
    const ref = profile.credentialRef;
    // An explicit credentialRef identifies a tenant-specific secret. Never
    // fall back to the process-wide key when that reference is missing; doing
    // so can silently authenticate the selected profile as another tenant.
    const envApiKey = ref ? this.env[`WJX_CREDENTIAL_${ref}`] : this.env.WJX_API_KEY;
    // The legacy .wjxrc credential belongs to the implicit default profile.
    // Do not inject it into process.env: doing so would silently authenticate
    // an explicitly selected named profile as the default tenant.
    const configApiKey = !ref && profile.name === "default"
      ? loadConfig(this.env)?.apiKey
      : undefined;
    const apiKey = (envApiKey || configApiKey)?.trim();
    if (!apiKey) {
      const source = ref ? `WJX_CREDENTIAL_${ref}` : "WJX_API_KEY";
      throw new Error(`${source} 未设置。请通过 --api-key、环境变量或配置 credentialRef。`);
    }
    return { apiKey };
  }
}

let provider: CredentialProvider = new EnvCredentialProvider();

export function getCredentialProvider(): CredentialProvider { return provider; }
export function setCredentialProvider(next: CredentialProvider): void { provider = next; }
