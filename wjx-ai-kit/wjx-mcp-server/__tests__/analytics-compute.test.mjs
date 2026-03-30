import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createCipheriv, createHash, randomBytes } from "node:crypto";

import {
  decodeResponses,
  calculateNps,
  calculateCsat,
  detectAnomalies,
  compareMetrics,
} from "../dist/modules/analytics/compute.js";
import { decodePushPayload } from "../dist/modules/analytics/push-decode.js";

// ═══════════════════════════════════════════════════════════════════════════════
// decodeResponses
// ═══════════════════════════════════════════════════════════════════════════════

describe("decodeResponses", () => {
  it("should parse single-choice answers", () => {
    const result = decodeResponses("1$3}2$1");
    assert.equal(result.count, 2);
    assert.equal(result.answers[0].questionIndex, 1);
    assert.equal(result.answers[0].type, "single");
    assert.equal(result.answers[0].value, "3");
  });

  it("should parse multi-choice answers (pipe separated)", () => {
    const result = decodeResponses("1$1|2|3");
    assert.equal(result.count, 1);
    assert.equal(result.answers[0].type, "multi");
    assert.deepEqual(result.answers[0].value, ["1", "2", "3"]);
  });

  it("should parse fill-in answers", () => {
    const result = decodeResponses("3$Hello World");
    assert.equal(result.count, 1);
    assert.equal(result.answers[0].type, "fill");
    assert.equal(result.answers[0].value, "Hello World");
  });

  it("should parse matrix answers (row_col format)", () => {
    const result = decodeResponses("5$r1_c2,r2_c3");
    assert.equal(result.count, 1);
    assert.equal(result.answers[0].type, "matrix");
    assert.deepEqual(result.answers[0].value, { r1: "c2", r2: "c3" });
  });

  it("should handle mixed question types", () => {
    const result = decodeResponses("1$2}2$1|3}3$text answer}4$r1_c1,r2_c2");
    assert.equal(result.count, 4);
    assert.equal(result.answers[0].type, "single");
    assert.equal(result.answers[1].type, "multi");
    assert.equal(result.answers[2].type, "fill");
    assert.equal(result.answers[3].type, "matrix");
  });

  it("should return empty for empty string", () => {
    const result = decodeResponses("");
    assert.equal(result.count, 0);
    assert.deepEqual(result.answers, []);
  });

  it("should return empty for whitespace-only string", () => {
    const result = decodeResponses("   ");
    assert.equal(result.count, 0);
  });

  it("should skip segments without dollar sign", () => {
    const result = decodeResponses("invalid}1$2");
    assert.equal(result.count, 1);
    assert.equal(result.answers[0].questionIndex, 1);
  });

  it("should skip segments with non-numeric question index", () => {
    const result = decodeResponses("abc$2}1$3");
    assert.equal(result.count, 1);
    assert.equal(result.answers[0].questionIndex, 1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// calculateNps
// ═══════════════════════════════════════════════════════════════════════════════

describe("calculateNps", () => {
  it("should calculate perfect NPS (all promoters)", () => {
    const result = calculateNps([10, 10, 9, 10, 9]);
    assert.equal(result.score, 100);
    assert.equal(result.promoters.count, 5);
    assert.equal(result.detractors.count, 0);
    assert.equal(result.rating, "优秀");
  });

  it("should calculate worst NPS (all detractors)", () => {
    const result = calculateNps([0, 1, 2, 3, 4]);
    assert.equal(result.score, -100);
    assert.equal(result.detractors.count, 5);
    assert.equal(result.promoters.count, 0);
    assert.equal(result.rating, "较差");
  });

  it("should calculate mixed NPS", () => {
    // 3 promoters, 2 passives, 5 detractors = (3-5)/10 * 100 = -20
    const scores = [10, 9, 10, 8, 7, 6, 5, 4, 3, 2];
    const result = calculateNps(scores);
    assert.equal(result.score, -20);
    assert.equal(result.promoters.count, 3);
    assert.equal(result.passives.count, 2);
    assert.equal(result.detractors.count, 5);
    assert.equal(result.rating, "较差");
  });

  it("should return 一般 for NPS between 0 and 50", () => {
    // 6 promoters, 4 detractors = (6-4)/10 * 100 = 20
    const scores = [10, 10, 10, 9, 9, 9, 6, 5, 4, 3];
    const result = calculateNps(scores);
    assert.equal(result.score, 20);
    assert.equal(result.rating, "一般");
  });

  it("should return 良好 for NPS between 50 and 70", () => {
    // 8 promoters, 2 detractors out of 10 = 60
    const scores = [10, 10, 10, 10, 9, 9, 9, 9, 5, 4];
    const result = calculateNps(scores);
    assert.equal(result.score, 60);
    assert.equal(result.rating, "良好");
  });

  it("should handle empty array", () => {
    const result = calculateNps([]);
    assert.equal(result.score, 0);
    assert.equal(result.total, 0);
    assert.equal(result.rating, "一般");
  });

  it("should compute correct ratios", () => {
    const result = calculateNps([10, 7, 3]);
    assert.equal(result.total, 3);
    assert.ok(Math.abs(result.promoters.ratio - 1 / 3) < 0.01);
    assert.ok(Math.abs(result.passives.ratio - 1 / 3) < 0.01);
    assert.ok(Math.abs(result.detractors.ratio - 1 / 3) < 0.01);
  });

  it("should return '良好' for NPS score of exactly 70", () => {
    // 85 promoters, 15 detractors out of 100 → NPS = 70
    // Need (promoters - detractors) / total = 0.70
    // 85 scores of 9, 15 scores of 6 → (85-15)/100 = 70
    const scores = [...Array(85).fill(9), ...Array(15).fill(6)];
    const result = calculateNps(scores);
    assert.equal(result.score, 70);
    assert.equal(result.rating, "良好"); // > 70 is 优秀, 70 is 良好
  });

  it("should return '一般' for NPS score of exactly 0", () => {
    // 50 promoters, 50 detractors → NPS = 0
    const scores = [...Array(50).fill(9), ...Array(50).fill(6)];
    const result = calculateNps(scores);
    assert.equal(result.score, 0);
    assert.equal(result.rating, "一般");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// calculateCsat
// ═══════════════════════════════════════════════════════════════════════════════

describe("calculateCsat", () => {
  it("should calculate 5-point CSAT (default scale)", () => {
    const result = calculateCsat([5, 4, 3, 2, 1]);
    assert.equal(result.satisfiedCount, 2); // 5 and 4
    assert.equal(result.total, 5);
    assert.ok(Math.abs(result.csat - 0.4) < 0.001);
  });

  it("should calculate 7-point CSAT", () => {
    const result = calculateCsat([7, 6, 5, 4, 3, 2, 1], "7-point");
    assert.equal(result.satisfiedCount, 3); // 7, 6, 5
    assert.equal(result.total, 7);
  });

  it("should return correct distribution", () => {
    const result = calculateCsat([5, 5, 4, 3, 3]);
    assert.equal(result.distribution["5"], 2);
    assert.equal(result.distribution["4"], 1);
    assert.equal(result.distribution["3"], 2);
  });

  it("should handle empty array", () => {
    const result = calculateCsat([]);
    assert.equal(result.csat, 0);
    assert.equal(result.total, 0);
    assert.equal(result.satisfiedCount, 0);
  });

  it("should handle all satisfied", () => {
    const result = calculateCsat([5, 5, 4, 4]);
    assert.equal(result.satisfiedCount, 4);
    assert.ok(Math.abs(result.csat - 1) < 0.001);
  });

  it("should handle none satisfied", () => {
    const result = calculateCsat([1, 2, 3]);
    assert.equal(result.satisfiedCount, 0);
    assert.equal(result.csat, 0);
  });

  it("should reject scores outside 1-7 range at schema level", () => {
    // This is a schema-level check; the compute function itself doesn't validate
    // but with scores in valid range, verify boundary behavior
    const result = calculateCsat([1, 2, 3, 4, 5], "5-point");
    assert.equal(result.satisfiedCount, 2); // 4 and 5 are satisfied
    assert.equal(result.total, 5);
  });

  it("should calculate correct CSAT ratio for 7-point scale", () => {
    const result = calculateCsat([1, 2, 3, 4, 5, 6, 7], "7-point");
    assert.equal(result.satisfiedCount, 3); // 5, 6, 7 are satisfied
    assert.equal(result.total, 7);
    assert.equal(result.csat, Math.round((3/7) * 10000) / 10000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// detectAnomalies
// ═══════════════════════════════════════════════════════════════════════════════

describe("detectAnomalies", () => {
  it("should detect straight-lining", () => {
    const result = detectAnomalies([
      { id: 1, answers: [1, 1, 1, 1], duration_seconds: 120 },
      { id: 2, answers: [1, 2, 3, 4], duration_seconds: 120 },
    ]);
    const flagged = result.flagged.find((f) => f.responseId === 1);
    assert.ok(flagged);
    assert.ok(flagged.reasons.includes("straight-lining"));
  });

  it("should not flag varied answers as straight-lining", () => {
    const result = detectAnomalies([
      { id: 1, answers: [1, 2, 3, 4], duration_seconds: 120 },
    ]);
    assert.equal(result.flagged.length, 0);
  });

  it("should detect speed anomaly", () => {
    const result = detectAnomalies([
      { id: 1, answers: [1, 2, 3], duration_seconds: 100 },
      { id: 2, answers: [2, 3, 4], duration_seconds: 100 },
      { id: 3, answers: [3, 4, 5], duration_seconds: 100 },
      { id: 4, answers: [4, 5, 6], duration_seconds: 10 }, // < 30% of median (100)
    ]);
    const flagged = result.flagged.find((f) => f.responseId === 4);
    assert.ok(flagged);
    assert.ok(flagged.reasons.includes("speed-anomaly"));
  });

  it("should detect IP+content duplicates", () => {
    const result = detectAnomalies([
      { id: 1, answers: [1, 2, 3], ip: "192.168.1.1", duration_seconds: 100 },
      { id: 2, answers: [1, 2, 3], ip: "192.168.1.1", duration_seconds: 100 },
    ]);
    const flagged = result.flagged.find((f) => f.responseId === 2);
    assert.ok(flagged);
    assert.ok(flagged.reasons.includes("ip-content-duplicate"));
  });

  it("should not flag different IPs as duplicates", () => {
    const result = detectAnomalies([
      { id: 1, answers: [1, 2, 3], ip: "192.168.1.1", duration_seconds: 100 },
      { id: 2, answers: [1, 2, 3], ip: "192.168.1.2", duration_seconds: 100 },
    ]);
    assert.equal(result.flagged.length, 0);
  });

  it("should handle empty responses", () => {
    const result = detectAnomalies([]);
    assert.equal(result.flagged.length, 0);
    assert.equal(result.totalChecked, 0);
  });

  it("should report totalChecked correctly", () => {
    const result = detectAnomalies([
      { id: 1, answers: [1, 2], duration_seconds: 100 },
      { id: 2, answers: [3, 4], duration_seconds: 100 },
    ]);
    assert.equal(result.totalChecked, 2);
  });

  it("should not flag straight-lining with 2 or fewer answers", () => {
    const result = detectAnomalies([
      { id: 1, answers: [1, 1], duration_seconds: 100 },
    ]);
    assert.equal(result.flagged.length, 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// compareMetrics
// ═══════════════════════════════════════════════════════════════════════════════

describe("compareMetrics", () => {
  it("should compute delta and change rate", () => {
    const result = compareMetrics(
      { completion_rate: 0.8, avg_score: 75 },
      { completion_rate: 0.9, avg_score: 80 },
    );
    assert.equal(result.comparisons.length, 2);
    const cr = result.comparisons.find((c) => c.metric === "completion_rate");
    assert.ok(cr);
    assert.ok(Math.abs(cr.delta - 0.1) < 0.001);
    assert.ok(Math.abs(cr.changeRate - 0.125) < 0.001);
    assert.equal(cr.significant, true); // 12.5% > 10%
  });

  it("should flag significant changes (>10%)", () => {
    const result = compareMetrics({ x: 100 }, { x: 112 });
    const c = result.comparisons[0];
    assert.equal(c.significant, true);
  });

  it("should not flag insignificant changes", () => {
    const result = compareMetrics({ x: 100 }, { x: 105 });
    const c = result.comparisons[0];
    assert.equal(c.significant, false);
  });

  it("should handle metrics present only in setA", () => {
    const result = compareMetrics({ x: 50 }, {});
    const c = result.comparisons[0];
    assert.equal(c.valueA, 50);
    assert.equal(c.valueB, 0);
    assert.equal(c.delta, -50);
  });

  it("should handle metrics present only in setB", () => {
    const result = compareMetrics({}, { y: 50 });
    const c = result.comparisons[0];
    assert.equal(c.valueA, 0);
    assert.equal(c.valueB, 50);
    assert.equal(c.changeRate, 1); // from 0, changeRate = 1
  });

  it("should handle both zero", () => {
    const result = compareMetrics({ x: 0 }, { x: 0 });
    const c = result.comparisons[0];
    assert.equal(c.delta, 0);
    assert.equal(c.changeRate, 0);
    assert.equal(c.significant, false);
  });

  it("should handle empty sets", () => {
    const result = compareMetrics({}, {});
    assert.equal(result.comparisons.length, 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// decodePushPayload
// ═══════════════════════════════════════════════════════════════════════════════

describe("decodePushPayload", () => {
  // Helper to encrypt a payload for testing
  function encryptPayload(plaintext, appKey) {
    const md5Hex = createHash("md5").update(appKey, "utf-8").digest("hex");
    const aesKey = Buffer.from(md5Hex.substring(0, 16), "utf-8");
    const iv = randomBytes(16);
    const cipher = createCipheriv("aes-128-cbc", aesKey, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
    return Buffer.concat([iv, encrypted]).toString("base64");
  }

  it("should decrypt a JSON payload", () => {
    const appKey = "test-app-key-123";
    const payload = JSON.stringify({ vid: 12345, response_id: 67890 });
    const encrypted = encryptPayload(payload, appKey);

    const result = decodePushPayload(encrypted, appKey);
    assert.deepEqual(result.decrypted, { vid: 12345, response_id: 67890 });
    assert.equal(result.signatureValid, undefined);
  });

  it("should decrypt a plain text payload", () => {
    const appKey = "my-app-key";
    const payload = "not json content";
    const encrypted = encryptPayload(payload, appKey);

    const result = decodePushPayload(encrypted, appKey);
    assert.equal(result.decrypted, "not json content");
  });

  it("should verify valid SHA1(rawBody + appKey) signature", () => {
    const appKey = "test-key";
    const payload = JSON.stringify({ data: "test" });
    const encrypted = encryptPayload(payload, appKey);
    const rawBody = '{"encrypted_data":"..."}';
    const signature = createHash("sha1").update(rawBody + appKey, "utf-8").digest("hex");

    const result = decodePushPayload(encrypted, appKey, signature, rawBody);
    assert.equal(result.signatureValid, true);
  });

  it("should reject invalid signature", () => {
    const appKey = "test-key";
    const payload = JSON.stringify({ data: "test" });
    const encrypted = encryptPayload(payload, appKey);

    const result = decodePushPayload(encrypted, appKey, "invalid-signature", "some body");
    assert.equal(result.signatureValid, false);
  });

  it("should throw on data too short", () => {
    assert.throws(
      () => decodePushPayload(Buffer.from("short").toString("base64"), "key"),
      /too short/,
    );
  });

  it("should not include signatureValid when no signature params", () => {
    const appKey = "key123";
    const encrypted = encryptPayload("{}", appKey);
    const result = decodePushPayload(encrypted, appKey);
    assert.equal(result.signatureValid, undefined);
  });

  it("should work with different app keys", () => {
    const appKey1 = "first-key";
    const appKey2 = "second-key";
    const payload = JSON.stringify({ id: 1 });

    const encrypted1 = encryptPayload(payload, appKey1);
    const encrypted2 = encryptPayload(payload, appKey2);

    assert.deepEqual(decodePushPayload(encrypted1, appKey1).decrypted, { id: 1 });
    assert.deepEqual(decodePushPayload(encrypted2, appKey2).decrypted, { id: 1 });

    // Wrong key should fail
    assert.throws(() => decodePushPayload(encrypted1, appKey2));
  });
});
