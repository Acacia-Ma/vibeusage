interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly VITE_APP_VERSION?: string;
  readonly APP_VERSION?: string;
  readonly VITE_VIBEUSAGE_HTTP_TIMEOUT_MS?: string;
  readonly VITE_VIBEUSAGE_MOCK?: string;
  readonly VITE_VIBEUSAGE_MOCK_NOW?: string;
  readonly VITE_VIBEUSAGE_MOCK_TODAY?: string;
  readonly VITE_VIBEUSAGE_MOCK_SEED?: string;
  readonly VITE_VIBEUSAGE_MOCK_MISSING?: string;
  readonly VITE_VIBEUSAGE_INSFORGE_BASE_URL?: string;
  readonly VITE_INSFORGE_BASE_URL?: string;
  readonly VITE_VIBEUSAGE_INSFORGE_ANON_KEY?: string;
  readonly VITE_INSFORGE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*?raw" {
  const content: string;
  export default content;
}

// Note: We previously hand-rolled a thin `declare module "react"` stub here
// (useState/useEffect/useMemo/useCallback/useRef + 3 types). Module
// augmentation in user-land overrides @types/react completely, which hid
// forwardRef, ComponentPropsWithoutRef, ElementRef, lazy, memo, and
// everything else from the dashboard. We rely on @types/react now.
