# Pricing Sync Health Check

## 环境变量（InsForge 后台）

- `OPENROUTER_API_KEY`
- `VIBEUSAGE_PRICING_SOURCE=openrouter`
- `VIBEUSAGE_PRICING_MODEL=gpt-5.2-codex`
- Optional: `OPENROUTER_HTTP_REFERER`, `OPENROUTER_APP_TITLE`

## 手动触发

- GitHub Actions: **Sync Pricing Profiles**（默认 `retention_days=90`）
- 或 curl：

```bash
BASE_URL="https://5tmappuk.us-east.insforge.app"
curl -s -X POST "$BASE_URL/functions/vibeusage-pricing-sync" \
  -H "Authorization: Bearer <service_role_or_project_admin_key>" \
  -H "Content-Type: application/json" \
  --data '{"retention_days":90}'
```

## 健康检查 SQL

在 InsForge SQL 控制台执行：

```sql
-- scripts/ops/pricing-sync-health.sql
```

期望信号：

- `latest_effective_from` 是当天或前一天 UTC，且 `is_fresh = true`
- 最新 `effective_from` 有大量 `active_rows`
- 默认模型 `gpt-5.2-codex` 存在（精确或带前缀）
- `fallback_matches` 可解释且整体占比下降

说明：

- 同一天内重复执行 sync 会走 upsert，不保证刷新 `created_at`
- 因此新鲜度不再用 `created_at` 判定，而是看最新 `effective_from`
- 如果要看未命中模型详情，执行：

```sql
-- scripts/ops/pricing-alias-diagnostics.sql
```

## 常见错误

- `Unauthorized`：key 权限不足或环境不匹配
- `permission denied for sequence`：缺少序列权限（需 grant）
- `OPENROUTER_API_KEY missing`：InsForge 环境变量未配置
