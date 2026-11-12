"use client";

import { useEffect, useState } from "react";
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

export default function PromocionesPage() {
  const { usuario, loading } = useAuth();
  const puedeEditar = moduleAccessLevel(usuario, "ventas") >= 2;

  const [promociones, setPromociones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  // Modal Crear / Editar
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState({
    id_promocion: 0,
    nombre: "",
    descripcion: "",
    tipo: "porcentaje",
    valor: 10,
    categoria: "",
    isbn: "",
    fecha_inicio: new Date().toISOString().slice(0, 10),
    fecha_fin: "2026-12-31",
    activo: true,
  });

  async function cargarPromociones() {
    setCargando(true);
    setError("");
    try {
      const res = await fetch("/api/ventas/promociones", { cache: "no-store" });
      const data = await res.json();
      setPromociones(data.promociones || []);
    } catch (err) {
      setError("No se pudieron cargar las promociones.");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    if (!loading && usuario) {
      cargarPromociones();
    }
  }, [loading, usuario]);

  async function toggleActivo(promo) {
    try {
      const res = await fetch("/api/ventas/promociones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle", id_promocion: promo.id_promocion, activo: !promo.activo }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error);
      cargarPromociones();
    } catch (err) {
      setError(err.message);
    }
  }

  function abrirModalNuevo() {
    setEditando(null);
    setForm({
      id_promocion: 0,
      nombre: "",
      descripcion: "",
      tipo: "porcentaje",
      valor: 10,
      categoria: "",
      isbn: "",
      fecha_inicio: new Date().toISOString().slice(0, 10),
      fecha_fin: "2026-12-31",
      activo: true,
    });
    setModalAbierto(true);
  }

  function abrirModalEditar(promo) {
    setEditando(promo);
    setForm({
      id_promocion: promo.id_promocion,
      nombre: promo.nombre,
      descripcion: promo.descripcion || "",
      tipo: promo.tipo || "porcentaje",
      valor: promo.valor || 0,
      categoria: promo.categoria || "",
      isbn: promo.isbn || "",
      fecha_inicio: promo.fecha_inicio || "",
      fecha_fin: promo.fecha_fin || "",
      activo: promo.activo,
    });
    setModalAbierto(true);
  }

  async function guardarPromocion(e) {
    e.preventDefault();
    if (!form.nombre || !form.fecha_inicio || !form.fecha_fin) {
      setError("Por favor completa los campos obligatorios.");
      return;
    }

    setGuardando(true);
    setError("");
    try {
      const res = await fetch("/api/ventas/promociones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error);
      setMensaje(data.mensaje || "Promoción guardada correctamente.");
      setModalAbierto(false);
      cargarPromociones();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  function exportarCsv() {
    const filas = [
      ["Nombre", "Descripción", "Tipo", "Valor / Beneficio", "Categoría / ISBN", "Fecha Inicio", "Fecha Fin", "Estado"],
      ...promociones.map((p) => [
        p.nombre,
        p.descripcion,
        p.tipo,
        p.tipo === "porcentaje" ? `${p.valor}%` : p.tipo === "2x1" ? "2x1" : formatMoney(p.valor),
        p.categoria || p.isbn || "Todo el catálogo",
        p.fecha_inicio,
        p.fecha_fin,
        p.activo ? "Activa" : "Inactiva",
      ]),
    ];
    const csvData = createCsv(filas);
    const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `promociones_ventas_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <ErpModuleShell
      usuario={usuario}
      module="ventas"
      title="Gestión de Promociones y Descuentos"
      description="Configuración de reglas comerciales: promociones 2x1 en sagas juveniles, convenios escolares y eventos."
      subnav={<VentasNav />}
      liveData={true}
    >
      <div className="ventas-report">
        {/* Resumen */}
        <div className="ventas-report-summary">
          <div className="ventas-report-summary-card">
            <span className="ventas-report-summary-label">Reglas Comerciales Totales</span>
            <strong>{promociones.length}</strong>
          </div>
          <div className="ventas-report-summary-card">
            <span className="ventas-report-summary-label">Promociones Activas en POS</span>
            <strong style={{ color: "#27ae60" }}>{promociones.filter((p) => p.activo).length} vigentes</strong>
          </div>
          <div className="ventas-report-summary-card">
            <span className="ventas-report-summary-label">Aplicación Automática</span>
            <strong>Tiempo Real en Caja</strong>
          </div>
        </div>

        {/* Barra superior */}
        <section className="erp-card ventas-report-filters">
          <div className="erp-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2>Catálogo de Promociones</h2>
              <p>Las reglas activas se aplican automáticamente en el Punto de Venta al coincidir con libros o categorías.</p>
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button type="button" className="erp-button erp-button-secondary" onClick={exportarCsv}>
                <ErpIcon name="trend" /> Exportar CSV
              </button>
              {puedeEditar && (
                <button type="button" className="erp-button erp-button-primary" onClick={abrirModalNuevo}>
                  <ErpIcon name="plus" /> Nueva Promoción
                </button>
              )}
            </div>
          </div>

          {error && <div className="erp-alert-error" style={{ marginTop: "1rem" }}>{error}</div>}
          {mensaje && <div className="ventas-message ventas-message-success" style={{ marginTop: "1rem" }}>{mensaje}</div>}
        </section>

        {/* Tabla */}
        <section className="erp-card ventas-report-table-card">
          <div className="ventas-report-table-wrapper">
            <table className="ventas-report-table">
              <thead>
                <tr>
                  <th>Promoción</th>
                  <th>Tipo</th>
                  <th>Beneficio</th>
                  <th>Alcance / Aplicación</th>
                  <th>Vigencia</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {cargando ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: "center", padding: "2rem" }}>Cargando reglas comerciales...</td>
                  </tr>
                ) : promociones.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: "center", padding: "2rem" }}>No hay promociones registradas.</td>
                  </tr>
                ) : (
                  promociones.map((p) => (
                    <tr key={p.id_promocion}>
                      <td>
                        <strong>{p.nombre}</strong>
                        {p.descripcion && <div style={{ fontSize: "0.8rem", color: "#666" }}>{p.descripcion}</div>}
                      </td>
                      <td>
                        <span className={`erp-badge ${p.tipo === "2x1" ? "erp-badge-yellow" : p.tipo === "porcentaje" ? "erp-badge-blue" : "erp-badge-green"}`} style={{ textTransform: "uppercase" }}>
                          {p.tipo}
                        </span>
                      </td>
                      <td>
                        <strong style={{ color: "#1a5c38" }}>
                          {p.tipo === "porcentaje"
                            ? `${p.valor}% desc.`
                            : p.tipo === "2x1"
                            ? "2x1 (Lleva 2, paga 1)"
                            : formatMoney(p.valor)}
                        </strong>
                      </td>
                      <td>
                        {p.libro_titulo ? (
                          <span>Libro: <b>{p.libro_titulo}</b></span>
                        ) : p.categoria ? (
                          <span>Categoría: <b>{p.categoria}</b></span>
                        ) : (
                          <span>Todo el Catálogo</span>
                        )}
                      </td>
                      <td>
                        <div style={{ fontSize: "0.85rem" }}>
                          {p.fecha_inicio} al {p.fecha_fin}
                        </div>
                      </td>
                      <td>
                        <span className={`erp-badge ${p.activo ? "erp-badge-green" : "erp-badge-gray"}`}>
                          {p.activo ? "Activa" : "Inactiva"}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "0.3rem" }}>
                          {puedeEditar && (
                            <>
                              <button
                                type="button"
                                className="erp-button erp-button-secondary"
                                style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem" }}
                                onClick={() => toggleActivo(p)}
                              >
                                {p.activo ? "Desactivar" : "Activar"}
                              </button>
                              <button
                                type="button"
                                className="erp-button erp-button-secondary"
                                style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem" }}
                                onClick={() => abrirModalEditar(p)}
                              >
                                Editar
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Modal Crear / Editar */}
        {modalAbierto && (
          <div className="erp-modal-overlay" style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center",
            justifyContent: "center", zIndex: 1000
          }}>
            <div className="erp-card" style={{ maxWidth: "540px", width: "90%", maxHeight: "90vh", overflowY: "auto" }}>
              <div className="erp-card-header" style={{ display: "flex", justifyContent: "space-between" }}>
                <h2>{editando ? "Editar Regla de Promoción" : "Nueva Regla de Promoción"}</h2>
                <button type="button" className="erp-icon-button" onClick={() => setModalAbierto(false)}>✕</button>
              </div>

              <form onSubmit={guardarPromocion} style={{ padding: "1.2rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
                <label className="erp-field">
                  <span>Nombre de la Promoción *</span>
                  <input
                    type="text"
                    required
                    placeholder="Ej. 2x1 Sagas Juveniles / Día del Libro"
                    value={form.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  />
                </label>

                <label className="erp-field">
                  <span>Descripción o Condiciones</span>
                  <input
                    type="text"
                    placeholder="Ej. Válido en compras sobre 2 unidades"
                    value={form.descripcion}
                    onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  />
                </label>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <label className="erp-field">
                    <span>Tipo de Beneficio *</span>
                    <select
                      value={form.tipo}
                      onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                    >
                      <option value="porcentaje">Porcentaje de Descuento (%)</option>
                      <option value="2x1">Promoción 2x1</option>
                      <option value="monto_fijo">Rebaja de Monto Fijo ($)</option>
                    </select>
                  </label>

                  <label className="erp-field">
                    <span>Valor del Descuento</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={form.valor}
                      disabled={form.tipo === "2x1"}
                      onChange={(e) => setForm({ ...form, valor: Number(e.target.value) })}
                    />
                  </label>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <label className="erp-field">
                    <span>Categoría Aplicable</span>
                    <select
                      value={form.categoria}
                      onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                    >
                      <option value="">Todas las categorías</option>
                      <option value="Novela">Novela</option>
                      <option value="Infantil">Infantil</option>
                      <option value="Clasicos">Clásicos</option>
                      <option value="Programacion">Programación</option>
                      <option value="Computacion">Computación</option>
                    </select>
                  </label>

                  <label className="erp-field">
                    <span>ISBN Específico (Opcional)</span>
                    <input
                      type="text"
                      placeholder="978..."
                      value={form.isbn}
                      onChange={(e) => setForm({ ...form, isbn: e.target.value })}
                    />
                  </label>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <label className="erp-field">
                    <span>Fecha Inicio *</span>
                    <input
                      type="date"
                      required
                      value={form.fecha_inicio}
                      onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })}
                    />
                  </label>

                  <label className="erp-field">
                    <span>Fecha Término *</span>
                    <input
                      type="date"
                      required
                      value={form.fecha_fin}
                      onChange={(e) => setForm({ ...form, fecha_fin: e.target.value })}
                    />
                  </label>
                </div>

                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={form.activo}
                    onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                  />
                  <span>Promoción Activa en POS</span>
                </label>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem" }}>
                  <button type="button" className="erp-button erp-button-secondary" onClick={() => setModalAbierto(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="erp-button erp-button-primary" disabled={guardando}>
                    {guardando ? "Guardando..." : "Guardar Promoción"}
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
