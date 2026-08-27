import type { WjxCredentials } from "wjx-api-sdk";
import type { ResolvedProfile } from "./profiles.js";

export interface CredentialProvider {
  get(profile: ResolvedProfile, identity: "user" | "bot" | "unknown"): WjxCredentials;
}

export class EnvCredentialProvider implements CredentialProvider {
  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}

  get(profile: ResolvedProfile): WjxCredentials {
    const ref = profile.credentialRef;
    const apiKey = (ref ? this.env[`WJX_CREDENTIAL_${ref}`] : undefined) || this.env.WJX_API_KEY;
    if (!apiKey) throw new Error("WJX_API_KEY 未设置。请通过 --api-key 参数、WJX_API_KEY 环境变量、或配置 credentialRef。");
    return { apiKey };
  }
}

let provider: CredentialProvider = new EnvCredentialProvider();

export function getCredentialProvider(): CredentialProvider { return provider; }
export function setCredentialProvider(next: CredentialProvider): void { provider = next; }
