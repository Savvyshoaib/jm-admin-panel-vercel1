import ExcelJS from "exceljs";

const BRAND = {
  ink: "FF1D1D1F",
  gold: "FFFCC11D",
  softGold: "FFFFF4D6",
  stripe: "FFF7F7F5",
  white: "FFFFFFFF",
  muted: "FFF0F0EE",
  mutedText: "FF6B6B6B",
  border: "FFD9D9D4",
  availableBg: "FFE8F5E9",
  availableFg: "FF1B5E20",
  archivedBg: "FFF0F0EE",
  archivedFg: "FF5C5C5C",
  draftBg: "FFF5F5F5",
  draftFg: "FF6B6B6B",
  visibleBg: "FFFFF4D6",
  visibleFg: "FF7A5C00",
  hiddenBg: "FFF0F0EE",
  hiddenFg: "FF6B6B6B",
};

export type ExcelColumn = {
  header: string;
  width?: number;
  /** ExcelJS numFmt, e.g. `"£"#,##0` */
  numFmt?: string;
  align?: "left" | "center" | "right";
};

export type ExcelCellStyleHint = "status" | "explore" | "currency" | "index";

export type ExcelRowCell = {
  value: string | number | null | undefined;
  hint?: ExcelCellStyleHint;
};

function thinBorder(): Partial<ExcelJS.Borders> {
  const edge: Partial<ExcelJS.Border> = {
    style: "thin",
    color: { argb: BRAND.border },
  };
  return { top: edge, left: edge, bottom: edge, right: edge };
}

function statusColors(raw: string): { bg: string; fg: string } {
  const key = raw.trim().toLowerCase().replace(/\s+/g, "_");
  if (
    key === "available" ||
    key === "published" ||
    key === "active" ||
    key === "converted" ||
    key === "accepted"
  ) {
    return { bg: BRAND.availableBg, fg: BRAND.availableFg };
  }
  if (key === "high" || key === "urgent" || key === "new") {
    return { bg: BRAND.softGold, fg: BRAND.visibleFg };
  }
  if (key === "archived" || key === "completed" || key === "sold_out" || key === "closed") {
    return { bg: BRAND.archivedBg, fg: BRAND.archivedFg };
  }
  if (
    key === "coming_soon" ||
    key === "reserved" ||
    key === "sent" ||
    key === "medium"
  ) {
    return { bg: BRAND.softGold, fg: BRAND.visibleFg };
  }
  return { bg: BRAND.draftBg, fg: BRAND.draftFg };
}

function exploreColors(raw: string): { bg: string; fg: string } {
  const key = raw.trim().toLowerCase();
  if (key === "visible") return { bg: BRAND.visibleBg, fg: BRAND.visibleFg };
  return { bg: BRAND.hiddenBg, fg: BRAND.hiddenFg };
}

function applyHint(
  cell: ExcelJS.Cell,
  hint: ExcelCellStyleHint | undefined,
  display: string,
): void {
  if (hint === "status") {
    const { bg, fg } = statusColors(display);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
    cell.font = { ...(cell.font ?? {}), color: { argb: fg }, bold: true };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    return;
  }
  if (hint === "explore") {
    const { bg, fg } = exploreColors(display);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
    cell.font = { ...(cell.font ?? {}), color: { argb: fg }, bold: true };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    return;
  }
  if (hint === "index") {
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.font = { ...(cell.font ?? {}), color: { argb: BRAND.mutedText } };
  }
}

export async function downloadStyledExcel(options: {
  filename: string;
  sheetName: string;
  columns: ExcelColumn[];
  rows: ExcelRowCell[][];
  title?: string;
}): Promise<void> {
  const { filename, sheetName, columns, rows, title } = options;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Joseph Mews Admin";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ state: "frozen", ySplit: title ? 2 : 1, showGridLines: false }],
  });

  let headerRowIndex = 1;
  if (title) {
    sheet.mergeCells(1, 1, 1, columns.length);
    const titleCell = sheet.getCell(1, 1);
    titleCell.value = title;
    titleCell.font = {
      name: "Calibri",
      size: 14,
      bold: true,
      color: { argb: BRAND.ink },
    };
    titleCell.alignment = { vertical: "middle", horizontal: "left" };
    sheet.getRow(1).height = 28;
    headerRowIndex = 2;
  }

  columns.forEach((col, index) => {
    sheet.getColumn(index + 1).width = col.width ?? 16;
  });

  const headerRow = sheet.getRow(headerRowIndex);
  headerRow.height = 24;
  columns.forEach((col, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = col.header;
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: BRAND.ink },
    };
    cell.font = {
      name: "Calibri",
      size: 11,
      bold: true,
      color: { argb: BRAND.gold },
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: col.align ?? "center",
      wrapText: true,
    };
    cell.border = thinBorder();
  });

  rows.forEach((rowCells, rowOffset) => {
    const excelRow = sheet.getRow(headerRowIndex + 1 + rowOffset);
    excelRow.height = 22;
    const stripe = rowOffset % 2 === 1;

    rowCells.forEach((entry, colIndex) => {
      const col = columns[colIndex];
      const cell = excelRow.getCell(colIndex + 1);
      const raw = entry?.value;
      cell.value = raw == null || raw === "" ? "—" : raw;
      cell.border = thinBorder();
      cell.font = { name: "Calibri", size: 11, color: { argb: BRAND.ink } };
      cell.alignment = {
        vertical: "middle",
        horizontal: col?.align ?? (typeof raw === "number" ? "right" : "left"),
        wrapText: false,
      };

      if (stripe && entry?.hint !== "status" && entry?.hint !== "explore") {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: BRAND.stripe },
        };
      }

      if (col?.numFmt && typeof raw === "number") {
        cell.numFmt = col.numFmt;
      }

      applyHint(cell, entry?.hint, String(raw ?? ""));
    });
  });

  const dataStart = headerRowIndex;
  const dataEnd = headerRowIndex + Math.max(rows.length, 0);
  const lastCol = columns.length;
  if (rows.length > 0) {
    // Column filter dropdowns (Excel AutoFilter)
    sheet.autoFilter = {
      from: { row: dataStart, column: 1 },
      to: { row: dataEnd, column: lastCol },
    };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const safeName = filename.toLowerCase().endsWith(".xlsx")
    ? filename
    : `${filename}.xlsx`;
  anchor.href = url;
  anchor.download = safeName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
