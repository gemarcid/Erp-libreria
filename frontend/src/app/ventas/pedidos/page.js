"use client";

import { useEffect, useState, useMemo } from "react";
import ErpModuleShell from "@/components/ErpModuleShell";
import ErpIcon from "@/components/ErpIcon";
import { useAuth } from "@/components/AuthProvider";
import VentasNav from "@/components/VentasNav";
import { moduleAccessLevel } from "@/lib/module-access";
import { createCsv } from "@/lib/csv";
import { useRouter } from "next/navigation";

function formatMoney(value) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

export default function PedidosYReservasPage() {
  const { usuario, loading } = useAuth();
  const router = useRouter();
  const puedeEditar = moduleAccessLevel(usuario, "ventas") >= 2;

  const [pestaña, setPestaña] = useState("pedidos"); // "pedidos" | "reservas"

  // Pedidos
  const [pedidos, setPedidos] = useState([]);
  const [cargandoPedidos, setCargandoPedidos] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [busqueda, setBusqueda] = useState("");

  // Reservas
  const [reservas, setReservas] = useState([]);
  const [cargandoReservas, setCargandoReservas] = useState(true);
  const [filtroReserva, setFiltroReserva] = useState("todos");

  // Notificaciones
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  // Clientes y Libros para modal
  const [clientes, setClientes] = useState([]);
  const [catalogoLibros, setCatalogoLibros] = useState([]);

  // Modal Nuevo Pedido
  const [modalNuevoPedido, setModalNuevoPedido] = useState(false);
  const [formPedido, setFormPedido] = useState({
    id_cliente: 0,
    tipo: "pedido",
    lineas: [{ isbn: "", titulo: "", cantidad: 1, precio_unitario: 0 }],
  });
  const [guardandoPedido, setGuardandoPedido] = useState(false);

  // Modal Nueva Reserva
  const [modalNuevaReserva, setModalNuevaReserva] = useState(false);
  const [formReserva, setFormReserva] = useState({
    id_cliente: 0,
    isbn: "",
    cantidad: 1,
  });
  const [guardandoReserva, setGuardandoReserva] = useState(false);

  async function cargarPedidos() {
    setCargandoPedidos(true);
    try {
      const params = new URLSearchParams();
      if (filtroTipo !== "todos") params.set("tipo", filtroTipo);
      if (filtroEstado !== "todos") params.set("estado", filtroEstado);
      if (busqueda.trim()) params.set("buscar", busqueda.trim());

      const res = await fetch(`/api/ventas/pedidos?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      setPedidos(data.pedidos || []);
    } catch (err) {
      setError("No se pudieron cargar los pedidos.");
    } finally {
      setCargandoPedidos(false);
    }
  }

  async function cargarReservas() {
    setCargandoReservas(true);
    try {
      const params = new URLSearchParams();
      if (filtroReserva !== "todos") params.set("estado", filtroReserva);
      const res = await fetch(`/api/ventas/reservas?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      setReservas(data.reservas || []);
    } catch {
    } finally {
      setCargandoReservas(false);
    }
  }

  // Cargar datos auxiliares para creación
  useEffect(() => {
    async function cargarAux() {
      try {
        const [resCli, resLib] = await Promise.all([
          fetch("/api/ventas/clientes?completo=true"),
          fetch("/api/ventas/libros?buscar="),
        ]);
        const dataCli = await resCli.json();
        const dataLib = await resLib.json();
        setClientes(dataCli.clientes || []);
        setCatalogoLibros(Array.isArray(dataLib) ? dataLib : dataLib.libros || []);
      } catch {}
    }
    if (usuario) cargarAux();
  }, [usuario]);

  useEffect(() => {
    if (!loading && usuario) {
      if (pestaña === "pedidos") cargarPedidos();
      else cargarReservas();
    }
  }, [loading, usuario, pestaña, filtroTipo, filtroEstado, filtroReserva]);

  async function cambiarEstadoPedido(id_pedido, nuevo_estado) {
    setError("");
    try {
      const res = await fetch("/api/ventas/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cambiar_estado", id_pedido, nuevo_estado }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error);
      setMensaje(data.mensaje || "Estado actualizado.");
      cargarPedidos();
    } catch (err) {
      setError(err.message);
    }
  }

  async function atenderReserva(id_reserva, nuevo_estado) {
    setError("");
    try {
      const res = await fetch("/api/ventas/reservas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "atender", id_reserva, nuevo_estado }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error);
      setMensaje("Reserva actualizada.");
      cargarReservas();
    } catch (err) {
      setError(err.message);
    }
  }

  async function guardarPedido(e) {
    e.preventDefault();
    if (!formPedido.id_cliente) {
      setError("Selecciona un cliente.");
      return;
    }
    const lineasValidas = formPedido.lineas.filter((l) => l.isbn && l.cantidad > 0);
    if (lineasValidas.length === 0) {
      setError("Agrega al menos un libro al pedido.");
      return;
    }

    setGuardandoPedido(true);
    setError("");
    try {
      const res = await fetch("/api/ventas/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_cliente: formPedido.id_cliente,
          tipo: formPedido.tipo,
          estado: "pendiente",
          detalles: lineasValidas.map((l) => ({
            isbn: l.isbn,
            cantidad: l.cantidad,
            precio_unitario: l.precio_unitario,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error);
      setMensaje(data.mensaje || "Pedido guardado con éxito.");
      setModalNuevoPedido(false);
      cargarPedidos();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardandoPedido(false);
    }
  }

  async function guardarReserva(e) {
    e.preventDefault();
    if (!formReserva.id_cliente || !formReserva.isbn) {
      setError("Selecciona un cliente y un libro.");
      return;
    }

    setGuardandoReserva(true);
    setError("");
    try {
      const res = await fetch("/api/ventas/reservas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formReserva),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error);
      setMensaje(data.mensaje || "Reserva creada.");
      setModalNuevaReserva(false);
      cargarReservas();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardandoReserva(false);
    }
  }

  function agregarLineaPedido() {
    setFormPedido((curr) => ({
      ...curr,
      lineas: [...curr.lineas, { isbn: "", titulo: "", cantidad: 1, precio_unitario: 0 }],
    }));
  }

  function cambiarLineaLibro(index, isbn) {
    const libro = catalogoLibros.find((l) => l.isbn === isbn);
    setFormPedido((curr) => {
      const copy = [...curr.lineas];
      copy[index] = {
        isbn,
        titulo: libro ? libro.titulo : "",
        cantidad: copy[index].cantidad || 1,
        precio_unitario: libro ? Number(libro.precio_venta) : 0,
      };
      return { ...curr, lineas: copy };
    });
  }

  function exportarCsvPedidos() {
    const filas = [
      ["Nro Pedido", "Fecha", "Tipo", "Cliente", "RUT", "Tipo Cliente", "Total Estimado", "Estado"],
      ...pedidos.map((p) => [
        p.id_pedido,
        p.fecha,
        p.tipo,
        p.cliente_nombre,
        p.cliente_rut,
        p.cliente_tipo,
        p.total_estimado,
        p.estado,
      ]),
    ];
    const csvData = createCsv(filas);
    const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `pedidos_ventas_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <ErpModuleShell
      usuario={usuario}
      module="ventas"
      title="Cotizaciones, Pedidos Institucionales y Reservas"
      description="Gestión previa a facturación de pedidos de colegios y empresas, y reservas de libros agotados."
      subnav={<VentasNav />}
      liveData={true}
    >
      <div className="ventas-report">
        {/* Selector de pestañas */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.2rem" }}>
          <button
            type="button"
            className={`erp-button ${pestaña === "pedidos" ? "erp-button-primary" : "erp-button-secondary"}`}
            onClick={() => setPestaña("pedidos")}
          >
            <ErpIcon name="book" /> Cotizaciones y Pedidos ({pedidos.length})
          </button>
          <button
            type="button"
            className={`erp-button ${pestaña === "reservas" ? "erp-button-primary" : "erp-button-secondary"}`}
            onClick={() => setPestaña("reservas")}
          >
            <ErpIcon name="clipboard" /> Reservas de Libros Agotados ({reservas.length})
          </button>
        </div>

        {error && <div className="erp-alert-error" style={{ marginBottom: "1rem" }}>{error}</div>}
        {mensaje && <div className="ventas-message ventas-message-success" style={{ marginBottom: "1rem" }}>{mensaje}</div>}

        {/* ---------------- PESTAÑA PEDIDOS Y COTIZACIONES ---------------- */}
        {pestaña === "pedidos" && (
          <>
            <section className="erp-card ventas-report-filters">
              <div className="erp-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h2>Monitor de Pedidos y Cotizaciones</h2>
                  <p>Administra cotizaciones de clientes y encomiendas institucionales antes de su facturación.</p>
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button type="button" className="erp-button erp-button-secondary" onClick={exportarCsvPedidos}>
                    <ErpIcon name="trend" /> Exportar CSV
                  </button>
                  {puedeEditar && (
                    <button
                      type="button"
                      className="erp-button erp-button-primary"
                      onClick={() => setModalNuevoPedido(true)}
                    >
                      <ErpIcon name="plus" /> Nueva Cotización / Pedido
                    </button>
                  )}
                </div>
              </div>

              <div className="ventas-report-filter-grid">
                <label className="erp-field">
                  <span>Tipo de Documento</span>
                  <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
                    <option value="todos">Todos los tipos</option>
                    <option value="cotizacion">Cotización</option>
                    <option value="pedido">Pedido Institucional</option>
                  </select>
                </label>

                <label className="erp-field">
                  <span>Estado</span>
                  <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
                    <option value="todos">Todos los estados</option>
                    <option value="pendiente">Pendiente</option>
                    <option value="aceptado">Aceptado</option>
                    <option value="facturado">Facturado</option>
                    <option value="vencido">Vencido</option>
                  </select>
                </label>

                <label className="erp-field">
                  <span>Buscar por Cliente o RUT</span>
                  <input
                    type="search"
                    placeholder="Ej. San Buenaventura"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                  />
                </label>

                <div className="ventas-report-filter-actions" style={{ alignSelf: "flex-end" }}>
                  <button type="button" className="erp-button erp-button-secondary" onClick={cargarPedidos}>
                    <ErpIcon name="sync" /> Actualizar
                  </button>
                </div>
              </div>
            </section>

            <section className="erp-card ventas-report-table-card">
              <div className="ventas-report-table-wrapper">
                <table className="ventas-report-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Fecha</th>
                      <th>Tipo</th>
                      <th>Cliente</th>
                      <th>Ítems</th>
                      <th>Total Estimado</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cargandoPedidos ? (
                      <tr>
                        <td colSpan="8" style={{ textAlign: "center", padding: "2rem" }}>Cargando pedidos...</td>
                      </tr>
                    ) : pedidos.length === 0 ? (
                      <tr>
                        <td colSpan="8" style={{ textAlign: "center", padding: "2rem" }}>No se registran pedidos.</td>
                      </tr>
                    ) : (
                      pedidos.map((p) => (
                        <tr key={p.id_pedido}>
                          <td><strong>#{p.id_pedido}</strong></td>
                          <td>{p.fecha}</td>
                          <td>
                            <span className={`erp-badge ${p.tipo === "pedido" ? "erp-badge-blue" : "erp-badge-gray"}`} style={{ textTransform: "capitalize" }}>
                              {p.tipo}
                            </span>
                          </td>
                          <td>
                            <strong>{p.cliente_nombre}</strong>
                            <div style={{ fontSize: "0.8rem", color: "#666" }}>{p.cliente_rut} · {p.cliente_tipo}</div>
                          </td>
                          <td>{p.items_count} producto(s)</td>
                          <td><strong>{formatMoney(p.total_estimado)}</strong></td>
                          <td>
                            <span className={`erp-badge ${p.estado === "facturado" ? "erp-badge-green" : p.estado === "aceptado" ? "erp-badge-blue" : p.estado === "vencido" ? "erp-badge-red" : "erp-badge-yellow"}`} style={{ textTransform: "capitalize" }}>
                              {p.estado}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: "0.3rem" }}>
                              {puedeEditar && p.estado === "pendiente" && (
                                <button
                                  type="button"
                                  className="erp-button erp-button-secondary"
                                  style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem" }}
                                  onClick={() => cambiarEstadoPedido(p.id_pedido, "aceptado")}
                                >
                                  Aceptar
                                </button>
                              )}

                              {puedeEditar && (p.estado === "pendiente" || p.estado === "aceptado") && (
                                <button
                                  type="button"
                                  className="erp-button erp-button-primary"
                                  style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem" }}
                                  onClick={() => router.push(`/ventas`)}
                                  title="Facturar en el Punto de Venta"
                                >
                                  Facturar en POS
                                </button>
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
          </>
        )}

        {/* ---------------- PESTAÑA RESERVAS ---------------- */}
        {pestaña === "reservas" && (
          <>
            <section className="erp-card ventas-report-filters">
              <div className="erp-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h2>Reservas de Libros Agotados (CU-V10)</h2>
                  <p>Registro de ejemplares solicitados por clientes cuando no hay stock inmediato disponible.</p>
                </div>
                {puedeEditar && (
                  <button
                    type="button"
                    className="erp-button erp-button-primary"
                    onClick={() => setModalNuevaReserva(true)}
                  >
                    <ErpIcon name="plus" /> Registrar Nueva Reserva
                  </button>
                )}
              </div>

              <div className="ventas-report-filter-grid">
                <label className="erp-field">
                  <span>Filtrar Estado</span>
                  <select value={filtroReserva} onChange={(e) => setFiltroReserva(e.target.value)}>
                    <option value="todos">Todos los estados</option>
                    <option value="activa">Activa (Pendiente de reposición)</option>
                    <option value="atendida">Atendida (Entregada / Vendida)</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                </label>
              </div>
            </section>

            <section className="erp-card ventas-report-table-card">
              <div className="ventas-report-table-wrapper">
                <table className="ventas-report-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Fecha</th>
                      <th>Cliente</th>
                      <th>Teléfono</th>
                      <th>Libro Solicitado</th>
                      <th>Cant</th>
                      <th>Stock Actual</th>
                      <th>Estado</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cargandoReservas ? (
                      <tr>
                        <td colSpan="9" style={{ textAlign: "center", padding: "2rem" }}>Cargando reservas...</td>
                      </tr>
                    ) : reservas.length === 0 ? (
                      <tr>
                        <td colSpan="9" style={{ textAlign: "center", padding: "2rem" }}>No hay reservas registradas.</td>
                      </tr>
                    ) : (
                      reservas.map((r) => (
                        <tr key={r.id_reserva}>
                          <td><strong>#{r.id_reserva}</strong></td>
                          <td>{r.fecha}</td>
                          <td>
                            <strong>{r.cliente.nombre}</strong>
                            <div style={{ fontSize: "0.8rem", color: "#666" }}>{r.cliente.rut}</div>
                          </td>
                          <td>{r.cliente.telefono || "Sin teléfono"}</td>
                          <td>
                            <strong>{r.libro.titulo}</strong>
                            <div style={{ fontSize: "0.8rem", color: "#666" }}>ISBN: {r.libro.isbn} · {r.libro.autor}</div>
                          </td>
                          <td><strong>{r.cantidad}</strong></td>
                          <td>
                            <span style={{ fontWeight: "bold", color: r.libro.stock_actual > 0 ? "#27ae60" : "#c0392b" }}>
                              {r.libro.stock_actual} disp.
                            </span>
                          </td>
                          <td>
                            <span className={`erp-badge ${r.estado === "atendida" ? "erp-badge-green" : r.estado === "cancelada" ? "erp-badge-red" : "erp-badge-yellow"}`} style={{ textTransform: "capitalize" }}>
                              {r.estado}
                            </span>
                          </td>
                          <td>
                            {puedeEditar && r.estado === "activa" && (
                              <button
                                type="button"
                                className="erp-button erp-button-secondary"
                                style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem" }}
                                onClick={() => atenderReserva(r.id_reserva, "atendida")}
                              >
                                Marcar Atendida
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
          </>
        )}

        {/* Modal Nuevo Pedido */}
        {modalNuevoPedido && (
          <div className="erp-modal-overlay" style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center",
            justifyContent: "center", zIndex: 1000
          }}>
            <div className="erp-card" style={{ maxWidth: "620px", width: "90%", maxHeight: "90vh", overflowY: "auto" }}>
              <div className="erp-card-header" style={{ display: "flex", justifyContent: "space-between" }}>
                <h2>Registrar Cotización o Pedido Institucional</h2>
                <button type="button" className="erp-icon-button" onClick={() => setModalNuevoPedido(false)}>✕</button>
              </div>

              <form onSubmit={guardarPedido} style={{ padding: "1.2rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <label className="erp-field">
                    <span>Cliente *</span>
                    <select
                      required
                      value={formPedido.id_cliente}
                      onChange={(e) => setFormPedido({ ...formPedido, id_cliente: Number(e.target.value) })}
                    >
                      <option value="0">Seleccionar cliente...</option>
                      {clientes.map((c) => (
                        <option key={c.id_cliente} value={c.id_cliente}>
                          {c.nombre} ({c.rut})
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="erp-field">
                    <span>Tipo *</span>
                    <select
                      value={formPedido.tipo}
                      onChange={(e) => setFormPedido({ ...formPedido, tipo: e.target.value })}
                    >
                      <option value="cotizacion">Cotización Formal</option>
                      <option value="pedido">Pedido Institucional (Colegio / Empresa)</option>
                    </select>
                  </label>
                </div>

                <h4>Líneas de Libros</h4>
                {formPedido.lineas.map((linea, idx) => (
                  <div key={idx} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: "0.5rem", alignItems: "center" }}>
                    <select
                      value={linea.isbn}
                      onChange={(e) => cambiarLineaLibro(idx, e.target.value)}
                      required
                    >
                      <option value="">Seleccionar libro...</option>
                      {catalogoLibros.map((l) => (
                        <option key={l.isbn} value={l.isbn}>
                          {l.titulo} ({formatMoney(l.precio_venta)})
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      min="1"
                      placeholder="Cant"
                      value={linea.cantidad}
                      onChange={(e) => {
                        const copy = [...formPedido.lineas];
                        copy[idx].cantidad = Number(e.target.value);
                        setFormPedido({ ...formPedido, lineas: copy });
                      }}
                    />

                    <input
                      type="number"
                      placeholder="Precio Pactado"
                      value={linea.precio_unitario}
                      onChange={(e) => {
                        const copy = [...formPedido.lineas];
                        copy[idx].precio_unitario = Number(e.target.value);
                        setFormPedido({ ...formPedido, lineas: copy });
                      }}
                    />

                    <button
                      type="button"
                      className="ventas-remove"
                      onClick={() => {
                        const copy = formPedido.lineas.filter((_, i) => i !== idx);
                        setFormPedido({ ...formPedido, lineas: copy });
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  className="erp-button erp-button-secondary"
                  style={{ alignSelf: "flex-start" }}
                  onClick={agregarLineaPedido}
                >
                  + Agregar Otro Libro
                </button>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem" }}>
                  <button type="button" className="erp-button erp-button-secondary" onClick={() => setModalNuevoPedido(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="erp-button erp-button-primary" disabled={guardandoPedido}>
                    {guardandoPedido ? "Guardando..." : "Registrar"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Nueva Reserva */}
        {modalNuevaReserva && (
          <div className="erp-modal-overlay" style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center",
            justifyContent: "center", zIndex: 1000
          }}>
            <div className="erp-card" style={{ maxWidth: "500px", width: "90%" }}>
              <div className="erp-card-header" style={{ display: "flex", justifyContent: "space-between" }}>
                <h2>Registrar Reserva de Libro Agotado</h2>
                <button type="button" className="erp-icon-button" onClick={() => setModalNuevaReserva(false)}>✕</button>
              </div>

              <form onSubmit={guardarReserva} style={{ padding: "1.2rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
                <label className="erp-field">
                  <span>Cliente Interesado *</span>
                  <select
                    required
                    value={formReserva.id_cliente}
                    onChange={(e) => setFormReserva({ ...formReserva, id_cliente: Number(e.target.value) })}
                  >
                    <option value="0">Seleccionar cliente...</option>
                    {clientes.map((c) => (
                      <option key={c.id_cliente} value={c.id_cliente}>
                        {c.nombre} ({c.rut})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="erp-field">
                  <span>Libro Solicitado *</span>
                  <select
                    required
                    value={formReserva.isbn}
                    onChange={(e) => setFormReserva({ ...formReserva, isbn: e.target.value })}
                  >
                    <option value="">Seleccionar libro agotado...</option>
                    {catalogoLibros.map((l) => (
                      <option key={l.isbn} value={l.isbn}>
                        {l.titulo} (Stock actual: {l.stock_actual})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="erp-field">
                  <span>Cantidad de Ejemplares *</span>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formReserva.cantidad}
                    onChange={(e) => setFormReserva({ ...formReserva, cantidad: Number(e.target.value) })}
                  />
                </label>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem" }}>
                  <button type="button" className="erp-button erp-button-secondary" onClick={() => setModalNuevaReserva(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="erp-button erp-button-primary" disabled={guardandoReserva}>
                    {guardandoReserva ? "Guardando..." : "Guardar Reserva"}
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
