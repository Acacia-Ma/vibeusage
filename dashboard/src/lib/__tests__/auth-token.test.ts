import { describe, expect, it } from "vitest";

import { resolveAuthAccessToken } from "../auth-token";

describe("resolveAuthAccessToken", () => {
  it("falls back to object.accessToken when getAccessToken returns null", async () => {
    const token = await resolveAuthAccessToken({
      accessToken: "fallback-token",
      getAccessToken: async () => null,
    });

    expect(token).toBe("fallback-token");
  });

  it("falls back to object.accessToken when getAccessToken throws", async () => {
    const token = await resolveAuthAccessToken({
      accessToken: "fallback-token",
      getAccessToken: async () => {
        throw new Error("boom");
      },
    });

    expect(token).toBe("fallback-token");
  });

  it("prefers getAccessToken when it returns a valid token", async () => {
    const token = await resolveAuthAccessToken({
      accessToken: "fallback-token",
      getAccessToken: async () => "fresh-token",
    });

    expect(token).toBe("fresh-token");
  });
});
