"use client";

import { useEffect, useState, useMemo } from "react";
import ErpModuleShell from "@/components/ErpModuleShell";
import ErpIcon from "@/components/ErpIcon";
import { useAuth } from "@/components/AuthProvider";
import VentasNav from "@/components/VentasNav";
import { moduleAccessLevel } from "@/lib/module-access";
import { createCsv } from "@/lib/csv";

function formatMoney(value) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

export default function GestionClientesPage() {
  const { usuario, loading } = useAuth();
  const puedeEditar = moduleAccessLevel(usuario, "ventas") >= 2;

  const [clientes, setClientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  // Modal Crear / Editar
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState({
    id_cliente: 0,
    rut: "",
    nombre: "",
    correo: "",
    telefono: "",
    direccion: "",
    tipo_cliente: "persona",
    limite_credito: 500000,
  });

  async function cargarClientes() {
    setCargando(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (busqueda.trim()) params.set("buscar", busqueda.trim());
      if (filtroTipo !== "todos") params.set("tipo", filtroTipo);
      params.set("completo", "true");

      const res = await fetch(`/api/ventas/clientes?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo cargar la lista de clientes.");
      setClientes(data.clientes || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    if (!loading && usuario) {
      cargarClientes();
    }
  }, [loading, usuario, filtroTipo]);

  function abrirModalNuevo() {
    setEditando(null);
    setForm({
      id_cliente: 0,
      rut: "",
      nombre: "",
      correo: "",
      telefono: "",
      direccion: "",
      tipo_cliente: "persona",
      limite_credito: 500000,
    });
    setMensaje("");
    setError("");
    setModalAbierto(true);
  }

  function abrirModalEditar(cliente) {
    setEditando(cliente);
    setForm({
      id_cliente: cliente.id_cliente,
      rut: cliente.rut,
      nombre: cliente.nombre,
      correo: cliente.correo || "",
      telefono: cliente.telefono || "",
      direccion: cliente.direccion || "",
      tipo_cliente: cliente.tipo_cliente || "persona",
      limite_credito: cliente.limite_credito || 500000,
    });
    setMensaje("");
    setError("");
    setModalAbierto(true);
  }

  async function guardarCliente(e) {
    e.preventDefault();
    if (!form.rut || !form.nombre) {
      setError("El RUT y el nombre comercial son campos obligatorios.");
      return;
    }

    setGuardando(true);
    setError("");
    setMensaje("");

    try {
      const res = await fetch("/api/ventas/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Error al guardar el cliente.");
      }

      setMensaje(data.mensaje || "Cliente guardado exitosamente.");
      setModalAbierto(false);
      cargarClientes();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  function exportarCsv() {
    const filas = [
      ["RUT", "Nombre", "Tipo", "Correo", "Teléfono", "Dirección", "Puntos Lectura", "Límite Crédito", "Crédito Utilizado", "Crédito Disponible"],
      ...clientes.map((c) => [
        c.rut,
        c.nombre,
        c.tipo_cliente,
        c.correo,
        c.telefono,
        c.direccion,
        c.puntos_fidelidad,
        c.limite_credito,
        c.credito_utilizado,
        c.credito_disponible,
      ]),
    ];
    const csvData = createCsv(filas);
    const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `clientes_erp_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const clientesFiltrados = useMemo(() => {
    if (!busqueda.trim()) return clientes;
    const term = busqueda.toLowerCase();
    return clientes.filter(
      (c) =>
        c.nombre.toLowerCase().includes(term) ||
        c.rut.toLowerCase().includes(term) ||
        (c.correo && c.correo.toLowerCase().includes(term)),
    );
  }, [clientes, busqueda]);

  const totalPuntos = useMemo(() => clientes.reduce((acc, c) => acc + (c.puntos_fidelidad || 0), 0), [clientes]);
  const totalCredito = useMemo(() => clientes.reduce((acc, c) => acc + (c.limite_credito || 0), 0), [clientes]);

  return (
    <ErpModuleShell
      usuario={usuario}
      module="ventas"
      title="Gestión de Clientes"
      description="Administración de datos comerciales, cuentas de crédito y puntos de lectura (fidelización)."
      subnav={<VentasNav />}
      liveData={true}
    >
      <div className="ventas-report">
        {/* Métricas rápidas */}
        <div className="ventas-report-summary">
          <div className="ventas-report-summary-card">
            <span className="ventas-report-summary-label">Total Clientes</span>
            <strong>{clientes.length}</strong>
          </div>
          <div className="ventas-report-summary-card">
            <span className="ventas-report-summary-label">Puntos de Lectura Acumulados</span>
            <strong>{totalPuntos.toLocaleString("es-CL")} pts</strong>
          </div>
          <div className="ventas-report-summary-card">
            <span className="ventas-report-summary-label">Línea de Crédito Global</span>
            <strong>{formatMoney(totalCredito)}</strong>
          </div>
        </div>

        {/* Barra de filtros y acciones */}
        <section className="erp-card ventas-report-filters">
          <div className="erp-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2>Directorio Comercial</h2>
              <p>Busca clientes por RUT, nombre o filtra por tipo de cliente (Persona, Colegio o Empresa).</p>
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button type="button" className="erp-button erp-button-secondary" onClick={exportarCsv}>
                <ErpIcon name="trend" /> Exportar CSV
              </button>
              {puedeEditar && (
                <button type="button" className="erp-button erp-button-primary" onClick={abrirModalNuevo}>
                  <ErpIcon name="plus" /> Nuevo Cliente
                </button>
              )}
            </div>
          </div>

          <div className="ventas-report-filter-grid">
            <label className="erp-field">
              <span>Buscar por RUT, Nombre o Correo</span>
              <input
                type="text"
                placeholder="Ej. 15.234.567-8 o San Buenaventura"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </label>

            <label className="erp-field">
              <span>Tipo de Cliente</span>
              <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
                <option value="todos">Todos los tipos</option>
                <option value="persona">Persona Natural</option>
                <option value="colegio">Colegio / Institución Educativa</option>
                <option value="empresa">Empresa / Corporativo</option>
              </select>
            </label>

            <div className="ventas-report-filter-actions" style={{ alignSelf: "flex-end" }}>
              <button type="button" className="erp-button erp-button-secondary" onClick={cargarClientes}>
                <ErpIcon name="sync" /> Actualizar
              </button>
            </div>
          </div>

          {error && <div className="erp-alert-error" style={{ marginTop: "1rem" }}>{error}</div>}
          {mensaje && <div className="ventas-message ventas-message-success" style={{ marginTop: "1rem" }}>{mensaje}</div>}
        </section>

        {/* Tabla de Clientes */}
        <section className="erp-card ventas-report-table-card">
          <div className="ventas-report-table-wrapper">
            <table className="ventas-report-table">
              <thead>
                <tr>
                  <th>RUT</th>
                  <th>Cliente</th>
                  <th>Tipo</th>
                  <th>Contacto</th>
                  <th>Puntos Fidelidad</th>
                  <th>Límite Crédito</th>
                  <th>Crédito Disponible</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {cargando ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: "center", padding: "2rem" }}>
                      Cargando clientes...
                    </td>
                  </tr>
                ) : clientesFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: "center", padding: "2rem" }}>
                      No se encontraron clientes con los criterios especificados.
                    </td>
                  </tr>
                ) : (
                  clientesFiltrados.map((c) => (
                    <tr key={c.id_cliente}>
                      <td><strong>{c.rut}</strong></td>
                      <td>
                        <strong>{c.nombre}</strong>
                        {c.direccion && <div style={{ fontSize: "0.8rem", color: "#666" }}>{c.direccion}</div>}
                      </td>
                      <td>
                        <span className={`erp-badge ${c.tipo_cliente === "colegio" ? "erp-badge-blue" : c.tipo_cliente === "empresa" ? "erp-badge-green" : "erp-badge-gray"}`} style={{ textTransform: "capitalize" }}>
                          {c.tipo_cliente}
                        </span>
                      </td>
                      <td>
                        <div>{c.correo || "—"}</div>
                        <div style={{ fontSize: "0.8rem", color: "#666" }}>{c.telefono || ""}</div>
                      </td>
                      <td>
                        <span style={{ fontWeight: "bold", color: "#1a5c38" }}>
                          ★ {c.puntos_fidelidad || 0} pts
                        </span>
                      </td>
                      <td>{formatMoney(c.limite_credito)}</td>
                      <td>
                        <strong style={{ color: c.credito_disponible > 0 ? "#1a5c38" : "#a11" }}>
                          {formatMoney(c.credito_disponible)}
                        </strong>
                      </td>
                      <td>
                        {puedeEditar && (
                          <button
                            type="button"
                            className="erp-button erp-button-secondary"
                            style={{ padding: "0.3rem 0.6rem", fontSize: "0.85rem" }}
                            onClick={() => abrirModalEditar(c)}
                          >
                            <ErpIcon name="edit" /> Editar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Modal de Crear / Editar Cliente */}
        {modalAbierto && (
          <div className="erp-modal-overlay" style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center",
            justifyContent: "center", zIndex: 1000
          }}>
            <div className="erp-card" style={{ maxWidth: "560px", width: "90%", maxHeight: "90vh", overflowY: "auto" }}>
              <div className="erp-card-header" style={{ display: "flex", justifyContent: "space-between" }}>
                <h2>{editando ? "Editar Ficha de Cliente" : "Registrar Nuevo Cliente"}</h2>
                <button type="button" className="erp-icon-button" onClick={() => setModalAbierto(false)}>✕</button>
              </div>

              <form onSubmit={guardarCliente} style={{ padding: "1.2rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <label className="erp-field">
                    <span>RUT *</span>
                    <input
                      type="text"
                      required
                      placeholder="12.345.678-9"
                      value={form.rut}
                      disabled={!!editando}
                      onChange={(e) => setForm({ ...form, rut: e.target.value })}
                    />
                  </label>

                  <label className="erp-field">
                    <span>Tipo de Cliente *</span>
                    <select
                      value={form.tipo_cliente}
                      onChange={(e) => setForm({ ...form, tipo_cliente: e.target.value })}
                    >
                      <option value="persona">Persona</option>
                      <option value="colegio">Colegio</option>
                      <option value="empresa">Empresa</option>
                    </select>
                  </label>
                </div>

                <label className="erp-field">
                  <span>Razón Social / Nombre Completo *</span>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Colegio Adventista de Chillán"
                    value={form.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  />
                </label>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <label className="erp-field">
                    <span>Correo Electrónico</span>
                    <input
                      type="email"
                      placeholder="contacto@libreria.cl"
                      value={form.correo}
                      onChange={(e) => setForm({ ...form, correo: e.target.value })}
                    />
                  </label>

                  <label className="erp-field">
                    <span>Teléfono</span>
                    <input
                      type="tel"
                      placeholder="+56 9 1234 5678"
                      value={form.telefono}
                      onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                    />
                  </label>
                </div>

                <label className="erp-field">
                  <span>Dirección Comercial</span>
                  <input
                    type="text"
                    placeholder="Calle, Número, Comuna, Ciudad"
                    value={form.direccion}
                    onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                  />
                </label>

                <label className="erp-field">
                  <span>Límite de Crédito Autorizado (CLP)</span>
                  <input
                    type="number"
                    min="0"
                    step="10000"
                    value={form.limite_credito}
                    onChange={(e) => setForm({ ...form, limite_credito: Number(e.target.value) })}
                  />
                </label>

                {error && <div className="erp-alert-error">{error}</div>}

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem" }}>
                  <button type="button" className="erp-button erp-button-secondary" onClick={() => setModalAbierto(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="erp-button erp-button-primary" disabled={guardando}>
                    {guardando ? "Guardando..." : "Guardar Cliente"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </ErpModuleShell>
  );
}
