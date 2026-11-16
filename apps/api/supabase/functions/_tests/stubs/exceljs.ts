// Test double for exceljs: records the rows the function writes so a test can see exactly which
// expenses would have been exported (globalThis.__xlsxRows).
type Row = Record<string, unknown>;
const g = globalThis as unknown as { __xlsxRows?: Row[] };

class Worksheet {
  columns: unknown[] = [];
  getRow(_n: number) {
    return { font: {}, fill: {} };
  }
  addRow(row: Row) {
    (g.__xlsxRows ??= []).push(row);
    return { font: {}, fill: {} };
  }
  getColumn(_key: string) {
    return { numFmt: "" };
  }
}

class Workbook {
  xlsx = { writeBuffer: () => Promise.resolve(new Uint8Array([0x50, 0x4b, 0x03, 0x04])) };
  addWorksheet(_name: string) {
    return new Worksheet();
  }
}

export default { Workbook };
