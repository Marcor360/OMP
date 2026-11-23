type Cell = string | number | null | undefined;

const escapeCell = (value: Cell): string => {
  const text = value == null ? '' : String(value);
  // Make text supplied by users inert when a spreadsheet opens the CSV.
  const safe = typeof value === 'string' && /^[\s\u0000-\u001f]*[=+\-@]|^[\t\r\n]/.test(text)
    ? "'" + text : text;
  return '"' + safe.replace(/"/g, '""') + '"';
};

export const buildPreachingReportCsv = (rows: Cell[][]): string =>
  '\uFEFF' + rows.map((row) => row.map(escapeCell).join(',')).join('\r\n') + '\r\n';
