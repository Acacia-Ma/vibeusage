export const REQUIRED_COPY_COLUMNS: string[];

export function parseCsvRows(raw: string): string[][];

export function buildCopyRegistry(raw: string): {
  header: string[];
  rows: Array<{
    key: string;
    module: string;
    page: string;
    component: string;
    slot: string;
    text: string;
    row: number;
  }>;
  map: Map<
    string,
    {
      key: string;
      module: string;
      page: string;
      component: string;
      slot: string;
      text: string;
      row: number;
    }
  >;
  duplicates: Map<string, number[]>;
  missingColumns: string[];
};

export function normalizeCopyText(text: unknown): string;
export function interpolateCopyText(text: string, params?: Record<string, unknown>): string;
