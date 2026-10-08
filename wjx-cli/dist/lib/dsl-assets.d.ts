import { type WjxCredentials } from "wjx-api-sdk";
export interface DslAssetSpec {
    id: string;
    file: string;
    fileName?: string;
}
type AssetUploader = (input: {
    file_name: string;
    file: string;
}, credentials: WjxCredentials) => Promise<unknown>;
/** Upload manifest assets and replace {{asset:id}} placeholders in a complete DSL. */
export declare function materializeDslAssets(dsl: string, manifestPath: string, credentials: WjxCredentials, uploader?: AssetUploader): Promise<{
    dsl: string;
    assets: Array<{
        id: string;
        file: string;
        path: string;
        bytes: number;
    }>;
}>;
export {};
