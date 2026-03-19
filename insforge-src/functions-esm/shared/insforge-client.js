let cachedCreateClientPromise = null;

async function loadSdkCreateClient() {
  if (typeof Deno === "undefined") return null;
  try {
    const mod = await import("npm:@insforge/sdk");
    return typeof mod?.createClient === "function" ? mod.createClient : null;
  } catch (_error) {
    return null;
  }
}

export async function getCreateClient() {
  const injected = globalThis.createClient;
  if (typeof injected === "function") return injected;

  if (!cachedCreateClientPromise) {
    cachedCreateClientPromise = loadSdkCreateClient();
  }
  const sdkCreateClient = await cachedCreateClientPromise;
  if (typeof sdkCreateClient === "function") return sdkCreateClient;

  throw new Error("Missing createClient");
}

export async function createEdgeClient(options) {
  const createClient = await getCreateClient();
  return createClient(options);
}
