import { useRef, useState } from "react";
import { accountTypes, accountingMoney, entryPeriod, toCents } from "@/lib/accounting-reports";

const blankAccount = { code: "", name: "", type: "activo" };
const blankLine = { account: "", debit: "", credit: "" };

function useAccountingMutation(onSaved) {
  const [state, setState] = useState({ busy: false, error: false, message: "" });
  const pending = useRef(false);
  async function save(operation, data, message, onSuccess) {
    if (pending.current) return;
    pending.current = true;
    setState({ busy: true, error: false, message: "" });
    try {
      const response = await fetch("/api/contabilidad", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation, data }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "No se pudo confirmar la operación.");
      onSuccess?.(result);
      setState({ busy: false, error: false, message: typeof message === "function" ? message(result) : message });
      onSaved();
    } catch (err) {
      setState({ busy: false, error: true, message: err.message });
    } finally {
      pending.current = false;
    }
  }
  return { ...state, save };
}

function Feedback({ state }) {
  if (!state.message) return null;
  return <p className={"ventas-message " + (state.error ? "ventas-message-error" : "ventas-message-success")}
    role={state.error ? "alert" : "status"}>{state.message}</p>;
}

function ManagementPanel({ title, description, children }) {
  return (
    <section className="erp-card module-panel">
      <div className="erp-section-heading"><div>
        <p className="erp-eyebrow">GESTIÓN CONTABLE</p>
        <h2>{title}</h2>
      </div></div>
      <p className="module-caption">{description}</p>
      {children}
    </section>
  );
}

export function AccountPlan({ accounts, onSaved, canEdit }) {
  const [form, setForm] = useState(null);
  const state = useAccountingMutation(onSaved);
  return (
    <ManagementPanel title="Plan de cuentas" description="Consulta, crea y edita las cuentas de la librería.">
      <Feedback state={state} />
      <div className="accounting-actions">
        {canEdit && <button className="module-secondary-button" type="button" disabled={state.busy}
          onClick={() => setForm({ ...blankAccount, edit: false })}>Nueva cuenta</button>}
      </div>
      {form && canEdit && (
        <form className="accounting-form" onSubmit={(event) => {
          event.preventDefault();
          state.save("account", form, "Cuenta guardada.", () => setForm(null));
        }}>
          <h3>{form.edit ? "Editar cuenta " + form.code : "Nueva cuenta"}</h3>
          <fieldset disabled={state.busy}>
            <label>Código <input value={form.code} maxLength={20} required readOnly={form.edit}
              pattern="[A-Za-z0-9][A-Za-z0-9._\-]{0,19}"
              onChange={(event) => setForm({ ...form, code: event.target.value })} /></label>
            <label>Nombre <input value={form.name} maxLength={100} required
              onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
            <label>Tipo <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
              {Object.entries(accountTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select></label>
          </fieldset>
          <div className="accounting-actions">
            <button className="module-primary-button" disabled={state.busy}>Guardar cuenta</button>
            <button className="module-secondary-button" type="button" disabled={state.busy} onClick={() => setForm(null)}>Cancelar</button>
          </div>
        </form>
      )}
      <div className="module-table-scroll">
        <table className="module-table">
          <thead><tr><th scope="col">Código</th><th scope="col">Nombre</th><th scope="col">Tipo</th><th scope="col">Acción</th></tr></thead>
          <tbody>{accounts.map((item) => (
            <tr key={item.code}><td>{item.code}</td><td>{item.name}</td><td>{accountTypes[item.type] || item.type}</td>
              <td>{canEdit && <button className="module-text-button" type="button" disabled={state.busy} aria-label={"Editar " + item.name}
                onClick={() => setForm({ ...item, edit: true })}>Editar</button>}</td></tr>
          ))}</tbody>
        </table>
      </div>
      {accounts.length === 0 && <p className="erp-empty">Todavía no hay cuentas registradas.</p>}
    </ManagementPanel>
  );
}

export function AutomaticAccounts({ automatic, accounts, onSaved, canEdit }) {
  const [editing, setEditing] = useState(null);
  const state = useAccountingMutation(onSaved);
  return (
    <ManagementPanel title="Cuentas automáticas" description="Define las cuentas que usarán los próximos asientos del punto de venta.">
      <Feedback state={state} />
      <div className="module-table-scroll">
        <table className="module-table">
          <thead><tr><th scope="col">Operación de ventas</th><th scope="col">Cuenta asignada</th><th scope="col">Acción</th></tr></thead>
          <tbody>{automatic.map((rule) => {
            const account = accounts.find((item) => item.code === rule.account);
            return <tr key={rule.key}><td>{rule.label}</td><td>{rule.account} · {account?.name || "Predeterminada"}</td>
              <td>{canEdit && <button className="module-text-button" type="button" disabled={state.busy} aria-label={"Cambiar cuenta de " + rule.label}
                onClick={() => setEditing({ ...rule, account: account?.code || "" })}>Cambiar</button>}</td></tr>;
          })}</tbody>
        </table>
      </div>
      {editing && canEdit && (
        <form className="accounting-form" onSubmit={(event) => {
          event.preventDefault();
          state.save("automatic", { operation: editing.key, account: editing.account },
            "Cuenta automática actualizada.", () => setEditing(null));
        }}>
          <h3>{editing.label}</h3>
          <fieldset disabled={state.busy}>
            <label>Cuenta de tipo {accountTypes[editing.type]}
              <select required value={editing.account} onChange={(event) => setEditing({ ...editing, account: event.target.value })}>
                <option value="">Seleccionar cuenta</option>
                {accounts.filter(({ type, code }) => type === editing.type ||
                  (editing.type === "costo" && type === "gasto" && code === editing.defaultAccount)).map(({ code, name }) =>
                  <option value={code} key={code}>{code} · {name}</option>)}
              </select>
            </label>
          </fieldset>
          <div className="accounting-actions">
            <button className="module-primary-button" disabled={state.busy}>Guardar asignación</button>
            <button className="module-secondary-button" type="button" disabled={state.busy} onClick={() => setEditing(null)}>Cancelar</button>
          </div>
        </form>
      )}
    </ManagementPanel>
  );
}

export function AccountingPeriods({ periods, entries, onSaved, canEdit, canClose }) {
  const [month, setMonth] = useState("");
  const [review, setReview] = useState("");
  const state = useAccountingMutation(onSaved);
  const reviewPeriod = periods.find((item) => item.value === review && item.status === "abierto");
  const reviewEntries = entries.filter((entry) => entryPeriod(entry) === review);
  const debit = reviewEntries.reduce((sum, entry) => sum + entry.lines.reduce((total, line) => total + toCents(line.debit), 0), 0);
  const credit = reviewEntries.reduce((sum, entry) => sum + entry.lines.reduce((total, line) => total + toCents(line.credit), 0), 0);
  return (
    <ManagementPanel title="Períodos contables" description="Abre meses para registrar movimientos y revisa sus asientos antes del cierre.">
      <Feedback state={state} />
      {canEdit && <form className="accounting-form" onSubmit={(event) => {
        event.preventDefault();
        state.save("period", { period: month }, "Período abierto.", () => setMonth(""));
      }}>
        <fieldset disabled={state.busy}>
          <label>Mes y año <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} required /></label>
          <button className="module-primary-button">Abrir período</button>
        </fieldset>
      </form>}
      {reviewPeriod && canClose && (
        <div className="accounting-form">
          <h3>Confirmar cierre de {reviewPeriod.label}</h3>
          <p>{reviewEntries.length} asientos · Debe {accountingMoney.format(debit / 100)} · Haber {accountingMoney.format(credit / 100)}</p>
          <p>El período quedará cerrado para registrar nuevos asientos. Podrás seguir consultando sus movimientos.</p>
          <div className="accounting-actions">
            <button className="module-primary-button" type="button" disabled={state.busy || debit !== credit}
              onClick={() => state.save("period", { period: review, close: true }, "Período cerrado.", () => setReview(""))}>Confirmar cierre</button>
            <button className="module-secondary-button" type="button" disabled={state.busy} onClick={() => setReview("")}>Cancelar</button>
          </div>
        </div>
      )}
      <div className="module-table-scroll">
        <table className="module-table">
          <thead><tr><th scope="col">Mes y año</th><th scope="col">Estado</th><th scope="col">Acción</th></tr></thead>
          <tbody>{periods.map((item) => (
            <tr key={item.value}><td>{item.label}</td>
              <td><span className={"erp-status " + (item.status === "abierto" ? "success" : "neutral")}>
                {item.status === "abierto" ? "Abierto" : "Cerrado"}
              </span></td><td>{item.status === "abierto" && canClose && (
                <button className="module-text-button" type="button" disabled={state.busy} onClick={() => setReview(item.value)}>
                  Revisar cierre<span className="module-visually-hidden"> de {item.label}</span>
                </button>
              )}</td></tr>
          ))}</tbody>
        </table>
      </div>
      {periods.length === 0 && <p className="erp-empty">Todavía no hay períodos registrados.</p>}
    </ManagementPanel>
  );
}

export function ManualEntry({ accounts, periods, onSaved }) {
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState([blankLine, blankLine]);
  const requestId = useRef(null);
  const state = useAccountingMutation(onSaved);
  const debit = lines.reduce((sum, line) => sum + toCents(line.debit), 0);
  const credit = lines.reduce((sum, line) => sum + toCents(line.credit), 0);
  const balanced = debit > 0 && debit === credit;
  const ready = date && description.trim() && balanced && lines.every((line) => line.account &&
    (Number(line.debit) > 0) !== (Number(line.credit) > 0));
  const month = periods.find((item) => item.value === date.slice(0, 7));
  function changeLine(index, key, value) {
    requestId.current = null;
    setLines((current) => current.map((line, position) => position === index ? { ...line, [key]: value } : line));
  }
  return (
    <ManagementPanel title="Registrar asiento manual" description="Ingresa ajustes, reclasificaciones o gastos. El Debe y el Haber deben sumar lo mismo.">
      <Feedback state={state} />
      <form className="accounting-form" onSubmit={(event) => {
        event.preventDefault();
        if (!ready || month?.status !== "abierto") return;
        requestId.current ??= crypto.randomUUID();
        state.save("manual", { date, description, requestId: requestId.current, lines: lines.map((line) => ({
          ...line, debit: Number(line.debit), credit: Number(line.credit),
        })) }, (result) => "Asiento " + result.code + " registrado en el Libro Diario.", () => {
          requestId.current = null;
          setDescription("");
          setLines([blankLine, blankLine]);
        });
      }}>
        <fieldset disabled={state.busy}>
          <label>Fecha contable <input type="date" required value={date}
            onChange={(event) => { requestId.current = null; setDate(event.target.value); }} /></label>
          <label className="accounting-grow">Glosa <input required maxLength={255} value={description}
            onChange={(event) => { requestId.current = null; setDescription(event.target.value); }} /></label>
        </fieldset>
        {date && month?.status !== "abierto" && <p className="ventas-message ventas-message-error" role="status">
          {month ? "El período de la fecha seleccionada está cerrado." : "Abre el período correspondiente a la fecha seleccionada."}
        </p>}
        <div className="module-table-scroll">
          <table className="module-table accounting-entry-table">
            <thead><tr><th scope="col">Cuenta</th><th scope="col">Debe</th><th scope="col">Haber</th><th scope="col">Acción</th></tr></thead>
            <tbody>{lines.map((line, index) => (
              <tr key={index}>
                <td><select required disabled={state.busy} aria-label={"Cuenta de línea " + (index + 1)}
                  value={line.account} onChange={(event) => changeLine(index, "account", event.target.value)}>
                  <option value="">Seleccionar cuenta</option>
                  {accounts.map(({ code, name }) => <option key={code} value={code}>{code} · {name}</option>)}
                </select></td>
                {["debit", "credit"].map((key) => <td key={key}><input type="number" min="0" max="9999999999.99" step="0.01"
                  disabled={state.busy} aria-label={(key === "debit" ? "Debe" : "Haber") + " de línea " + (index + 1)}
                  value={line[key]} onChange={(event) => changeLine(index, key, event.target.value)} placeholder="0" /></td>)}
                <td><button type="button" className="module-text-button" disabled={state.busy || lines.length <= 2}
                  aria-label={"Quitar línea " + (index + 1)} onClick={() => {
                    requestId.current = null;
                    setLines(lines.filter((_, position) => position !== index));
                  }}>Quitar</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <p className="accounting-entry-totals" aria-live="polite">
          Debe {accountingMoney.format(debit / 100)} · Haber {accountingMoney.format(credit / 100)} · {balanced
            ? "Cuadrado" : "Diferencia " + accountingMoney.format((debit - credit) / 100)}
        </p>
        <div className="accounting-actions">
          <button type="button" className="module-secondary-button" disabled={state.busy || lines.length >= 100}
            onClick={() => { requestId.current = null; setLines([...lines, blankLine]); }}>Agregar línea</button>
          <button className="module-primary-button" disabled={state.busy || !ready || month?.status !== "abierto"}>Guardar asiento</button>
        </div>
      </form>
    </ManagementPanel>
  );
}
