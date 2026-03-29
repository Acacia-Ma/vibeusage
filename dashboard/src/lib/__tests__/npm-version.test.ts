import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchLatestTrackerVersion } from "../npm-version";
import { safeRemoveItem, safeSetItem } from "../safe-browser";

const VERSION_CACHE_KEY = "vibeusage.latest_tracker_version";
const VERSION_CACHE_AT_KEY = "vibeusage.latest_tracker_version_at";
const VERSION_FAILURE_AT_KEY = "vibeusage.latest_tracker_version_failure_at";
const VERSION_IN_FLIGHT_AT_KEY = "vibeusage.latest_tracker_version_in_flight_at";

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

describe("fetchLatestTrackerVersion", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: createMemoryStorage(),
    });
    safeRemoveItem(VERSION_CACHE_KEY);
    safeRemoveItem(VERSION_CACHE_AT_KEY);
    safeRemoveItem(VERSION_FAILURE_AT_KEY);
    safeRemoveItem(VERSION_IN_FLIGHT_AT_KEY);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("dedupes concurrent registry requests", async () => {
    let resolveFetch: ((value: Response) => void) | null = null;
    global.fetch = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve as (value: Response) => void;
        }),
    ) as typeof fetch;

    const first = fetchLatestTrackerVersion({ allowStale: false });
    const second = fetchLatestTrackerVersion({ allowStale: false });

    expect(global.fetch).toHaveBeenCalledTimes(1);

    resolveFetch?.(
      new Response(JSON.stringify({ version: "1.2.3" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(first).resolves.toBe("1.2.3");
    await expect(second).resolves.toBe("1.2.3");
  });

  it("waits for a fresh cross-tab in-flight fetch instead of starting a second request", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-22T06:30:00.000Z"));
    global.fetch = vi.fn(async () => {
      throw new Error("should not fetch");
    }) as typeof fetch;

    safeSetItem(VERSION_IN_FLIGHT_AT_KEY, String(Date.now()));

    const pending = fetchLatestTrackerVersion({ allowStale: false });

    window.setTimeout(() => {
      safeSetItem(VERSION_CACHE_KEY, "1.2.4");
      safeSetItem(VERSION_CACHE_AT_KEY, String(Date.now()));
      safeRemoveItem(VERSION_IN_FLIGHT_AT_KEY);
    }, 50);

    await vi.advanceTimersByTimeAsync(120);

    await expect(pending).resolves.toBe("1.2.4");
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
