import { beforeEach, describe, expect, it } from "vitest";
import {
  clearSessionSoftExpired,
  loadSessionSoftExpired,
  loadSessionSoftExpiredState,
  markSessionSoftExpired,
  shouldClearSessionSoftExpiredForToken,
} from "../auth-storage";

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
  };
}

function makeJwt(payload: Record<string, unknown>) {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url").replace(/=/g, "");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(payload)}.sig`;
}

describe("session soft expiry storage", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: createMemoryStorage(),
    });
    clearSessionSoftExpired();
  });

  it("stores a token fingerprint for the token that triggered soft expiry", () => {
    const token = makeJwt({
      sub: "user-1",
      iat: 1773954516,
      exp: 1773955416,
    });

    markSessionSoftExpired(token);

    const state = loadSessionSoftExpiredState();
    expect(loadSessionSoftExpired()).toBe(true);
    expect(state?.expiredAt).toBeTruthy();
    expect(state?.tokenFingerprint).toMatch(/^fnv1a:/);
  });

  it("does not clear soft expiry for the same token", () => {
    const token = makeJwt({
      sub: "user-1",
      iat: 1773954516,
      exp: 1773955416,
    });

    markSessionSoftExpired(token);

    expect(shouldClearSessionSoftExpiredForToken(token)).toBe(false);
  });

  it("clears soft expiry only when a different token arrives", () => {
    const firstToken = makeJwt({
      sub: "user-1",
      iat: 1773954516,
      exp: 1773955416,
    });
    const secondToken = makeJwt({
      sub: "user-1",
      iat: 1773954816,
      exp: 1773955716,
    });

    markSessionSoftExpired(firstToken);

    expect(shouldClearSessionSoftExpiredForToken(secondToken)).toBe(true);
  });

  it("keeps legacy soft-expired markers clearable after a new token appears", () => {
    window.localStorage.setItem(
      "vibeusage.dashboard.session_soft_expired.v1",
      JSON.stringify({ expiredAt: new Date().toISOString() }),
    );
    const freshToken = makeJwt({
      sub: "user-1",
      iat: 1773954816,
      exp: 1773955716,
    });

    expect(shouldClearSessionSoftExpiredForToken(freshToken)).toBe(true);
  });
});
