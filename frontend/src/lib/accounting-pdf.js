import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { buildBalance, balanceColumns } from "./accounting-balance.js";

const amount = (value) => new Intl.NumberFormat("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
const primary = [155, 68, 68];
const muted = [107, 101, 101];

export function createAccountingTablePdf({ title, periodLabel, detail, columns, rows }) {
  const doc = new jsPDF({ orientation: columns.length > 5 ? "landscape" : "portrait", format: "a4" });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 14;
  const description = doc.splitTextToSize(detail, width - margin * 2);
  doc.setProperties({ title, subject: periodLabel, author: "Librería ERP" });
  autoTable(doc, {
    margin: { top: 46 + description.length * 4, bottom: 16, left: margin, right: margin },
    head: [columns.map(({ label }) => label)],
    body: rows.map(({ cells }) => cells.map((value) => typeof value === "number" ? amount(value) : value)),
    styles: { font: "helvetica", fontSize: 8, cellPadding: 2.5, overflow: "linebreak" },
    headStyles: { fillColor: primary, textColor: 255 },
    alternateRowStyles: { fillColor: [250, 247, 247] },
    columnStyles: Object.fromEntries(columns.map((column, index) => [index, { halign: column.numeric ? "right" : "left" }])),
    rowPageBreak: "avoid",
    didParseCell({ section, row, cell }) {
      if (section === "body" && rows[row.index]?.strong) cell.styles.fontStyle = "bold";
    },
    willDrawPage() {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...primary);
      doc.text("LIBRERÍA ERP / CONTABILIDAD", margin, 14);
      doc.setFontSize(19);
      doc.setTextColor(44, 44, 44);
      doc.text(title, margin, 27);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...muted);
      doc.text(periodLabel + " | Pesos chilenos (CLP)", margin, 35);
      doc.text(description, margin, 41);
    },
  });
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text("Página " + page + " de " + pages, width - margin, height - 8, { align: "right" });
  }
  return doc;
}

export function createAccountingPdf({ entries, accounts, period, periodLabel, source = "Todos", search = "", generatedAt = new Date() }) {
  if (!entries.length) throw new Error("No hay asientos para exportar.");
  const balance = buildBalance(entries, accounts);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setCreationDate(generatedAt);
  doc.setProperties({ title: "Balance de Comprobación de 8 Columnas", subject: `Contabilidad - ${period}`, author: "Librería ERP" });
  const width = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentWidth = width - margin * 2;
  const tableStyle = {
    margin: { top: 24, left: margin, right: margin, bottom: 18 },
    styles: { font: "helvetica", fontSize: 8, cellPadding: 3, textColor: [44, 44, 44], lineColor: [226, 218, 218], lineWidth: 0.1 },
    headStyles: { fillColor: primary, textColor: 255, fontStyle: "bold", halign: "center" },
    alternateRowStyles: { fillColor: [250, 247, 247] },
    footStyles: { fillColor: [240, 233, 233], textColor: [44, 44, 44], fontStyle: "bold" },
    showHead: "everyPage", showFoot: "lastPage", rowPageBreak: "avoid",
  };
  doc.setFontSize(10); doc.setTextColor(...primary); doc.setFont("helvetica", "bold");
  doc.text("LIBRERÍA ERP  /  CONTABILIDAD", margin, 16);
  doc.setFontSize(20); doc.setTextColor(44, 44, 44);
  doc.text("Balance de Comprobación de 8 Columnas", margin, 28);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...muted);
  doc.text(`Período: ${periodLabel || period}  |  Moneda: pesos chilenos (CLP)`, margin, 37);
  const scope = `Origen: ${source}${search ? ` | Búsqueda: ${search}` : ""} | ${entries.length} asientos seleccionados`;
  const scopeLines = doc.splitTextToSize(scope, contentWidth);
  doc.text(scopeLines, margin, 44);
  let y = 44 + scopeLines.length * 5 + 4;
  const cards = [ ["DÉBITOS", balance.sums.debit], ["CRÉDITOS", balance.sums.credit],
    ["DIFERENCIA", balance.difference], [balance.result >= 0 ? "UTILIDAD" : "PÉRDIDA", Math.abs(balance.result)] ];
  const cardWidth = (contentWidth - 18) / 4;
  cards.forEach(([label, value], index) => {
    const x = margin + index * (cardWidth + 6);
    doc.setFillColor(250, 247, 247); doc.setDrawColor(226, 218, 218);
    doc.roundedRect(x, y, cardWidth, 23, 2, 2, "FD");
    doc.setFontSize(8); doc.setTextColor(...muted); doc.text(label, x + 4, y + 7);
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(...primary);
    doc.text(amount(value), x + 4, y + 16); doc.setFont("helvetica", "normal");
  });
  y += 31;
  doc.setFontSize(9); doc.setTextColor(...muted);
  const note = "Movimientos de los asientos seleccionados del período; no incluye saldos anteriores. Las cuentas se clasifican según el plan contable y el signo del saldo.";
  const noteLines = doc.splitTextToSize(note, contentWidth);
  doc.text(noteLines, margin, y); y += noteLines.length * 4 + 6;
  const numericStyles = Object.fromEntries(balanceColumns.map((key, index) => [index + 2, { halign: "right", cellWidth: (contentWidth - 73) / 8 }]));
  const totalsRow = (label, values) => [{ content: label, colSpan: 2 }, ...balanceColumns.map((key) => amount(values[key]))];
  autoTable(doc, { ...tableStyle, startY: y,
    head: [[{ content: "Código", rowSpan: 2 }, { content: "Cuenta", rowSpan: 2 },
      { content: "Movimientos", colSpan: 2 }, { content: "Saldos", colSpan: 2 },
      { content: "Inventario", colSpan: 2 }, { content: "Resultado", colSpan: 2 }],
      ["Débitos", "Créditos", "Deudor", "Acreedor", "Activo", "Pasivo", "Pérdidas", "Ganancias"]],
    body: balance.rows.map((row) => [row.code, row.name, ...balanceColumns.map((key) => amount(row[key]))]),
    foot: [totalsRow("Sumas", balance.sums), totalsRow(balance.result >= 0 ? "Resultado: utilidad" : "Resultado: pérdida", balance.closing), totalsRow("Totales finales", balance.grandTotals)],
    columnStyles: { 0: { cellWidth: 18 }, 1: { cellWidth: 55 }, ...numericStyles },
  });
  // El detalle conserva todas las columnas del antiguo CSV.
  doc.addPage();
  doc.setFont("helvetica", "bold"); doc.setTextColor(44, 44, 44); doc.setFontSize(16);
  doc.text("Detalle de asientos exportados", margin, 28);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...muted);
  doc.text(`Período: ${periodLabel || period} | Origen: ${source}`, margin, 36);
  autoTable(doc, { ...tableStyle, startY: 43,
    head: [["Fecha", "Asiento", "Origen", "Documento", "Cuenta", "Glosa", "Debe", "Haber"]],
    body: entries.flatMap((entry) => entry.lines.map((line) => [entry.date.split("-").reverse().join("/"), entry.code, entry.source, entry.document,
      line.account, entry.description, amount(line.debit), amount(line.credit)])),
    columnStyles: { 0: { cellWidth: 23 }, 1: { cellWidth: 26 }, 2: { cellWidth: 22 }, 3: { cellWidth: 30 },
      4: { cellWidth: 22 }, 5: { cellWidth: contentWidth - 177 }, 6: { cellWidth: 27, halign: "right" }, 7: { cellWidth: 27, halign: "right" } },
  });
  const stamp = new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago", dateStyle: "short", timeStyle: "short" }).format(generatedAt);
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    if (page !== 1) {
      doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(...primary);
      doc.text("LIBRERÍA ERP / BALANCE DE COMPROBACIÓN", margin, 14);
    }
    doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(...muted);
    const status = balance.difference === 0 ? "Débitos y créditos cuadrados" : `Revisar diferencia: ${amount(balance.difference)}`;
    doc.text(`Emitido: ${stamp} | ${status}`, margin, 200);
    doc.text(`Página ${page} de ${pageCount}`, width - margin, 200, { align: "right" });
  }
  return doc;
}
