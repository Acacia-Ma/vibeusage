const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const sqlPath = path.join(__dirname, "..", "scripts", "ops", "fix-auth-uid-nonuuid.sql");

test("auth uid nonuuid fix installs safe helper and rewires RLS policies", () => {
  const sql = fs.readFileSync(sqlPath, "utf8");
  assert.match(sql, /create or replace function public\.vibeusage_auth_uid\(\)/);
  assert.match(sql, /project-admin-with-api-key/);
  assert.match(sql, /when sub ~\*/);
  assert.match(sql, /alter policy vibeusage_tracker_device_tokens_select/);
  assert.match(sql, /\(select public\.vibeusage_auth_uid\(\)\) = user_id/);
  assert.doesNotMatch(sql, /\(select auth\.uid\(\)\) = user_id/);
});
