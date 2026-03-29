"use strict";

function toBase64Url(value) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function createTestUserJwt(userId = "user-id", { expiresInSeconds = 3600 } = {}) {
  const header = toBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = toBase64Url(
    JSON.stringify({
      sub: userId,
      role: "authenticated",
      exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
    }),
  );
  return `${header}.${payload}.signature`;
}

module.exports = {
  createTestUserJwt,
};
