import { describe, expect, it } from "vitest";
import { addServerlessAuthorizationHeader } from "../../firebase/worker.js";

describe("firebase/worker gateway auth headers", () => {
  it("preserva Authorization para o gateway e duplica em X-Serverless-Authorization para IAM", () => {
    const headers = addServerlessAuthorizationHeader({
      "Content-Type": "application/json",
      Authorization: "Bearer test-token",
    });

    expect(headers.Authorization).toBe("Bearer test-token");
    expect(headers["X-Serverless-Authorization"]).toBe("Bearer test-token");
  });

  it("nao sobrescreve X-Serverless-Authorization existente", () => {
    const headers = addServerlessAuthorizationHeader({
      authorization: "Bearer app-token",
      "X-Serverless-Authorization": "Bearer iam-token",
    });

    expect(headers.authorization).toBe("Bearer app-token");
    expect(headers["X-Serverless-Authorization"]).toBe("Bearer iam-token");
  });
});
