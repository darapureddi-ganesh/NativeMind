// Minimal CSV parse/serialize + a browser download helper. No dependencies.

/** Parse CSV text into rows of string cells. Handles quoted fields, commas,
 *  escaped quotes ("") and CRLF/LF line endings. */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const s = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += c;
    }
  }
  // trailing cell/row
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function escapeCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Serialize an array of objects to CSV using the given column keys. */
export function toCSV(rows: Record<string, unknown>[], columns: string[]): string {
  const header = columns.map(escapeCell).join(",");
  const body = rows
    .map((r) => columns.map((c) => escapeCell(r[c])).join(","))
    .join("\n");
  return `${header}\n${body}`;
}

/** Trigger a client-side file download. */
export function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface ParsedItem {
  input: string;
  expectedOutput?: string;
}

/** Interpret pasted/uploaded text as dataset items.
 *  Accepts JSON (array of strings, or array of {input, expectedOutput}) or CSV
 *  (with an "input"/"expectedOutput" header, else first col = input, second =
 *  expected). */
export function parseItems(text: string): ParsedItem[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // JSON?
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const data = JSON.parse(trimmed);
      const arr = Array.isArray(data) ? data : [data];
      return arr
        .map((row): ParsedItem | null => {
          if (typeof row === "string") return { input: row };
          if (row && typeof row === "object") {
            const input = row.input ?? row.prompt ?? row.question;
            if (typeof input === "string" && input.trim()) {
              const expected =
                row.expectedOutput ?? row.expected ?? row.output ?? row.answer;
              return {
                input: input.trim(),
                expectedOutput:
                  typeof expected === "string" && expected.trim()
                    ? expected.trim()
                    : undefined,
              };
            }
          }
          return null;
        })
        .filter((x): x is ParsedItem => x !== null);
    } catch {
      // fall through to CSV
    }
  }

  // CSV
  const rows = parseCSV(trimmed);
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const inputIdx = header.indexOf("input");
  const expectedIdx =
    header.indexOf("expectedoutput") >= 0
      ? header.indexOf("expectedoutput")
      : header.indexOf("expected");
  const hasHeader = inputIdx >= 0;
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const iIdx = hasHeader ? inputIdx : 0;
  const eIdx = hasHeader ? expectedIdx : 1;
  return dataRows
    .map((r): ParsedItem | null => {
      const input = (r[iIdx] ?? "").trim();
      if (!input) return null;
      const expected = eIdx >= 0 ? (r[eIdx] ?? "").trim() : "";
      return { input, expectedOutput: expected || undefined };
    })
    .filter((x): x is ParsedItem => x !== null);
}
