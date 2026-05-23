const os = require("os");
const path = require("path");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const { Document, Packer, Paragraph, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, TextRun, HeadingLevel, Footer, PageNumber } = require("docx");

// Windows system font paths for Arabic support in PDF
const FONT_ARIAL = "C:\\Windows\\Fonts\\arial.ttf";
const FONT_ARIAL_BOLD = "C:\\Windows\\Fonts\\arialbd.ttf";

async function exportRowsToExcel(rows = [], worksheetName = "Report") {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(worksheetName);
  const headers = Object.keys(rows[0] || {});

  if (headers.length) {
    worksheet.addRow(headers);
    rows.forEach((row) => worksheet.addRow(headers.map((header) => row[header])));
  }

  const filePath = path.join(os.tmpdir(), `${worksheetName}-${Date.now()}.xlsx`);
  await workbook.xlsx.writeFile(filePath);
  return filePath;
}

async function exportRowsToPdf(rows = [], title = "Report") {
  const filePath = path.join(os.tmpdir(), `${title}-${Date.now()}.pdf`);
  const doc = new PDFDocument({ margin: 40 });
  const stream = fs.createWriteStream(filePath);

  doc.pipe(stream);
  doc.fontSize(18).text(title);
  doc.moveDown();
  rows.forEach((row) => {
    doc.fontSize(10).text(JSON.stringify(row));
    doc.moveDown(0.5);
  });
  doc.end();

  await new Promise((resolve) => stream.on("finish", resolve));
  return filePath;
}

/**
 * v2 exports: Arabic-friendly Excel and structured PDF (basic).
 * Note: PDFKit RTL shaping is limited; Excel is the primary high-quality export.
 */
async function exportRowsToExcelV2({
  rows = [],
  worksheetName = "Report",
  columns,
  rtl = true,
}) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ElHegazi Retailer";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(worksheetName, {
    views: rtl ? [{ rightToLeft: true }] : undefined,
  });

  const keys = Array.isArray(columns) && columns.length
    ? columns.map((c) => c.key)
    : Object.keys(safeRows[0] || {});
  const headers = Array.isArray(columns) && columns.length
    ? columns.map((c) => c.label)
    : keys;

  if (keys.length) {
    // Title row
    worksheet.addRow([worksheetName]);
    const titleRow = worksheet.getRow(1);
    titleRow.font = { bold: true, size: 16, color: { argb: "FF0F172A" } };
    titleRow.alignment = { vertical: "middle", horizontal: rtl ? "right" : "left" };
    titleRow.height = 28;
    worksheet.mergeCells(1, 1, 1, keys.length);

    // Empty spacer row
    worksheet.addRow([]);

    // Header row
    worksheet.addRow(headers);
    const headerRow = worksheet.getRow(3);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };
    headerRow.height = 24;
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF0F172A" },
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FF0F172A" } },
        bottom: { style: "thin", color: { argb: "FF0F172A" } },
        left: { style: "thin", color: { argb: "FF0F172A" } },
        right: { style: "thin", color: { argb: "FF0F172A" } },
      };
    });

    // Data rows with alternating colors
    safeRows.forEach((row, rowIdx) => {
      const dataRow = worksheet.addRow(keys.map((k) => row?.[k] ?? ""));
      dataRow.height = 20;
      dataRow.eachCell((cell, colIdx) => {
        const isNumeric = typeof cell.value === "number";
        cell.alignment = { vertical: "middle", horizontal: isNumeric ? "left" : (rtl ? "right" : "left") };
        cell.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } },
        };
        if (rowIdx % 2 === 0) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF8FAFC" },
          };
        }
        // Format numbers
        if (typeof cell.value === "number") {
          cell.numFmt = "#,##0.00";
        }
      });
    });

    // Auto-column widths based on content
    keys.forEach((k, idx) => {
      const header = headers[idx] || k;
      let maxWidth = String(header).length + 4;
      safeRows.slice(0, 50).forEach((row) => {
        const val = String(row?.[k] ?? "");
        if (val.length > maxWidth) maxWidth = Math.min(val.length, 30);
      });
      worksheet.getColumn(idx + 1).width = maxWidth + 2;
    });

    // Footer row
    worksheet.addRow([]);
    const footerRow = worksheet.addRow([`تم التصدير: ${new Date().toLocaleDateString("ar-EG-u-nu-latn")} - ${new Date().toLocaleTimeString("ar-EG-u-nu-latn")}`]);
    footerRow.font = { italic: true, size: 9, color: { argb: "FF64748B" } };
    footerRow.alignment = { horizontal: rtl ? "left" : "right" };
    worksheet.mergeCells(footerRow.number, 1, footerRow.number, keys.length);
  }

  const filePath = path.join(os.tmpdir(), `${worksheetName}-${Date.now()}.xlsx`);
  await workbook.xlsx.writeFile(filePath);
  return filePath;
}

async function exportRowsToPdfV2({
  rows = [],
  title = "Report",
  columns,
}) {
  const filePath = path.join(os.tmpdir(), `${title}-${Date.now()}.pdf`);
  const doc = new PDFDocument({ margin: 40, size: "A4" });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  doc.fontSize(16).text(title, { align: "right" });
  doc.moveDown(0.5);

  const keys = Array.isArray(columns) && columns.length
    ? columns.map((c) => c.key)
    : Object.keys(rows[0] || {});
  const headers = Array.isArray(columns) && columns.length
    ? columns.map((c) => c.label)
    : keys;

  // Simple header line (PDFKit RTL limitations acknowledged)
  if (headers.length) {
    doc.fontSize(9).text(headers.join(" | "), { align: "right" });
    doc.moveDown(0.25);
    doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke();
    doc.moveDown(0.4);
  }

  rows.slice(0, 400).forEach((row) => {
    const line = keys.map((k) => (row?.[k] == null ? "" : String(row[k]))).join(" | ");
    doc.fontSize(8).text(line, { align: "right" });
  });

  doc.end();
  await new Promise((resolve) => stream.on("finish", resolve));
  return filePath;
}

/**
 * Word (DOCX) export with Arabic RTL support and premium styling
 * Creates a professional table document with proper formatting
 */
async function exportRowsToDocx({
  rows = [],
  title = "Report",
  columns,
  rtl = true,
  filters = null,
  totals = {},
  companyName = "",
}) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const keys = Array.isArray(columns) && columns.length
    ? columns.map((c) => c.key)
    : Object.keys(safeRows[0] || {});
  const headers = Array.isArray(columns) && columns.length
    ? columns.map((c) => c.label)
    : keys;

  const tableRows = [];

  // Header row with dark background — repeats on every page
  if (headers.length) {
    tableRows.push(new TableRow({
      tableHeader: true,
      children: headers.map((header) => new TableCell({
        borders: {
          top: { style: BorderStyle.SINGLE, size: 8, color: "0f172a" },
          bottom: { style: BorderStyle.SINGLE, size: 8, color: "0f172a" },
          left: { style: BorderStyle.SINGLE, size: 4, color: "0f172a" },
          right: { style: BorderStyle.SINGLE, size: 4, color: "0f172a" },
        },
        shading: { fill: "0f172a" },
        width: { size: Math.round(100 / headers.length), type: WidthType.PERCENTAGE },
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 80, after: 80 },
          children: [new TextRun({ text: String(header), bold: true, color: "FFFFFF", size: 22, rightToLeft: rtl })],
        })],
      })),
    }));
  }

  // Determine column types for totals formatting
  const colTypes = {};
  if (Array.isArray(columns)) {
    columns.forEach((c) => { colTypes[c.key] = c.type; });
  }

  // Data rows with alternating colors
  safeRows.slice(0, 2000).forEach((row, rowIdx) => {
    const isEven = rowIdx % 2 === 0;
    tableRows.push(new TableRow({
      children: keys.map((k) => {
        const value = row?.[k] ?? "";
        const isNumeric = typeof value === "number" || (!isNaN(Number(value)) && value !== "");
        const displayVal = isNumeric && colTypes[k] === "money"
          ? Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : String(value);
        return new TableCell({
          borders: {
            top: { style: BorderStyle.SINGLE, size: 4, color: "e2e8f0" },
            bottom: { style: BorderStyle.SINGLE, size: 4, color: "e2e8f0" },
            left: { style: BorderStyle.SINGLE, size: 4, color: "e2e8f0" },
            right: { style: BorderStyle.SINGLE, size: 4, color: "e2e8f0" },
          },
          shading: isEven ? { fill: "f8fafc" } : undefined,
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 40, after: 40 },
            children: [new TextRun({
              text: displayVal,
              size: 20,
              rightToLeft: rtl,
              color: "0f172a",
            })],
          })],
        });
      }),
    }));
  });

  // Totals row
  if (Object.keys(totals).length > 0 && keys.length > 0) {
    tableRows.push(new TableRow({
      children: keys.map((k) => {
        const val = totals[k];
        const hasVal = val != null && !isNaN(Number(val));
        return new TableCell({
          borders: {
            top: { style: BorderStyle.SINGLE, size: 8, color: "0f172a" },
            bottom: { style: BorderStyle.SINGLE, size: 8, color: "0f172a" },
            left: { style: BorderStyle.SINGLE, size: 4, color: "0f172a" },
            right: { style: BorderStyle.SINGLE, size: 4, color: "0f172a" },
          },
          shading: { fill: "f1f5f9" },
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 60, after: 60 },
            children: [new TextRun({
              text: hasVal
                ? Number(val).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : "",
              bold: true,
              size: 20,
              rightToLeft: rtl,
              color: "0f172a",
            })],
          })],
        });
      }),
    }));
  }

  // Build date/time footer text
  const now = new Date();
  const dateStr = now.toLocaleDateString("ar-EG-u-nu-latn");
  const timeStr = now.toLocaleTimeString("ar-EG-u-nu-latn");
  const footerText = `تم التصدير: ${dateStr} ${timeStr}`;
  const totalRowsText = `إجمالي الصفوف: ${safeRows.length.toLocaleString("en-US")}`;

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 720, right: 720, bottom: 960, left: 720 },
        },
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 120 },
              border: {
                top: { style: BorderStyle.SINGLE, size: 4, color: "e2e8f0" },
              },
              children: [
                new TextRun({ text: `${footerText} | ${totalRowsText} | `, size: 16, color: "94a3b8", italics: true, rightToLeft: rtl }),
                new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "94a3b8", italics: true }),
                new TextRun({ text: " / ", size: 16, color: "94a3b8", italics: true }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: "94a3b8", italics: true }),
              ],
            }),
          ],
        }),
      },
      children: [
        // Company name header
        ...(companyName ? [
          new Paragraph({
            alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
            spacing: { after: 40 },
            children: [new TextRun({ text: companyName, size: 20, color: "64748b", rightToLeft: rtl })],
          }),
        ] : []),
        // Date range line
        ...(filters?.from && filters?.to ? [
          new Paragraph({
            alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
            spacing: { after: 40 },
            children: [new TextRun({ text: `الفترة: ${filters.from} إلى ${filters.to}`, size: 18, color: "64748b", italics: true, rightToLeft: rtl })],
          }),
        ] : []),
        // Title with accent bar
        new Paragraph({
          alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
          spacing: { after: 200 },
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 12, color: "0f172a" },
          },
          children: [new TextRun({ text: title, bold: true, size: 36, rightToLeft: rtl, color: "0f172a" })],
        }),
        new Paragraph({ text: "", spacing: { after: 120 } }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: tableRows,
        }),
        new Paragraph({ text: "", spacing: { after: 120 } }),
        // Row count summary
        new Paragraph({
          alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
          spacing: { before: 100 },
          border: {
            top: { style: BorderStyle.SINGLE, size: 4, color: "e2e8f0" },
          },
          children: [new TextRun({
            text: `تم التصدير: ${dateStr} - ${timeStr}`,
            size: 18,
            color: "64748b",
            rightToLeft: rtl,
            italics: true,
          })],
        }),
      ],
    }],
  });

  const filePath = path.join(os.tmpdir(), `${title}-${Date.now()}.docx`);
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

/**
 * Enhanced PDF export with premium styling and proper RTL table layout
 */
async function exportRowsToPdfV3({
  rows = [],
  title = "Report",
  columns,
  filters = null,
  orientation = "portrait",
  paperSize = "A4",
  fontSize = "medium",
  showTotals = true,
  showPageNumbers = true,
  totals = {},
}) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const filePath = path.join(os.tmpdir(), `${title}-${Date.now()}.pdf`);
  const sizeMap = { A4: "A4", A5: "A5", Letter: "LETTER" };
  const doc = new PDFDocument({
    margin: 40,
    size: sizeMap[paperSize] || "A4",
    layout: orientation === "landscape" ? "landscape" : "portrait",
    autoFirstPage: true,
  });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  const keys = Array.isArray(columns) && columns.length
    ? columns.map((c) => c.key)
    : Object.keys(safeRows[0] || {});
  const headers = Array.isArray(columns) && columns.length
    ? columns.map((c) => c.label)
    : keys;

  // Helper to draw header on each page
  const drawHeader = () => {
    // Top accent bar
    doc.rect(0, 0, doc.page.width, 8).fill("#0f172a");
    // Title area with background
    doc.rect(40, 20, doc.page.width - 80, 35).fill("#f8fafc");
    doc.roundedRect(40, 20, doc.page.width - 80, 35, 4);
    doc.fill("#f8fafc");
    // Title text - use Arial for Arabic support
    doc.fontSize(16).font(FONT_ARIAL_BOLD).fillColor("#0f172a");
    doc.text(title, 50, 28, { align: "center" });
    // Filter info below title
    if (filters?.from && filters?.to) {
      doc.fontSize(9).font(FONT_ARIAL).fillColor("#64748b");
      doc.text(`الفترة: ${filters.from} إلى ${filters.to}`, 50, 48, { align: "center" });
    }
    doc.y = 70;
  };

  // Draw header on first page
  drawHeader();

  // Table header
  if (headers.length) {
    const pageWidth = doc.page.width - 80;
    const colWidth = Math.min(100, pageWidth / headers.length);

    // Header row background
    doc.rect(40, doc.y, pageWidth, 24).fill("#0f172a");
    doc.fillColor("#ffffff").fontSize(9).font(FONT_ARIAL_BOLD);

    let xPos = doc.page.width - 40;
    headers.forEach((header) => {
      doc.text(header, xPos - colWidth + 4, doc.y + 7, { width: colWidth - 8, align: "right" });
      xPos -= colWidth;
    });

    doc.y += 26;
  }

  // Data rows (limit to fit page)
  const fontSizeScale = fontSize === "small" ? 0.85 : fontSize === "large" ? 1.15 : 1;
  const dataFontSize = Math.round(8 * fontSizeScale);
  const headerFontSize = Math.round(9 * fontSizeScale);
  const titleFontSize = Math.round(16 * fontSizeScale);
  const rowHeight = Math.round(20 * fontSizeScale);
  const headerRowHeight = Math.round(24 * fontSizeScale);

  const hasTotals = showTotals && Object.keys(totals).length > 0;
  const maxRows = Math.min(safeRows.length, 500);
  const pageWidth = doc.page.width - 80;
  const colWidth = Math.min(100, pageWidth / keys.length);
  let pageNum = 1;

  safeRows.slice(0, maxRows).forEach((row, rowIdx) => {
    const rowY = doc.y;

    // Check for page overflow
    if (rowY > doc.page.height - 80) {
      if (showPageNumbers) {
        doc.fontSize(8).font(FONT_ARIAL).fillColor("#94a3b8");
        doc.text(`صفحة ${pageNum}`, 40, doc.page.height - 30, { align: "center" });
      }
      doc.addPage();
      pageNum++;
      drawHeader();
      // Redraw table header
      doc.rect(40, doc.y, pageWidth, headerRowHeight).fill("#0f172a");
      doc.fillColor("#ffffff").fontSize(headerFontSize).font(FONT_ARIAL_BOLD);
      let xPos = doc.page.width - 40;
      headers.forEach((header) => {
        doc.text(header, xPos - colWidth + 4, doc.y + 7, { width: colWidth - 8, align: "center" });
        xPos -= colWidth;
      });
      doc.y += headerRowHeight + 2;
    }

    const currentY = doc.y;

    // Alternating row background
    if (rowIdx % 2 === 0) {
      doc.rect(40, currentY, pageWidth, rowHeight).fill("#f8fafc");
    }

    // Row border
    doc.rect(40, currentY, pageWidth, rowHeight).stroke("#e2e8f0");

    doc.fillColor("#0f172a").fontSize(dataFontSize).font(FONT_ARIAL);
    let xPos = doc.page.width - 40;
    keys.forEach((k) => {
      const value = row?.[k] == null ? "" : String(row[k]);
      doc.text(value, xPos - colWidth + 3, currentY + 6, { width: colWidth - 6, align: "center", ellipsis: true });
      xPos -= colWidth;
    });

    doc.y = currentY + rowHeight;
  });

  // Totals row
  if (hasTotals) {
    const totalY = doc.y;
    if (totalY + rowHeight > doc.page.height - 60) {
      doc.addPage();
      pageNum++;
    }
    doc.fillColor("#f1f5f9").rect(40, doc.y, pageWidth, rowHeight).fill();
    doc.fillColor("#0f172a").fontSize(dataFontSize).font(FONT_ARIAL_BOLD);
    let xPos = doc.page.width - 40;
    keys.forEach((k) => {
      const val = totals[k];
      const display = val != null && !isNaN(Number(val))
        ? Number(val).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : "";
      doc.text(display, xPos - colWidth + 3, doc.y + 6, { width: colWidth - 6, align: "center", ellipsis: true });
      xPos -= colWidth;
    });
    doc.y += rowHeight;
  }

  // Footer
  doc.y = Math.max(doc.y + 10, doc.page.height - 60);
  doc.fontSize(8).font(FONT_ARIAL).fillColor("#94a3b8");
  doc.text(`تم التصدير: ${new Date().toLocaleDateString("ar-EG-u-nu-latn")} - ${new Date().toLocaleTimeString("ar-EG-u-nu-latn")}`, 40, doc.y, { align: "center" });

  if (safeRows.length > maxRows) {
    doc.moveDown(0.3);
    doc.text(`تم عرض ${maxRows} من أصل ${safeRows.length} صف. للتصدير الكامل استخدم Excel.`, { align: "center" });
  }

  if (showPageNumbers) {
    doc.text(`صفحة ${pageNum}`, 40, doc.page.height - 30, { align: "center" });
  }

  doc.end();
  await new Promise((resolve) => stream.on("finish", resolve));
  return filePath;
}

module.exports = {
  exportRowsToExcel,
  exportRowsToPdf,
  exportRowsToExcelV2,
  exportRowsToPdfV2,
  exportRowsToDocx,
  exportRowsToPdfV3,
};
