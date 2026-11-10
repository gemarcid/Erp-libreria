"use client";

import { useCallback, useEffect, useState } from "react";
import ErpModuleShell from "@/components/ErpModuleShell";
import { EventsPanel, RolesPanel } from "./SecurityPanels";
import ErpIcon from "@/components/ErpIcon";
import { useAuth } from "@/components/AuthProvider";
import { canOpenModule } from "@/lib/module-access";

async function readUsers(signal) {
  const response = await fetch("/api/administracion/usuarios", { cache: "no-store", signal });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "No se pudieron cargar los usuarios.");
  return result;
}

export default function Administracion() {
  const [view, setView] = useState("usuarios");
  const { usuario, refreshSession } = useAuth();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async (signal) => {
    setLoading(true);
    try {
      const result = await readUsers(signal);
      if (!signal?.aborted) { setUsers(result.usuarios); setRoles(result.perfiles); setError(""); }
    } catch (err) { if (!signal?.aborted) setError(err.message); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, []);
  useEffect(() => {
    if (!usuario || !canOpenModule(usuario, "administracion")) return;
    const controller = new AbortController();
    readUsers(controller.signal)
      .then((result) => { if (!controller.signal.aborted) { setUsers(result.usuarios); setRoles(result.perfiles); setError(""); } })
      .catch((err) => { if (!controller.signal.aborted) setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [usuario]);

  async function persist(data) {
    const response = await fetch("/api/administracion/usuarios", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "No se pudo guardar el usuario.");
  }
  async function save(event) {
    event.preventDefault();
    if (saving) return;
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if (editing.id) data.id = editing.id;
    setSaving(true); setError(""); setMessage("");
    try {
      await persist(data);
      setEditing(null);
      setMessage("Usuario guardado correctamente.");
      await load();
      if (String(data.id) === usuario.id_usuario) await refreshSession();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }
  async function changeStatus(user) {
    if (saving || !window.confirm(`¿Quieres ${user.estado === "activo" ? "desactivar" : "reactivar"} a ${user.nombre}?`)) return;
    setSaving(true); setError(""); setMessage("");
    try {
      await persist({ id: user.id, nombre: user.nombre, correo: user.correo, idRol: user.idRol, rut: user.rut, tipoCliente: user.tipoCliente, estado: user.estado === "activo" ? "inactivo" : "activo" });
      setMessage("Estado del usuario actualizado.");
      await load();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }
  const visible = users.filter((user) =>
    `${user.nombre} ${user.correo}`.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es").trim()) &&
    (!role || String(user.idRol) === role) && (!status || user.estado === status));
  const active = users.filter((user) => user.estado === "activo").length;
  async function exportUsers() {
    if (exporting) return;
    setExporting(true); setError("");
    try {
      const { createUsersPdf } = await import("@/lib/users-pdf");
      const doc = createUsersPdf({ users: visible, totalUsers: users.length,
        role: roles.find((item) => String(item.id) === role)?.nombre || "Todos",
        status: status === "activo" ? "Activo" : status === "inactivo" ? "Inactivo" : "Todos", search });
      doc.save("reporte-usuarios-y-perfiles.pdf");
    } catch (err) { setError(err.message || "No se pudo generar el PDF."); }
    finally { setExporting(false); }
  }

  return <ErpModuleShell module="administracion" title="Administración y seguridad" liveData
    description="Administra usuarios y permisos. Consulta accesos y operaciones del sistema."
    actions={view === "usuarios" && <div className="account-heading-actions"><button className="module-primary-button" disabled={loading || saving || !roles.length} onClick={() => { setEditing({ nombre: "", correo: "", idRol: roles.find((r) => r.nombre.toLowerCase() === "cliente")?.id || roles[0]?.id, estado: "activo" }); setError(""); }}><ErpIcon name="plus" />Nuevo usuario</button></div>}>
    <nav className="module-tabs" aria-label="Vistas de Administración y Seguridad">
      {[["usuarios", "Usuarios"], ["perfiles", "Roles y permisos"], ["accesos", "Inicios de sesión"],
        ["operaciones", "Bitácora"], ["actividad", "Actividad por módulo"]].map(([id, label]) => (
        <button type="button" key={id} aria-current={view === id ? "page" : undefined}
          className={view === id ? "is-selected" : undefined} onClick={() => setView(id)}>{label}</button>
      ))}
    </nav>
    {view === "perfiles" && <RolesPanel />}
    {["accesos", "operaciones", "actividad"].includes(view) && <EventsPanel key={view} view={view} />}
    {view === "usuarios" && <>
    {error && <p className="ventas-message ventas-message-error" role="alert">{error}</p>}
    {message && <p className="account-message" role="status">{message}</p>}
    <section className="erp-metrics" aria-label="Resumen de usuarios">
      {[["Usuarios registrados", users.length], ["Usuarios activos", active], ["Perfiles disponibles", roles.length], ["Usuarios inactivos", users.length - active]].map(([title, value]) =>
        <article className="erp-card erp-metric" key={title}><div className="erp-metric-heading"><h2>{title}</h2><span className="erp-metric-icon neutral"><ErpIcon name="settings" /></span></div><strong className="erp-metric-value">{loading ? "—" : value}</strong></article>)}
    </section>
    {editing && <section className="erp-card module-panel" aria-labelledby="user-form-title">
      <div className="erp-section-heading"><h2 id="user-form-title">{editing.id ? "Editar usuario y perfil" : "Crear usuario"}</h2>
        <button type="button" className="module-secondary-button" onClick={() => setEditing(null)} disabled={saving}>Cancelar</button></div>
      <form className="account-form" onSubmit={save} key={editing.id || "new"}>
        <label>Nombre<input name="nombre" defaultValue={editing.nombre} maxLength={100} required autoComplete="off" /></label>
        <label>Correo<input name="correo" type="email" defaultValue={editing.correo} maxLength={100} required autoComplete="off" /></label>
        <label>Perfil<select name="idRol" value={editing.idRol} onChange={(e) => setEditing({ ...editing, idRol: Number(e.target.value) })} required>{roles.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
        {roles.find((r) => r.id === Number(editing.idRol))?.nombre.toLowerCase() === "cliente" && <>
          <label>RUT del cliente<input name="rut" defaultValue={editing.rut || ""} maxLength={15} required placeholder="12.345.678-5" /></label>
          <label>Tipo de cliente<select name="tipoCliente" defaultValue={editing.tipoCliente || "persona"}><option value="persona">Persona</option><option value="colegio">Colegio</option><option value="empresa">Empresa</option></select></label>
        </>}
        <label>Estado<select name="estado" defaultValue={editing.estado}><option value="activo">Activo</option><option value="inactivo">Inactivo</option></select></label>
        <label>{editing.id ? "Nueva contraseña (opcional)" : "Contraseña"}<input name="password" type="password" minLength={8} required={!editing.id} autoComplete="new-password" /></label>
        <div className="account-form-footer"><span className="account-form-hint">{editing.id ? "Deja la contraseña vacía para conservar la actual." : "Todos los campos son obligatorios. Usa una contraseña de al menos 8 caracteres."}</span><button className="module-primary-button" disabled={saving}>{saving ? "Guardando…" : "Guardar usuario"}</button></div>
      </form>
    </section>}
    <section className="erp-card module-panel module-admin-panel">
      <div className="erp-section-heading"><h2>Usuarios y perfiles</h2><div className="account-heading-actions"><button className="module-secondary-button" onClick={() => load()} disabled={loading || saving}>Actualizar</button><button className="module-secondary-button" onClick={exportUsers} disabled={loading || exporting || !visible.length}><ErpIcon name="arrow" />{exporting ? "Generando PDF…" : "Exportar PDF"}</button></div></div>
      <div className="module-toolbar module-admin-toolbar">
        <label className="erp-search"><ErpIcon name="search" /><input aria-label="Buscar usuario" type="search" placeholder="Nombre o correo…" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
        <label className="module-select-label module-admin-select">Perfil<select value={role} onChange={(e) => setRole(e.target.value)}><option value="">Todos</option>{roles.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
        <label className="module-select-label module-admin-select">Estado<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Todos</option><option value="activo">Activo</option><option value="inactivo">Inactivo</option></select></label>
      </div>
      {loading ? <p role="status">Cargando usuarios…</p> : <div className="module-table-scroll"><table className="module-table">
        <thead><tr><th>Usuario</th><th>Perfil</th><th>Estado</th><th>Creación</th><th>Acciones</th></tr></thead>
        <tbody>{visible.map((user) => <tr key={user.id}><td className="account-user-cell"><strong>{user.nombre}</strong><small>{user.correo}</small></td><td>{user.rol}</td><td><span className={`erp-status ${user.estado === "activo" ? "success" : "danger"}`}>{user.estado === "activo" ? "Activo" : "Inactivo"}</span></td><td>{user.fechaCreacion}</td>
          <td><div className="account-actions"><button className="module-secondary-button" disabled={saving} onClick={() => { setEditing(user); setError(""); }}>Editar</button><button className={`module-secondary-button ${user.estado === "activo" ? "account-danger-button" : ""}`} disabled={saving || String(user.id) === usuario?.id_usuario} onClick={() => changeStatus(user)}>{user.estado === "activo" ? "Desactivar" : "Reactivar"}</button></div></td></tr>)}</tbody>
      </table>{!visible.length && !error && <p className="erp-empty">No hay usuarios que coincidan con los filtros.</p>}</div>}
      <p className="module-caption">La desactivación elimina el acceso y conserva el historial de compras y ventas del usuario.</p>
    </section>
    </>}
  </ErpModuleShell>;
}
