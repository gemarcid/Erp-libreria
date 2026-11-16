"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import ErpModuleShell from "@/components/ErpModuleShell";
import ErpIcon from "@/components/ErpIcon";
import { useAuth } from "@/components/AuthProvider";
import InventarioNav from "@/components/InventarioNav";
import { money } from "@/lib/dashboard";

const CATALOGO_BASE = [
  { isbn: "978-84-376-0494-7", titulo: "Cien Años de Soledad", autor: "Gabriel García Márquez", categoria: "Ficción", stock: 14, costoUnitario: 11200, precio: 18500 },
  { isbn: "978-84-206-8562-4", titulo: "Don Quijote de la Mancha", autor: "Miguel de Cervantes", categoria: "Clásicos", stock: 8, costoUnitario: 15400, precio: 24900 },
  { isbn: "978-84-376-0188-5", titulo: "Ficciones", autor: "Jorge Luis Borges", categoria: "Cuentos", stock: 3, costoUnitario: 8900, precio: 14200 },
  { isbn: "978-956-247-456-1", titulo: "La Casa de los Espíritus", autor: "Isabel Allende", categoria: "Novela", stock: 19, costoUnitario: 10500, precio: 16900 },
  { isbn: "978-84-376-0457-2", titulo: "Rayuela", autor: "Julio Cortázar", categoria: "Novela", stock: 5, costoUnitario: 12800, precio: 19900 },
  { isbn: "978-84-663-3245-3", titulo: "El Aleph", autor: "Jorge Luis Borges", categoria: "Cuentos", stock: 2, costoUnitario: 8400, precio: 13500 },
  { isbn: "978-84-9759-220-8", titulo: "Crónica de una Muerte Anunciada", autor: "Gabriel García Márquez", categoria: "Ficción", stock: 11, costoUnitario: 7900, precio: 12900 },
  { isbn: "978-956-12-1405-7", titulo: "SubTerra", autor: "Baldomero Lillo", categoria: "Literatura Chilena", stock: 22, costoUnitario: 5900, precio: 9900 },
];

const PROVEEDORES_PREDETERMINADOS = [
  "Penguin Random House Grupo Editorial",
  "Editorial Planeta S.A.",
  "Editorial Zig-Zag",
  "Fondo de Cultura Económica (FCE)",
  "Distribuidora Big Sur Libros",
  "Ediciones Universidad Católica",
  "Ediciones Urano Chile",
  "Vicens Vives Chile",
];

export default function DevolucionesProveedoresPage() {
  const { usuario } = useAuth();

  // Estados de catálogo y búsqueda
  const [inventario, setInventario] = useState(CATALOGO_BASE);
  const [busqueda, setBusqueda] = useState("");

  // Cabecera de Devolución
  const [proveedor, setProveedor] = useState("");
  const [motivoPrincipal, setMotivoPrincipal] = useState("Ejemplares con falla de encuadernación / imprenta");
  const [motivoDetalle, setMotivoDetalle] = useState("");
  const [facturaReferencia, setFacturaReferencia] = useState("");
  const [bodegaOrigen, setBodegaOrigen] = useState("Casa Matriz - Bodega Central");
  const [fechaDevolucion, setFechaDevolucion] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [responsable, setResponsable] = useState("");
  const [solicitaNotaCredito, setSolicitaNotaCredito] = useState(true);

  // Planilla de libros a devolver
  // Estructura: [{ isbn, titulo, autor, categoria, stockActual, cantidad: 1, costoUnitario: 10000 }]
  const [itemsDevolucion, setItemsDevolucion] = useState([]);

  // Estados de validación y confirmación
  const [erroresFormulario, setErroresFormulario] = useState([]);
  const [devolucionConfirmada, setDevolucionConfirmada] = useState(null);
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    if (usuario?.nombre && !responsable) {
      setResponsable(usuario.nombre);
    }
  }, [usuario, responsable]);

  // Intentar sincronizar con la API real de inventario
  useEffect(() => {
    let cancelado = false;
    async function sincronizarInventario() {
      try {
        const res = await fetch("/api/inventario", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0 && !cancelado) {
            setInventario(
              data.map((item) => ({
                ...item,
                costoUnitario: Number(item.costoUnitario) || (item.precio ? Math.round(Number(item.precio) * 0.6) : 10000),
              }))
            );
          }
        }
      } catch {
        // Modo offline / mock
      }
    }
    sincronizarInventario();
    return () => { cancelado = true; };
  }, []);

  // Filtrado de libros en el buscador
  const librosFiltrados = useMemo(() => {
    if (!busqueda.trim()) return [];
    const query = busqueda.toLowerCase().trim();
    return inventario
      .filter((item) =>
        `${item.isbn} ${item.titulo} ${item.autor || ""} ${item.categoria || ""}`
          .toLowerCase()
          .includes(query)
      )
      .slice(0, 6);
  }, [inventario, busqueda]);

  // Agregar libro al listado de devolución
  function agregarLibro(libro) {
    if (itemsDevolucion.some((i) => i.isbn === libro.isbn)) {
      setBusqueda("");
      return;
    }
    const nuevo = {
      isbn: libro.isbn,
      titulo: libro.titulo,
      autor: libro.autor || "—",
      categoria: libro.categoria || "General",
      stockActual: Number(libro.stock) || 0,
      costoUnitario: Number(libro.costoUnitario) || 10000,
      cantidad: 1,
    };
    setItemsDevolucion((prev) => [...prev, nuevo]);
    setBusqueda("");
  }

  // Quitar libro de la planilla
  function removerLibro(isbn) {
    setItemsDevolucion((prev) => prev.filter((i) => i.isbn !== isbn));
  }

  // Actualizar cantidad a devolver
  function actualizarCantidad(isbn, valor) {
    const parsed = parseInt(valor, 10);
    const cantidad = isNaN(parsed) ? "" : parsed;
    setItemsDevolucion((prev) =>
      prev.map((i) => (i.isbn === isbn ? { ...i, cantidad } : i))
    );
  }

  // Actualizar costo unitario
  function actualizarCosto(isbn, valor) {
    const parsed = parseFloat(valor);
    const costoUnitario = isNaN(parsed) ? "" : parsed;
    setItemsDevolucion((prev) =>
      prev.map((i) => (i.isbn === isbn ? { ...i, costoUnitario } : i))
    );
  }

  // Validación de stock: no permitir devolver más de lo disponible en bodega
  const validacionesItems = useMemo(() => {
    const listado = [];
    itemsDevolucion.forEach((item) => {
      const cant = Number(item.cantidad);
      const costo = Number(item.costoUnitario);

      if (!item.cantidad || cant <= 0) {
        listado.push(`El libro "${item.titulo}" debe tener una cantidad a devolver mayor a 0.`);
      } else if (cant > item.stockActual) {
        listado.push(
          `Stock insuficiente para "${item.titulo}": intentas devolver ${cant} un., pero solo hay ${item.stockActual} un. en bodega.`
        );
      }

      if (!item.costoUnitario || costo <= 0) {
        listado.push(`El costo unitario de "${item.titulo}" debe ser mayor a $0.`);
      }
    });
    return listado;
  }, [itemsDevolucion]);

  // Cálculos de totales financieros
  const totalesDevolucion = useMemo(() => {
    let unidadesTotales = 0;
    let montoNeto = 0;

    itemsDevolucion.forEach((item) => {
      const cant = Number(item.cantidad) || 0;
      const costo = Number(item.costoUnitario) || 0;
      unidadesTotales += cant;
      montoNeto += cant * costo;
    });

    const iva19 = Math.round(montoNeto * 0.19);
    const totalBruto = montoNeto + iva19;

    return {
      lineas: itemsDevolucion.length,
      unidadesTotales,
      montoNeto,
      iva19,
      totalBruto,
    };
  }, [itemsDevolucion]);

  // Confirmar devolución
  function handleConfirmarDevolucion(e) {
    e.preventDefault();
    const errores = [];

    if (!proveedor.trim()) {
      errores.push("Debes indicar el Proveedor o Editorial receptora de la devolución.");
    }
    if (!facturaReferencia.trim()) {
      errores.push("El N° de Factura o comprobante de compra original es obligatorio para asociar la nota de crédito.");
    }
    if (!motivoPrincipal) {
      errores.push("El motivo principal de la devolución es obligatorio.");
    }
    if (itemsDevolucion.length === 0) {
      errores.push("Debes añadir al menos un producto a la planilla de devolución.");
    }
    if (validacionesItems.length > 0) {
      errores.push(...validacionesItems);
    }

    if (errores.length > 0) {
      setErroresFormulario(errores);
      window.scrollTo({ top: 130, behavior: "smooth" });
      return;
    }

    setErroresFormulario([]);
    setProcesando(true);

    setTimeout(() => {
      const folioDevolucion = `DEV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

      // Descontar existencias físicas en el inventario local
      setInventario((prev) =>
        prev.map((lib) => {
          const itemDevuelto = itemsDevolucion.find((i) => i.isbn === lib.isbn);
          if (!itemDevuelto) return lib;
          return {
            ...lib,
            stock: Math.max(0, Number(lib.stock) - Number(itemDevuelto.cantidad)),
          };
        })
      );

      setDevolucionConfirmada({
        folio: folioDevolucion,
        proveedor,
        facturaReferencia,
        motivo: motivoPrincipal,
        detalle: motivoDetalle || "Devolución regular a distribuidor.",
        bodegaOrigen,
        fecha: fechaDevolucion,
        responsable: responsable || "Encargado de Inventario",
        solicitaNotaCredito,
        resumen: { ...totalesDevolucion },
        items: [...itemsDevolucion],
      });

      // Limpiar planilla
      setItemsDevolucion([]);
      setFacturaReferencia("");
      setMotivoDetalle("");
      setProcesando(false);
    }, 600);
  }

  function reiniciarFormulario() {
    setDevolucionConfirmada(null);
    setErroresFormulario([]);
    setItemsDevolucion([]);
    setFacturaReferencia("");
    setMotivoDetalle("");
  }

  return (
    <ErpModuleShell
      module="inventario"
      liveData={true}
      title="Mermas y Devoluciones a Proveedores"
      description="Emisión de guías de devolución física por ejemplares defectuosos, mermas de transporte o excedentes editoriales."
      subnav={<InventarioNav activeTab="devoluciones" />}
    >
      <div className="erp-module-screen" style={{ maxWidth: "1380px", margin: "0 auto" }}>
        
        {/* COMPROBANTE OFICIAL DE DEVOLUCIÓN GENERADO */}
        {devolucionConfirmada && (
          <div
            className="module-panel"
            style={{
              background: "#FDFBF7",
              border: "2px solid #0F1E36",
              borderRadius: "12px",
              padding: "24px",
              marginBottom: "24px",
              boxShadow: "0 10px 25px -5px rgba(15, 30, 54, 0.15)",
            }}
            role="status"
            aria-live="polite"
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
              <div>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    background: "#0F1E36",
                    color: "#ffffff",
                    fontSize: "11px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    padding: "4px 10px",
                    borderRadius: "6px",
                  }}
                >
                  ✓ Acta de Devolución a Proveedor Generada
                </span>
                <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#0F1E36", margin: "10px 0 4px" }}>
                  Devolución {devolucionConfirmada.folio} Asentada
                </h2>
                <p style={{ color: "#6b6565", fontSize: "13px" }}>
                  Se ha rebajado el stock físico en <strong>{devolucionConfirmada.bodegaOrigen}</strong> y generado la solicitud de Nota de Crédito.
                </p>
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <Link
                  href="/inventario/kardex"
                  className="ventas-subnav-link is-active"
                  style={{ padding: "8px 16px", fontSize: "12px" }}
                >
                  Ver Asiento en Kardex →
                </Link>
                <button
                  type="button"
                  onClick={reiniciarFormulario}
                  className="module-secondary-button"
                  style={{ padding: "8px 16px", fontSize: "12px" }}
                >
                  Nueva Devolución
                </button>
              </div>
            </div>

            {/* Resumen del Comprobante */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "14px",
                marginTop: "20px",
                padding: "16px",
                background: "#ffffff",
                borderRadius: "8px",
                border: "1px solid #e2dada",
              }}
            >
              <div>
                <span style={{ fontSize: "11px", color: "#6b6565", display: "block" }}>Proveedor Destino</span>
                <strong style={{ color: "#0F1E36", fontSize: "13px", display: "block" }}>
                  {devolucionConfirmada.proveedor}
                </strong>
                <small style={{ color: "#6b6565" }}>Factura Ref: {devolucionConfirmada.facturaReferencia}</small>
              </div>
              <div>
                <span style={{ fontSize: "11px", color: "#6b6565", display: "block" }}>Causa Registrada</span>
                <strong style={{ color: "#991b1b", fontSize: "12px", display: "block" }}>
                  {devolucionConfirmada.motivo}
                </strong>
                <small style={{ color: "#6b6565" }}>{devolucionConfirmada.resumen.unidadesTotales} ejemplares a retirar</small>
              </div>
              <div>
                <span style={{ fontSize: "11px", color: "#6b6565", display: "block" }}>Monto Reclamado (Bruto)</span>
                <strong style={{ color: "#0F1E36", fontSize: "16px" }}>
                  {money(devolucionConfirmada.resumen.totalBruto)}
                </strong>
                <small style={{ color: "#6b6565", display: "block" }}>
                  Neto: {money(devolucionConfirmada.resumen.montoNeto)} + IVA
                </small>
              </div>
              <div>
                <span style={{ fontSize: "11px", color: "#6b6565", display: "block" }}>Fecha / Responsable</span>
                <span style={{ fontSize: "12px", color: "#2c2c2c" }}>
                  {devolucionConfirmada.fecha} · <strong>{devolucionConfirmada.responsable}</strong>
                </span>
                <small style={{ color: "#6b6565", display: "block" }}>{devolucionConfirmada.bodegaOrigen}</small>
              </div>
            </div>
          </div>
        )}

        {/* ALERTA DE ERRORES DE VALIDACIÓN */}
        {erroresFormulario.length > 0 && (
          <div
            className="module-panel"
            style={{
              background: "#fef2f2",
              border: "1px solid #f87171",
              borderRadius: "8px",
              padding: "16px 20px",
              marginBottom: "20px",
            }}
            role="alert"
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#991b1b", fontWeight: 700, marginBottom: "8px" }}>
              <ErpIcon name="info" />
              <span>Por favor corrige las siguientes observaciones antes de continuar:</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: "24px", color: "#b91c1c", fontSize: "12px", lineHeight: "1.6" }}>
              {erroresFormulario.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* FORMULARIO DE DEVOLUCIÓN */}
        <form onSubmit={handleConfirmarDevolucion} className="module-form" noValidate>
          
          {/* SECCIÓN 1: CABECERA DE LA DEVOLUCIÓN */}
          <div
            className="module-panel erp-card"
            style={{
              background: "#FDFBF7",
              border: "1px solid #e2dada",
              borderRadius: "12px",
              padding: "24px",
              marginBottom: "24px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "10px",
                borderBottom: "1px solid #e2dada",
                paddingBottom: "16px",
                marginBottom: "20px",
              }}
            >
              <div>
                <h2 style={{ fontSize: "17px", fontWeight: 700, color: "#0F1E36", margin: 0 }}>
                  Antecedentes de la Devolución y Proveedor
                </h2>
                <p style={{ fontSize: "12px", color: "#6b6565", marginTop: "3px" }}>
                  Indica la editorial, el motivo contractual y la factura de compra original que respalda el abono.
                </p>
              </div>

              <span
                style={{
                  fontSize: "11px",
                  background: "#ffffff",
                  color: "#0F1E36",
                  border: "1px solid #0F1E36",
                  padding: "4px 10px",
                  borderRadius: "6px",
                  fontWeight: 600,
                }}
              >
                Origen de Salida: {bodegaOrigen}
              </span>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                gap: "18px",
                marginBottom: "16px",
              }}
            >
              {/* Proveedor o Editorial */}
              <div>
                <label
                  htmlFor="proveedor"
                  style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#0F1E36", marginBottom: "5px" }}
                >
                  Proveedor / Editorial Receptora <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input
                  id="proveedor"
                  type="text"
                  list="lista-proveedores-dev"
                  placeholder="Selecciona o escribe la editorial..."
                  value={proveedor}
                  onChange={(e) => setProveedor(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    minHeight: "42px",
                    padding: "8px 12px",
                    borderRadius: "7px",
                    border: "1px solid #0F1E36",
                    background: "#ffffff",
                    fontSize: "13px",
                    outline: "none",
                  }}
                />
                <datalist id="lista-proveedores-dev">
                  {PROVEEDORES_PREDETERMINADOS.map((p, idx) => (
                    <option key={idx} value={p} />
                  ))}
                </datalist>
              </div>

              {/* Factura de Compra Original */}
              <div>
                <label
                  htmlFor="factura-ref"
                  style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#0F1E36", marginBottom: "5px" }}
                >
                  N° Factura de Compra Asociada <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input
                  id="factura-ref"
                  type="text"
                  placeholder="Ej: FC-008412 o FC-008290"
                  value={facturaReferencia}
                  onChange={(e) => setFacturaReferencia(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    minHeight: "42px",
                    padding: "8px 12px",
                    borderRadius: "7px",
                    border: "1px solid #0F1E36",
                    background: "#ffffff",
                    fontSize: "13px",
                    fontFamily: "monospace",
                    outline: "none",
                  }}
                />
              </div>

              {/* Motivo de la Devolución */}
              <div>
                <label
                  htmlFor="motivo-principal"
                  style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#0F1E36", marginBottom: "5px" }}
                >
                  Motivo de la Devolución / Merma <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <select
                  id="motivo-principal"
                  value={motivoPrincipal}
                  onChange={(e) => setMotivoPrincipal(e.target.value)}
                  style={{
                    width: "100%",
                    minHeight: "42px",
                    padding: "8px 12px",
                    borderRadius: "7px",
                    border: "1px solid #0F1E36",
                    background: "#ffffff",
                    fontSize: "13px",
                    outline: "none",
                  }}
                >
                  <option value="Ejemplares con falla de encuadernación / imprenta">Ejemplares con falla de encuadernación / imprenta</option>
                  <option value="Merma por transporte / daño de flete">Merma por transporte / daño de flete</option>
                  <option value="Excedente no solicitado en orden de compra">Excedente no solicitado en orden de compra</option>
                  <option value="Vencimiento / Desactualización de edición">Vencimiento / Desactualización de edición</option>
                  <option value="Devolución de libros en consignación">Devolución de libros en consignación</option>
                  <option value="Otro motivo justificado">Otro motivo justificado (especificar abajo)</option>
                </select>
              </div>

              {/* Fecha de Devolución */}
              <div>
                <label
                  htmlFor="fecha-devolucion"
                  style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#0F1E36", marginBottom: "5px" }}
                >
                  Fecha del Envío <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input
                  id="fecha-devolucion"
                  type="date"
                  value={fechaDevolucion}
                  onChange={(e) => setFechaDevolucion(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    minHeight: "42px",
                    padding: "8px 12px",
                    borderRadius: "7px",
                    border: "1px solid #d1d5db",
                    background: "#ffffff",
                    fontSize: "13px",
                    outline: "none",
                  }}
                />
              </div>

              {/* Bodega de Origen */}
              <div>
                <label
                  htmlFor="bodega-origen"
                  style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#0F1E36", marginBottom: "5px" }}
                >
                  Bodega de Despacho
                </label>
                <select
                  id="bodega-origen"
                  value={bodegaOrigen}
                  onChange={(e) => setBodegaOrigen(e.target.value)}
                  style={{
                    width: "100%",
                    minHeight: "42px",
                    padding: "8px 12px",
                    borderRadius: "7px",
                    border: "1px solid #d1d5db",
                    background: "#ffffff",
                    fontSize: "13px",
                    outline: "none",
                  }}
                >
                  <option value="Casa Matriz - Bodega Central">Casa Matriz - Bodega Central</option>
                  <option value="Sucursal Providencia - Bodega">Sucursal Providencia - Bodega</option>
                  <option value="Sucursal Centro - Almacén">Sucursal Centro - Almacén</option>
                </select>
              </div>

              {/* Responsable */}
              <div>
                <label
                  htmlFor="responsable"
                  style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#0F1E36", marginBottom: "5px" }}
                >
                  Responsable del Control Físico
                </label>
                <input
                  id="responsable"
                  type="text"
                  value={responsable}
                  onChange={(e) => setResponsable(e.target.value)}
                  style={{
                    width: "100%",
                    minHeight: "42px",
                    padding: "8px 12px",
                    borderRadius: "7px",
                    border: "1px solid #d1d5db",
                    background: "#ffffff",
                    fontSize: "13px",
                    outline: "none",
                  }}
                />
              </div>
            </div>

            {/* Observaciones y check de Nota de Crédito */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "20px", alignItems: "center" }}>
              <div style={{ flex: 1, minWidth: "280px" }}>
                <label
                  htmlFor="motivo-detalle"
                  style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#0F1E36", marginBottom: "5px" }}
                >
                  Detalle / Observaciones del Deterioro o Falla
                </label>
                <input
                  id="motivo-detalle"
                  type="text"
                  placeholder="Ej: Páginas en blanco en pliego central, encuadernación despegada en lote de 5 ejemplares..."
                  value={motivoDetalle}
                  onChange={(e) => setMotivoDetalle(e.target.value)}
                  style={{
                    width: "100%",
                    minHeight: "40px",
                    padding: "8px 12px",
                    borderRadius: "7px",
                    border: "1px solid #d1d5db",
                    background: "#ffffff",
                    fontSize: "13px",
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "20px" }}>
                <input
                  id="solicita-nc"
                  type="checkbox"
                  checked={solicitaNotaCredito}
                  onChange={(e) => setSolicitaNotaCredito(e.target.checked)}
                  style={{ width: "18px", height: "18px", cursor: "pointer", accentColor: "#0F1E36" }}
                />
                <label htmlFor="solicita-nc" style={{ fontSize: "13px", fontWeight: 600, color: "#0F1E36", cursor: "pointer" }}>
                  Exigir emisión de Nota de Crédito Tributaria al proveedor
                </label>
              </div>
            </div>
          </div>

          {/* SECCIÓN 2: BUSCADOR Y PLANILLA DE PRODUCTOS A DEVOLVER */}
          <div
            className="module-panel erp-card"
            style={{
              background: "#FDFBF7",
              border: "1px solid #e2dada",
              borderRadius: "12px",
              padding: "24px",
              marginBottom: "24px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "10px",
                marginBottom: "16px",
              }}
            >
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#0F1E36", margin: 0 }}>
                  Planilla de Ejemplares a Retirar de Inventario
                </h3>
                <p style={{ fontSize: "12px", color: "#6b6565", margin: "3px 0 0" }}>
                  Las cantidades ingresadas serán rebajadas de las existencias de la bodega de despacho.
                </p>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  fontSize: "12px",
                  background: "#ffffff",
                  padding: "6px 14px",
                  borderRadius: "8px",
                  border: "1px solid #e2dada",
                }}
              >
                <span>
                  Líneas agregadas: <strong>{totalesDevolucion.lineas}</strong>
                </span>
                <span>•</span>
                <span>
                  Total unidades a devolver:{" "}
                  <strong style={{ color: "#991b1b" }}>{totalesDevolucion.unidadesTotales} un.</strong>
                </span>
              </div>
            </div>

            {/* Buscador de libros */}
            <div style={{ position: "relative", marginBottom: "20px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  background: "#ffffff",
                  border: "1px solid #0F1E36",
                  borderRadius: "8px",
                  padding: "0 14px",
                }}
              >
                <ErpIcon name="search" />
                <input
                  type="search"
                  placeholder="Buscar libro por ISBN, título o autor para añadir a la planilla de devolución..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  style={{
                    width: "100%",
                    minHeight: "42px",
                    border: 0,
                    outline: "none",
                    fontSize: "13px",
                    background: "transparent",
                    color: "#2c2c2c",
                  }}
                />
              </div>

              {/* Resultados flotantes */}
              {busqueda.trim().length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    zIndex: 20,
                    background: "#ffffff",
                    border: "1px solid #0F1E36",
                    borderRadius: "8px",
                    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                    marginTop: "4px",
                    maxHeight: "260px",
                    overflowY: "auto",
                  }}
                >
                  {librosFiltrados.length === 0 ? (
                    <p style={{ padding: "14px", color: "#6b6565", fontSize: "12px", margin: 0 }}>
                      No se encontraron libros que coincidan con &quot;{busqueda}&quot;.
                    </p>
                  ) : (
                    librosFiltrados.map((libro) => {
                      const yaAgregado = itemsDevolucion.some((i) => i.isbn === libro.isbn);
                      const sinStock = Number(libro.stock) <= 0;

                      return (
                        <div
                          key={libro.isbn}
                          onClick={() => !yaAgregado && !sinStock && agregarLibro(libro)}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "10px 14px",
                            borderBottom: "1px solid #f3f4f6",
                            cursor: yaAgregado || sinStock ? "not-allowed" : "pointer",
                            background: yaAgregado ? "#f9fafb" : sinStock ? "#fef2f2" : "#ffffff",
                            opacity: yaAgregado || sinStock ? 0.6 : 1,
                          }}
                        >
                          <div>
                            <strong style={{ fontSize: "13px", color: "#0F1E36", display: "block" }}>
                              {libro.titulo}
                            </strong>
                            <small style={{ color: "#6b6565", fontSize: "11px" }}>
                              ISBN: {libro.isbn} · {libro.autor} · {libro.categoria}
                            </small>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <span style={{ fontSize: "11px", color: sinStock ? "#dc2626" : "#4b5563", display: "block", fontWeight: 600 }}>
                              Stock Disponible: {libro.stock} un.
                            </span>
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 600,
                                color: yaAgregado ? "#6b6565" : sinStock ? "#dc2626" : "#0F1E36",
                              }}
                            >
                              {yaAgregado ? "✓ En lista" : sinStock ? "Sin stock en bodega" : "+ Agregar"}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* TABLA DE ÍTEMS (.module-table-scroll + .module-table) */}
            <div className="module-table-scroll" role="region" aria-label="Tabla de libros a devolver" tabIndex={0}>
              <table className="module-table" style={{ background: "#ffffff", borderRadius: "8px", overflow: "hidden" }}>
                <thead>
                  <tr style={{ background: "#f8f9fa", borderBottom: "2px solid #e2dada" }}>
                    <th scope="col" style={{ width: "150px" }}>ISBN</th>
                    <th scope="col">Título y Autor</th>
                    <th scope="col" className="module-number" style={{ width: "110px" }}>Stock Actual</th>
                    <th scope="col" style={{ width: "160px" }}>Cantidad a Devolver</th>
                    <th scope="col" className="module-number" style={{ width: "140px" }}>Costo Compra Unit.</th>
                    <th scope="col" className="module-number" style={{ width: "120px" }}>Queda en Stock</th>
                    <th scope="col" className="module-number" style={{ width: "140px" }}>Subtotal Devolución</th>
                    <th scope="col" style={{ width: "60px", textAlign: "center" }}>Quitar</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsDevolucion.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: "center", padding: "36px 16px", color: "#6b6565" }}>
                        <p style={{ margin: 0, fontSize: "13px", fontWeight: 600 }}>
                          No has añadido ejemplares a la planilla de devolución.
                        </p>
                        <small style={{ display: "block", marginTop: "4px" }}>
                          Usa el buscador de arriba para incorporar los libros defectuosos o excedentes a devolver.
                        </small>
                      </td>
                    </tr>
                  ) : (
                    itemsDevolucion.map((item) => {
                      const cant = Number(item.cantidad) || 0;
                      const costo = Number(item.costoUnitario) || 0;
                      const subtotal = cant * costo;
                      const excedeStock = cant > item.stockActual;
                      const errorCantidad = !item.cantidad || cant <= 0 || excedeStock;
                      const remanente = Math.max(0, item.stockActual - cant);

                      return (
                        <tr
                          key={item.isbn}
                          style={{
                            background: errorCantidad ? "#fef2f2" : "transparent",
                          }}
                        >
                          <td style={{ fontFamily: "monospace", fontSize: "12px", color: "#4b5563" }}>
                            {item.isbn}
                          </td>
                          <td>
                            <strong style={{ color: "#0F1E36", display: "block", fontSize: "13px" }}>
                              {item.titulo}
                            </strong>
                            <small style={{ color: "#6b6565" }}>
                              {item.autor} · {item.categoria}
                            </small>
                          </td>
                          <td className="module-number" style={{ fontWeight: 600, color: "#4b5563" }}>
                            {item.stockActual} un.
                          </td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <button
                                type="button"
                                onClick={() => actualizarCantidad(item.isbn, Math.max(1, cant - 1))}
                                style={{
                                  width: "28px",
                                  height: "32px",
                                  border: "1px solid #d1d5db",
                                  background: "#f3f4f6",
                                  borderRadius: "4px",
                                  fontWeight: "bold",
                                  cursor: "pointer",
                                }}
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="1"
                                max={item.stockActual}
                                value={item.cantidad}
                                onChange={(e) => actualizarCantidad(item.isbn, e.target.value)}
                                style={{
                                  width: "65px",
                                  textAlign: "center",
                                  height: "32px",
                                  borderRadius: "4px",
                                  border: `1px solid ${excedeStock ? "#dc2626" : "#0F1E36"}`,
                                  fontWeight: 600,
                                  color: excedeStock ? "#dc2626" : "#0F1E36",
                                  background: "#ffffff",
                                  outline: "none",
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => actualizarCantidad(item.isbn, cant + 1)}
                                style={{
                                  width: "28px",
                                  height: "32px",
                                  border: "1px solid #d1d5db",
                                  background: "#f3f4f6",
                                  borderRadius: "4px",
                                  fontWeight: "bold",
                                  cursor: "pointer",
                                }}
                              >
                                +
                              </button>
                            </div>
                            {excedeStock && (
                              <span style={{ display: "block", color: "#dc2626", fontSize: "10px", marginTop: "2px", fontWeight: 600 }}>
                                ¡Supera existencias ({item.stockActual})!
                              </span>
                            )}
                          </td>
                          <td className="module-number">
                            <div style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                              <span style={{ color: "#6b6565", fontSize: "12px" }}>$</span>
                              <input
                                type="number"
                                min="1"
                                step="100"
                                value={item.costoUnitario}
                                onChange={(e) => actualizarCosto(item.isbn, e.target.value)}
                                style={{
                                  width: "90px",
                                  textAlign: "right",
                                  height: "32px",
                                  borderRadius: "4px",
                                  border: "1px solid #d1d5db",
                                  fontWeight: 600,
                                  color: "#0F1E36",
                                  background: "#ffffff",
                                  paddingRight: "6px",
                                  outline: "none",
                                }}
                              />
                            </div>
                          </td>
                          <td className="module-number" style={{ fontWeight: 600, color: "#4b5563" }}>
                            {remanente} un.
                          </td>
                          <td className="module-number" style={{ fontWeight: 700, color: "#991b1b" }}>
                            {money(subtotal)}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <button
                              type="button"
                              onClick={() => removerLibro(item.isbn)}
                              style={{
                                border: 0,
                                background: "transparent",
                                color: "#dc2626",
                                cursor: "pointer",
                                fontSize: "16px",
                                padding: "4px",
                              }}
                              title="Quitar libro de la planilla"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* TOTALES FINANCIEROS DE LA DEVOLUCIÓN */}
            <div
              style={{
                marginTop: "20px",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "16px",
                background: "#ffffff",
                padding: "16px 20px",
                borderRadius: "8px",
                border: "1px solid #e2dada",
              }}
            >
              <div>
                <span style={{ fontSize: "11px", color: "#6b6565", display: "block" }}>Total Unidades Físicas</span>
                <strong style={{ fontSize: "18px", color: "#991b1b" }}>
                  -{totalesDevolucion.unidadesTotales} ejemplares
                </strong>
              </div>
              <div>
                <span style={{ fontSize: "11px", color: "#6b6565", display: "block" }}>Subtotal Neto a Abonar</span>
                <strong style={{ fontSize: "18px", color: "#0F1E36" }}>
                  {money(totalesDevolucion.montoNeto)}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: "11px", color: "#6b6565", display: "block" }}>IVA (19% Recuperable)</span>
                <strong style={{ fontSize: "18px", color: "#4b5563" }}>
                  {money(totalesDevolucion.iva19)}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: "11px", color: "#6b6565", display: "block" }}>Total Nota de Crédito Reclamada</span>
                <strong style={{ fontSize: "20px", color: "#0F1E36" }}>
                  {money(totalesDevolucion.totalBruto)}
                </strong>
              </div>
            </div>

            {/* BOTONES DE ACCIÓN (.erp-primary-button) */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
                gap: "12px",
                marginTop: "24px",
                borderTop: "1px solid #e2dada",
                paddingTop: "20px",
              }}
            >
              <button
                type="button"
                onClick={reiniciarFormulario}
                className="module-secondary-button"
                style={{ padding: "10px 20px" }}
                disabled={procesando}
              >
                Limpiar Planilla
              </button>

              <button
                type="submit"
                disabled={
                  procesando ||
                  itemsDevolucion.length === 0 ||
                  validacionesItems.length > 0 ||
                  !proveedor.trim() ||
                  !facturaReferencia.trim()
                }
                className="erp-primary-button"
                style={{
                  background:
                    itemsDevolucion.length === 0 ||
                    validacionesItems.length > 0 ||
                    !proveedor.trim() ||
                    !facturaReferencia.trim()
                      ? "#94a3b8"
                      : "#0F1E36",
                  color: "#ffffff",
                  padding: "10px 24px",
                  borderRadius: "7px",
                  fontWeight: 600,
                  fontSize: "13px",
                  border: 0,
                  cursor:
                    itemsDevolucion.length === 0 ||
                    validacionesItems.length > 0 ||
                    !proveedor.trim() ||
                    !facturaReferencia.trim()
                      ? "not-allowed"
                      : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  transition: "background 0.2s ease",
                }}
              >
                {procesando ? (
                  <span>Emitiendo comprobante de devolución...</span>
                ) : (
                  <>
                    <span>Confirmar Devolución y Descontar Stock</span>
                    <span>→</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </ErpModuleShell>
  );
}
