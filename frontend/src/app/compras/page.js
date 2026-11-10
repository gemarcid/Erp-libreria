"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { moduleAccessLevel } from "@/lib/module-access";
import ErpModuleShell from "@/components/ErpModuleShell";
import ComprasNav from "@/components/ComprasNav";
import ErpIcon from "@/components/ErpIcon";
import {
  fetchProveedores,
  fetchOrdenesCompra,
  fetchOrdenCompraPorId,
  crearOrdenCompra,
  aprobarOrdenCompra,
  rechazarOrdenCompra,
  fetchLibrosParaCompra,
} from "@/lib/compras-api";

function formatMoney(value) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function hoyISO() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function OrdenesCompraPage() {
  const { usuario, loading: authLoading, error: authError } = useAuth();
  const router = useRouter();

  // Estados principales
  const [ordenes, setOrdenes] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [catalogoLibros, setCatalogoLibros] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorGeneral, setErrorGeneral] = useState("");

  // Filtros
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroProveedor, setFiltroProveedor] = useState("");
  const [filtroNumero, setFiltroNumero] = useState("");

  // Modal Detalle
  const [ordenSeleccionada, setOrdenSeleccionada] = useState(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [detalleError, setDetalleError] = useState("");
  const [procesandoAccion, setProcesandoAccion] = useState(false);

  // Modal Nueva Orden
  const [modalNuevoAbierto, setModalNuevoAbierto] = useState(false);
  const [formProveedorId, setFormProveedorId] = useState("");
  const [formFechaEntrega, setFormFechaEntrega] = useState("");
  const [lineas, setLineas] = useState([
    { isbn: "", cantidad: 1, precioPactado: 0, titulo: "", costoBase: 0 },
  ]);
  const [guardando, setGuardando] = useState(false);
  const [formError, setFormError] = useState("");

  // Redirección si no hay sesión
  useEffect(() => {
    if (!authLoading && !usuario && !authError) {
      router.replace("/login");
    }
  }, [authLoading, usuario, authError, router]);

  // Cargar datos auxiliares (proveedores y catálogo)
  useEffect(() => {
    if (!usuario) return;
    async function cargarAuxiliares() {
      try {
        const [provs, libros] = await Promise.all([
          fetchProveedores(),
          fetchLibrosParaCompra(),
        ]);
        setProveedores(provs);
        setCatalogoLibros(libros);
      } catch (err) {
        console.error("Error al cargar datos auxiliares:", err);
      }
    }
    cargarAuxiliares();
  }, [usuario]);

  // Cargar lista de órdenes con filtros
  const cargarOrdenes = useCallback(async () => {
    setCargando(true);
    setErrorGeneral("");
    try {
      const data = await fetchOrdenesCompra({
        estado: filtroEstado || undefined,
        proveedor: filtroProveedor ? parseInt(filtroProveedor, 10) : undefined,
        numero: filtroNumero ? parseInt(filtroNumero, 10) : undefined,
      });
      setOrdenes(data);
    } catch (err) {
      setErrorGeneral(err.message || "No se pudieron obtener las órdenes de compra.");
      setOrdenes([]);
    } finally {
      setCargando(false);
    }
  }, [filtroEstado, filtroProveedor, filtroNumero]);

  useEffect(() => {
    if (!usuario) return;
    const timer = setTimeout(() => {
      cargarOrdenes();
    }, 200);
    return () => clearTimeout(timer);
  }, [usuario, cargarOrdenes]);

  // Ver detalle de una orden
  async function verDetalle(idOc) {
    setCargandoDetalle(true);
    setDetalleError("");
    setOrdenSeleccionada({ idOc });
    try {
      const detalle = await fetchOrdenCompraPorId(idOc);
      setOrdenSeleccionada(detalle);
    } catch (err) {
      setDetalleError(err.message || "No se pudo cargar el detalle de la orden.");
    } finally {
      setCargandoDetalle(false);
    }
  }

  function cerrarDetalle() {
    if (procesandoAccion) return;
    setOrdenSeleccionada(null);
    setDetalleError("");
  }

  // Aprobar orden
  async function handleAprobar() {
    if (!ordenSeleccionada || procesandoAccion) return;
    const id = ordenSeleccionada.idOc || ordenSeleccionada.id_oc;
    const confirmar = window.confirm(
      `¿Confirmas que deseas APROBAR la orden de compra #${id}? Esta acción no se puede deshacer.`
    );
    if (!confirmar) return;

    setProcesandoAccion(true);
    setDetalleError("");
    try {
      await aprobarOrdenCompra(id);
      await verDetalle(id);
      cargarOrdenes();
    } catch (err) {
      setDetalleError(err.message || "Error al aprobar la orden de compra.");
    } finally {
      setProcesandoAccion(false);
    }
  }

  // Rechazar orden
  async function handleRechazar() {
    if (!ordenSeleccionada || procesandoAccion) return;
    const id = ordenSeleccionada.idOc || ordenSeleccionada.id_oc;
    const confirmar = window.confirm(
      `¿Confirmas que deseas RECHAZAR la orden de compra #${id}? Esta acción no se puede deshacer.`
    );
    if (!confirmar) return;

    setProcesandoAccion(true);
    setDetalleError("");
    try {
      await rechazarOrdenCompra(id);
      await verDetalle(id);
      cargarOrdenes();
    } catch (err) {
      setDetalleError(err.message || "Error al rechazar la orden de compra.");
    } finally {
      setProcesandoAccion(false);
    }
  }

  // Manejo de formulario nueva orden
  function abrirNuevaOrden() {
    setFormProveedorId("");
    setFormFechaEntrega(hoyISO());
    setLineas([
      { isbn: "", cantidad: 1, precioPactado: 0, titulo: "", costoBase: 0 },
    ]);
    setFormError("");
    setModalNuevoAbierto(true);
  }

  function cerrarNuevaOrden() {
    if (guardando) return;
    setModalNuevoAbierto(false);
    setFormError("");
  }

  function agregarLinea() {
    setLineas((prev) => [
      ...prev,
      { isbn: "", cantidad: 1, precioPactado: 0, titulo: "", costoBase: 0 },
    ]);
  }

  function quitarLinea(index) {
    if (lineas.length <= 1) return;
    setLineas((prev) => prev.filter((_, i) => i !== index));
  }

  function cambiarLibroEnLinea(index, isbn) {
    const libro = catalogoLibros.find((l) => l.isbn === isbn);
    setLineas((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        isbn: isbn,
        titulo: libro ? libro.titulo : "",
        costoBase: libro ? Number(libro.costoUnitario) : 0,
        precioPactado: libro ? Number(libro.costoUnitario) : copy[index].precioPactado,
      };
      return copy;
    });
  }

  function cambiarCantidadEnLinea(index, valor) {
    const cantidad = Math.max(1, parseInt(valor, 10) || 1);
    setLineas((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], cantidad };
      return copy;
    });
  }

  function cambiarPrecioEnLinea(index, valor) {
    const precioPactado = Math.max(0, parseFloat(valor) || 0);
    setLineas((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], precioPactado };
      return copy;
    });
  }

  // Cálculos en vivo para nueva orden
  const { totalNeto, totalIva, totalFinal } = useMemo(() => {
    let neto = 0;
    lineas.forEach((l) => {
      if (l.isbn && l.cantidad > 0 && l.precioPactado > 0) {
        neto += l.cantidad * l.precioPactado;
      }
    });
    const iva = Math.round(neto * 0.19);
    const final = neto + iva;
    return { totalNeto: neto, totalIva: iva, totalFinal: final };
  }, [lineas]);

  // Guardar nueva orden
  async function handleGuardarOrden(event) {
    event.preventDefault();
    setFormError("");

    if (!formProveedorId) {
      setFormError("Debes seleccionar un proveedor.");
      return;
    }

    if (!formFechaEntrega) {
      setFormError("La fecha estimada de entrega es obligatoria.");
      return;
    }

    if (formFechaEntrega < hoyISO()) {
      setFormError("La fecha de entrega no puede ser anterior a la fecha de hoy.");
      return;
    }

    if (lineas.length === 0) {
      setFormError("Debes incluir al menos un libro en la orden.");
      return;
    }

    const isbns = new Set();
    for (let i = 0; i < lineas.length; i++) {
      const l = lineas[i];
      if (!l.isbn) {
        setFormError(`La línea #${i + 1} no tiene ningún libro seleccionado.`);
        return;
      }
      if (isbns.has(l.isbn)) {
        setFormError(`El libro "${l.titulo || l.isbn}" está repetido en la orden. Ajusta la cantidad en una sola línea.`);
        return;
      }
      isbns.add(l.isbn);

      if (l.cantidad <= 0 || !Number.isInteger(Number(l.cantidad))) {
        setFormError(`La cantidad para "${l.titulo || l.isbn}" debe ser un número entero mayor a 0.`);
        return;
      }
      if (l.precioPactado <= 0) {
        setFormError(`El precio pactado para "${l.titulo || l.isbn}" debe ser mayor a 0.`);
        return;
      }
    }

    setGuardando(true);
    try {
      await crearOrdenCompra({
        idProveedor: parseInt(formProveedorId, 10),
        fechaEntrega: formFechaEntrega,
        lineas: lineas.map((l) => ({
          isbn: l.isbn,
          cantidad: parseInt(l.cantidad, 10),
          precioPactado: parseFloat(l.precioPactado),
        })),
      });

      setModalNuevoAbierto(false);
      await cargarOrdenes();
    } catch (err) {
      setFormError(err.message || "Error al crear la orden de compra.");
    } finally {
      setGuardando(false);
    }
  }

  const nivelCompras = moduleAccessLevel(usuario, "compras");
  const puedeAprobar = nivelCompras === 3;
  const puedeCrear = nivelCompras >= 2;

  function getBadgeClass(estado) {
    switch (estado?.toLowerCase()) {
      case "aprobada":
        return "success";
      case "recibida":
        return "neutral";
      case "rechazada":
        return "danger";
      case "pendiente":
      default:
        return "warning";
    }
  }

  return (
    <ErpModuleShell
      module="compras"
      title="Órdenes de Compra"
      description="Emisión, seguimiento y autorización de pedidos de adquisición a proveedores."
      liveData
      subnav={<ComprasNav />}
      actions={
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            type="button"
            className="module-secondary-button"
            onClick={cargarOrdenes}
            disabled={cargando}
          >
            Actualizar
          </button>
          {puedeCrear && (
            <button
              type="button"
              className="module-primary-button"
              onClick={abrirNuevaOrden}
              style={{
                backgroundColor: "var(--color-primary)",
                color: "#ffffff",
                border: "none",
                borderRadius: "7px",
                padding: "8px 16px",
                fontWeight: "600",
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              + Nueva orden
            </button>
          )}
        </div>
      }
    >
      <div className="inventory-screen" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {errorGeneral && (
          <p className="ventas-message ventas-message-error" role="alert">
            {errorGeneral}
          </p>
        )}

        {/* Panel de Filtros */}
        <section
          className="erp-card"
          aria-label="Filtros de búsqueda"
          style={{
            padding: "16px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "12px",
            alignItems: "center",
          }}
        >
          {/* Buscar por N° OC */}
          <div>
            <label
              htmlFor="filtro-numero"
              style={{ display: "block", fontSize: "11px", fontWeight: "600", marginBottom: "4px", color: "var(--color-text-muted)" }}
            >
              N° ORDEN DE COMPRA
            </label>
            <label className="erp-search" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <ErpIcon name="search" />
              <input
                id="filtro-numero"
                type="number"
                placeholder="Buscar por N° OC..."
                value={filtroNumero}
                onChange={(e) => setFiltroNumero(e.target.value)}
                style={{ width: "100%", border: "none", outline: "none", background: "transparent" }}
              />
            </label>
          </div>

          {/* Filtro por Proveedor */}
          <div>
            <label
              htmlFor="filtro-prov"
              style={{ display: "block", fontSize: "11px", fontWeight: "600", marginBottom: "4px", color: "var(--color-text-muted)" }}
            >
              PROVEEDOR
            </label>
            <select
              id="filtro-prov"
              value={filtroProveedor}
              onChange={(e) => setFiltroProveedor(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: "7px", border: "1px solid var(--color-border)" }}
            >
              <option value="">Todos los proveedores</option>
              {proveedores.map((p) => {
                const id = p.idProveedor || p.id_proveedor;
                const razon = p.razonSocial || p.razon_social;
                return (
                  <option key={id} value={id}>
                    {razon}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Filtro por Estado */}
          <div>
            <label
              htmlFor="filtro-est"
              style={{ display: "block", fontSize: "11px", fontWeight: "600", marginBottom: "4px", color: "var(--color-text-muted)" }}
            >
              ESTADO
            </label>
            <select
              id="filtro-est"
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: "7px", border: "1px solid var(--color-border)" }}
            >
              <option value="">Todos los estados</option>
              <option value="pendiente">Pendiente</option>
              <option value="aprobada">Aprobada</option>
              <option value="recibida">Recibida</option>
              <option value="rechazada">Rechazada</option>
            </select>
          </div>
        </section>

        {/* Tabla de órdenes */}
        <section className="erp-card inventory-table-panel" style={{ padding: "20px" }}>
          {cargando ? (
            <p className="erp-empty" role="status">
              Cargando órdenes de compra…
            </p>
          ) : (
            <>
              <div className="module-table-scroll" role="region" aria-label="Tabla de órdenes de compra" tabIndex={0}>
                <table className="module-table" style={{ width: "100%" }}>
                  <caption className="module-visually-hidden">Registro histórico de órdenes de compra</caption>
                  <thead>
                    <tr>
                      <th scope="col" style={{ width: "90px", textAlign: "left" }}>N° OC</th>
                      <th scope="col" style={{ textAlign: "left" }}>Proveedor</th>
                      <th scope="col" style={{ width: "120px", textAlign: "left" }}>Emisión</th>
                      <th scope="col" style={{ width: "120px", textAlign: "left" }}>Entrega</th>
                      <th scope="col" style={{ width: "130px", textAlign: "right" }}>Total</th>
                      <th scope="col" style={{ width: "120px", textAlign: "center" }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordenes.map((oc) => {
                      const id = oc.idOc || oc.id_oc;
                      const provNombre = oc.proveedorNombre || oc.razon_social;
                      const entrega = oc.fechaEntrega || oc.fecha_entrega;

                      return (
                        <tr
                          key={id}
                          onClick={() => verDetalle(id)}
                          style={{ cursor: "pointer" }}
                          title="Haz clic para ver el detalle de esta orden"
                        >
                          <td style={{ fontFamily: "monospace", fontWeight: "bold" }}>
                            #{id}
                          </td>
                          <td>
                            <strong>{provNombre}</strong>
                          </td>
                          <td style={{ color: "var(--color-text-muted)" }}>{oc.fecha}</td>
                          <td style={{ color: "var(--color-text-muted)" }}>
                            {entrega || "—"}
                          </td>
                          <td style={{ textAlign: "right", fontWeight: "600" }}>
                            {formatMoney(oc.total)}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <span className={`erp-status ${getBadgeClass(oc.estado)}`}>
                              {oc.estado}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {ordenes.length === 0 && (
                <p className="erp-empty" role="status" style={{ padding: "32px 0", textAlign: "center" }}>
                  No se encontraron órdenes de compra con los filtros aplicados.
                </p>
              )}
            </>
          )}
        </section>

        {/* Modal: Detalle de Orden de Compra */}
        {ordenSeleccionada && (
          <div
            className="module-modal-backdrop"
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              padding: "16px",
            }}
            onClick={cerrarDetalle}
          >
            <div
              className="erp-card"
              style={{
                width: "100%",
                maxWidth: "700px",
                padding: "28px",
                borderRadius: "12px",
                backgroundColor: "var(--color-surface-card)",
                maxHeight: "90vh",
                overflowY: "auto",
                boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  borderBottom: "1px solid var(--color-border)",
                  paddingBottom: "16px",
                  marginBottom: "20px",
                }}
              >
                <div>
                  <p className="erp-eyebrow">DETALLE DE COMPRA</p>
                  <h2 style={{ margin: "4px 0", fontSize: "20px" }}>
                    Orden de Compra #{ordenSeleccionada.idOc || ordenSeleccionada.id_oc}
                  </h2>
                  <div style={{ marginTop: "6px" }}>
                    <span className={`erp-status ${getBadgeClass(ordenSeleccionada.estado)}`}>
                      {ordenSeleccionada.estado}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={cerrarDetalle}
                  disabled={procesandoAccion}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: "22px",
                    cursor: "pointer",
                    color: "var(--color-text-muted)",
                  }}
                  aria-label="Cerrar modal"
                >
                  ✕
                </button>
              </div>

              {detalleError && (
                <p className="ventas-message ventas-message-error" role="alert" style={{ marginBottom: "16px" }}>
                  {detalleError}
                </p>
              )}

              {cargandoDetalle ? (
                <p className="erp-empty">Cargando líneas y desglose…</p>
              ) : (
                <>
                  {/* Encabezado informativo */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "12px",
                      backgroundColor: "var(--color-bg-app)",
                      padding: "16px",
                      borderRadius: "8px",
                      marginBottom: "20px",
                      fontSize: "13px",
                    }}
                  >
                    <div>
                      <span style={{ color: "var(--color-text-muted)", display: "block" }}>Proveedor:</span>
                      <strong>{ordenSeleccionada.proveedorNombre}</strong> ({ordenSeleccionada.proveedorRut || "—"})
                    </div>
                    <div>
                      <span style={{ color: "var(--color-text-muted)", display: "block" }}>Emisión:</span>
                      <strong>{ordenSeleccionada.fecha}</strong>
                    </div>
                    <div>
                      <span style={{ color: "var(--color-text-muted)", display: "block" }}>Entrega estimada:</span>
                      <strong>{ordenSeleccionada.fechaEntrega || "No definida"}</strong>
                    </div>
                    <div>
                      <span style={{ color: "var(--color-text-muted)", display: "block" }}>Creado por:</span>
                      <strong>{ordenSeleccionada.usuarioNombre || "—"}</strong>
                    </div>
                  </div>

                  {/* Tabla de líneas */}
                  <div className="module-table-scroll" style={{ marginBottom: "20px" }}>
                    <table className="module-table" style={{ width: "100%", fontSize: "13px" }}>
                      <thead>
                        <tr>
                          <th scope="col" style={{ textAlign: "left" }}>Libro / Título</th>
                          <th scope="col" style={{ width: "120px", textAlign: "left" }}>ISBN</th>
                          <th scope="col" style={{ width: "70px", textAlign: "right" }}>Cant.</th>
                          <th scope="col" style={{ width: "110px", textAlign: "right" }}>Precio P.</th>
                          <th scope="col" style={{ width: "120px", textAlign: "right" }}>Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(ordenSeleccionada.lineas || []).map((linea, idx) => (
                          <tr key={linea.idDetalleOc || idx}>
                            <td><strong>{linea.titulo}</strong></td>
                            <td style={{ fontFamily: "monospace", fontSize: "12px" }}>{linea.isbn}</td>
                            <td style={{ textAlign: "right" }}>{linea.cantidad}</td>
                            <td style={{ textAlign: "right" }}>{formatMoney(linea.precioPactado)}</td>
                            <td style={{ textAlign: "right", fontWeight: "600" }}>{formatMoney(linea.subtotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Desglose de totales */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                      gap: "6px",
                      borderTop: "1px solid var(--color-border)",
                      paddingTop: "12px",
                      marginBottom: "24px",
                    }}
                  >
                    <div style={{ display: "flex", width: "220px", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--color-text-muted)" }}>Subtotal Neto:</span>
                      <span>{formatMoney(ordenSeleccionada.neto)}</span>
                    </div>
                    <div style={{ display: "flex", width: "220px", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--color-text-muted)" }}>IVA (19%):</span>
                      <span>{formatMoney(ordenSeleccionada.iva)}</span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        width: "220px",
                        justifyContent: "space-between",
                        fontSize: "16px",
                        fontWeight: "bold",
                        color: "var(--color-primary)",
                        borderTop: "1px dashed var(--color-border)",
                        paddingTop: "6px",
                      }}
                    >
                      <span>Total OC:</span>
                      <span>{formatMoney(ordenSeleccionada.total)}</span>
                    </div>
                  </div>

                  {/* Acciones de aprobación / rechazo (requieren permiso total) */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      borderTop: "1px solid var(--color-border)",
                      paddingTop: "16px",
                    }}
                  >
                    <div>
                      {ordenSeleccionada.estado === "pendiente" && puedeAprobar ? (
                        <div style={{ display: "flex", gap: "10px" }}>
                          <button
                            type="button"
                            onClick={handleAprobar}
                            disabled={procesandoAccion}
                            style={{
                              backgroundColor: "#2e7d32",
                              color: "#fff",
                              border: "none",
                              padding: "8px 16px",
                              borderRadius: "7px",
                              fontWeight: "600",
                              cursor: procesandoAccion ? "not-allowed" : "pointer",
                            }}
                          >
                            ✓ Aprobar Orden
                          </button>
                          <button
                            type="button"
                            onClick={handleRechazar}
                            disabled={procesandoAccion}
                            style={{
                              backgroundColor: "#c62828",
                              color: "#fff",
                              border: "none",
                              padding: "8px 16px",
                              borderRadius: "7px",
                              fontWeight: "600",
                              cursor: procesandoAccion ? "not-allowed" : "pointer",
                            }}
                          >
                            ✕ Rechazar Orden
                          </button>
                        </div>
                      ) : ordenSeleccionada.estado === "pendiente" && !puedeAprobar ? (
                        <small style={{ color: "var(--color-text-muted)" }}>
                          * Se requiere perfil de Administrador para autorizar o rechazar esta orden.
                        </small>
                      ) : (
                        <small style={{ color: "var(--color-text-muted)" }}>
                          Esta orden ya fue {ordenSeleccionada.estado} y no admite cambios de estado.
                        </small>
                      )}
                    </div>

                    <button
                      type="button"
                      className="module-secondary-button"
                      onClick={cerrarDetalle}
                      disabled={procesandoAccion}
                    >
                      Cerrar
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Modal: Formulario Nueva Orden de Compra */}
        {modalNuevoAbierto && (
          <div
            className="module-modal-backdrop"
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              padding: "16px",
            }}
            onClick={cerrarNuevaOrden}
          >
            <div
              className="erp-card"
              style={{
                width: "100%",
                maxWidth: "850px",
                padding: "28px",
                borderRadius: "12px",
                backgroundColor: "var(--color-surface-card)",
                maxHeight: "92vh",
                overflowY: "auto",
                boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderBottom: "1px solid var(--color-border)",
                  paddingBottom: "14px",
                  marginBottom: "20px",
                }}
              >
                <div>
                  <p className="erp-eyebrow">EMISIÓN DE COMPRA</p>
                  <h2 style={{ margin: "4px 0 0", fontSize: "20px" }}>Nueva Orden de Compra</h2>
                </div>
                <button
                  type="button"
                  onClick={cerrarNuevaOrden}
                  disabled={guardando}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: "22px",
                    cursor: "pointer",
                    color: "var(--color-text-muted)",
                  }}
                  aria-label="Cerrar modal"
                >
                  ✕
                </button>
              </div>

              {formError && (
                <p className="ventas-message ventas-message-error" role="alert" style={{ marginBottom: "16px" }}>
                  {formError}
                </p>
              )}

              <form onSubmit={handleGuardarOrden}>
                {/* Cabecera de la orden */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "16px",
                    marginBottom: "24px",
                  }}
                >
                  <div>
                    <label
                      htmlFor="form-prov"
                      style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "6px" }}
                    >
                      Proveedor <span style={{ color: "var(--color-primary)" }}>*</span>
                    </label>
                    <select
                      id="form-prov"
                      value={formProveedorId}
                      onChange={(e) => setFormProveedorId(e.target.value)}
                      disabled={guardando}
                      required
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        borderRadius: "7px",
                        border: "1px solid var(--color-border)",
                      }}
                    >
                      <option value="">-- Selecciona un proveedor --</option>
                      {proveedores.map((p) => {
                        const id = p.idProveedor || p.id_proveedor;
                        const razon = p.razonSocial || p.razon_social;
                        return (
                          <option key={id} value={id}>
                            {razon} ({p.rut})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="form-fecha"
                      style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "6px" }}
                    >
                      Fecha estimada de entrega <span style={{ color: "var(--color-primary)" }}>*</span>
                    </label>
                    <input
                      id="form-fecha"
                      type="date"
                      min={hoyISO()}
                      value={formFechaEntrega}
                      onChange={(e) => setFormFechaEntrega(e.target.value)}
                      disabled={guardando}
                      required
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        borderRadius: "7px",
                        border: "1px solid var(--color-border)",
                      }}
                    />
                  </div>
                </div>

                {/* Líneas de productos */}
                <div style={{ marginBottom: "20px" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "10px",
                    }}
                  >
                    <h3 style={{ margin: 0, fontSize: "15px" }}>Líneas de la Orden</h3>
                    <button
                      type="button"
                      className="module-secondary-button"
                      onClick={agregarLinea}
                      disabled={guardando}
                      style={{ fontSize: "12px", padding: "5px 12px" }}
                    >
                      + Agregar libro
                    </button>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {lineas.map((linea, index) => {
                      const subtotalFila = linea.cantidad * linea.precioPactado;

                      return (
                        <div
                          key={index}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "3fr 1fr 1.5fr 1.5fr auto",
                            gap: "10px",
                            alignItems: "center",
                            backgroundColor: "var(--color-bg-app)",
                            padding: "10px 14px",
                            borderRadius: "8px",
                          }}
                        >
                          {/* Selector de libro */}
                          <div>
                            <select
                              value={linea.isbn}
                              onChange={(e) => cambiarLibroEnLinea(index, e.target.value)}
                              disabled={guardando}
                              required
                              style={{
                                width: "100%",
                                padding: "8px",
                                borderRadius: "6px",
                                border: "1px solid var(--color-border)",
                                fontSize: "12px",
                              }}
                            >
                              <option value="">-- Seleccionar Libro --</option>
                              {catalogoLibros.map((b) => (
                                <option key={b.isbn} value={b.isbn}>
                                  {b.titulo} ({b.isbn}) — Costo: {formatMoney(b.costoUnitario)}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Cantidad */}
                          <div>
                            <input
                              type="number"
                              min="1"
                              placeholder="Cant."
                              value={linea.cantidad}
                              onChange={(e) => cambiarCantidadEnLinea(index, e.target.value)}
                              disabled={guardando}
                              required
                              style={{
                                width: "100%",
                                padding: "8px",
                                borderRadius: "6px",
                                border: "1px solid var(--color-border)",
                                textAlign: "right",
                                fontSize: "12px",
                              }}
                            />
                          </div>

                          {/* Precio pactado */}
                          <div>
                            <input
                              type="number"
                              min="1"
                              step="any"
                              placeholder="Precio pactado"
                              value={linea.precioPactado}
                              onChange={(e) => cambiarPrecioEnLinea(index, e.target.value)}
                              disabled={guardando}
                              required
                              style={{
                                width: "100%",
                                padding: "8px",
                                borderRadius: "6px",
                                border: "1px solid var(--color-border)",
                                textAlign: "right",
                                fontSize: "12px",
                              }}
                            />
                          </div>

                          {/* Subtotal fila */}
                          <div style={{ textAlign: "right", fontWeight: "600", fontSize: "13px" }}>
                            {formatMoney(subtotalFila)}
                          </div>

                          {/* Quitar fila */}
                          <div>
                            <button
                              type="button"
                              onClick={() => quitarLinea(index)}
                              disabled={guardando || lineas.length <= 1}
                              style={{
                                background: "none",
                                border: "none",
                                color: lineas.length <= 1 ? "#ccc" : "#c62828",
                                cursor: lineas.length <= 1 ? "not-allowed" : "pointer",
                                fontSize: "16px",
                              }}
                              title="Quitar línea"
                            >
                              🗑
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Resumen de totales en vivo */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: "6px",
                    borderTop: "1px solid var(--color-border)",
                    paddingTop: "12px",
                    marginBottom: "20px",
                  }}
                >
                  <div style={{ display: "flex", width: "240px", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--color-text-muted)" }}>Subtotal Neto:</span>
                    <span>{formatMoney(totalNeto)}</span>
                  </div>
                  <div style={{ display: "flex", width: "240px", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--color-text-muted)" }}>IVA (19%):</span>
                    <span>{formatMoney(totalIva)}</span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      width: "240px",
                      justifyContent: "space-between",
                      fontSize: "17px",
                      fontWeight: "bold",
                      color: "var(--color-primary)",
                      borderTop: "1px dashed var(--color-border)",
                      paddingTop: "6px",
                    }}
                  >
                    <span>Total Estimado:</span>
                    <span>{formatMoney(totalFinal)}</span>
                  </div>
                </div>

                {/* Botones de acción */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "12px",
                    borderTop: "1px solid var(--color-border)",
                    paddingTop: "16px",
                  }}
                >
                  <button
                    type="button"
                    className="module-secondary-button"
                    onClick={cerrarNuevaOrden}
                    disabled={guardando}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="module-primary-button"
                    disabled={guardando}
                    style={{
                      backgroundColor: "var(--color-primary)",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "7px",
                      padding: "8px 24px",
                      fontWeight: "600",
                      fontSize: "13px",
                      cursor: guardando ? "not-allowed" : "pointer",
                      opacity: guardando ? 0.7 : 1,
                    }}
                  >
                    {guardando ? "Emitiendo orden…" : "Guardar orden"}
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
