import type { PushDecodeResult } from "./types.js";
/**
 * Decode an AES-128-CBC encrypted push payload from WJX.
 *
 * - key = MD5(appKey).substring(0, 16)
 * - encrypted_data is base64-encoded
 * - IV is the first 16 bytes of the ciphertext
 * - PKCS7 padding
 *
 * Optional: verify SHA1(rawBody + appKey) signature if signature + rawBody provided.
 */
export declare function decodePushPayload(encryptedData: string, appKey: string, signature?: string, rawBody?: string): PushDecodeResult;
