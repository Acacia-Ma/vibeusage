type UsagePanelLoadingArgs = {
  usageLoading?: boolean;
  trendLoading?: boolean;
  heatmapLoading?: boolean;
  modelBreakdownLoading?: boolean;
};

type RollingUsageSelectionArgs = {
  recentRolling?: any;
};

export function getUsagePanelLoading({ usageLoading }: UsagePanelLoadingArgs = {}) {
  return Boolean(usageLoading);
}

export function selectRollingUsageForDisplay({
  recentRolling,
}: RollingUsageSelectionArgs = {}) {
  return recentRolling ?? null;
}
