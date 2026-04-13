type SnapshotScope = "usage" | "trend" | "modelBreakdown" | "recentUsage";

const snapshotScopes = new Map<SnapshotScope, Map<string, any>>();

function getScopeStore(scope: SnapshotScope) {
  let store = snapshotScopes.get(scope);
  if (!store) {
    store = new Map<string, any>();
    snapshotScopes.set(scope, store);
  }
  return store;
}

export function readDashboardLiveSnapshot(scope: SnapshotScope, key?: string | null) {
  if (!key) return null;
  return getScopeStore(scope).get(key) ?? null;
}

export function writeDashboardLiveSnapshot(
  scope: SnapshotScope,
  key: string | null | undefined,
  snapshot: any,
) {
  if (!key) return;
  getScopeStore(scope).set(key, snapshot);
}

export function deleteDashboardLiveSnapshot(scope: SnapshotScope, key?: string | null) {
  if (!key) return;
  getScopeStore(scope).delete(key);
}

export function clearDashboardLiveSnapshotsForTests() {
  snapshotScopes.clear();
}
