const os = require("os");
const path = require("path");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const { Document, Packer, Paragraph, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, TextRun, HeadingLevel, Footer, PageNumber } = require("docx");

// Windows system font paths for Arabic support in PDF
const FONT_ARIAL = "C:\\Windows\\Fonts\\arial.ttf";
const FONT_ARIAL_BOLD = "C:\\Windows\\Fonts\\arialbd.ttf";

async function exportRowsToExcel(rows = [], worksheetName = "تقرير") {
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

async function exportRowsToPdf(rows = [], title = "تقرير") {
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
  worksheetName = "تقرير",
  columns,
  rtl = true,
  res = null,
}) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ElHegazi Retailer"; // metadata field — not visible in sheet
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

  if (res) {
    await workbook.xlsx.write(res);
    return null;
  }

  const filePath = path.join(os.tmpdir(), `${worksheetName}-${Date.now()}.xlsx`);
  await workbook.xlsx.writeFile(filePath);
  return filePath;
}

async function exportRowsToPdfV2({
  rows = [],
  title = "تقرير",
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
  title = "تقرير",
  columns,
  rtl = true,
  filters = null,
  totals = {},
  companyName = "",
  res = null,
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
          ? Number(value).toLocaleString("ar-EG-u-nu-latn", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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
                ? Number(val).toLocaleString("ar-EG-u-nu-latn", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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
  const totalRowsText = `إجمالي الصفوف: ${safeRows.length.toLocaleString("ar-EG-u-nu-latn")}`;

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
        // Filter info lines
        ...(filters ? [
          new Paragraph({
            alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
            spacing: { after: 40 },
            children: [new TextRun({
              text: [filters.from && filters.to ? `الفترة: ${filters.from} إلى ${filters.to}` : ""].filter(Boolean).join(""),
              size: 18, color: "64748b", italics: true, rightToLeft: rtl,
            })],
          }),
          ...(() => {
            const filterLabels = { status: "الحالة", payment_type: "نوع الدفع", movement_type: "نوع الحركة", customer_id: "العميل", supplier_id: "المورد", category_id: "التصنيف", item_id: "الصنف", cashier_id: "الكاشير", warehouse_id: "المخزن", user_id: "المستخدم", action: "الإجراء", resource: "الموارد", method_id: "طريقة الدفع", direction: "الاتجاه", doc_type: "نوع المستند", party_type: "نوع الطرف", amount_min: "الحد الأدنى", amount_max: "الحد الأقصى", tax_type: "نوع الضريبة", treasury_id: "الخزينة", bank_id: "البنك" };
            const parts = [];
            for (const [k, v] of Object.entries(filters)) {
              if (k === "from" || k === "to") continue;
              const label = filterLabels[k] || k;
              parts.push(`${label}: ${v}`);
            }
            return parts.length ? [new Paragraph({
              alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
              spacing: { after: 40 },
              children: [new TextRun({ text: parts.join("  |  "), size: 18, color: "64748b", italics: true, rightToLeft: rtl })],
            })] : [];
          })(),
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

  const buffer = await Packer.toBuffer(doc);
  if (res) {
    res.end(buffer);
    return null;
  }
  const filePath = path.join(os.tmpdir(), `${title}-${Date.now()}.docx`);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

/**
 * Enhanced PDF export with premium styling and proper RTL table layout
 */
async function exportRowsToPdfV3({
  rows = [],
  title = "تقرير",
  columns,
  filters = null,
  orientation = "portrait",
  paperSize = "A4",
  fontSize = "medium",
  showTotals = true,
  showPageNumbers = true,
  totals = {},
  res = null,
}) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const sizeMap = { A4: "A4", A5: "A5", Letter: "LETTER" };
  const doc = new PDFDocument({
    margin: 40,
    size: sizeMap[paperSize] || "A4",
    layout: orientation === "landscape" ? "landscape" : "portrait",
    autoFirstPage: true,
  });
  const pdfStream = res || fs.createWriteStream(path.join(os.tmpdir(), `${title}-${Date.now()}.pdf`));
  doc.pipe(pdfStream);

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
    doc.roundedRect(40, 20, doc.page.width - 80, 35, 4).fill("#f8fafc");
    // Title text - use Arial for Arabic support
    doc.fontSize(16).font(FONT_ARIAL_BOLD).fillColor("#0f172a");
    doc.text(title, 50, 28, { align: "center" });
    // Filter info below title
    const filterParts = [];
    if (filters?.from && filters?.to) {
      filterParts.push(`الفترة: ${filters.from} إلى ${filters.to}`);
    }
    const filterLabels = {
      status: "الحالة", payment_type: "نوع الدفع", movement_type: "نوع الحركة",
      customer_id: "العميل", supplier_id: "المورد", category_id: "التصنيف",
      item_id: "الصنف", cashier_id: "الكاشير", warehouse_id: "المخزن",
      user_id: "المستخدم", action: "الإجراء", resource: "الموارد",
      method_id: "طريقة الدفع", direction: "الاتجاه", doc_type: "نوع المستند",
      party_type: "نوع الطرف", amount_min: "الحد الأدنى", amount_max: "الحد الأقصى",
      tax_type: "نوع الضريبة", treasury_id: "الخزينة", bank_id: "البنك",
    };
    for (const [k, v] of Object.entries(filters || {})) {
      if (k === "from" || k === "to") continue;
      const label = filterLabels[k] || k;
      filterParts.push(`${label}: ${v}`);
    }
    if (filterParts.length) {
      doc.fontSize(9).font(FONT_ARIAL).fillColor("#64748b");
      doc.text(filterParts.join("  |  "), 50, 48, { align: "center" });
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
        ? Number(val).toLocaleString("ar-EG-u-nu-latn", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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
  if (res) {
    await new Promise((resolve) => res.on("finish", resolve));
    return null;
  }
  await new Promise((resolve) => pdfStream.on("finish", resolve));
  return pdfStream.path;
}

async function exportRowsToCsv({ rows = [], title = "تقرير", columns = [], res = null }) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const keys = Array.isArray(columns) && columns.length
    ? columns.map((c) => c.key)
    : Object.keys(safeRows[0] || {});
  const headers = Array.isArray(columns) && columns.length
    ? columns.map((c) => c.label)
    : keys;

  if (res) {
    res.write("\uFEFF");
    res.write(headers.map(h => `"${h.replace(/"/g, '""')}"`).join(",") + "\r\n");
    for (const row of safeRows) {
      const vals = keys.map(k => {
        const v = row[k];
        if (v == null) return "";
        const s = String(v);
        return `"${s.replace(/"/g, '""')}"`;
      });
      res.write(vals.join(",") + "\r\n");
    }
    res.end();
    return null;
  }

  const lines = [];
  // BOM for Arabic/UTF-8 support in Excel
  lines.push("\uFEFF" + headers.map(h => `"${h.replace(/"/g, '""')}"`).join(","));
  for (const row of safeRows) {
    const vals = keys.map(k => {
      const v = row[k];
      if (v == null) return "";
      const s = String(v);
      return `"${s.replace(/"/g, '""')}"`;
    });
    lines.push(vals.join(","));
  }

  const filePath = path.join(os.tmpdir(), `${title}-${Date.now()}.csv`);
  fs.writeFileSync(filePath, lines.join("\r\n"), "utf8");
  return filePath;
}

/**
 * Premium account-statement DOCX export matching the print preview layout.
 * Uses the same Arabic column headers and visual structure as AccountStatementBlocks.
 */
async function exportAccountStatementDocx({
  rows = [],
  title = "كشف حساب",
  summary = {},
  partyName = "",
  partyCode = "",
  period = {},
  accent = "#1e40af",
  companyName = "",
  res = null,
}) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const cols = [
    { key: "index", label: "م", width: 6 },
    { key: "date", label: "التاريخ", width: 14 },
    { key: "debit", label: "مدين", width: 14 },
    { key: "credit", label: "دائن", width: 14 },
    { key: "running_balance", label: "الرصيد", width: 14 },
    { key: "description", label: "الوصف", width: 38 },
  ];
  const accentHex = accent.replace("#", "");
  const totalDebit = Number(summary.total_debit || 0);
  const totalCredit = Number(summary.total_credit || 0);
  const closing = Number(summary.closing_balance || 0);

  const tableRows = [];

  // Header row
  tableRows.push(new TableRow({
    tableHeader: true,
    children: cols.map((c) => new TableCell({
      borders: {
        top: { style: BorderStyle.SINGLE, size: 8, color: accentHex },
        bottom: { style: BorderStyle.SINGLE, size: 8, color: accentHex },
        left: { style: BorderStyle.SINGLE, size: 4, color: accentHex },
        right: { style: BorderStyle.SINGLE, size: 4, color: accentHex },
      },
      shading: { fill: accentHex },
      width: { size: c.width, type: WidthType.PERCENTAGE },
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 60, after: 60 },
        children: [new TextRun({ text: c.label, bold: true, color: "FFFFFF", size: 20, rightToLeft: true })],
      })],
    })),
  }));

  // Opening balance row
  const opening = Number(summary.opening_balance || 0);
  tableRows.push(new TableRow({
    children: cols.map((c) => {
      let val = "";
      let isBold = true;
      if (c.key === "description") val = "رصيد سابق";
      else if (c.key === "debit" || c.key === "credit" || c.key === "running_balance") {
        val = Number(opening).toLocaleString("ar-EG-u-nu-latn", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      } else if (c.key === "index" || c.key === "date") val = "—";
      return new TableCell({
        borders: {
          top: { style: BorderStyle.SINGLE, size: 4, color: "e2e8f0" },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: "e2e8f0" },
          left: { style: BorderStyle.SINGLE, size: 4, color: "e2e8f0" },
          right: { style: BorderStyle.SINGLE, size: 4, color: "e2e8f0" },
        },
        shading: { fill: "fffbeb" },
        width: { size: c.width, type: WidthType.PERCENTAGE },
        children: [new Paragraph({
          alignment: c.key === "description" ? AlignmentType.RIGHT : AlignmentType.CENTER,
          spacing: { before: 40, after: 40 },
          children: [new TextRun({ text: val, bold: isBold, size: 18, rightToLeft: true, color: "78350f" })],
        })],
      });
    }),
  }));

  // Data rows
  safeRows.forEach((row, rowIdx) => {
    const isEven = rowIdx % 2 === 0;
    const amt = Number(row.debit || 0) - Number(row.credit || 0);
    const isNeg = amt < -0.005;
    tableRows.push(new TableRow({
      children: cols.map((c) => {
        let val = "";
        let color = "0f172a";
        let isBold = false;
        if (c.key === "index") val = String(rowIdx + 1);
        else if (c.key === "date") val = row.date || "";
        else if (c.key === "debit") val = row.debit > 0.005 ? Number(row.debit).toLocaleString("ar-EG-u-nu-latn", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";
        else if (c.key === "credit") val = row.credit > 0.005 ? Number(row.credit).toLocaleString("ar-EG-u-nu-latn", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";
        else if (c.key === "running_balance") { val = Number(row.running_balance || 0).toLocaleString("ar-EG-u-nu-latn", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); isBold = true; color = isNeg ? "dc2626" : "0f172a"; }
        else if (c.key === "description") val = row.description || "";
        return new TableCell({
          borders: {
            top: { style: BorderStyle.SINGLE, size: 2, color: "e2e8f0" },
            bottom: { style: BorderStyle.SINGLE, size: 2, color: "e2e8f0" },
            left: { style: BorderStyle.SINGLE, size: 2, color: "e2e8f0" },
            right: { style: BorderStyle.SINGLE, size: 2, color: "e2e8f0" },
          },
          shading: isEven ? { fill: "f8fafc" } : undefined,
          width: { size: c.width, type: WidthType.PERCENTAGE },
          children: [new Paragraph({
            alignment: c.key === "description" ? AlignmentType.RIGHT : AlignmentType.CENTER,
            spacing: { before: 30, after: 30 },
            children: [new TextRun({ text: val, bold: isBold, size: 18, rightToLeft: true, color })],
          })],
        });
      }),
    }));
  });

  // Summary footer rows
  const summaryBg = accentHex;
  // Total row
  tableRows.push(new TableRow({
    children: cols.map((c) => {
      let val = "";
      let colSpan = 0;
      if (c.key === "index") { colSpan = 1; val = ""; }
      else if (c.key === "description") { val = "الإجمالي"; }
      else if (c.key === "debit") val = totalDebit.toLocaleString("ar-EG-u-nu-latn", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      else if (c.key === "credit") val = totalCredit.toLocaleString("ar-EG-u-nu-latn", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      else if (c.key === "running_balance") val = closing.toLocaleString("ar-EG-u-nu-latn", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      else if (c.key === "date") val = "";
      return new TableCell({
        borders: {
          top: { style: BorderStyle.SINGLE, size: 8, color: summaryBg },
          bottom: { style: BorderStyle.SINGLE, size: 8, color: summaryBg },
          left: { style: BorderStyle.SINGLE, size: 4, color: summaryBg },
          right: { style: BorderStyle.SINGLE, size: 4, color: summaryBg },
        },
        shading: { fill: summaryBg },
        width: { size: c.width, type: WidthType.PERCENTAGE },
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 60, after: 60 },
          children: [new TextRun({ text: val, bold: true, size: 20, rightToLeft: true, color: "FFFFFF" })],
        })],
      });
    }),
  }));

  // Closing balance row
  tableRows.push(new TableRow({
    children: cols.map((c) => {
      let val = "";
      if (c.key === "description") val = "الرصيد الختامي";
      else if (c.key === "running_balance") val = closing.toLocaleString("ar-EG-u-nu-latn", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      else if (c.key === "index" || c.key === "date" || c.key === "debit" || c.key === "credit") val = "";
      return new TableCell({
        borders: {
          top: { style: BorderStyle.SINGLE, size: 8, color: summaryBg },
          bottom: { style: BorderStyle.SINGLE, size: 8, color: summaryBg },
          left: { style: BorderStyle.SINGLE, size: 4, color: summaryBg },
          right: { style: BorderStyle.SINGLE, size: 4, color: summaryBg },
        },
        shading: { fill: summaryBg },
        width: { size: c.width, type: WidthType.PERCENTAGE },
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 40, after: 40 },
          children: [new TextRun({ text: val, bold: true, size: 18, rightToLeft: true, color: closing < -0.005 ? "fca5a5" : "FFFFFF" })],
        })],
      });
    }),
  }));

  const now = new Date();
  const dateStr = now.toLocaleDateString("ar-EG-u-nu-latn");
  const timeStr = now.toLocaleTimeString("ar-EG-u-nu-latn");

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
              border: { top: { style: BorderStyle.SINGLE, size: 4, color: "e2e8f0" } },
              children: [
                new TextRun({ text: `تم التصدير: ${dateStr} ${timeStr} | صفحة `, size: 16, color: "94a3b8", italics: true, rightToLeft: true }),
                new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "94a3b8", italics: true }),
                new TextRun({ text: " / ", size: 16, color: "94a3b8", italics: true }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: "94a3b8", italics: true }),
              ],
            }),
          ],
        }),
      },
      children: [
        // Company name
        ...(companyName ? [new Paragraph({
          alignment: AlignmentType.RIGHT, spacing: { after: 40 },
          children: [new TextRun({ text: companyName, size: 20, color: "64748b", rightToLeft: true })],
        })] : []),
        // Party info
        ...(partyName ? [new Paragraph({
          alignment: AlignmentType.RIGHT, spacing: { after: 20 },
          children: [
            new TextRun({ text: `${title} — `, size: 22, color: accentHex, bold: true, rightToLeft: true }),
            new TextRun({ text: partyName, size: 22, color: "0f172a", bold: true, rightToLeft: true }),
            ...(partyCode ? [new TextRun({ text: ` (${partyCode})`, size: 18, color: "64748b", rightToLeft: true })] : []),
          ],
        })] : []),
        // Period
        ...(period?.from || period?.to ? [new Paragraph({
          alignment: AlignmentType.RIGHT, spacing: { after: 60 },
          children: [new TextRun({ text: `الفترة: ${period.from || "البداية"} إلى ${period.to || "الآن"}`, size: 18, color: "64748b", italics: true, rightToLeft: true })],
        })] : []),
        // Title with accent bar
        new Paragraph({
          alignment: AlignmentType.RIGHT, spacing: { after: 200 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: accentHex } },
          children: [new TextRun({ text: title, bold: true, size: 32, rightToLeft: true, color: accentHex })],
        }),
        new Paragraph({ text: "", spacing: { after: 80 } }),
        // Statement table
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: tableRows,
        }),
        new Paragraph({ text: "", spacing: { after: 120 } }),
        // Footer summary
        new Paragraph({
          alignment: AlignmentType.RIGHT, spacing: { before: 100 },
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: "e2e8f0" } },
          children: [new TextRun({ text: `إجمالي الصفوف: ${safeRows.length} | إجمالي المدين: ${totalDebit.toLocaleString("ar-EG-u-nu-latn", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | إجمالي الدائن: ${totalCredit.toLocaleString("ar-EG-u-nu-latn", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, size: 18, color: "64748b", rightToLeft: true, italics: true })],
        }),
      ],
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  if (res) { res.end(buffer); return null; }
  const filePath = path.join(os.tmpdir(), `${title}-${Date.now()}.docx`);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

/**
 * Premium account-statement PDF export matching the print preview layout.
 */
async function exportAccountStatementPdf({
  rows = [],
  title = "كشف حساب",
  summary = {},
  partyName = "",
  partyCode = "",
  period = {},
  accent = "#1e40af",
  res = null,
}) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const doc = new PDFDocument({ margin: 40, size: "A4", autoFirstPage: true });
  const pdfStream = res || fs.createWriteStream(path.join(os.tmpdir(), `${title}-${Date.now()}.pdf`));
  doc.pipe(pdfStream);

  const cols = [
    { key: "index", label: "م", width: 6 },
    { key: "date", label: "التاريخ", width: 14 },
    { key: "debit", label: "مدين", width: 14 },
    { key: "credit", label: "دائن", width: 14 },
    { key: "running_balance", label: "الرصيد", width: 14 },
    { key: "description", label: "الوصف", width: 38 },
  ];
  const accentHex = accent.replace("#", "");
  const totalDebit = Number(summary.total_debit || 0);
  const totalCredit = Number(summary.total_credit || 0);
  const closing = Number(summary.closing_balance || 0);
  const opening = Number(summary.opening_balance || 0);
  const pageWidth = doc.page.width - 80;

  // Header
  doc.rect(0, 0, doc.page.width, 8).fill(accent);
  doc.roundedRect(40, 20, pageWidth, 30, 4).fill("#f8fafc");
  doc.fontSize(14).font(FONT_ARIAL_BOLD).fillColor(accent);
  doc.text(`${title} — ${partyName || ""}${partyCode ? ` (${partyCode})` : ""}`, 50, 26, { align: "right", width: pageWidth - 20 });
  if (period?.from || period?.to) {
    doc.fontSize(8).font(FONT_ARIAL).fillColor("#64748b");
    doc.text(`الفترة: ${period.from || "البداية"} إلى ${period.to || "الآن"}`, 50, 46, { align: "right", width: pageWidth - 20 });
  }
  doc.y = 60;

  // Table header
  const colW = cols.map((c) => (c.width / 100) * pageWidth);
  doc.rect(40, doc.y, pageWidth, 20).fill(accent);
  doc.fillColor("#ffffff").fontSize(8).font(FONT_ARIAL_BOLD);
  let xPos = doc.page.width - 40;
  cols.forEach((c, i) => {
    doc.text(c.label, xPos - colW[i] + 2, doc.y + 5, { width: colW[i] - 4, align: "center" });
    xPos -= colW[i];
  });
  doc.y += 22;

  // Opening balance row
  doc.rect(40, doc.y, pageWidth, 16).fill("#fffbeb");
  doc.fillColor("#78350f").fontSize(7).font(FONT_ARIAL_BOLD);
  xPos = doc.page.width - 40;
  cols.forEach((c, i) => {
    let val = "—";
    if (c.key === "description") val = "رصيد سابق";
    else if (c.key === "running_balance" || c.key === "debit" || c.key === "credit") val = opening.toLocaleString("ar-EG-u-nu-latn", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    doc.text(val, xPos - colW[i] + 2, doc.y + 3, { width: colW[i] - 4, align: c.key === "description" ? "right" : "center" });
    xPos -= colW[i];
  });
  doc.y += 18;

  // Data rows
  doc.font(FONT_ARIAL);
  safeRows.forEach((row, rowIdx) => {
    if (doc.y > doc.page.height - 80) {
      doc.addPage();
      // Redraw header
      doc.rect(0, 0, doc.page.width, 8).fill(accent);
      doc.rect(40, 20, pageWidth, 20).fill(accent);
      doc.fillColor("#ffffff").fontSize(8).font(FONT_ARIAL_BOLD);
      xPos = doc.page.width - 40;
      cols.forEach((c, i) => {
        doc.text(c.label, xPos - colW[i] + 2, 25, { width: colW[i] - 4, align: "center" });
        xPos -= colW[i];
      });
      doc.y = 42;
      doc.font(FONT_ARIAL);
    }

    if (rowIdx % 2 === 0) doc.rect(40, doc.y, pageWidth, 14).fill("#f8fafc");
    doc.rect(40, doc.y, pageWidth, 14).stroke("#e2e8f0");
    doc.fillColor("#0f172a").fontSize(7);
    xPos = doc.page.width - 40;
    cols.forEach((c, i) => {
      let val = "";
      let color = "#0f172a";
      if (c.key === "index") val = String(rowIdx + 1);
      else if (c.key === "date") val = row.date || "";
      else if (c.key === "debit") val = row.debit > 0.005 ? Number(row.debit).toLocaleString("ar-EG-u-nu-latn", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";
      else if (c.key === "credit") val = row.credit > 0.005 ? Number(row.credit).toLocaleString("ar-EG-u-nu-latn", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";
      else if (c.key === "running_balance") { val = Number(row.running_balance || 0).toLocaleString("ar-EG-u-nu-latn", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); const amt = Number(row.debit || 0) - Number(row.credit || 0); if (amt < -0.005) color = "#dc2626"; }
      else if (c.key === "description") val = row.description || "";
      doc.fillColor(color).text(val, xPos - colW[i] + 2, doc.y + 3, { width: colW[i] - 4, align: c.key === "description" ? "right" : "center" });
      xPos -= colW[i];
    });
    doc.y += 16;
  });

  // Summary footer
  doc.rect(40, doc.y, pageWidth, 16).fill(accent);
  doc.fillColor("#ffffff").fontSize(7).font(FONT_ARIAL_BOLD);
  xPos = doc.page.width - 40;
  cols.forEach((c, i) => {
    let val = "";
    if (c.key === "description") val = "الإجمالي";
    else if (c.key === "debit") val = totalDebit.toLocaleString("ar-EG-u-nu-latn", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    else if (c.key === "credit") val = totalCredit.toLocaleString("ar-EG-u-nu-latn", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    else if (c.key === "running_balance") val = closing.toLocaleString("ar-EG-u-nu-latn", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    doc.text(val, xPos - colW[i] + 2, doc.y + 3, { width: colW[i] - 4, align: "center" });
    xPos -= colW[i];
  });
  doc.y += 18;

  // Closing balance row
  doc.rect(40, doc.y, pageWidth, 16).fill(accent);
  doc.fillColor(closing < -0.005 ? "#fca5a5" : "#ffffff").fontSize(7);
  xPos = doc.page.width - 40;
  cols.forEach((c, i) => {
    let val = "";
    if (c.key === "description") val = "الرصيد الختامي";
    else if (c.key === "running_balance") val = closing.toLocaleString("ar-EG-u-nu-latn", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    doc.text(val, xPos - colW[i] + 2, doc.y + 3, { width: colW[i] - 4, align: "center" });
    xPos -= colW[i];
  });
  doc.y += 20;

  // Footer
  doc.fontSize(7).font(FONT_ARIAL).fillColor("#94a3b8");
  doc.text(`تم التصدير: ${new Date().toLocaleDateString("ar-EG-u-nu-latn")} - ${new Date().toLocaleTimeString("ar-EG-u-nu-latn")} | صفوف: ${safeRows.length}`, 40, doc.y, { align: "center" });

  doc.end();
  if (res) { await new Promise((r) => res.on("finish", r)); return null; }
  await new Promise((r) => pdfStream.on("finish", r));
  return pdfStream.path;
}

module.exports = {
  exportRowsToExcel,
  exportRowsToPdf,
  exportRowsToExcelV2,
  exportRowsToPdfV2,
  exportRowsToDocx,
  exportRowsToPdfV3,
  exportRowsToCsv,
  exportAccountStatementDocx,
  exportAccountStatementPdf,
};
