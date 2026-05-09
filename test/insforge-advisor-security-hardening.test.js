const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const sqlPath = path.join(
  __dirname,
  "..",
  "scripts",
  "ops",
  "insforge-advisor-security-hardening.sql",
);

function readSql() {
  return fs.readFileSync(sqlPath, "utf8");
}

test("advisor hardening enables forced RLS for reported public tables", () => {
  const sql = readSql();
  for (const tableName of [
    "nft_siwe_nonces",
    "nft_wallet_bindings",
    "nft_wallet_binding_audit",
    "nft_issuances",
    "nft_allowlist_roots",
    "vibeusage_user_totals",
    "posts",
  ]) {
    assert.match(sql, new RegExp(`'${tableName}'`));
  }
  assert.match(sql, /enable row level security/);
  assert.match(sql, /force row level security/);
});

test("advisor hardening removes anonymous metadata reads", () => {
  const sql = readSql();
  for (const policyName of [
    "vibeusage_model_aliases_select",
    "vibeusage_pricing_model_aliases_select",
    "vibeusage_pricing_profiles_select",
  ]) {
    assert.match(sql, new RegExp(`create policy ${policyName}`));
  }
  assert.doesNotMatch(sql, /for select\s+to public\s+using\s*\(true\)/i);
  assert.match(sql, /to authenticated\s+using \(\(select auth\.uid\(\)\) is not null\)/i);
});

test("advisor hardening keeps project_admin explicit instead of literal true", () => {
  const sql = readSql();
  for (const tableName of [
    "nft_siwe_nonces",
    "nft_wallet_bindings",
    "nft_wallet_binding_audit",
    "nft_issuances",
    "nft_allowlist_roots",
    "vibeusage_user_totals",
    "posts",
  ]) {
    assert.match(sql, new RegExp(`'${tableName}'`));
  }
  assert.match(sql, /create policy project_admin_policy/);
  assert.match(sql, /current_user = 'project_admin'/);
  assert.doesNotMatch(sql, /to project_admin using \(true\) with check \(true\)/i);
});

test("advisor hardening locks SECURITY DEFINER execution grants", () => {
  const sql = readSql();
  for (const functionName of [
    "vibeusage_device_token_allows_event_insert",
    "vibeusage_leaderboard_system_earliest_day",
    "vibeusage_purge_events",
    "vibeusage_exchange_link_code",
    "vibeusage_leaderboard_period",
    "vibeusage_leaderboard_me",
  ]) {
    assert.match(sql, new RegExp(`revoke execute on function public\\.${functionName}`));
    assert.match(sql, new RegExp(`alter function public\\.${functionName}`));
  }
  assert.match(sql, /set search_path = ''/);
  assert.match(sql, /alter function public\.vibeusage_device_token_allows_event_insert\(uuid, uuid, uuid\) security invoker/);
  assert.match(sql, /revoke execute on function public\.vibeusage_leaderboard_me\(text, text\) from anon, authenticated/);
  assert.match(sql, /grant execute on function public\.vibeusage_purge_events\(timestamp with time zone, boolean\) to project_admin/);
  assert.doesNotMatch(sql, /grant execute on function public\.vibeusage_leaderboard_me\(text, text\) to authenticated/);
});
