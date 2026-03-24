"use strict";

const CORE_KEY = "__vibeusageHttpCore";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

function handleOptions(request) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  return null;
}

function json(body, status = 200, extraHeaders = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      ...(extraHeaders || {}),
    },
  });
}

function requireMethod(request, method) {
  if (request.method !== method) return json({ error: "Method not allowed" }, 405);
  return null;
}

async function readJson(request) {
  if (!request.headers.get("Content-Type")?.includes("application/json")) {
    return { error: "Content-Type must be application/json", status: 415, data: null };
  }
  try {
    const data = await request.json();
    return { error: null, status: 200, data };
  } catch (_error) {
    return { error: "Invalid JSON", status: 400, data: null };
  }
}

if (!globalThis[CORE_KEY]) {
  Object.defineProperty(globalThis, CORE_KEY, {
    value: {
      corsHeaders,
      handleOptions,
      json,
      requireMethod,
      readJson,
    },
    configurable: true,
    enumerable: false,
    writable: false,
  });
}
