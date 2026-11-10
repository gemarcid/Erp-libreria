import { useState } from "react";
import { buildBalance, balanceColumns } from "@/lib/accounting-balance";
import {
  accountingMoney, buildIncomeStatement, buildLedger, journalRows,
} from "@/lib/accounting-reports";
import { createCsv } from "@/lib/csv";
import { dateLabel } from "@/lib/module-demo";

const sources = ["Todos", "Compras", "Ventas", "Manual"];
const titles = {
  balance: "Balance de comprobación de 8 columnas",
  results: "Estado de resultados",
  centralized: "Libro mayor centralizado",
  origin: "Origen de asientos por módulo",
  ledger: "Libro mayor",
};

const textColumn = (label) => ({ label });
const numberColumn = (label) => ({ label, numeric: true });
const row = (cells, strong = false) => ({ cells, strong });

function ledgerReport(entries, accounts, period, account) {
  const groups = buildLedger(entries, accounts, period, account);
  return {
    detail: "Saldo positivo deudor y negativo acreedor. El saldo inicial se calcula con los asientos anteriores disponibles.",
    columns: ["Cuenta", "Fecha", "Asiento", "Detalle"].map(textColumn).concat(["Debe", "Haber", "Saldo"].map(numberColumn)),
    rows: groups.flatMap((group) => {
      const label = group.code + " · " + group.name;
      return [
        row([label, "", "", "Saldo inicial", "", "", group.opening], true),
        ...group.rows.map((item) => row([
          label, dateLabel(item.date), item.code, item.description, item.line.debit, item.line.credit, item.balance,
        ])),
        row([label, "", "", "Saldo final", "", "", group.balance], true),
      ];
    }),
    hasData: groups.some((group) => group.rows.length > 0),
  };
}

function reportData(kind, entries, allEntries, accounts, period, account, source) {
  if (kind === "centralized" || kind === "ledger") {
    return ledgerReport(kind === "ledger" && !account ? [] : allEntries, accounts, period, account);
  }
  if (kind === "origin") {
    const rows = journalRows(entries.filter((entry) => source === "Todos" || entry.source === source), accounts);
    return {
      detail: "Origen seleccionado · " + source,
      columns: ["Fecha", "Asiento", "Origen", "Documento", "Glosa", "Cuenta"].map(textColumn).concat(["Debe", "Haber"].map(numberColumn)),
      rows: rows.map(([date, ...cells]) => row([dateLabel(date), ...cells])),
      hasData: rows.length > 0,
    };
  }
  if (kind === "results") {
    const statement = buildIncomeStatement(entries, accounts);
    return {
      detail: "Ingresos, costo de ventas y gastos según los asientos registrados en el período.",
      columns: ["Código", "Cuenta / concepto"].map(textColumn).concat(numberColumn("Importe")),
      rows: [
        ...statement.groups.flatMap((group) => [
          row(["", group.label, group.total], true),
          ...group.accounts.map((item) => row([item.code, item.name, item.amount])),
        ]),
        row(["", statement.result >= 0 ? "Utilidad del período" : "Pérdida del período", statement.result], true),
      ],
      hasData: statement.groups.some((group) => group.accounts.length > 0),
    };
  }
  const balance = buildBalance(entries, accounts);
  const total = (label, amounts) => row(["", label, ...balanceColumns.map((key) => amounts[key])], true);
  return {
    detail: "Movimientos de todo el período, sin arrastre de saldos anteriores. Diferencia Debe / Haber · " + accountingMoney.format(balance.difference),
    columns: ["Código", "Cuenta"].map(textColumn).concat(
      ["Débitos", "Créditos", "Deudor", "Acreedor", "Activo", "Pasivo", "Pérdidas", "Ganancias"].map(numberColumn),
    ),
    rows: [
      ...balance.rows.map((item) => row([item.code, item.name, ...balanceColumns.map((key) => item[key])])),
      total("Sumas", balance.sums),
      total(balance.result >= 0 ? "Resultado · utilidad" : "Resultado · pérdida", balance.closing),
      total("Totales finales", balance.grandTotals),
    ],
    hasData: balance.rows.length > 0,
  };
}

const csvValue = (value) => {
  if (typeof value === "number") return value.toFixed(2).replace(".", ",");
  return /^[\s]*[=+\-@]/.test(value) || /^[\t\r\n]/.test(value) ? "'" + value : value;
};

export default function AccountingReports({ mode, entries, allEntries, accounts, period, periodLabel }) {
  const [report, setReport] = useState("balance");
  const [account, setAccount] = useState("");
  const [source, setSource] = useState("Todos");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const kind = mode === "ledger" ? "ledger" : report;
  const title = titles[kind];
  const filename = "contabilidad-" + kind + "-" + period;
  let data;
  let dataError = "";
  try {
    data = reportData(kind, entries, allEntries, accounts, period, account, source);
  } catch (err) {
    dataError = err.message;
  }

  async function downloadPdf() {
    setExporting(true);
    setExportError("");
    try {
      const { createAccountingPdf, createAccountingTablePdf } = await import("@/lib/accounting-pdf");
      const doc = kind === "balance"
        ? createAccountingPdf({ entries, accounts, period, periodLabel })
        : createAccountingTablePdf({ ...data, title, periodLabel });
      doc.save(filename + ".pdf");
    } catch (err) {
      setExportError(err.message || "No se pudo generar el PDF.");
    } finally {
      setExporting(false);
    }
  }

  function downloadCsv() {
    const rows = [[title], [periodLabel], [data.detail], data.columns.map(({ label }) => label), ...data.rows.map(({ cells }) => cells)];
    const blob = new Blob([createCsv(rows.map((cells) => cells.map(csvValue)))], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename + ".csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const canExport = data?.hasData || (kind === "ledger" && data?.rows.length > 0);
  return (
    <section className="erp-card module-panel">
      <div className="erp-section-heading">
        <div>
          <p className="erp-eyebrow">REPORTE CONTABLE</p>
          <h2>{title}</h2>
        </div>
        <div className="module-journal-actions">
          <button className="module-secondary-button" type="button" disabled={!canExport || exporting} onClick={downloadPdf}>
            {exporting ? "Generando PDF…" : "Descargar PDF"}
          </button>
          <button className="module-secondary-button" type="button" disabled={!canExport} onClick={downloadCsv}>Descargar CSV</button>
        </div>
      </div>
      <div className="module-toolbar accounting-controls">
        {mode === "reports" && (
          <label className="module-select-label">
            Reporte
            <select aria-label="Reporte" value={report} onChange={(event) => { setReport(event.target.value); setExportError(""); }}>
              {Object.entries(titles).filter(([key]) => key !== "ledger").map(([key, label]) =>
                <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
        )}
        {kind === "ledger" && (
          <label className="module-select-label">
            Cuenta contable
            <select aria-label="Cuenta contable" value={account} onChange={(event) => setAccount(event.target.value)}>
              <option value="">Seleccionar cuenta</option>
              {accounts.map(({ code, name }) => <option key={code} value={code}>{code} · {name}</option>)}
            </select>
          </label>
        )}
        {kind === "origin" && (
          <label className="module-select-label">
            Origen
            <select aria-label="Origen" value={source} onChange={(event) => setSource(event.target.value)}>
              {sources.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
        )}
      </div>
      {(dataError || exportError) && <p className="ventas-message ventas-message-error" role="alert">{dataError || exportError}</p>}
      {data && <p className="module-caption">{periodLabel} · {data.detail}</p>}
      {data && !data.hasData && <p className="erp-empty" role="status">{
        kind === "ledger" && !account ? "Selecciona una cuenta para consultar sus movimientos." :
          "No hay movimientos para esta consulta en el período seleccionado."
      }</p>}
      {canExport && (
        <div className="module-table-scroll">
          <table className="module-table accounting-report-table">
            <caption className="module-visually-hidden">{title}</caption>
            <thead><tr>{data.columns.map(({ label, numeric }) =>
              <th key={label} scope="col" className={numeric ? "module-number" : ""}>{label}</th>)}</tr></thead>
            <tbody>{data.rows.map(({ cells, strong }, index) => (
              <tr key={index} className={strong ? "accounting-total" : undefined}>
                {cells.map((value, column) => <td key={column} className={data.columns[column].numeric ? "module-number" : ""}>
                  {typeof value === "number" ? accountingMoney.format(value) : value}
                </td>)}
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
