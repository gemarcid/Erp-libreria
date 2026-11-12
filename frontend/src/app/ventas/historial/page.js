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

export default function HistorialVentasPage() {
  const { usuario, loading } = useAuth();
  const puedeEditar = moduleAccessLevel(usuario, "ventas") >= 2;

  const [ventas, setVentas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  // Filtros
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [filtroTipoDoc, setFiltroTipoDoc] = useState("todos");
  const [filtroCanal, setFiltroCanal] = useState("todos");
  const [busqueda, setBusqueda] = useState("");

  // Modal Detalle
  const [ventaSeleccionada, setVentaSeleccionada] = useState(null);
  const [detalleData, setDetalleData] = useState(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  // Modal Nota de Crédito / Devolución
  const [modalNC, setModalNC] = useState(false);
  const [motivoNC, setMotivoNC] = useState("Devolución por cliente dentro de plazo");
  const [destinoFisico, setDestinoFisico] = useState("reingreso");
  const [procesandoNC, setProcesandoNC] = useState(false);

  async function cargarHistorial() {
    setCargando(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (desde) params.set("desde", desde);
      if (hasta) params.set("hasta", hasta);
      if (filtroEstado !== "todos") params.set("estado", filtroEstado);
      if (filtroTipoDoc !== "todos") params.set("tipo_documento", filtroTipoDoc);
      if (filtroCanal !== "todos") params.set("canal", filtroCanal);
      if (busqueda.trim()) params.set("buscar", busqueda.trim());

      const res = await fetch(`/api/ventas/historial?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo cargar el historial.");
      setVentas(data.ventas || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    if (!loading && usuario) {
      cargarHistorial();
    }
  }, [loading, usuario, filtroEstado, filtroTipoDoc, filtroCanal]);

  async function verDetalle(id) {
    setCargandoDetalle(true);
    setDetalleData(null);
    setVentaSeleccionada(id);
    try {
      const res = await fetch(`/api/ventas/historial/${id}`);
      const data = await res.json();
      if (data.success) {
        setDetalleData(data);
      }
    } catch {
    } finally {
      setCargandoDetalle(false);
    }
  }

  function abrirModalDevolucion(venta) {
    setDetalleData({ venta, items: venta.detalles || [] });
    setVentaSeleccionada(venta.id_venta);
    setMotivoNC("Devolución voluntaria del cliente");
    setDestinoFisico("reingreso");
    setModalNC(true);
  }

  async function emitirNotaCredito(e) {
    e.preventDefault();
    if (!ventaSeleccionada || !motivoNC) return;

    setProcesandoNC(true);
    setError("");
    setMensaje("");

    try {
      const res = await fetch("/api/ventas/notas-credito", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_venta: ventaSeleccionada,
          motivo: motivoNC,
          destino_fisico: destinoFisico,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "No se pudo emitir la nota de crédito.");
      }

      setMensaje(data.mensaje || `Nota de crédito emitida con éxito (${data.folio}).`);
      setModalNC(false);
      setVentaSeleccionada(null);
      cargarHistorial();
    } catch (err) {
      setError(err.message);
    } finally {
      setProcesandoNC(false);
    }
  }

  function exportarCsv() {
    const filas = [
      ["Folio", "Fecha", "Cliente", "RUT", "Tipo Documento", "Canal", "Forma Pago", "Total", "Estado"],
      ...ventas.map((v) => [
        v.folio,
        v.fecha,
        v.cliente_nombre,
        v.cliente_rut,
        v.tipo_documento,
        v.canal,
        v.forma_pago,
        v.total,
        v.estado,
      ]),
    ];
    const csvData = createCsv(filas);
    const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `historial_ventas_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const resumen = useMemo(() => {
    const pagadas = ventas.filter((v) => v.estado === "pagado");
    const pendientes = ventas.filter((v) => v.estado === "pendiente");
    const anuladas = ventas.filter((v) => v.estado === "anulado");
    const totalRecaudado = pagadas.reduce((a, b) => a + Number(b.total), 0);

    return {
      totalPagado: totalRecaudado,
      cantPagadas: pagadas.length,
      cantPendientes: pendientes.length,
      cantAnuladas: anuladas.length,
    };
  }, [ventas]);

  return (
    <ErpModuleShell
      usuario={usuario}
      module="ventas"
      title="Historial y Monitor de Ventas"
      description="Monitor de documentos tributarios emitidos, trazabilidad de cobros y emisión de notas de crédito."
      subnav={<VentasNav />}
      liveData={true}
    >
      <div className="ventas-report">
        {/* Resumen */}
        <div className="ventas-report-summary">
          <div className="ventas-report-summary-card">
            <span className="ventas-report-summary-label">Ventas Pagadas</span>
            <strong>{resumen.cantPagadas} ops ({formatMoney(resumen.totalPagado)})</strong>
          </div>
          <div className="ventas-report-summary-card">
            <span className="ventas-report-summary-label">Documentos a Crédito / Pendientes</span>
            <strong style={{ color: "#d97706" }}>{resumen.cantPendientes} doc(s)</strong>
          </div>
          <div className="ventas-report-summary-card">
            <span className="ventas-report-summary-label">Notas de Crédito / Anulaciones</span>
            <strong style={{ color: "#dc2626" }}>{resumen.cantAnuladas} doc(s)</strong>
          </div>
        </div>

        {/* Filtros */}
        <section className="erp-card ventas-report-filters">
          <div className="erp-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2>Filtros del Monitor</h2>
              <p>Consulta por rango de fechas, canal, comprobante o estado comercial.</p>
            </div>
            <button type="button" className="erp-button erp-button-secondary" onClick={exportarCsv}>
              <ErpIcon name="trend" /> Exportar CSV
            </button>
          </div>

          <div className="ventas-report-filter-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            <label className="erp-field">
              <span>Desde</span>
              <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </label>

            <label className="erp-field">
              <span>Hasta</span>
              <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </label>

            <label className="erp-field">
              <span>Estado</span>
              <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
                <option value="todos">Todos los estados</option>
                <option value="pagado">Pagado</option>
                <option value="pendiente">Pendiente (Crédito)</option>
                <option value="anulado">Anulado (Nota Crédito)</option>
              </select>
            </label>

            <label className="erp-field">
              <span>Comprobante</span>
              <select value={filtroTipoDoc} onChange={(e) => setFiltroTipoDoc(e.target.value)}>
                <option value="todos">Boletas y Facturas</option>
                <option value="boleta">Boleta</option>
                <option value="factura">Factura</option>
              </select>
            </label>

            <label className="erp-field">
              <span>Canal</span>
              <select value={filtroCanal} onChange={(e) => setFiltroCanal(e.target.value)}>
                <option value="todos">Todos los canales</option>
                <option value="tienda fisica">Tienda Física</option>
                <option value="tienda digital">Tienda Digital</option>
                <option value="retiro en tienda">Retiro en Tienda</option>
              </select>
            </label>
          </div>

          <div style={{ marginTop: "1rem", display: "flex", gap: "0.8rem", alignItems: "center" }}>
            <label className="erp-search" style={{ flex: 1 }}>
              <ErpIcon name="search" />
              <input
                type="search"
                placeholder="Buscar por Folio, Cliente o RUT..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </label>
            <button type="button" className="erp-button erp-button-secondary" onClick={cargarHistorial}>
              <ErpIcon name="sync" /> Filtrar
            </button>
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
                  <th>Folio</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Canal</th>
                  <th>Documento</th>
                  <th>Medio Pago</th>
                  <th>Total</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {cargando ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: "center", padding: "2rem" }}>
                      Cargando historial de transacciones...
                    </td>
                  </tr>
                ) : ventas.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: "center", padding: "2rem" }}>
                      No se encontraron registros de ventas con los filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  ventas.map((v) => {
                    const esAnulada = v.estado === "anulado";
                    const esPendiente = v.estado === "pendiente";

                    return (
                      <tr key={v.id_venta}>
                        <td><strong>{v.folio}</strong></td>
                        <td>{v.fecha}</td>
                        <td>
                          <strong>{v.cliente_nombre}</strong>
                          <div style={{ fontSize: "0.8rem", color: "#666" }}>{v.cliente_rut}</div>
                        </td>
                        <td style={{ textTransform: "capitalize" }}>{v.canal}</td>
                        <td>
                          <span className={`erp-badge ${v.tipo_documento === "factura" ? "erp-badge-blue" : "erp-badge-gray"}`} style={{ textTransform: "uppercase" }}>
                            {v.tipo_documento}
                          </span>
                        </td>
                        <td style={{ textTransform: "capitalize" }}>{v.forma_pago}</td>
                        <td><strong>{formatMoney(v.total)}</strong></td>
                        <td>
                          <span className={`erp-badge ${esAnulada ? "erp-badge-red" : esPendiente ? "erp-badge-yellow" : "erp-badge-green"}`} style={{ textTransform: "capitalize" }}>
                            {v.estado}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: "0.3rem" }}>
                            <button
                              type="button"
                              className="erp-button erp-button-secondary"
                              style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem" }}
                              onClick={() => verDetalle(v.id_venta)}
                            >
                              Detalle
                            </button>

                            {puedeEditar && !esAnulada && (
                              <button
                                type="button"
                                className="erp-button"
                                style={{
                                  padding: "0.25rem 0.5rem",
                                  fontSize: "0.8rem",
                                  color: "#dc2626",
                                  border: "1px solid #fca5a5",
                                  backgroundColor: "#fff",
                                }}
                                onClick={() => abrirModalDevolucion(v)}
                              >
                                Devolución
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Modal Detalle de Venta */}
        {ventaSeleccionada && !modalNC && (
          <div className="erp-modal-overlay" style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center",
            justifyContent: "center", zIndex: 1000
          }}>
            <div className="erp-card" style={{ maxWidth: "600px", width: "90%", maxHeight: "90vh", overflowY: "auto" }}>
              <div className="erp-card-header" style={{ display: "flex", justifyContent: "space-between" }}>
                <h2>Detalle de Documento #{ventaSeleccionada}</h2>
                <button type="button" className="erp-icon-button" onClick={() => setVentaSeleccionada(null)}>✕</button>
              </div>

              {cargandoDetalle || !detalleData ? (
                <div style={{ padding: "2rem", textAlign: "center" }}>Cargando desglose...</div>
              ) : (
                <div style={{ padding: "1.2rem" }}>
                  <div style={{ background: "#fdfbf7", padding: "1rem", borderRadius: "8px", border: "1px solid #e7e2d6", marginBottom: "1rem", fontSize: "0.9rem" }}>
                    <div><strong>Folio:</strong> {detalleData.venta?.folio}</div>
                    <div><strong>Cliente:</strong> {detalleData.venta?.cliente?.nombre} ({detalleData.venta?.cliente?.rut})</div>
                    <div><strong>Fecha:</strong> {detalleData.venta?.fecha}</div>
                    <div><strong>Canal:</strong> {detalleData.venta?.canal} · <strong>Forma de Pago:</strong> {detalleData.venta?.forma_pago}</div>
                    <div><strong>Estado:</strong> <span style={{ textTransform: "capitalize", fontWeight: "bold" }}>{detalleData.venta?.estado}</span></div>

                    {detalleData.nota_credito && (
                      <div style={{ marginTop: "0.5rem", padding: "0.5rem", background: "#fef2f2", color: "#991b1b", borderRadius: "4px" }}>
                        <strong>Nota de Crédito Asociada:</strong> {detalleData.nota_credito.folio} ({formatMoney(detalleData.nota_credito.monto)})
                        <br /><small>Motivo: {detalleData.nota_credito.motivo}</small>
                      </div>
                    )}
                  </div>

                  <h4>Artículos Comprados</h4>
                  <table className="ventas-report-table" style={{ marginTop: "0.5rem" }}>
                    <thead>
                      <tr>
                        <th>ISBN</th>
                        <th>Título</th>
                        <th>Cant</th>
                        <th>Precio</th>
                        <th>Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detalleData.items || []).map((it) => (
                        <tr key={it.id_detalle}>
                          <td>{it.isbn}</td>
                          <td><strong>{it.titulo}</strong></td>
                          <td>{it.cantidad}</td>
                          <td>{formatMoney(it.precio_unitario)}</td>
                          <td><strong>{formatMoney(it.subtotal)}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div style={{ textAlign: "right", marginTop: "1rem", fontSize: "1rem" }}>
                    <div>Neto: <strong>{formatMoney(detalleData.venta?.neto)}</strong></div>
                    <div>IVA (19%): <strong>{formatMoney(detalleData.venta?.iva)}</strong></div>
                    <div style={{ fontSize: "1.2rem", marginTop: "0.3rem" }}>
                      Total: <strong>{formatMoney(detalleData.venta?.total)}</strong>
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1.5rem" }}>
                    <button type="button" className="erp-button erp-button-secondary" onClick={() => setVentaSeleccionada(null)}>
                      Cerrar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal Emitir Nota de Crédito / Devolución */}
        {modalNC && (
          <div className="erp-modal-overlay" style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center",
            justifyContent: "center", zIndex: 1000
          }}>
            <div className="erp-card" style={{ maxWidth: "520px", width: "90%" }}>
              <div className="erp-card-header" style={{ display: "flex", justifyContent: "space-between" }}>
                <h2>Emitir Nota de Crédito / Devolución</h2>
                <button type="button" className="erp-icon-button" onClick={() => setModalNC(false)}>✕</button>
              </div>

              <form onSubmit={emitirNotaCredito} style={{ padding: "1.2rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
                <p style={{ fontSize: "0.9rem", color: "#666" }}>
                  Se anulará el documento de venta y se emitirá una nota de crédito formal por el importe total.
                </p>

                <label className="erp-field">
                  <span>Motivo de la Devolución o Anulación *</span>
                  <input
                    type="text"
                    required
                    value={motivoNC}
                    onChange={(e) => setMotivoNC(e.target.value)}
                    placeholder="Ej. Devolución por insatisfacción / Error de cobro"
                  />
                </label>

                <label className="erp-field">
                  <span>Destino Físico de los Ejemplares (Control de Inventario) *</span>
                  <select value={destinoFisico} onChange={(e) => setDestinoFisico(e.target.value)}>
                    <option value="reingreso">Reingreso a Stock Disponible (Ejemplar en perfecto estado)</option>
                    <option value="desecho">Desecho / Baja por Merma (Ejemplar dañado o defectuoso)</option>
                  </select>
                </label>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem" }}>
                  <button type="button" className="erp-button erp-button-secondary" onClick={() => setModalNC(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="erp-button erp-button-primary" style={{ backgroundColor: "#dc2626" }} disabled={procesandoNC}>
                    {procesandoNC ? "Emitiendo..." : "Confirmar Nota de Crédito"}
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
