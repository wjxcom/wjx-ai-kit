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
export declare function profilesPath(env?: NodeJS.ProcessEnv): string;
export declare function loadProfiles(path?: string): ProfilesDocument | null;
export declare function saveProfiles(document: ProfilesDocument, path?: string): void;
export declare function resolveProfile(options?: {
    profile?: string;
    profilesPath?: string;
    env?: NodeJS.ProcessEnv;
}): ResolvedProfile;
