"use client";

import { Fragment, useEffect, useState } from "react";
import ErpModuleShell from "@/components/ErpModuleShell";
import ErpIcon from "@/components/ErpIcon";
import { useAuth } from "@/components/AuthProvider";
import { canOpenModule, moduleAccessLevel } from "@/lib/module-access";
import AccountingOverview from "./AccountingOverview";
import AccountingReports from "./AccountingReports";
import { AccountPlan, AccountingPeriods, AutomaticAccounts, ManualEntry } from "./AccountingManagement";
import { accountingMoney, buildIncomeStatement, entryPeriod } from "@/lib/accounting-reports";
import {
  dateLabel,
  normalize,
  totals,
} from "@/lib/module-demo";

const money = (value) => accountingMoney.format(value);
const screens = [
  ["journal", "Libro diario"],
  ["ledger", "Libro mayor"],
  ["reports", "Reportes"],
  ["accounts", "Plan de cuentas"],
  ["automatic", "Cuentas automáticas"],
  ["manual", "Asiento manual"],
  ["periods", "Períodos contables"],
];

export default function Contabilidad() {
  const { usuario } = useAuth();
  const access = moduleAccessLevel(usuario, "contabilidad");
  const [accounts, setAccounts] = useState([]);
  const [entries, setEntries] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [automatic, setAutomatic] = useState([]);
  const [screen, setScreen] = useState("journal");
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [period, setPeriod] = useState("");
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("Todos");
  const [selected, setSelected] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  useEffect(() => {
    if (!usuario || !canOpenModule(usuario, "contabilidad")) return;
    const controller = new AbortController();
    let requestRevision = 0;
    async function loadJournal() {
      const currentRevision = ++requestRevision;
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/contabilidad", {
          cache: "no-store", signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok || result.success !== true) {
          throw new Error(result.error || "No se pudo consultar el libro diario.");
        }
        if (controller.signal.aborted || currentRevision !== requestRevision) return;
        setAccounts(result.accounts);
        setEntries(result.entries);
        setPeriods(result.periods);
        setAutomatic(result.automatic || []);
        setLoaded(true);
        setPeriod((current) => {
          if (result.periods.some((item) => item.value === current)) return current;
          const today = new Intl.DateTimeFormat("sv-SE", {
            timeZone: "America/Santiago", year: "numeric", month: "2-digit",
          }).format(new Date());
          return result.periods.some((item) => item.value === today)
            ? today : result.periods[0]?.value || "";
        });
      } catch (err) {
        if (!controller.signal.aborted && currentRevision === requestRevision) setError(err.message);
      } finally {
        if (!controller.signal.aborted && currentRevision === requestRevision) setLoading(false);
      }
    }
    loadJournal();
    window.addEventListener("focus", loadJournal);
    return () => {
      controller.abort();
      window.removeEventListener("focus", loadJournal);
    };
  }, [usuario, revision]);
  const periodInfo = periods.find((item) => item.value === period);
  const periodEntries = entries.filter((entry) => entryPeriod(entry) === period);
  const summary = totals(periodEntries);
  const statement = buildIncomeStatement(periodEntries, accounts);
  const refresh = () => setRevision((value) => value + 1);
  const visibleEntries = periodEntries.filter(
    (entry) =>
      (source === "Todos" || entry.source === source) &&
      normalize(
        `${entry.code} ${entry.description} ${entry.document}`,
      ).includes(normalize(search)),
  );

  async function exportJournal() {
    setExporting(true);
    setExportError("");
    try {
      const { createAccountingPdf } = await import("@/lib/accounting-pdf");
      const doc = createAccountingPdf({ entries: visibleEntries, accounts, period, periodLabel: periodInfo?.label, source, search });
      doc.save(`balance-comprobacion-8-columnas-${period}.pdf`);
    } catch (err) {
      setExportError(err.message || "No se pudo generar el PDF.");
    } finally {
      setExporting(false);
    }
  }

  const metricCards = [
    [
      "Asientos del período",
      String(periodEntries.length),
      "Compras, ventas y ajustes",
      "accounting",
      "neutral",
    ],
    [
      "Ingresos del período",
      money(statement.groups[0].total),
      "Ingresos según el plan de cuentas",
      "sales",
      "success",
    ],
    [
      "Resultado del período",
      money(statement.result),
      "Ingresos menos costos y gastos",
      "trend",
      statement.result >= 0 ? "success" : "danger",
    ],
    [
      "Diferencia debe / haber",
      money(summary.debit - summary.credit),
      summary.debit === summary.credit
        ? "Asientos cuadrados"
        : "Revisar movimientos",
      "book",
      summary.debit === summary.credit ? "success" : "danger",
    ],
  ];

  return (
    <ErpModuleShell
      module="contabilidad"
      liveData
      title="Contabilidad"
      description="Consulta los movimientos, administra los períodos y genera reportes contables."
      actions={
        ["journal", "ledger", "reports"].includes(screen) && (
        <label className="module-select-label module-accounting-select">
          Período contable
          <select
            value={period}
            disabled={loading || periods.length === 0}
            onChange={(event) => {
              setPeriod(event.target.value);
              setSelected(null);
            }}
          >
            {periods.map((item) => (
              <option value={item.value} key={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        )
      }
    >
      {error && (
        <div className="accounting-actions">
          <p className="ventas-message ventas-message-error" role="alert">{error}</p>
          <button className="module-secondary-button" type="button" onClick={refresh}>Reintentar</button>
        </div>
      )}
      {loading && <p className="erp-empty" role="status">Cargando datos contables…</p>}
      <nav className="module-tabs" aria-label="Vistas de contabilidad">
        {screens.filter(([key]) => key !== "manual" || access >= 2).map(([key, label]) => (
          <button key={key} type="button" aria-current={screen === key ? "page" : undefined}
            className={screen === key ? "is-selected" : undefined} onClick={() => setScreen(key)}>{label}</button>
        ))}
      </nav>
      {loaded && !error && <>
        {(screen === "ledger" || screen === "reports") && <AccountingReports
          key={screen} mode={screen} entries={periodEntries} allEntries={entries} accounts={accounts}
          period={period} periodLabel={periodInfo?.label || "Sin período"} />}
        {screen === "accounts" && <AccountPlan accounts={accounts} onSaved={refresh} canEdit={access >= 2} />}
        {screen === "automatic" && <AutomaticAccounts automatic={automatic} accounts={accounts} onSaved={refresh} canEdit={access === 3} />}
        {screen === "manual" && access >= 2 && <ManualEntry accounts={accounts} periods={periods} onSaved={refresh} />}
        {screen === "periods" && <AccountingPeriods periods={periods} entries={entries} onSaved={refresh} canEdit={access >= 2} canClose={access === 3} />}
      </>}
      {screen === "journal" && <>
      {exportError && <p className="ventas-message ventas-message-error" role="alert">{exportError}</p>}
      <section className="erp-metrics" aria-label="Resumen contable">
        {metricCards.map(([title, value, detail, icon, tone]) => (
          <article className="erp-card erp-metric" key={title}>
            <div className="erp-metric-heading">
              <h2>{title}</h2>
              <span className={`erp-metric-icon ${tone}`}>
                <ErpIcon name={icon} />
              </span>
            </div>
            <strong className="erp-metric-value">{loading || error ? "—" : value}</strong>
            <p className={`erp-metric-detail ${tone}`}>{detail}</p>
          </article>
        ))}
      </section>
      {loaded && !error && <AccountingOverview entries={entries} periodEntries={periodEntries} accounts={accounts} period={period}
        onEntry={(code) => {
          setSearch(code);
          setSource("Todos");
          setSelected(code);
          document.getElementById("libro-diario")?.scrollIntoView({ block: "start" });
        }} />}
      <section className="erp-card module-panel" id="libro-diario">
        <div className="erp-section-heading">
          <div>
            <p className="erp-eyebrow">REPORTE CONTABLE</p>
            <h2>Libro diario</h2>
          </div>
          <div className="module-journal-actions">
          <button
            type="button"
            className="module-secondary-button"
            disabled={loading}
            onClick={refresh}
          >
            Actualizar
          </button>
          <button
            type="button"
            className="module-secondary-button"
            onClick={exportJournal}
            disabled={loading || !!error || exporting || visibleEntries.length === 0}
            title="Balance de Comprobación de 8 Columnas y detalle de los asientos seleccionados"
          >
            <ErpIcon name="arrow" />
            {exporting ? "Generando PDF…" : "Descargar balance PDF"}
          </button>
          </div>
        </div>
        <div className="module-toolbar module-journal-toolbar">
          <label className="erp-search">
            <ErpIcon name="search" />
            <input
              type="search"
              aria-label="Buscar asiento, documento o glosa"
              value={search}
              placeholder="Buscar asiento, documento o glosa…"
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <label className="module-select-label module-accounting-select">
            Origen
            <select
              value={source}
              onChange={(event) => setSource(event.target.value)}
            >
              {["Todos", "Compras", "Ventas", "Manual"].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="module-table-scroll">
          <table className="module-table">
            <caption className="module-visually-hidden">
              Asientos contables del período seleccionado
            </caption>
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Asiento / documento</th>
                <th scope="col">Glosa</th>
                <th scope="col">Origen</th>
                <th scope="col" className="module-number">
                  Debe
                </th>
                <th scope="col" className="module-number">
                  Haber
                </th>
                <th scope="col">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {!loading && !error && visibleEntries.map((entry) => {
                const value = totals([entry]);
                return (
                  <Fragment key={entry.code}>
                    <tr>
                      <td>{dateLabel(entry.date)}</td>
                      <td>
                        <strong>{entry.code}</strong>
                        <small>{entry.document}</small>
                      </td>
                      <td>{entry.description}</td>
                      <td>
                        <span className="erp-status neutral">
                          {entry.source}
                        </span>
                      </td>
                      <td className="module-number">{money(value.debit)}</td>
                      <td className="module-number">{money(value.credit)}</td>
                      <td>
                        <button
                          className="module-text-button"
                          aria-expanded={selected === entry.code}
                          aria-controls={`detalle-${entry.code}`}
                          onClick={() =>
                            setSelected(
                              selected === entry.code ? null : entry.code,
                            )
                          }
                        >
                          {selected === entry.code ? "Ocultar" : "Ver"}
                        </button>
                      </td>
                    </tr>
                    {selected === entry.code && (
                      <tr
                        className="module-entry-detail-row"
                        id={`detalle-${entry.code}`}
                      >
                        <td colSpan={7}>
                          <div className="module-entry-detail">
                            <h3>Detalle de {entry.code}</h3>
                            <div className="module-table-scroll">
                              <table className="module-table">
                                <thead>
                                  <tr>
                                    <th scope="col">Cuenta</th>
                                    <th scope="col" className="module-number">
                                      Debe
                                    </th>
                                    <th scope="col" className="module-number">
                                      Haber
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {entry.lines.map((line, index) => (
                                    <tr key={line.id ?? index}>
                                      <td>
                                        {line.account} ·{" "}
                                        {
                                          accounts.find(
                                            (account) =>
                                              account.code === line.account,
                                          )?.name
                                        }
                                      </td>
                                      <td className="module-number">
                                        {money(line.debit)}
                                      </td>
                                      <td className="module-number">
                                        {money(line.credit)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        {!loading && !error && visibleEntries.length === 0 && (
          <p className="erp-empty" role="status">
            No hay asientos que coincidan con los filtros.
          </p>
        )}
        <p className="module-caption">
          {periodInfo?.label || "Sin período"} · {periodInfo?.status || ""} · {loading || error ? "—" : `${visibleEntries.length} de ${periodEntries.length}`} asientos. Importes en pesos chilenos.
        </p>
      </section>
      </>}
    </ErpModuleShell>
  );
}
