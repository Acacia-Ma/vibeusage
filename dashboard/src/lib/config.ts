import runtimeDefaults from "../../../src/shared/runtime-defaults.cjs";

const { DEFAULT_INSFORGE_BASE_URL } = runtimeDefaults as any;

export function getInsforgeBaseUrl() {
  const env = typeof import.meta !== "undefined" ? import.meta.env : undefined;
  return env?.VITE_VIBEUSAGE_INSFORGE_BASE_URL || env?.VITE_INSFORGE_BASE_URL || DEFAULT_INSFORGE_BASE_URL;
}

export function getInsforgeAnonKey() {
  const env = typeof import.meta !== "undefined" ? import.meta.env : undefined;
  return env?.VITE_VIBEUSAGE_INSFORGE_ANON_KEY || env?.VITE_INSFORGE_ANON_KEY || "";
}
