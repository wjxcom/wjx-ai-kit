import type { WjxCredentials } from "wjx-api-sdk";
import type { ResolvedProfile } from "./profiles.js";
export interface CredentialProvider {
    get(profile: ResolvedProfile, identity: "user" | "bot" | "unknown"): WjxCredentials;
}
export declare class EnvCredentialProvider implements CredentialProvider {
    private readonly env;
    constructor(env?: NodeJS.ProcessEnv);
    get(profile: ResolvedProfile): WjxCredentials;
}
export declare function getCredentialProvider(): CredentialProvider;
export declare function setCredentialProvider(next: CredentialProvider): void;
