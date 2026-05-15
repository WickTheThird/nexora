// Flexible CSV parser for the principal's "Add your workers" roster.
//
// Goals:
//   - Detect columns by CONTENT shape, not header order:
//       * PPS  - matches Irish PPS pattern (7 digits + 1-2 letters)
//       * email - contains '@'
//       * name  - everything else, or a single Full Name column,
//                 OR split First Name + Last Name (or Surname) columns
//   - Tolerate extra/unknown columns
//   - Return good rows + bad rows so the UI can show inline fix prompts

export interface RosterRow {
  pps: string;
  email: string;
  name: string;
}

export interface RosterParseResult {
  good: RosterRow[];
  bad: Array<{
    rowIndex: number;     // 1-based; line in the CSV
    raw: string[];        // original cell values
    issue: string;        // human description
  }>;
  detectedColumns: {
    pps: number | null;
    email: number | null;
    fullName: number | null;
    firstName: number | null;
    lastName: number | null;
  };
}

// Irish PPS canonical regex (covers Old + New formats). The new format
// is 7 digits + 2 letters, old was 7 digits + 1 letter.
const PPS_RE = /^\s*\d{7}[A-Za-z]{1,2}\s*$/;
const EMAIL_RE = /[^\s,;]+@[^\s,;]+\.[^\s,;]+/;

function normaliseHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function isPpsLike(s: string): boolean {
  return PPS_RE.test(s.trim());
}

function isEmailLike(s: string): boolean {
  return EMAIL_RE.test(s.trim());
}

// Tokenise one CSV line. Handles quoted fields with commas inside.
function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else {
      if (c === ",") {
        cells.push(cur);
        cur = "";
      } else if (c === '"') {
        inQuotes = true;
      } else {
        cur += c;
      }
    }
  }
  cells.push(cur);
  return cells.map((s) => s.trim());
}

// Headers we recognise. Anything we can't classify is ignored.
function classifyHeader(h: string): "pps" | "email" | "fullName" | "firstName" | "lastName" | null {
  const n = normaliseHeader(h);
  if (n.includes("pps") || n.includes("ppsno") || n.includes("ppsnumber") || n.includes("revenueid") || n.includes("utr") || n.includes("taxid")) return "pps";
  if (n.includes("email") || n.includes("mail")) return "email";
  if (n === "fullname" || n === "name" || n === "operativename" || n === "workername" || n === "personname" || n === "subname") return "fullName";
  if (n.includes("firstname") || n === "first" || n === "givenname" || n === "forename") return "firstName";
  if (n.includes("lastname") || n === "last" || n === "surname" || n === "familyname") return "lastName";
  return null;
}

// If headers couldn't tell us where things are, infer from the FIRST data
// row by looking at what each cell looks like.
function inferFromDataRow(cells: string[]): RosterParseResult["detectedColumns"] {
  const det: RosterParseResult["detectedColumns"] = { pps: null, email: null, fullName: null, firstName: null, lastName: null };
  cells.forEach((cell, i) => {
    if (det.pps === null && isPpsLike(cell)) det.pps = i;
    else if (det.email === null && isEmailLike(cell)) det.email = i;
    else if (det.fullName === null && cell.length > 0 && !isPpsLike(cell) && !isEmailLike(cell)) det.fullName = i;
  });
  return det;
}

export function parseRosterCsv(text: string): RosterParseResult {
  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/^\uFEFF/, ""))
    .filter((l) => l.trim().length > 0);

  const good: RosterRow[] = [];
  const bad: RosterParseResult["bad"] = [];
  const detected: RosterParseResult["detectedColumns"] = { pps: null, email: null, fullName: null, firstName: null, lastName: null };

  if (lines.length === 0) {
    return { good, bad, detectedColumns: detected };
  }

  // Try the first line as a header. If we can classify >= 1 column by
  // header name, use header mode; otherwise treat the file as headerless
  // and infer from row 1.
  const headerCells = splitCsvLine(lines[0]);
  let headerMatchCount = 0;
  headerCells.forEach((h, i) => {
    const k = classifyHeader(h);
    if (k && detected[k] === null) {
      detected[k] = i;
      headerMatchCount++;
    }
  });

  let startIdx = 0;
  if (headerMatchCount >= 1) {
    startIdx = 1;
  } else {
    // Headerless: infer from first row
    Object.assign(detected, inferFromDataRow(headerCells));
    startIdx = 0;
  }

  // We need PPS and email at minimum to be useful
  if (detected.pps === null || detected.email === null) {
    // Try harder: scan all rows to find which column index is most often
    // PPS-like vs email-like.
    const sample = lines.slice(startIdx, startIdx + 10).map(splitCsvLine);
    const colCount = Math.max(...sample.map((r) => r.length), 0);
    const score = Array.from({ length: colCount }, () => ({ pps: 0, email: 0 }));
    for (const row of sample) {
      row.forEach((cell, i) => {
        if (isPpsLike(cell)) score[i].pps++;
        if (isEmailLike(cell)) score[i].email++;
      });
    }
    if (detected.pps === null) {
      const idx = score.findIndex((s) => s.pps > 0);
      if (idx >= 0) detected.pps = idx;
    }
    if (detected.email === null) {
      const idx = score.findIndex((s) => s.email > 0);
      if (idx >= 0) detected.email = idx;
    }
  }

  // If we still can't find PPS or email, the file is unusable.
  if (detected.pps === null || detected.email === null) {
    bad.push({
      rowIndex: 0,
      raw: headerCells,
      issue: "Couldn't find a PPS or email column. Make sure your file has columns for PPS number and email.",
    });
    return { good, bad, detectedColumns: detected };
  }

  for (let li = startIdx; li < lines.length; li++) {
    const rowIndex = li + 1;
    const cells = splitCsvLine(lines[li]);
    const pps = (cells[detected.pps] || "").trim().toUpperCase();
    const email = (cells[detected.email] || "").trim().toLowerCase();

    let name = "";
    if (detected.fullName !== null) {
      name = (cells[detected.fullName] || "").trim();
    } else if (detected.firstName !== null || detected.lastName !== null) {
      const first = detected.firstName !== null ? (cells[detected.firstName] || "").trim() : "";
      const last = detected.lastName !== null ? (cells[detected.lastName] || "").trim() : "";
      name = [first, last].filter(Boolean).join(" ");
    } else {
      // Final fallback: any non-PPS, non-email cell that doesn't look
      // numeric. Lets us survive files where the name column wasn't
      // labelled at all.
      const candidate = cells.find((c, i) => {
        if (i === detected.pps || i === detected.email) return false;
        const trimmed = c.trim();
        return trimmed.length > 0 && !isPpsLike(trimmed) && !isEmailLike(trimmed);
      });
      name = (candidate || "").trim();
    }

    const issues: string[] = [];
    if (!isPpsLike(pps)) issues.push("invalid PPS");
    if (!isEmailLike(email)) issues.push("invalid email");
    if (!name) issues.push("missing name");

    if (issues.length > 0) {
      bad.push({ rowIndex, raw: cells, issue: issues.join(", ") });
    } else {
      good.push({ pps, email, name });
    }
  }

  return { good, bad, detectedColumns: detected };
}

export function rosterRowsToCsv(rows: RosterRow[]): string {
  const head = "PPS Number,Email,Full Name\n";
  return head + rows.map((r) => `${r.pps},${r.email},${r.name.replace(/"/g, '""')}`).join("\n");
}
