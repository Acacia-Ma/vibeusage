import copyRaw from "../content/copy.csv?raw";
import * as copyRegistryModule from "../../../src/shared/copy-registry.js";

type AnyRecord = Record<string, any>;

let cachedRegistry: any = null;
const { buildCopyRegistry, interpolateCopyText, normalizeCopyText } = copyRegistryModule as any;

function getRegistry() {
  if (!cachedRegistry) {
    cachedRegistry = buildCopyRegistry(copyRaw);
    if (cachedRegistry.missingColumns?.length && import.meta?.env?.DEV) {
      // eslint-disable-next-line no-console
      console.error("Copy registry missing columns:", cachedRegistry.missingColumns.join(", "));
    }
    if (cachedRegistry.duplicates?.size && import.meta?.env?.DEV) {
      for (const [key, rows] of cachedRegistry.duplicates.entries()) {
        // eslint-disable-next-line no-console
        console.warn(`Duplicate copy key: ${key} (rows ${rows.join(", ")})`);
      }
    }
  }
  return cachedRegistry;
}

export function copy(key: any, params?: AnyRecord) {
  const registry = getRegistry();
  const record = registry.map.get(key);
  const value = record?.text || key;

  if (!record && import.meta?.env?.DEV) {
    // eslint-disable-next-line no-console
    console.warn(`Missing copy key: ${key}`);
  }

  const normalized = normalizeCopyText(value);
  return interpolateCopyText(normalized, params);
}

export function getCopyRegistry() {
  return getRegistry();
}
