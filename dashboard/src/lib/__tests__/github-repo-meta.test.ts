import { beforeEach, describe, expect, it, vi } from "vitest";

describe("fetchGithubRepoMeta", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("dedupes concurrent requests for the same repo", async () => {
    let resolveFetch: ((value: any) => void) | null = null;
    const fetchMock = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const mod = await import("../github-repo-meta");
    const first = mod.fetchGithubRepoMeta("victorGPT/vibeusage");
    const second = mod.fetchGithubRepoMeta("victorGPT/vibeusage");

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    resolveFetch?.({
      ok: true,
      json: async () => ({
        stargazers_count: 42,
        owner: { avatar_url: "https://example.com/avatar.png" },
      }),
    });

    await expect(Promise.all([first, second])).resolves.toEqual([
      { stars: 42, avatarUrl: "https://example.com/avatar.png" },
      { stars: 42, avatarUrl: "https://example.com/avatar.png" },
    ]);
  });

  it("caps concurrent fetches for different repos", async () => {
    const resolvers: Array<(value: any) => void> = [];
    const fetchMock = vi.fn(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve);
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const mod = await import("../github-repo-meta");
    const first = mod.fetchGithubRepoMeta("owner/repo-1");
    const second = mod.fetchGithubRepoMeta("owner/repo-2");
    const third = mod.fetchGithubRepoMeta("owner/repo-3");

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    resolvers[0]?.({
      ok: true,
      json: async () => ({ stargazers_count: 1, owner: { avatar_url: null } }),
    });

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));

    resolvers[1]?.({
      ok: true,
      json: async () => ({ stargazers_count: 2, owner: { avatar_url: null } }),
    });
    resolvers[2]?.({
      ok: true,
      json: async () => ({ stargazers_count: 3, owner: { avatar_url: null } }),
    });

    await expect(Promise.all([first, second, third])).resolves.toEqual([
      { stars: 1, avatarUrl: null },
      { stars: 2, avatarUrl: null },
      { stars: 3, avatarUrl: null },
    ]);
  });
});
