import assert from "node:assert/strict";
import { describe, it } from "node:test";

import * as sdk from "../dist/index.js";

// ═══════════════════════════════════════════════════════════════════════════════
// Smoke test: all public exports exist and have the expected types
// ═══════════════════════════════════════════════════════════════════════════════

describe("SDK barrel exports", () => {
  // ─── Core / constants ──────────────────────────────────────────────
  describe("core constants and URL getters", () => {
    it("should export getWjxBaseUrl as a function", () => {
      assert.equal(typeof sdk.getWjxBaseUrl, "function");
    });

    it("should export getWjxApiUrl as a function", () => {
      assert.equal(typeof sdk.getWjxApiUrl, "function");
      assert.equal(typeof sdk.getWjxApiUrl(), "string");
    });

    it("should export getWjxUserSystemApiUrl as a function", () => {
      assert.equal(typeof sdk.getWjxUserSystemApiUrl, "function");
      assert.equal(typeof sdk.getWjxUserSystemApiUrl(), "string");
    });

    it("should export getWjxSubuserApiUrl as a function", () => {
      assert.equal(typeof sdk.getWjxSubuserApiUrl, "function");
    });

    it("should export getWjxContactsApiUrl as a function", () => {
      assert.equal(typeof sdk.getWjxContactsApiUrl, "function");
    });

    it("should export SSO URL getters as functions", () => {
      assert.equal(typeof sdk.getWjxSsoSubaccountUrl, "function");
      assert.equal(typeof sdk.getWjxSsoUserSystemUrl, "function");
      assert.equal(typeof sdk.getWjxSsoPartnerUrl, "function");
      assert.equal(typeof sdk.getWjxSurveyCreateUrl, "function");
      assert.equal(typeof sdk.getWjxSurveyEditUrl, "function");
    });

    it("should export Action as an object with string values", () => {
      assert.equal(typeof sdk.Action, "object");
      assert.equal(typeof sdk.Action.CREATE_SURVEY, "string");
    });

    it("should export timeout/retry constants as numbers", () => {
      assert.equal(typeof sdk.DEFAULT_TIMEOUT_MS, "number");
      assert.equal(typeof sdk.DEFAULT_MAX_RETRIES, "number");
      assert.equal(typeof sdk.RETRY_DELAY_MS, "number");
    });
  });

  // ─── Core / api-client ─────────────────────────────────────────────
  describe("core api-client functions", () => {
    it("should export setCredentialProvider as a function", () => {
      assert.equal(typeof sdk.setCredentialProvider, "function");
    });

    it("should export getWjxCredentials as a function", () => {
      assert.equal(typeof sdk.getWjxCredentials, "function");
    });

    it("should export validateQuestionsJson as a function", () => {
      assert.equal(typeof sdk.validateQuestionsJson, "function");
    });

    it("should export callWjxApi as a function", () => {
      assert.equal(typeof sdk.callWjxApi, "function");
    });

    it("should export callWjxUserSystemApi as a function", () => {
      assert.equal(typeof sdk.callWjxUserSystemApi, "function");
    });

    it("should export callWjxSubuserApi as a function", () => {
      assert.equal(typeof sdk.callWjxSubuserApi, "function");
    });

    it("should export callWjxContactsApi as a function", () => {
      assert.equal(typeof sdk.callWjxContactsApi, "function");
    });

    it("should export getCorpId as a function", () => {
      assert.equal(typeof sdk.getCorpId, "function");
    });
  });

  // ─── Survey module ─────────────────────────────────────────────────
  describe("survey module", () => {
    for (const name of [
      "createSurvey", "createSurveyByJson", "getSurvey", "listSurveys", "updateSurveyStatus",
      "getSurveySettings", "updateSurveySettings", "deleteSurvey",
      "getQuestionTags", "getTagDetails", "clearRecycleBin", "uploadFile",
      "extractJsonlMetadata", "normalizeJsonl",
    ]) {
      it(`should export ${name} as a function`, () => {
        assert.equal(typeof sdk[name], "function", `${name} should be a function`);
      });
    }
  });

  // ─── Response module ───────────────────────────────────────────────
  describe("response module", () => {
    for (const name of [
      "queryResponses", "queryResponsesRealtime", "downloadResponses",
      "getReport", "submitResponse", "getFileLinks",
      "getWinners", "modifyResponse", "get360Report", "clearResponses",
    ]) {
      it(`should export ${name} as a function`, () => {
        assert.equal(typeof sdk[name], "function", `${name} should be a function`);
      });
    }
  });

  // ─── Contacts module ──────────────────────────────────────────────
  describe("contacts module", () => {
    for (const name of [
      "queryContacts", "addContacts", "deleteContacts",
      "addAdmin", "deleteAdmin", "restoreAdmin",
      "listDepartments", "addDepartment", "modifyDepartment", "deleteDepartment",
      "listTags", "addTag", "modifyTag", "deleteTag",
    ]) {
      it(`should export ${name} as a function`, () => {
        assert.equal(typeof sdk[name], "function", `${name} should be a function`);
      });
    }
  });

  // ─── User System module ───────────────────────────────────────────
  describe("user-system module", () => {
    for (const name of [
      "addParticipants", "modifyParticipants", "deleteParticipants",
      "bindActivity", "querySurveyBinding", "queryUserSurveys",
    ]) {
      it(`should export ${name} as a function`, () => {
        assert.equal(typeof sdk[name], "function", `${name} should be a function`);
      });
    }
  });

  // ─── Multi-User module ────────────────────────────────────────────
  describe("multi-user module", () => {
    for (const name of [
      "addSubAccount", "modifySubAccount", "deleteSubAccount",
      "restoreSubAccount", "querySubAccounts",
    ]) {
      it(`should export ${name} as a function`, () => {
        assert.equal(typeof sdk[name], "function", `${name} should be a function`);
      });
    }
  });

  // ─── SSO module ───────────────────────────────────────────────────
  describe("SSO module", () => {
    for (const name of [
      "buildSsoSubaccountUrl", "buildSsoUserSystemUrl",
      "buildSsoPartnerUrl", "buildSurveyUrl",
    ]) {
      it(`should export ${name} as a function`, () => {
        assert.equal(typeof sdk[name], "function", `${name} should be a function`);
      });
    }
  });

  // ─── Analytics module ─────────────────────────────────────────────
  describe("analytics module", () => {
    for (const name of [
      "decodeResponses", "calculateNps", "calculateCsat",
      "detectAnomalies", "compareMetrics", "decodePushPayload",
    ]) {
      it(`should export ${name} as a function`, () => {
        assert.equal(typeof sdk[name], "function", `${name} should be a function`);
      });
    }
  });
});
