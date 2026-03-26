"use strict";

const REQUIRED_COPY_COLUMNS = ["key", "module", "page", "component", "slot", "text"];

function parseCsvRows(raw) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < String(raw || "").length; i += 1) {
    const ch = raw[i];

    if (inQuotes) {
      if (ch === '"') {
        const next = raw[i + 1];
        if (next === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ",") {
      row.push(field);
      field = "";
      continue;
    }

    if (ch === "\n") {
      row.push(field);
      field = "";
      if (!row.every((cell) => String(cell).trim() === "")) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    if (ch === "\r") continue;

    field += ch;
  }

  row.push(field);
  if (!row.every((cell) => String(cell).trim() === "")) {
    rows.push(row);
  }

  return rows;
}

function buildCopyRegistry(raw) {
  const rows = parseCsvRows(raw || "");
  if (!rows.length) {
    return {
      header: [],
      rows: [],
      map: new Map(),
      duplicates: new Map(),
      missingColumns: [...REQUIRED_COPY_COLUMNS],
    };
  }

  const header = rows[0].map((cell) => String(cell).trim());
  const missingColumns = REQUIRED_COPY_COLUMNS.filter((col) => !header.includes(col));
  if (missingColumns.length > 0) {
    return {
      header,
      rows: [],
      map: new Map(),
      duplicates: new Map(),
      missingColumns,
    };
  }

  const indexByColumn = Object.fromEntries(header.map((col, index) => [col, index]));
  const entries = [];
  const map = new Map();
  const duplicates = new Map();

  rows.slice(1).forEach((cells, rowIndex) => {
    const record = {
      key: String(cells[indexByColumn.key] || "").trim(),
      module: String(cells[indexByColumn.module] || "").trim(),
      page: String(cells[indexByColumn.page] || "").trim(),
      component: String(cells[indexByColumn.component] || "").trim(),
      slot: String(cells[indexByColumn.slot] || "").trim(),
      text: String(cells[indexByColumn.text] ?? "").trim(),
      row: rowIndex + 2,
    };

    if (!record.key) return;

    if (map.has(record.key)) {
      const existingRows = duplicates.get(record.key) || [map.get(record.key).row];
      existingRows.push(record.row);
      duplicates.set(record.key, existingRows);
    }

    map.set(record.key, record);
    entries.push(record);
  });

  return {
    header,
    rows: entries,
    map,
    duplicates,
    missingColumns: [],
  };
}

function normalizeCopyText(text) {
  return String(text ?? "").replace(/\\n/g, "\n");
}

function interpolateCopyText(text, params) {
  if (!params || typeof params !== "object") return text;
  return String(text).replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (params[key] == null) return match;
    return String(params[key]);
  });
}

module.exports = {
  REQUIRED_COPY_COLUMNS,
  parseCsvRows,
  buildCopyRegistry,
  normalizeCopyText,
  interpolateCopyText,
};
