// Minimal client-side CSV export. Takes an array of rows + column definitions,
// builds a CSV string, and triggers a browser download. No external library.
//
// CSV semantics:
//   - Comma separator
//   - Values containing comma, quote, CR or LF are double-quoted; embedded
//     quotes are doubled per RFC 4180.
//   - UTF-8 BOM prefix so Excel opens it with the right encoding by default.

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

function escapeCell(v: string | number | null | undefined): string {
  if (v == null) return "";
  const s = typeof v === "number" ? String(v) : v;
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const head = columns.map((c) => escapeCell(c.header)).join(",");
  const body = rows
    .map((r) => columns.map((c) => escapeCell(c.value(r))).join(","))
    .join("\r\n");
  // BOM so Excel auto-detects UTF-8.
  return "\ufeff" + head + "\r\n" + body + (body ? "\r\n" : "");
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Free the blob URL after a tick - browsers complete the download asynchronously.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportRowsAsCsv<T>(filename: string, rows: T[], columns: CsvColumn<T>[]): void {
  downloadCsv(filename, buildCsv(rows, columns));
}
