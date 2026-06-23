import { describe, expect, it } from "vitest";
import { classifyRequestTraffic } from "../../middleware/requestTraffic.js";

function req({ path = "/api/pt/conversations/current", headers = {} } = {}) {
  return {
    originalUrl: path,
    url: path,
    headers,
  };
}

describe("classifyRequestTraffic", () => {
  it("conta request padrao de API como usuario real", () => {
    expect(classifyRequestTraffic(req())).toEqual({
      trafficKind: "user",
      countAsUserRequest: true,
      requestPath: "/api/pt/conversations/current",
    });
  });

  it("nao conta polling de background como usuario real", () => {
    expect(classifyRequestTraffic(req({
      path: "/api/pt/claude/pending",
      headers: { "x-pt-request-kind": "background" },
    }))).toMatchObject({
      trafficKind: "background",
      countAsUserRequest: false,
    });
  });

  it("nao conta health check como usuario real", () => {
    expect(classifyRequestTraffic(req({
      path: "/api/pt/health",
    }))).toMatchObject({
      trafficKind: "system",
      countAsUserRequest: false,
    });
  });

  it("nao conta Cloud Scheduler como usuario real", () => {
    expect(classifyRequestTraffic(req({
      path: "/api/pt/some-job",
      headers: { "x-cloudscheduler": "true" },
    }))).toMatchObject({
      trafficKind: "system",
      countAsUserRequest: false,
    });
  });
});
