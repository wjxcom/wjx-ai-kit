import { createDecipheriv, createHash, timingSafeEqual } from "node:crypto";
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
export function decodePushPayload(encryptedData, appKey, signature, rawBody) {
    // Derive AES key: MD5(appKey) first 16 chars → 16-byte key
    const md5Hex = createHash("md5").update(appKey, "utf-8").digest("hex");
    const aesKey = Buffer.from(md5Hex.substring(0, 16), "utf-8");
    // Decode base64 ciphertext
    const ciphertext = Buffer.from(encryptedData, "base64");
    if (ciphertext.length < 16) {
        throw new Error("Encrypted data too short — must be at least 16 bytes for IV");
    }
    // IV = first 16 bytes
    const iv = ciphertext.subarray(0, 16);
    const encrypted = ciphertext.subarray(16);
    // Decrypt with AES-128-CBC + PKCS7 (Node default)
    const decipher = createDecipheriv("aes-128-cbc", aesKey, iv);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    const plaintext = decrypted.toString("utf-8");
    // Parse JSON
    let parsed;
    try {
        parsed = JSON.parse(plaintext);
    }
    catch {
        parsed = plaintext;
    }
    // Optional signature verification (timing-safe)
    let signatureValid;
    if (signature && rawBody) {
        const expected = createHash("sha1").update(rawBody + appKey, "utf-8").digest("hex");
        signatureValid =
            expected.length === signature.length &&
                timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    }
    return { decrypted: parsed, signatureValid };
}
//# sourceMappingURL=push-decode.js.map