const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const sqlPath = path.join(
  __dirname,
  "..",
  "scripts",
  "ops",
  "insforge-advisor-performance-hardening.sql",
);

function readSql() {
  return fs.readFileSync(sqlPath, "utf8");
}

test("advisor performance hardening adds concurrent FK indexes", () => {
  const sql = readSql();
  for (const indexName of [
    "idx_vibeusage_tracker_device_tokens_device_id",
    "idx_vibeusage_tracker_events_device_id",
    "idx_vibeusage_tracker_events_device_token_id",
    "idx_vibeusage_user_settings_user_id",
    "idx_vibeusage_tracker_hourly_device_token_id",
    "idx_vibeusage_tracker_ingest_batches_device_token_id",
    "idx_vibeusage_user_entitlements_user_id",
    "idx_vibeusage_link_codes_user_id",
    "idx_vibeusage_public_views_user_id",
    "idx_vibeusage_projects_device_id",
    "idx_vibeusage_projects_device_token_id",
    "idx_vibeusage_project_usage_hourly_device_id",
    "idx_vibeusage_project_usage_hourly_device_token_id",
    "idx_vibeusage_tracker_subscriptions_device_id",
    "idx_vibeusage_tracker_subscriptions_device_token_id",
  ]) {
    assert.match(sql, new RegExp(`create index concurrently if not exists ${indexName}`));
  }
  assert.doesNotMatch(sql, /\bbegin\b/i);
  assert.doesNotMatch(sql, /\bcommit\b/i);
});

test("advisor performance hardening uses safe auth uid in RLS policies", () => {
  const sql = readSql();
  for (const policyName of [
    "vibeusage_link_codes_insert_self",
    "vibeusage_project_usage_hourly_select",
    "vibeusage_projects_select",
    "vibeusage_public_views_update",
    "vibeusage_tracker_device_tokens_insert",
    "vibeusage_tracker_devices_update",
    "vibeusage_tracker_hourly_select",
    "vibeusage_user_settings_update",
  ]) {
    assert.match(sql, new RegExp(`alter policy ${policyName}`));
  }
  assert.match(sql, /create or replace function public\.vibeusage_auth_uid\(\)/);
  assert.match(sql, /\(select public\.vibeusage_auth_uid\(\)\) = user_id/);
  assert.doesNotMatch(sql, /\(select auth\.uid\(\)\) = user_id/);
  assert.match(sql, /d\.user_id = \(select public\.vibeusage_auth_uid\(\)\)/);
});
