import { describe, expect, it } from "vitest";
import { buildRedirectUrl } from "../auth-redirect";

describe("buildRedirectUrl", () => {
  it("omits display identity from redirect payloads", () => {
    const url = buildRedirectUrl("http://127.0.0.1:8787/callback", {
      accessToken: "token-1",
      userId: "user-1",
      email: "neo@example.com",
      name: "Neo",
    });

    const parsed = new URL(url);

    expect(parsed.searchParams.get("access_token")).toBe("token-1");
    expect(parsed.searchParams.get("user_id")).toBe("user-1");
    expect(parsed.searchParams.get("email")).toBe("neo@example.com");
    expect(parsed.searchParams.has("name")).toBe(false);
  });
});
