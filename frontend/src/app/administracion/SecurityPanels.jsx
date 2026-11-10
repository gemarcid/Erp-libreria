import { useEffect, useState } from "react";
import { createCsv } from "@/lib/csv";

const endpoint = "/api/administracion/seguridad";
const modules = {
  compras: "Compras", ventas: "Ventas", inventario: "Inventario",
  contabilidad: "Contabilidad", catalogo: "Catálogo", administracion: "Administración", perfil: "Mi perfil",
};
const levels = ["Sin acceso", "Consulta", "Editar", "Total"];
const readOnly = new Set(["inventario", "catalogo"]);
const editableModules = Object.keys(modules).slice(0, 5);
const dateTime = new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago", dateStyle: "short", timeStyle: "medium" });
const localDay = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" });

async function request(query, options) {
  const response = await fetch(endpoint + query, { cache: "no-store", ...options });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "No se pudo completar la operación.");
  return result;
}

function csvDownload(name, headers, rows) {
  const values = [headers, ...rows].map((row) => row.map((value) =>
    typeof value === "string" && (/^\s*[=+\-@]/.test(value) || /^[\r\n\t]/.test(value)) ? "'" + value : value));
  const url = URL.createObjectURL(new Blob([createCsv(values)], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name + ".csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Notice({ error, message }) {
  return error ? <p className="ventas-message ventas-message-error" role="alert">{error}</p> :
    message ? <p className="account-message" role="status">{message}</p> : null;
}

export function RolesPanel() {
  const [profiles, setProfiles] = useState([]);
  const [since, setSince] = useState("");
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    request("?vista=perfiles", { signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        setProfiles(result.perfiles);
        setSince(result.desde);
        setError("");
      })
      .catch((err) => { if (!controller.signal.aborted) setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);

  async function save(data, update) {
    if (saving) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await request("", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      setProfiles((current) => current.map((item) => item.id === data.idRol ? update(item) : item));
      setMessage("Cambios guardados.");
      if (data.operacion === "perfil") setEditing(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="erp-card module-panel">
      <div className="erp-section-heading">
        <div><p className="erp-eyebrow">CONTROL DE ACCESO</p><h2>Roles y permisos</h2></div>
        <div className="account-heading-actions">
          <button type="button" className="module-secondary-button" disabled={loading || saving}
            onClick={() => { setLoading(true); setRevision((value) => value + 1); }}>Actualizar</button>
          <button type="button" className="module-secondary-button" disabled={loading || saving || !profiles.length}
            onClick={() => csvDownload("permisos-por-rol", ["Perfil", "Descripción", ...Object.values(modules)],
              profiles.map(({ nombre, descripcion, permisos }) => [
                nombre, descripcion, ...Object.keys(modules).map((module) => levels[permisos[module] ?? 0]),
              ]))}>Exportar CSV</button>
        </div>
      </div>
      <Notice error={error} message={message} />
      {since && <p className="module-caption">Renovación de contraseña cada 15 días. Política activada el {since.split("-").reverse().join("/")}.</p>}
      {loading ? <p className="erp-empty" role="status">Cargando perfiles…</p> : profiles.length > 0 && <>
        <p className="module-caption">Los cambios se guardan al elegir un nivel. Consulta permite leer y exportar. Editar habilita operaciones de registro. Total incluye acciones como aprobar compras y cerrar períodos.</p>
        <div className="module-table-scroll">
          <table className="module-table security-matrix">
            <caption className="module-visually-hidden">Permisos por perfil y módulo</caption>
            <thead><tr><th scope="col">Perfil</th>{Object.values(modules).map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead>
            <tbody>{profiles.map((role) => (
              <tr key={role.id}>
                <th scope="row">{role.nombre}<small>{role.descripcion}</small>
                  <button className="module-text-button" type="button" disabled={saving}
                    onClick={() => setEditing({ id: role.id, nombre: role.nombre, descripcion: role.descripcion })}>Editar descripción</button>
                </th>
                {Object.entries(modules).map(([module, label]) => {
                  const level = role.permisos[module] ?? 0;
                  if (!role.editable || !editableModules.includes(module)) return <td key={module}>{levels[level]}</td>;
                  return (
                    <td key={module}><select value={level} disabled={saving} aria-label={role.nombre + " · " + label}
                      onChange={(event) => {
                        const nivel = Number(event.target.value);
                        save({ operacion: "permiso", idRol: role.id, modulo: module, nivel },
                          (item) => ({ ...item, permisos: { ...item.permisos, [module]: nivel } }));
                      }}>
                      {(readOnly.has(module) ? levels.slice(0, 2) : levels).map((name, index) =>
                        <option key={name} value={index}>{name}</option>)}
                    </select></td>
                  );
                })}
              </tr>
            ))}</tbody>
          </table>
        </div>
        {editing && (
          <form className="account-form security-form" onSubmit={(event) => {
            event.preventDefault();
            const descripcion = editing.descripcion.trim();
            save({ operacion: "perfil", idRol: editing.id, descripcion }, (item) => ({ ...item, descripcion }));
          }}>
            <label>Descripción de {editing.nombre}
              <input maxLength={255} value={editing.descripcion}
                onChange={(event) => setEditing({ ...editing, descripcion: event.target.value })} disabled={saving} />
            </label>
            <div className="account-heading-actions">
              <button className="module-primary-button" disabled={saving}>Guardar descripción</button>
              <button type="button" className="module-secondary-button" disabled={saving} onClick={() => setEditing(null)}>Cancelar</button>
            </div>
          </form>
        )}
      </>}
    </section>
  );
}

const titles = {
  accesos: "Historial de inicios de sesión",
  operaciones: "Bitácora de operaciones",
  actividad: "Actividad por módulo",
};

export function EventsPanel({ view }) {
  const [filters, setFilters] = useState(() => ({
    desde: localDay.format(new Date(Date.now() - 29 * 86400000)),
    hasta: localDay.format(new Date()), buscar: "", modulo: "", resultado: "",
  }));
  const [query, setQuery] = useState(() => ({ ...filters, pagina: 1 }));
  const [result, setResult] = useState({ filas: [], mas: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const activity = view === "actividad";
  const access = view === "accesos";
  const columns = activity ? ["Usuario", "Perfil", "Módulo", "Operaciones"] :
    access ? ["Fecha y hora", "Usuario", "Perfil", "Resultado", "Detalle"] :
      ["Fecha y hora", "Usuario", "Perfil", "Módulo", "Acción", "Detalle"];

  useEffect(() => {
    const controller = new AbortController();
    request("?" + new URLSearchParams({ ...query, vista: view }), { signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) { setResult(data); setError(""); } })
      .catch((err) => { if (!controller.signal.aborted) setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query, view]);

  function load(filters, page) {
    setLoading(true);
    setQuery({ ...filters, pagina: page });
  }

  const rows = result.filas.map((row) => {
    const moduleLabel = modules[row.modulo] || row.modulo;
    if (activity) return [row.usuario, row.rol || "—", moduleLabel, row.total];
    const identity = [dateTime.format(new Date(row.fecha)), row.usuario, row.rol || "—"];
    return access ? [...identity, row.exito ? "Exitoso" : "Fallido", row.detalle] :
      [...identity, moduleLabel, row.accion, row.detalle];
  });

  return (
    <section className="erp-card module-panel">
      <div className="erp-section-heading">
        <div><p className="erp-eyebrow">AUDITORÍA</p><h2>{titles[view]}</h2></div>
        <button type="button" className="module-secondary-button" disabled={loading || !!error || !rows.length}
          onClick={() => csvDownload(view + "-" + query.desde + "-p" + query.pagina, columns, rows)}>Exportar página CSV</button>
      </div>
      <form className="account-form security-filters" onSubmit={(event) => { event.preventDefault(); load(filters, 1); }}>
        <label>Desde<input type="date" required value={filters.desde} max={filters.hasta}
          onChange={(event) => setFilters({ ...filters, desde: event.target.value })} /></label>
        <label>Hasta<input type="date" required value={filters.hasta} min={filters.desde}
          onChange={(event) => setFilters({ ...filters, hasta: event.target.value })} /></label>
        <label>Correo de usuario<input type="search" value={filters.buscar} maxLength={100}
          onChange={(event) => setFilters({ ...filters, buscar: event.target.value })} /></label>
        {access ? <label>Resultado<select value={filters.resultado} onChange={(event) => setFilters({ ...filters, resultado: event.target.value })}>
          <option value="">Todos</option><option value="exito">Exitosos</option><option value="fallo">Fallidos</option>
        </select></label> : <label>Módulo<select value={filters.modulo} onChange={(event) => setFilters({ ...filters, modulo: event.target.value })}>
          <option value="">Todos</option>{Object.entries(modules).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></label>}
        <button className="module-primary-button" disabled={loading}>Consultar</button>
      </form>
      <Notice error={error} />
      {loading ? <p className="erp-empty" role="status">Consultando registros…</p> : !error && (rows.length ?
        <>
          <div className="module-table-scroll">
            <table className="module-table">
              <caption className="module-visually-hidden">{titles[view]}</caption>
              <thead><tr>{columns.map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead>
              <tbody>{rows.map((cells, index) => <tr key={result.filas[index].id ?? index}>
                {cells.map((cell, column) => <td key={column}>{cell}</td>)}
              </tr>)}</tbody>
            </table>
          </div>
          <div className="account-heading-actions security-pagination">
            <button type="button" className="module-secondary-button" disabled={query.pagina === 1}
              onClick={() => load(query, query.pagina - 1)}>Anterior</button>
            <span>Página {query.pagina}</span>
            <button type="button" className="module-secondary-button" disabled={!result.mas}
              onClick={() => load(query, query.pagina + 1)}>Siguiente</button>
          </div>
        </> : <p className="erp-empty" role="status">No hay registros para los filtros seleccionados.</p>)}
      <p className="module-caption">{activity ? "Operaciones registradas en la bitácora durante el rango seleccionado." :
        "Las fechas y horas se muestran en hora de Chile."}</p>
    </section>
  );
}
