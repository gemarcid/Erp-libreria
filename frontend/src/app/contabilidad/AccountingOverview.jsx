import { accountingMoney, buildIncomeStatement, entryPeriod } from "@/lib/accounting-reports";
import { dateLabel } from "@/lib/module-demo";

const monthLabel = new Intl.DateTimeFormat("es-CL", { month: "short", timeZone: "UTC" });

export default function AccountingOverview({ entries, periodEntries, accounts, period, onEntry }) {
  if (!period) return null;
  const [year, month] = period.split("-").map(Number);
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 6 + index, 1));
    const key = date.toISOString().slice(0, 7);
    const { groups } = buildIncomeStatement(entries.filter((entry) => entryPeriod(entry) === key), accounts);
    return { key, label: monthLabel.format(date), income: groups[0].total, expenses: groups[1].total + groups[2].total };
  });
  const scale = Math.max(1, ...months.flatMap(({ income, expenses }) => [Math.abs(income), Math.abs(expenses)]));
  return (
    <div className="accounting-overview">
      <section className="erp-card module-panel">
        <div className="erp-section-heading"><div>
          <h2>Ingresos y egresos</h2>
          <p className="module-caption">Últimos seis meses hasta el período seleccionado.</p>
        </div></div>
        <div className="accounting-chart-legend"><span>Ingresos</span><span>Egresos</span></div>
        <div className="accounting-chart" aria-label="Comparación mensual">
          {months.map(({ key, label, income, expenses }) => (
            <div key={key} className="accounting-chart-month" title={key + " · Ingresos " + accountingMoney.format(income) +
              " · Egresos " + accountingMoney.format(expenses)}>
              <span className="module-visually-hidden">{key}. Ingresos {accountingMoney.format(income)}. Egresos {accountingMoney.format(expenses)}.</span>
              <div className="accounting-chart-bars" aria-hidden="true">
                <span style={{ height: Math.abs(income) / scale * 100 + "%" }} className={income < 0 ? "is-negative" : undefined} />
                <span style={{ height: Math.abs(expenses) / scale * 100 + "%" }} className={expenses < 0 ? "is-negative" : undefined} />
              </div>
              <span aria-hidden="true">{label}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="erp-card module-panel">
        <div className="erp-section-heading"><div>
          <h2>Movimientos recientes</h2>
          <p className="module-caption">Últimos asientos del período seleccionado.</p>
        </div></div>
        <ul className="accounting-recent">
          {periodEntries.slice(0, 4).map((entry) => (
            <li key={entry.code}>
              <div><strong>{entry.description || entry.code}</strong><small>{dateLabel(entry.date)} · {entry.source}</small></div>
              <button className="module-text-button" type="button" onClick={() => onEntry(entry.code)}>{entry.code}</button>
            </li>
          ))}
        </ul>
        {periodEntries.length === 0 && <p className="erp-empty">Todavía no hay movimientos en este período.</p>}
      </section>
    </div>
  );
}
