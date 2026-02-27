import ExcelJS from 'exceljs';

/**
 * Export data to a single-sheet Excel file and trigger download.
 */
export async function exportToExcel(
  data: Record<string, unknown>[],
  filename: string,
  sheetName: string
) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);

  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  sheet.addRow(headers);
  sheet.getRow(1).font = { bold: true };
  sheet.columns = headers.map((h) => ({ width: Math.max(h.length + 2, 14) }));

  for (const row of data) {
    sheet.addRow(headers.map((h) => row[h] ?? ''));
  }

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBuffer(buffer as ArrayBuffer, filename);
}

/**
 * Export data to a multi-sheet Excel file and trigger download.
 */
export async function exportMultiSheetExcel(
  sheets: { name: string; data: Record<string, unknown>[] }[],
  filename: string
) {
  const workbook = new ExcelJS.Workbook();

  for (const { name, data } of sheets) {
    const sheet = workbook.addWorksheet(name);
    if (data.length === 0) continue;

    const headers = Object.keys(data[0]);
    sheet.addRow(headers);
    sheet.getRow(1).font = { bold: true };
    sheet.columns = headers.map((h) => ({ width: Math.max(h.length + 2, 14) }));

    for (const row of data) {
      sheet.addRow(headers.map((h) => row[h] ?? ''));
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBuffer(buffer as ArrayBuffer, filename);
}

/**
 * Parse an Excel file into headers and rows of string values.
 */
export async function parseExcelFile(
  data: ArrayBuffer
): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  const workbook = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(data as any);

  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.rowCount === 0) {
    return { headers: [], rows: [] };
  }

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber - 1] = String(cell.value ?? '').trim();
  });

  const rows: Record<string, string>[] = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    if (!row.hasValues) continue;
    const obj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      const val = row.getCell(c + 1).value;
      obj[headers[c]] = String(val ?? '').trim();
    }
    rows.push(obj);
  }

  return { headers, rows };
}

function downloadBuffer(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
