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
  fetchProveedoresActivos,
  fetchOrdenesCompra,
  fetchOrdenCompraPorId,
  crearOrdenCompra,
  enviarOrdenCompraProveedor,
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

function crearLineaVacia() {
  return {
    isbn: "",
    titulo: "",
    cantidad: 1,
    precioPactado: 0,
    ivaPorcentaje: 19,
    costoBase: 0,
  };
}

export default function OrdenesCompraPage() {
  const { usuario, loading: authLoading, error: authError } = useAuth();
  const router = useRouter();

  // Estados principales
  const [ordenes, setOrdenes] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [proveedoresActivos, setProveedoresActivos] = useState([]);
  const [catalogoLibros, setCatalogoLibros] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorGeneral, setErrorGeneral] = useState("");
  const [mensajeConfirmacion, setMensajeConfirmacion] = useState("");

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
  const [formFechaEmision, setFormFechaEmision] = useState(hoyISO());
  const [formFechaEntrega, setFormFechaEntrega] = useState("");
  const [lineas, setLineas] = useState([crearLineaVacia()]);
  const [guardando, setGuardando] = useState(false);
  const [formError, setFormError] = useState("");
  const [erroresCampos, setErroresCampos] = useState({
    proveedor: "",
    fechaEntrega: "",
    lineas: {},
  });

  // Redirección si no hay sesión
  useEffect(() => {
    if (!authLoading && !usuario && !authError) {
      router.replace("/login");
    }
  }, [authLoading, usuario, authError, router]);

  // Cargar datos auxiliares desde la base de datos (proveedores, proveedores activos y catálogo de libros)
  const cargarAuxiliares = useCallback(async () => {
    if (!usuario) return;
    try {
      const [todosProvs, provsActivos, libros] = await Promise.all([
        fetchProveedores(),
        fetchProveedoresActivos(),
        fetchLibrosParaCompra(),
      ]);
      setProveedores(todosProvs);
      setProveedoresActivos(
        provsActivos.filter((p) => p.activo !== false)
      );
      setCatalogoLibros(libros);
    } catch (err) {
      console.error("Error al cargar datos auxiliares:", err);
    }
  }, [usuario]);

  useEffect(() => {
    cargarAuxiliares();
  }, [cargarAuxiliares]);

  // Cargar lista de órdenes con filtros desde la base de datos
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
  async function abrirNuevaOrden() {
    const hoy = hoyISO();
    setFormProveedorId("");
    setFormFechaEmision(hoy);
    setFormFechaEntrega(hoy);
    setLineas([crearLineaVacia()]);
    setFormError("");
    setErroresCampos({ proveedor: "", fechaEntrega: "", lineas: {} });
    setModalNuevoAbierto(true);
    await cargarAuxiliares();
  }

  function cerrarNuevaOrden() {
    if (guardando) return;
    setModalNuevoAbierto(false);
    setFormError("");
    setErroresCampos({ proveedor: "", fechaEntrega: "", lineas: {} });
  }

  function limpiarErrorLinea(index, campo) {
    setErroresCampos((prev) => {
      if (!prev.lineas || !prev.lineas[index] || !prev.lineas[index][campo]) {
        return prev;
      }
      const nuevasLineas = { ...prev.lineas };
      nuevasLineas[index] = { ...nuevasLineas[index], [campo]: "" };
      return { ...prev, lineas: nuevasLineas };
    });
  }

  function agregarLinea() {
    setLineas((prev) => [...prev, crearLineaVacia()]);
  }

  function quitarLinea(index) {
    if (lineas.length <= 1) return;
    setLineas((prev) => prev.filter((_, i) => i !== index));
    setErroresCampos((prev) => {
      const nuevasLineas = {};
      Object.entries(prev.lineas || {}).forEach(([k, val]) => {
        const idx = Number(k);
        if (idx < index) nuevasLineas[idx] = val;
        else if (idx > index) nuevasLineas[idx - 1] = val;
      });
      return { ...prev, lineas: nuevasLineas };
    });
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
    limpiarErrorLinea(index, "isbn");
    limpiarErrorLinea(index, "precioPactado");
  }

  function cambiarCantidadEnLinea(index, valor) {
    setLineas((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], cantidad: valor };
      return copy;
    });
    limpiarErrorLinea(index, "cantidad");
  }

  function cambiarPrecioEnLinea(index, valor) {
    setLineas((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], precioPactado: valor };
      return copy;
    });
    limpiarErrorLinea(index, "precioPactado");
  }

  function cambiarIvaEnLinea(index, valor) {
    setLineas((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ivaPorcentaje: valor };
      return copy;
    });
    limpiarErrorLinea(index, "ivaPorcentaje");
  }

  // Cálculos en tiempo real para nueva orden (Neto, IVA y Total)
  const { totalNeto, totalIva, totalFinal } = useMemo(() => {
    let neto = 0;
    let ivaExacto = 0;
    lineas.forEach((l) => {
      const cant = Number(l.cantidad);
      const precio = Number(l.precioPactado);
      const ivaPct = l.ivaPorcentaje === "" ? 0 : Number(l.ivaPorcentaje);
      if (l.isbn && Number.isFinite(cant) && cant > 0 && Number.isFinite(precio) && precio > 0) {
        const subtotalLinea = Math.round(cant * precio);
        neto += subtotalLinea;
        if (Number.isFinite(ivaPct) && ivaPct >= 0) {
          ivaExacto += subtotalLinea * (ivaPct / 100);
        }
      }
    });
    const iva = Math.round(ivaExacto);
    const final = neto + iva;
    return { totalNeto: neto, totalIva: iva, totalFinal: final };
  }, [lineas]);

  // Validación integral en pantalla resaltando cada campo con error
  function validarFormularioOrden() {
    const hoy = hoyISO();
    const nuevosErrores = {
      proveedor: "",
      fechaEntrega: "",
      lineas: {},
    };
    const mensajes = [];

    // 1. Validar proveedor obligatorio y activo en catálogo
    if (!formProveedorId) {
      nuevosErrores.proveedor = "Selecciona un proveedor activo del catálogo.";
      mensajes.push("Debes seleccionar un proveedor.");
    } else {
      const provEncontrado = proveedoresActivos.find(
        (p) => String(p.idProveedor ?? p.id_proveedor) === String(formProveedorId)
      );
      if (!provEncontrado || provEncontrado.activo === false) {
        nuevosErrores.proveedor = "El proveedor seleccionado no existe o está inactivo.";
        mensajes.push("El proveedor seleccionado está inactivo o no es válido.");
      }
    }

    // 2. Validar fecha de entrega obligatoria y >= fecha actual
    if (!formFechaEntrega) {
      nuevosErrores.fechaEntrega = "La fecha de entrega es obligatoria.";
      mensajes.push("Debes indicar la fecha de entrega.");
    } else if (formFechaEntrega < hoy) {
      nuevosErrores.fechaEntrega = `No puede ser anterior a hoy (${hoy}).`;
      mensajes.push("La fecha de entrega no puede ser anterior a la fecha actual.");
    }

    // 3. Validar líneas de productos
    if (!lineas || lineas.length === 0) {
      mensajes.push("Debes agregar al menos una línea de producto.");
    } else {
      const isbnsVistos = new Map();

      lineas.forEach((l, idx) => {
        const errLinea = {};
        const numFila = idx + 1;

        if (!l.isbn || !String(l.isbn).trim()) {
          errLinea.isbn = "Selecciona un producto del catálogo.";
          mensajes.push(`Línea #${numFila}: falta seleccionar el producto.`);
        } else {
          const isbnNorm = String(l.isbn).trim();
          if (isbnsVistos.has(isbnNorm)) {
            errLinea.isbn = "Producto repetido en la orden.";
            const filaPrevia = isbnsVistos.get(isbnNorm);
            mensajes.push(
              `Línea #${numFila}: el producto "${l.titulo || isbnNorm}" ya está en la línea #${filaPrevia}.`
            );
          } else {
            isbnsVistos.set(isbnNorm, numFila);
          }
        }

        const cantNum = Number(l.cantidad);
        if (
          l.cantidad === "" ||
          l.cantidad === null ||
          !Number.isFinite(cantNum) ||
          !Number.isInteger(cantNum) ||
          cantNum <= 0
        ) {
          errLinea.cantidad = "Debe ser entero > 0.";
          mensajes.push(`Línea #${numFila}: la cantidad debe ser un número entero mayor a 0.`);
        }

        const precioNum = Number(l.precioPactado);
        if (
          l.precioPactado === "" ||
          l.precioPactado === null ||
          !Number.isFinite(precioNum) ||
          precioNum <= 0
        ) {
          errLinea.precioPactado = "Debe ser mayor a 0.";
          mensajes.push(`Línea #${numFila}: el precio pactado unitario debe ser mayor a 0.`);
        }

        const ivaNum = Number(l.ivaPorcentaje);
        if (
          l.ivaPorcentaje === "" ||
          l.ivaPorcentaje === null ||
          !Number.isFinite(ivaNum) ||
          ivaNum < 0 ||
          ivaNum > 100
        ) {
          errLinea.ivaPorcentaje = "IVA entre 0% y 100%.";
          mensajes.push(`Línea #${numFila}: el porcentaje de IVA debe estar entre 0 y 100.`);
        }

        if (Object.keys(errLinea).length > 0) {
          nuevosErrores.lineas[idx] = errLinea;
        }
      });
    }

    setErroresCampos(nuevosErrores);

    if (mensajes.length > 0) {
      setFormError(`Corrige los campos marcados en rojo: ${mensajes.join(" ")}`);
      return false;
    }

    setFormError("");
    return true;
  }

  // Guardar nueva orden
  async function handleGuardarOrden(event) {
    event.preventDefault();
    setMensajeConfirmacion("");

    if (!validarFormularioOrden()) {
      return;
    }

    setGuardando(true);
    try {
      const creada = await crearOrdenCompra({
        idProveedor: parseInt(formProveedorId, 10),
        fechaEntrega: formFechaEntrega,
        lineas: lineas.map((l) => ({
          isbn: String(l.isbn).trim(),
          cantidad: parseInt(l.cantidad, 10),
          precioPactado: parseFloat(l.precioPactado),
          ivaPorcentaje: parseFloat(l.ivaPorcentaje),
        })),
      });

      const idNuevaOc = creada.idOc ?? creada.id_oc;

      // Punto de llamada preparado para el envío al proveedor (se implementa en la siguiente instrucción)
      await enviarOrdenCompraProveedor(idNuevaOc);

      setModalNuevoAbierto(false);
      setFiltroEstado("");
      setFiltroProveedor("");
      setFiltroNumero("");
      await cargarOrdenes();

      setMensajeConfirmacion(
        creada.mensaje ||
          `Orden de compra #${idNuevaOc} generada exitosamente en estado pendiente por un total de ${formatMoney(
            creada.total
          )}.`
      );
    } catch (err) {
      setFormError(err.message || "Error al crear la orden de compra.");
    } finally {
      setGuardando(false);
    }
  }

  const nivelCompras = moduleAccessLevel(usuario, "compras");
  const puedeAprobar = nivelCompras === 3;
  const puedeCrear = nivelCompras >= 2;

  function obtenerEtiquetaEstado(oc) {
    if (!oc) return "";
    const estado = (oc.estado || "").toLowerCase();
    const fechaEnvio = oc.fechaEnvio ?? oc.fecha_envio ?? null;
    const intentosEnvio = Number(oc.intentosEnvio ?? oc.intentos_envio ?? 0);
    if (estado === "pendiente" && !fechaEnvio && intentosEnvio > 0) {
      return "pendiente de envío";
    }
    return oc.estado;
  }

  function getBadgeClass(estado) {
    switch (estado?.toLowerCase()) {
      case "aprobada":
        return "success";
      case "recibida":
      case "recibida parcial":
        return "neutral";
      case "rechazada":
        return "danger";
      case "pendiente de envío":
      case "pendiente":
      default:
        return "warning";
    }
  }

  const inputErrorStyle = {
    border: "2px solid #c62828",
    backgroundColor: "#fff5f5",
  };

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

        {mensajeConfirmacion && (
          <div
            role="status"
            style={{
              padding: "12px 16px",
              borderRadius: "8px",
              backgroundColor: "#e8f5e9",
              border: "1px solid #81c784",
              color: "#1b5e20",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "13px",
              fontWeight: "600",
            }}
          >
            <span>✓ {mensajeConfirmacion}</span>
            <button
              type="button"
              onClick={() => setMensajeConfirmacion("")}
              style={{
                background: "none",
                border: "none",
                color: "#1b5e20",
                cursor: "pointer",
                fontWeight: "bold",
                fontSize: "15px",
              }}
              aria-label="Cerrar mensaje de confirmación"
            >
              ✕
            </button>
          </div>
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
              <option value="recibida parcial">Recibida parcial</option>
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
                      <th scope="col" style={{ width: "140px", textAlign: "center" }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordenes.map((oc) => {
                      const id = oc.idOc || oc.id_oc;
                      const provNombre = oc.proveedorNombre || oc.razon_social;
                      const entrega = oc.fechaEntrega || oc.fecha_entrega;
                      const etiquetaEstado = obtenerEtiquetaEstado(oc);

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
                            <span className={`erp-status ${getBadgeClass(etiquetaEstado)}`}>
                              {etiquetaEstado}
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
                maxWidth: "740px",
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
                    <span className={`erp-status ${getBadgeClass(obtenerEtiquetaEstado(ordenSeleccionada))}`}>
                      {obtenerEtiquetaEstado(ordenSeleccionada)}
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
                          <th scope="col" style={{ width: "65px", textAlign: "right" }}>Cant.</th>
                          <th scope="col" style={{ width: "105px", textAlign: "right" }}>Precio P.</th>
                          <th scope="col" style={{ width: "70px", textAlign: "right" }}>IVA %</th>
                          <th scope="col" style={{ width: "115px", textAlign: "right" }}>Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(ordenSeleccionada.lineas || []).map((linea, idx) => (
                          <tr key={linea.idDetalleOc || idx}>
                            <td><strong>{linea.titulo}</strong></td>
                            <td style={{ fontFamily: "monospace", fontSize: "12px" }}>{linea.isbn}</td>
                            <td style={{ textAlign: "right" }}>{linea.cantidad}</td>
                            <td style={{ textAlign: "right" }}>{formatMoney(linea.precioPactado)}</td>
                            <td style={{ textAlign: "right" }}>{Number(linea.ivaPorcentaje ?? 19)}%</td>
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
                      <span style={{ color: "var(--color-text-muted)" }}>IVA:</span>
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
                maxWidth: "960px",
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

              <form onSubmit={handleGuardarOrden} noValidate>
                {/* Cabecera de la orden: Proveedor, Fecha de emisión (solo lectura), Fecha de entrega */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr 1fr",
                    gap: "16px",
                    marginBottom: "24px",
                  }}
                >
                  {/* 1. Proveedor (solo activos del catálogo) */}
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
                      onChange={(e) => {
                        setFormProveedorId(e.target.value);
                        setErroresCampos((prev) => ({ ...prev, proveedor: "" }));
                      }}
                      disabled={guardando}
                      aria-invalid={Boolean(erroresCampos.proveedor)}
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        borderRadius: "7px",
                        border: "1px solid var(--color-border)",
                        ...(erroresCampos.proveedor ? inputErrorStyle : {}),
                      }}
                    >
                      <option value="">-- Selecciona un proveedor activo --</option>
                      {proveedoresActivos.map((p) => {
                        const id = p.idProveedor || p.id_proveedor;
                        const razon = p.razonSocial || p.razon_social;
                        return (
                          <option key={id} value={id}>
                            {razon} ({p.rut})
                          </option>
                        );
                      })}
                    </select>
                    {erroresCampos.proveedor && (
                      <small style={{ color: "#c62828", display: "block", marginTop: "4px", fontWeight: "600" }}>
                        {erroresCampos.proveedor}
                      </small>
                    )}
                  </div>

                  {/* 2. Fecha de emisión (fecha actual, solo lectura) */}
                  <div>
                    <label
                      htmlFor="form-fecha-emision"
                      style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "6px" }}
                    >
                      Fecha de emisión
                    </label>
                    <input
                      id="form-fecha-emision"
                      type="date"
                      value={formFechaEmision}
                      readOnly
                      aria-readonly="true"
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        borderRadius: "7px",
                        border: "1px solid var(--color-border)",
                        backgroundColor: "var(--color-bg-app)",
                        color: "var(--color-text-muted)",
                        cursor: "not-allowed",
                      }}
                    />
                  </div>

                  {/* 3. Fecha de entrega (obligatoria y >= hoy) */}
                  <div>
                    <label
                      htmlFor="form-fecha"
                      style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "6px" }}
                    >
                      Fecha de entrega <span style={{ color: "var(--color-primary)" }}>*</span>
                    </label>
                    <input
                      id="form-fecha"
                      type="date"
                      min={formFechaEmision}
                      value={formFechaEntrega}
                      onChange={(e) => {
                        setFormFechaEntrega(e.target.value);
                        setErroresCampos((prev) => ({ ...prev, fechaEntrega: "" }));
                      }}
                      disabled={guardando}
                      aria-invalid={Boolean(erroresCampos.fechaEntrega)}
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        borderRadius: "7px",
                        border: "1px solid var(--color-border)",
                        ...(erroresCampos.fechaEntrega ? inputErrorStyle : {}),
                      }}
                    />
                    {erroresCampos.fechaEntrega && (
                      <small style={{ color: "#c62828", display: "block", marginTop: "4px", fontWeight: "600" }}>
                        {erroresCampos.fechaEntrega}
                      </small>
                    )}
                  </div>
                </div>

                {/* 4. Tabla de productos editable */}
                <div style={{ marginBottom: "20px" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "10px",
                    }}
                  >
                    <h3 style={{ margin: 0, fontSize: "15px" }}>Productos de la Orden</h3>
                    <button
                      type="button"
                      className="module-secondary-button"
                      onClick={agregarLinea}
                      disabled={guardando}
                      style={{ fontSize: "12px", padding: "6px 14px" }}
                    >
                      + Agregar línea
                    </button>
                  </div>

                  <div className="module-table-scroll">
                    <table className="module-table" style={{ width: "100%", fontSize: "12px" }}>
                      <thead>
                        <tr>
                          <th scope="col" style={{ textAlign: "left", minWidth: "270px" }}>
                            Producto (Catálogo) *
                          </th>
                          <th scope="col" style={{ width: "110px", textAlign: "right" }}>
                            Cantidad *
                          </th>
                          <th scope="col" style={{ width: "145px", textAlign: "right" }}>
                            Precio Pactado Unit. *
                          </th>
                          <th scope="col" style={{ width: "95px", textAlign: "right" }}>
                            IVA (%) *
                          </th>
                          <th scope="col" style={{ width: "130px", textAlign: "right" }}>
                            Subtotal Línea
                          </th>
                          <th scope="col" style={{ width: "60px", textAlign: "center" }}>
                            Quitar
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {lineas.map((linea, index) => {
                          const cantNum = Number(linea.cantidad);
                          const precioNum = Number(linea.precioPactado);
                          const subtotalFila =
                            linea.isbn && cantNum > 0 && precioNum > 0
                              ? Math.round(cantNum * precioNum)
                              : 0;
                          const errFila = erroresCampos.lineas?.[index] || {};

                          return (
                            <tr key={index} style={{ verticalAlign: "top" }}>
                              {/* Producto desde catálogo de libros (solo lectura una vez elegido del selector) */}
                              <td>
                                <select
                                  aria-label={`Producto línea ${index + 1}`}
                                  value={linea.isbn}
                                  onChange={(e) => cambiarLibroEnLinea(index, e.target.value)}
                                  disabled={guardando}
                                  aria-invalid={Boolean(errFila.isbn)}
                                  style={{
                                    width: "100%",
                                    padding: "8px",
                                    borderRadius: "6px",
                                    border: "1px solid var(--color-border)",
                                    fontSize: "12px",
                                    ...(errFila.isbn ? inputErrorStyle : {}),
                                  }}
                                >
                                  <option value="">-- Seleccionar producto del catálogo --</option>
                                  {catalogoLibros.map((b) => (
                                    <option key={b.isbn} value={b.isbn}>
                                      {b.titulo} ({b.isbn}) — Costo ref.: {formatMoney(b.costoUnitario)}
                                    </option>
                                  ))}
                                </select>
                                {linea.isbn && (
                                  <small
                                    style={{
                                      display: "block",
                                      marginTop: "3px",
                                      color: "var(--color-text-muted)",
                                      fontSize: "11px",
                                    }}
                                  >
                                    ISBN: <code>{linea.isbn}</code> · Producto de catálogo (solo lectura)
                                  </small>
                                )}
                                {errFila.isbn && (
                                  <small style={{ color: "#c62828", display: "block", marginTop: "4px", fontWeight: "600" }}>
                                    {errFila.isbn}
                                  </small>
                                )}
                              </td>

                              {/* Cantidad (entero > 0) */}
                              <td>
                                <input
                                  aria-label={`Cantidad línea ${index + 1}`}
                                  type="number"
                                  min="1"
                                  step="1"
                                  placeholder="Cant."
                                  value={linea.cantidad}
                                  onChange={(e) => cambiarCantidadEnLinea(index, e.target.value)}
                                  disabled={guardando}
                                  aria-invalid={Boolean(errFila.cantidad)}
                                  style={{
                                    width: "100%",
                                    padding: "8px",
                                    borderRadius: "6px",
                                    border: "1px solid var(--color-border)",
                                    textAlign: "right",
                                    fontSize: "12px",
                                    ...(errFila.cantidad ? inputErrorStyle : {}),
                                  }}
                                />
                                {errFila.cantidad && (
                                  <small style={{ color: "#c62828", display: "block", marginTop: "4px", fontWeight: "600", textAlign: "right" }}>
                                    {errFila.cantidad}
                                  </small>
                                )}
                              </td>

                              {/* Precio pactado unitario (> 0) */}
                              <td>
                                <input
                                  aria-label={`Precio pactado línea ${index + 1}`}
                                  type="number"
                                  min="1"
                                  step="any"
                                  placeholder="Precio unitario"
                                  value={linea.precioPactado}
                                  onChange={(e) => cambiarPrecioEnLinea(index, e.target.value)}
                                  disabled={guardando}
                                  aria-invalid={Boolean(errFila.precioPactado)}
                                  style={{
                                    width: "100%",
                                    padding: "8px",
                                    borderRadius: "6px",
                                    border: "1px solid var(--color-border)",
                                    textAlign: "right",
                                    fontSize: "12px",
                                    ...(errFila.precioPactado ? inputErrorStyle : {}),
                                  }}
                                />
                                {errFila.precioPactado && (
                                  <small style={{ color: "#c62828", display: "block", marginTop: "4px", fontWeight: "600", textAlign: "right" }}>
                                    {errFila.precioPactado}
                                  </small>
                                )}
                              </td>

                              {/* IVA en % (por defecto 19) */}
                              <td>
                                <input
                                  aria-label={`IVA porcentaje línea ${index + 1}`}
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="any"
                                  value={linea.ivaPorcentaje}
                                  onChange={(e) => cambiarIvaEnLinea(index, e.target.value)}
                                  disabled={guardando}
                                  aria-invalid={Boolean(errFila.ivaPorcentaje)}
                                  style={{
                                    width: "100%",
                                    padding: "8px",
                                    borderRadius: "6px",
                                    border: "1px solid var(--color-border)",
                                    textAlign: "right",
                                    fontSize: "12px",
                                    ...(errFila.ivaPorcentaje ? inputErrorStyle : {}),
                                  }}
                                />
                                {errFila.ivaPorcentaje && (
                                  <small style={{ color: "#c62828", display: "block", marginTop: "4px", fontWeight: "600", textAlign: "right" }}>
                                    {errFila.ivaPorcentaje}
                                  </small>
                                )}
                              </td>

                              {/* Subtotal de la línea calculado automáticamente */}
                              <td style={{ textAlign: "right", fontWeight: "600", fontSize: "13px", paddingTop: "14px" }}>
                                {formatMoney(subtotalFila)}
                              </td>

                              {/* Quitar línea */}
                              <td style={{ textAlign: "center", paddingTop: "10px" }}>
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
                                  title={
                                    lineas.length <= 1
                                      ? "La orden debe tener al menos una línea"
                                      : "Quitar línea"
                                  }
                                  aria-label={`Quitar línea ${index + 1}`}
                                >
                                  🗑
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 5. Totales calculados en tiempo real: Neto, IVA y Total */}
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
                    <span style={{ color: "var(--color-text-muted)" }}>Neto:</span>
                    <span>{formatMoney(totalNeto)}</span>
                  </div>
                  <div style={{ display: "flex", width: "240px", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--color-text-muted)" }}>IVA:</span>
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
                    <span>Total:</span>
                    <span>{formatMoney(totalFinal)}</span>
                  </div>
                </div>

                {/* 6. Botones "Cancelar" y "Generar y enviar orden" */}
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
                    {guardando ? "Generando orden…" : "Generar y enviar orden"}
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
