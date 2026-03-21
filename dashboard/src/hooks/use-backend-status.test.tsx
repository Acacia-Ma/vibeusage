import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useBackendStatus } from "./use-backend-status";

const probeBackend = vi.fn(async (_args?: any) => ({ status: 200 }));

vi.mock("../lib/vibeusage-api", () => ({
  probeBackend: (args: any) => probeBackend(args),
}));

describe("useBackendStatus", () => {
  afterEach(() => {
    probeBackend.mockReset();
    probeBackend.mockResolvedValue({ status: 200 });
  });

  it("reuses a resolved access token across refreshes while it remains usable", async () => {
    const getAccessToken = vi.fn(async () => "opaque-token");

    const { result } = renderHook(() =>
      useBackendStatus({
        baseUrl: "https://example.com",
        accessToken: getAccessToken,
        intervalMs: 60_000,
        retryDelayMs: 0,
      }),
    );

    await waitFor(() => expect(probeBackend).toHaveBeenCalledTimes(1));
    expect(getAccessToken).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.refresh({ reschedule: false });
    });

    await waitFor(() => expect(probeBackend).toHaveBeenCalledTimes(2));
    expect(getAccessToken).toHaveBeenCalledTimes(1);
  });
});
