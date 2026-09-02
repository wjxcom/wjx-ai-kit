import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { enrichSurveyListOutput } from "../dist/lib/output.js";

describe("enrichSurveyListOutput", () => {
  it("preserves a validated API fill_url when no derivation fields exist", () => {
    const input = {
      result: true,
      data: {
        activitys: {
          survey: {
            vid: 123,
            fill_url: "https://www.wjx.cn/vm/short-code.aspx",
          },
        },
      },
    };

    const result = enrichSurveyListOutput(input);

    assert.equal(result.data.activitys.survey.fill_url, "https://www.wjx.cn/vm/short-code.aspx");
  });

  it("prefers a validated API fill_url over a sid-derived fallback", () => {
    const input = {
      data: {
        activitys: {
          survey: {
            vid: 123,
            sid: "short-code",
            activity_domain: "https://www.wjx.cn",
            fill_url: "https://www.wjx.cn/m/server-selected.aspx",
          },
        },
      },
    };

    const result = enrichSurveyListOutput(input);

    assert.equal(result.data.activitys.survey.fill_url, "https://www.wjx.cn/m/server-selected.aspx");
  });

  it("removes an untrusted fill_url when no safe respondent URL can be derived", () => {
    const input = {
      result: true,
      data: {
        activitys: {
          "123": {
            vid: 123,
            activity_domain: "https://www.wjx.cn",
            sid: "123",
            fill_url: "https://www.wjx.cn/vm/123.aspx",
          },
        },
      },
    };

    const result = enrichSurveyListOutput(input);

    assert.deepEqual(result.data.activitys["123"], {
      vid: 123,
      activity_domain: "https://www.wjx.cn",
      sid: "123",
    });
    assert.equal(input.data.activitys["123"].fill_url, "https://www.wjx.cn/vm/123.aspx");
  });

  it("does not guess a respondent URL from sid without a server path", () => {
    const input = {
      data: {
        activitys: {
          survey: {
            vid: 123,
            sid: "safe id",
            activity_domain: "https://www.wjx.cn/",
            title: "Customer survey",
          },
        },
      },
    };

    const result = enrichSurveyListOutput(input);

    assert.deepEqual(result.data.activitys.survey, input.data.activitys.survey);
  });

  it("prefers the API pc_path over mobile_path and preserves its route", () => {
    const input = {
      data: {
        activitys: {
          survey: {
            vid: 123,
            sid: "short-code",
            activity_domain: "https://www.wjx.cn",
            pc_path: "/m/server-path.aspx",
            mobile_path: "/vm/mobile-path.aspx",
          },
        },
      },
    };

    const result = enrichSurveyListOutput(input);

    assert.equal(result.data.activitys.survey.fill_url, "https://www.wjx.cn/m/server-path.aspx");
  });

  it("uses a safe server mobile path for the activities alias", () => {
    const input = {
      data: {
        activities: {
          survey: {
            vid: 123,
            sid: "123",
            activity_domain: "https://www.wjx.cn/",
            mobile_path: "/vm/secure-code.aspx",
          },
        },
      },
    };

    const result = enrichSurveyListOutput(input);

    assert.equal(
      result.data.activities.survey.fill_url,
      "https://www.wjx.cn/vm/secure-code.aspx",
    );
  });

  it("rejects a mobile path that exposes the numeric vid", () => {
    for (const mobilePath of [
      "/vm/123.aspx",
      "/m/123",
      "/m/123?preview=1",
      "/m/%31%32%33.aspx",
    ]) {
      const input = {
        data: {
          activitys: {
            survey: {
              vid: 123,
              activity_domain: "https://www.wjx.cn",
              mobile_path: mobilePath,
            },
          },
        },
      };

      const result = enrichSurveyListOutput(input);

      assert.equal("fill_url" in result.data.activitys.survey, false, mobilePath);
    }
  });

  it("rejects an absolute mobile path from another origin", () => {
    const input = {
      data: {
        activitys: {
          survey: {
            vid: 123,
            sid: "123",
            activity_domain: "https://www.wjx.cn",
            mobile_path: "https://evil.test/vm/secure-code.aspx",
          },
        },
      },
    };

    const result = enrichSurveyListOutput(input);

    assert.equal("fill_url" in result.data.activitys.survey, false);
  });

  it("returns unrelated response shapes unchanged", () => {
    for (const input of [null, "response", [], { data: [] }, { data: { rows: [] } }]) {
      assert.equal(enrichSurveyListOutput(input), input);
    }
  });
});
