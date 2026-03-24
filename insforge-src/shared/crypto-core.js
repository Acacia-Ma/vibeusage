"use strict";

const CORE_KEY = "__vibeusageCryptoCore";

async function sha256Hex(input) {
  const data = new TextEncoder().encode(String(input ?? ""));
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

if (!globalThis[CORE_KEY]) {
  Object.defineProperty(globalThis, CORE_KEY, {
    value: {
      sha256Hex,
    },
    configurable: true,
    enumerable: false,
    writable: false,
  });
}
