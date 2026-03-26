import { logSlowQuery } from "../logging.js";
import { collectHourlyUsageRows } from "./usage-row-collector.js";

export async function collectFilteredUsageRows({
  logger,
  queryLabel,
  logMeta,
  edgeClient,
  userId,
  source,
  usageModels,
  canonicalModel,
  hasModelFilter,
  aliasTimeline,
  effectiveDate,
  startIso,
  endIso,
  rowStateOptions,
  onUsageRow,
} = {}) {
  const queryStartMs = Date.now();
  const { error, rowCount } = await collectHourlyUsageRows({
    edgeClient,
    userId,
    source,
    usageModels,
    canonicalModel,
    hasModelFilter,
    aliasTimeline,
    effectiveDate,
    startIso,
    endIso,
    rowStateOptions,
    onUsageRow,
  });
  const queryDurationMs = Date.now() - queryStartMs;

  logSlowQuery(logger, {
    query_label: queryLabel,
    duration_ms: queryDurationMs,
    row_count: rowCount,
    ...(logMeta || {}),
  });

  return { error, rowCount, queryDurationMs };
}
