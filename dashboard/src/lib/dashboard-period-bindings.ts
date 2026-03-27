type UsagePanelLoadingArgs = {
  usageLoading?: boolean;
  trendLoading?: boolean;
  heatmapLoading?: boolean;
  modelBreakdownLoading?: boolean;
};

type RollingUsageSelectionArgs = {
  recentRolling?: any;
  usageRolling?: any;
};

export function getUsagePanelLoading({ usageLoading }: UsagePanelLoadingArgs = {}) {
  return Boolean(usageLoading);
}

export function selectRollingUsageForDisplay({
  recentRolling,
  usageRolling,
}: RollingUsageSelectionArgs = {}) {
  if (recentRolling) return recentRolling;
  return usageRolling ?? null;
}
