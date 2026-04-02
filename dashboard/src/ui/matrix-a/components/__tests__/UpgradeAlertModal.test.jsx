import { cleanup, render, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UpgradeAlertModal } from "../UpgradeAlertModal.jsx";

function createStorageStub() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

describe("UpgradeAlertModal", () => {
  const originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");
  const originalLocalStorage = window.localStorage;

  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get() {
        return 42;
      },
    });
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: createStorageStub(),
    });
    document.documentElement.style.removeProperty("--matrix-banner-offset");
  });

  afterEach(() => {
    cleanup();
    document.documentElement.style.removeProperty("--matrix-banner-offset");
    if (originalOffsetHeight) {
      Object.defineProperty(HTMLElement.prototype, "offsetHeight", originalOffsetHeight);
    }
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: originalLocalStorage,
    });
    vi.restoreAllMocks();
  });

  it("sets and clears the banner offset CSS variable around mount lifecycle", async () => {
    const { unmount } = render(<UpgradeAlertModal requiredVersion="1.2.3" />);

    await waitFor(() => {
      expect(
        document.documentElement.style.getPropertyValue("--matrix-banner-offset"),
      ).toBe("42px");
    });

    unmount();

    expect(document.documentElement.style.getPropertyValue("--matrix-banner-offset")).toBe("0px");
  });
});
