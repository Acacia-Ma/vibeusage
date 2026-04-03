import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createInsforgeClient,
  createPersistentStorage,
  installSessionPersistenceBridge,
} from "../insforge-client";

const TOKEN_STORAGE_KEY = "vibeusage.insforge.session.v1.insforge-auth-token";
const USER_STORAGE_KEY = "vibeusage.insforge.session.v1.insforge-auth-user";

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

function buildJwt(expSeconds: number) {
  const header = { alg: "HS256", typ: "JWT" };
  const payload = { exp: expSeconds };
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url").replace(/=/g, "");
  return `${encode(header)}.${encode(payload)}.sig`;
}

describe("createPersistentStorage", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: createMemoryStorage(),
    });
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      value: createMemoryStorage(),
    });
  });

  it("stores auth token as TTL envelope and returns raw token", () => {
    const storage = createPersistentStorage();
    const token = buildJwt(Math.floor(Date.now() / 1000) + 3600);

    storage.setItem("insforge-auth-token", token);

    const raw = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    expect(raw).toBeTruthy();

    const parsed = JSON.parse(String(raw));
    expect(parsed.token).toBe(token);
    expect(parsed.expiresAt).toBeGreaterThan(Date.now());

    expect(storage.getItem("insforge-auth-token")).toBe(token);
  });

  it("keeps token envelope readable even after token exp", () => {
    const storage = createPersistentStorage();
    const expiredToken = buildJwt(Math.floor(Date.now() / 1000) - 10);

    storage.setItem("insforge-auth-token", expiredToken);

    expect(storage.getItem("insforge-auth-token")).toBe(expiredToken);
    expect(window.localStorage.getItem(TOKEN_STORAGE_KEY)).toBeTruthy();
  });

  it("restores token from sessionStorage and backfills localStorage", () => {
    const storage = createPersistentStorage();
    const token = buildJwt(Math.floor(Date.now() / 1000) + 600);
    const wrapped = JSON.stringify({
      v: 1,
      token,
      expiresAt: Date.now() + 600_000,
    });

    window.sessionStorage.setItem(TOKEN_STORAGE_KEY, wrapped);

    expect(storage.getItem("insforge-auth-token")).toBe(token);
    expect(window.localStorage.getItem(TOKEN_STORAGE_KEY)).toBe(wrapped);
  });
});

describe("installSessionPersistenceBridge", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: createMemoryStorage(),
    });
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      value: createMemoryStorage(),
    });
  });

  it("persists token-manager sessions into storage", () => {
    const session = { accessToken: "token-123", user: { id: "u1" } };
    const originalSaveSession = vi.fn();
    const tokenManager = {
      saveSession: originalSaveSession,
      getSession: vi.fn(() => null),
      clearSession: vi.fn(),
    };
    const client = { tokenManager };

    installSessionPersistenceBridge(client);
    client.tokenManager.saveSession(session);

    expect(originalSaveSession).toHaveBeenCalledWith(session);
    expect(createPersistentStorage().getItem("insforge-auth-token")).toBe("token-123");
    expect(window.localStorage.getItem(USER_STORAGE_KEY)).toBe(JSON.stringify({ id: "u1" }));
  });

  it("hydrates token manager from persisted storage when memory is empty", () => {
    const session = { accessToken: "token-123", user: { id: "u1" } };
    const storage = createPersistentStorage();
    storage.setItem("insforge-auth-token", session.accessToken);
    storage.setItem("insforge-auth-user", JSON.stringify(session.user));

    const originalSaveSession = vi.fn();
    const tokenManager = {
      saveSession: originalSaveSession,
      getSession: vi.fn(() => null),
      clearSession: vi.fn(),
    };
    const client = { tokenManager };

    installSessionPersistenceBridge(client);
    originalSaveSession.mockClear();
    const restored = client.tokenManager.getSession();

    expect(originalSaveSession).toHaveBeenCalledTimes(1);
    expect(originalSaveSession).toHaveBeenCalledWith(session);
    expect(restored).toEqual(session);
  });

  it("installs only once", () => {
    const session = { accessToken: "token-123", user: { id: "u1" } };
    const originalSaveSession = vi.fn();
    const tokenManager = {
      saveSession: originalSaveSession,
      getSession: vi.fn(() => null),
      clearSession: vi.fn(),
    };
    const client = { tokenManager };

    installSessionPersistenceBridge(client);
    installSessionPersistenceBridge(client);
    client.tokenManager.saveSession(session);

    expect(originalSaveSession).toHaveBeenCalledTimes(1);
  });
});

describe("createInsforgeClient", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: createMemoryStorage(),
    });
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      value: createMemoryStorage(),
    });
  });

  it("keeps database helpers usable after method extraction", () => {
    const client = createInsforgeClient({
      baseUrl: "https://example.com",
      accessToken: "token-123",
    });

    const from = client.database.from;
    const rpc = client.database.rpc;

    expect(() => from("demo_table")).not.toThrow();
    expect(() => rpc("demo_fn", {})).not.toThrow();
  });
});
