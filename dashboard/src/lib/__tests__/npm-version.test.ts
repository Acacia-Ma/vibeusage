import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchLatestTrackerVersion } from "../npm-version";
import { safeRemoveItem } from "../safe-browser";

const VERSION_CACHE_KEY = "vibeusage.latest_tracker_version";
const VERSION_CACHE_AT_KEY = "vibeusage.latest_tracker_version_at";

describe("fetchLatestTrackerVersion", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    safeRemoveItem(VERSION_CACHE_KEY);
    safeRemoveItem(VERSION_CACHE_AT_KEY);
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
});
