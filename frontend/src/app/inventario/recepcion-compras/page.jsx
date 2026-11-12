"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import ErpModuleShell from "@/components/ErpModuleShell";
import ErpIcon from "@/components/ErpIcon";
import { useAuth } from "@/components/AuthProvider";
import InventarioNav from "@/components/InventarioNav";
import { money } from "@/lib/dashboard";

const CATALOGO_BASE = [
  { isbn: "978-84-376-0494-7", titulo: "Cien Años de Soledad", autor: "Gabriel García Márquez", categoria: "Ficción", stock: 14, costoReferencia: 11200, precio: 18500 },
  { isbn: "978-84-206-8562-4", titulo: "Don Quijote de la Mancha", autor: "Miguel de Cervantes", categoria: "Clásicos", stock: 8, costoReferencia: 15400, precio: 24900 },
  { isbn: "978-84-376-0188-5", titulo: "Ficciones", autor: "Jorge Luis Borges", categoria: "Cuentos", stock: 3, costoReferencia: 8900, precio: 14200 },
  { isbn: "978-956-247-456-1", titulo: "La Casa de los Espíritus", autor: "Isabel Allende", categoria: "Novela", stock: 19, costoReferencia: 10500, precio: 16900 },
  { isbn: "978-84-376-0457-2", titulo: "Rayuela", autor: "Julio Cortázar", categoria: "Novela", stock: 5, costoReferencia: 12800, precio: 19900 },
  { isbn: "978-84-663-3245-3", titulo: "El Aleph", autor: "Jorge Luis Borges", categoria: "Cuentos", stock: 2, costoReferencia: 8400, precio: 13500 },
  { isbn: "978-84-9759-220-8", titulo: "Crónica de una Muerte Anunciada", autor: "Gabriel García Márquez", categoria: "Ficción", stock: 11, costoReferencia: 7900, precio: 12900 },
  { isbn: "978-956-12-1405-7", titulo: "SubTerra", autor: "Baldomero Lillo", categoria: "Literatura Chilena", stock: 22, costoReferencia: 5900, precio: 9900 },
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

export default function RecepcionComprasPage() {
  const { usuario } = useAuth();
  const inputBarcodeRef = useRef(null);

  // Catálogo base
  const [inventario, setInventario] = useState(CATALOGO_BASE);
  const [cargandoCatalogo, setCargandoCatalogo] = useState(false);

  // Cabecera del Documento de Recepción
  const [tipoDocumento, setTipoDocumento] = useState("Factura Electrónica");
  const [folioDocumento, setFolioDocumento] = useState("");
  const [proveedor, setProveedor] = useState("");
  const [bodegaDestino, setBodegaDestino] = useState("Casa Matriz - Bodega Central");
  const [fechaRecepcion, setFechaRecepcion] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [observaciones, setObservaciones] = useState("");

  // Búsqueda y Lector de Código de Barras
  const [barcodeInput, setBarcodeInput] = useState("");
  const [busquedaTexto, setBusquedaTexto] = useState("");
  const [mensajeLector, setMensajeLector] = useState("");

  // Planilla de Ítems Recibidos
  // Estructura: [{ isbn, titulo, autor, categoria, stockActual, cantidad: 1, costoUnitario: 10000 }]
  const [itemsRecibidos, setItemsRecibidos] = useState([]);

  // Estado de confirmación y feedback
  const [erroresFormulario, setErroresFormulario] = useState([]);
  const [recepcionConfirmada, setRecepcionConfirmada] = useState(null);
  const [procesando, setProcesando] = useState(false);

  // Cargar catálogo de libros desde la API si está disponible
  useEffect(() => {
    let cancelado = false;
    async function cargarCatalogo() {
      try {
        setCargandoCatalogo(true);
        const res = await fetch("/api/inventario", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0 && !cancelado) {
            setInventario(data);
          }
        }
      } catch {
        // Modo offline: se usa CATALOGO_BASE
      } finally {
        if (!cancelado) setCargandoCatalogo(false);
      }
    }
    cargarCatalogo();
    return () => {
      cancelado = true;
    };
  }, []);

  // Filtrar catálogo por texto para selector manual
  const librosFiltrados = useMemo(() => {
    if (!busquedaTexto.trim()) return [];
    const query = busquedaTexto.toLowerCase().trim();
    return inventario
      .filter((item) =>
        `${item.isbn} ${item.titulo} ${item.autor || ""} ${item.categoria || ""}`
          .toLowerCase()
          .includes(query)
      )
      .slice(0, 6);
  }, [inventario, busquedaTexto]);

  // Manejo de lector de código de barras (ISBN exacto o scanner físico)
  function handleScannerSubmit(e) {
    e.preventDefault();
    const codigo = barcodeInput.trim();
    if (!codigo) return;

    // Buscar si existe en el catálogo
    const libroEncontrado = inventario.find(
      (b) =>
        b.isbn.replace(/[^0-9X]/gi, "") === codigo.replace(/[^0-9X]/gi, "") ||
        b.isbn.toLowerCase() === codigo.toLowerCase()
    );

    if (libroEncontrado) {
      // Si ya está en la lista de recepción, incrementar cantidad
      if (itemsRecibidos.some((i) => i.isbn === libroEncontrado.isbn)) {
        setItemsRecibidos((prev) =>
          prev.map((i) =>
            i.isbn === libroEncontrado.isbn
              ? { ...i, cantidad: Number(i.cantidad) + 1 }
              : i
          )
        );
        setMensajeLector(`+1 unidad agregada a "${libroEncontrado.titulo}"`);
      } else {
        agregarLibroALista(libroEncontrado);
        setMensajeLector(`✓ "${libroEncontrado.titulo}" añadido a la planilla.`);
      }
      setBarcodeInput("");
      setTimeout(() => setMensajeLector(""), 3000);
    } else {
      setMensajeLector(
        `⚠ No se encontró ningún libro con el código/ISBN "${codigo}".`
      );
      setTimeout(() => setMensajeLector(""), 4000);
    }

    if (inputBarcodeRef.current) {
      inputBarcodeRef.current.focus();
    }
  }

  // Agregar libro al listado desde la búsqueda
  function agregarLibroALista(libro) {
    if (itemsRecibidos.some((i) => i.isbn === libro.isbn)) {
      setBusquedaTexto("");
      return;
    }
    const nuevo = {
      isbn: libro.isbn,
      titulo: libro.titulo,
      autor: libro.autor || "—",
      categoria: libro.categoria || "General",
      stockActual: Number(libro.stock) || 0,
      costoUnitario: Number(libro.costoReferencia) || Number(libro.precio ? Math.round(libro.precio * 0.6) : 9000),
      cantidad: 1,
    };
    setItemsRecibidos((prev) => [...prev, nuevo]);
    setBusquedaTexto("");
  }

  // Quitar libro de la planilla
  function removerItem(isbn) {
    setItemsRecibidos((prev) => prev.filter((i) => i.isbn !== isbn));
  }

  // Actualizar cantidad con validación estricta
  function actualizarCantidad(isbn, valor) {
    const parsed = parseInt(valor, 10);
    const cantidad = isNaN(parsed) ? "" : parsed;
    setItemsRecibidos((prev) =>
      prev.map((i) => (i.isbn === isbn ? { ...i, cantidad } : i))
    );
  }

  // Actualizar costo unitario con validación estricta
  function actualizarCosto(isbn, valor) {
    const parsed = parseFloat(valor);
    const costoUnitario = isNaN(parsed) ? "" : parsed;
    setItemsRecibidos((prev) =>
      prev.map((i) => (i.isbn === isbn ? { ...i, costoUnitario } : i))
    );
  }

  // Validaciones de ítems individuales
  const erroresItems = useMemo(() => {
    const listado = [];
    itemsRecibidos.forEach((item) => {
      const cant = Number(item.cantidad);
      const costo = Number(item.costoUnitario);
      if (!item.cantidad || cant <= 0) {
        listado.push(`El libro "${item.titulo}" debe tener una cantidad mayor a 0.`);
      }
      if (!item.costoUnitario || costo <= 0) {
        listado.push(`El costo de compra unitario para "${item.titulo}" debe ser mayor a $0.`);
      }
    });
    return listado;
  }, [itemsRecibidos]);

  // Cálculos financieros globales
  const resumenFinanciero = useMemo(() => {
    let totalUnidades = 0;
    let subtotalNeto = 0;

    itemsRecibidos.forEach((item) => {
      const cant = Number(item.cantidad) || 0;
      const costo = Number(item.costoUnitario) || 0;
      totalUnidades += cant;
      subtotalNeto += cant * costo;
    });

    const iva19 = Math.round(subtotalNeto * 0.19);
    const totalFacturado = subtotalNeto + iva19;

    return {
      totalLineas: itemsRecibidos.length,
      totalUnidades,
      subtotalNeto,
      iva19,
      totalFacturado,
    };
  }, [itemsRecibidos]);

  // Confirmar la recepción
  function handleConfirmarRecepcion(e) {
    e.preventDefault();
    const errores = [];

    if (!folioDocumento.trim()) {
      errores.push("El número de Factura o Guía de Despacho es obligatorio.");
    }
    if (!proveedor.trim()) {
      errores.push("Debes indicar el Proveedor o Editorial del despacho.");
    }
    if (!fechaRecepcion) {
      errores.push("La fecha de recepción física es obligatoria.");
    }
    if (itemsRecibidos.length === 0) {
      errores.push("La planilla debe contener al menos un producto recibido.");
    }
    if (erroresItems.length > 0) {
      errores.push(...erroresItems);
    }

    if (errores.length > 0) {
      setErroresFormulario(errores);
      window.scrollTo({ top: 120, behavior: "smooth" });
      return;
    }

    setErroresFormulario([]);
    setProcesando(true);

    // Simular el asentamiento de stock en bodega
    setTimeout(() => {
      const folioIngreso = `ING-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

      // Incrementar stock en catálogo local
      setInventario((prev) =>
        prev.map((lib) => {
          const recibido = itemsRecibidos.find((i) => i.isbn === lib.isbn);
          if (!recibido) return lib;
          return {
            ...lib,
            stock: Number(lib.stock) + Number(recibido.cantidad),
          };
        })
      );

      setRecepcionConfirmada({
        folioIngreso,
        tipoDocumento,
        folioDocumento,
        proveedor,
        bodegaDestino,
        fechaRecepcion,
        observaciones: observaciones || "Recepción conforme sin observaciones.",
        responsable: usuario?.nombre || "Encargado de Bodega",
        resumen: { ...resumenFinanciero },
        items: [...itemsRecibidos],
      });

      // Limpiar formulario para nuevo registro
      setItemsRecibidos([]);
      setFolioDocumento("");
      setProveedor("");
      setObservaciones("");
      setProcesando(false);
    }, 600);
  }

  function reiniciarRecepcion() {
    setRecepcionConfirmada(null);
    setErroresFormulario([]);
    setItemsRecibidos([]);
    setFolioDocumento("");
    setProveedor("");
    setObservaciones("");
  }

  return (
    <ErpModuleShell
      module="inventario"
      liveData={true}
      title="Recepción de Compras / Ingreso de Mercadería"
      description="Control físico de ingreso de libros a bodega asociado a Facturas y Guías de Despacho de proveedores."
      subnav={<InventarioNav activeTab="recepcion-compras" />}
    >
      <div className="erp-module-screen" style={{ maxWidth: "1380px", margin: "0 auto" }}>
        
        {/* COMPROBANTE DE INGRESO GENERADO EXITOSAMENTE */}
        {recepcionConfirmada && (
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
                  ✓ Acta de Recepción Física Generada
                </span>
                <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#0F1E36", margin: "10px 0 4px" }}>
                  Ingreso a Bodega {recepcionConfirmada.folioIngreso} Asentado
                </h2>
                <p style={{ color: "#6b6565", fontSize: "13px" }}>
                  Las existencias se incrementaron en {recepcionConfirmada.bodegaDestino}. Los costos unitarios han sido actualizados en el Kardex.
                </p>
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <Link
                  href="/inventario/kardex"
                  className="ventas-subnav-link is-active"
                  style={{ padding: "8px 16px", fontSize: "12px" }}
                >
                  Ver Movimiento en Kardex →
                </Link>
                <button
                  type="button"
                  onClick={reiniciarRecepcion}
                  className="module-secondary-button"
                  style={{ padding: "8px 16px", fontSize: "12px" }}
                >
                  Registrar Otra Recepción
                </button>
              </div>
            </div>

            {/* Resumen del Comprobante de Recepción */}
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
                <span style={{ fontSize: "11px", color: "#6b6565", display: "block" }}>Documento Proveedor</span>
                <strong style={{ color: "#0F1E36" }}>
                  {recepcionConfirmada.tipoDocumento} N° {recepcionConfirmada.folioDocumento}
                </strong>
                <small style={{ color: "#6b6565", display: "block" }}>{recepcionConfirmada.proveedor}</small>
              </div>
              <div>
                <span style={{ fontSize: "11px", color: "#6b6565", display: "block" }}>Unidades Físicas</span>
                <strong style={{ color: "#166534", fontSize: "15px" }}>
                  +{recepcionConfirmada.resumen.totalUnidades} ejemplares
                </strong>
                <small style={{ color: "#6b6565", display: "block" }}>
                  {recepcionConfirmada.resumen.totalLineas} títulos recibidos
                </small>
              </div>
              <div>
                <span style={{ fontSize: "11px", color: "#6b6565", display: "block" }}>Monto Total Facturado</span>
                <strong style={{ color: "#0F1E36", fontSize: "15px" }}>
                  {money(recepcionConfirmada.resumen.totalFacturado)}
                </strong>
                <small style={{ color: "#6b6565", display: "block" }}>
                  Neto: {money(recepcionConfirmada.resumen.subtotalNeto)} + IVA
                </small>
              </div>
              <div>
                <span style={{ fontSize: "11px", color: "#6b6565", display: "block" }}>Fecha / Receptor</span>
                <span style={{ fontSize: "12px", color: "#2c2c2c" }}>
                  {recepcionConfirmada.fechaRecepcion} · <strong>{recepcionConfirmada.responsable}</strong>
                </span>
                <small style={{ color: "#6b6565", display: "block" }}>{recepcionConfirmada.bodegaDestino}</small>
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
              <span>Por favor corrige las siguientes observaciones antes de asentar el ingreso:</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: "24px", color: "#b91c1c", fontSize: "12px", lineHeight: "1.6" }}>
              {erroresFormulario.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* FORMULARIO DE RECEPCIÓN */}
        <form onSubmit={handleConfirmarRecepcion} className="module-form" noValidate>
          
          {/* SECCIÓN 1: CABECERA DEL DOCUMENTO */}
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
                  Datos del Documento Tributario y Despacho
                </h2>
                <p style={{ fontSize: "12px", color: "#6b6565", marginTop: "3px" }}>
                  Ingresa los antecedentes de la factura o guía proporcionada por el transportista o editorial.
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
                Bodega Receptora: {bodegaDestino}
              </span>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "18px",
                marginBottom: "16px",
              }}
            >
              {/* Tipo de Documento */}
              <div>
                <label
                  htmlFor="tipo-doc"
                  style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#0F1E36", marginBottom: "5px" }}
                >
                  Tipo de Comprobante <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <select
                  id="tipo-doc"
                  value={tipoDocumento}
                  onChange={(e) => setTipoDocumento(e.target.value)}
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
                  <option value="Factura Electrónica">Factura Electrónica de Compra</option>
                  <option value="Guía de Despacho">Guía de Despacho Electrónica</option>
                  <option value="Nota de Entrega / Remisión">Nota de Entrega / Remisión Internacional</option>
                </select>
              </div>

              {/* Número de Documento */}
              <div>
                <label
                  htmlFor="folio-doc"
                  style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#0F1E36", marginBottom: "5px" }}
                >
                  N° de Factura / Guía <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input
                  id="folio-doc"
                  type="text"
                  placeholder="Ej: FC-009412 o GD-33921"
                  value={folioDocumento}
                  onChange={(e) => setFolioDocumento(e.target.value)}
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

              {/* Proveedor o Editorial */}
              <div>
                <label
                  htmlFor="proveedor"
                  style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#0F1E36", marginBottom: "5px" }}
                >
                  Proveedor / Editorial <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input
                  id="proveedor"
                  type="text"
                  list="lista-proveedores"
                  placeholder="Selecciona o escribe el proveedor..."
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
                <datalist id="lista-proveedores">
                  {PROVEEDORES_PREDETERMINADOS.map((p, idx) => (
                    <option key={idx} value={p} />
                  ))}
                </datalist>
              </div>

              {/* Fecha de Recepción */}
              <div>
                <label
                  htmlFor="fecha-recepcion"
                  style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#0F1E36", marginBottom: "5px" }}
                >
                  Fecha de Recepción <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input
                  id="fecha-recepcion"
                  type="date"
                  value={fechaRecepcion}
                  onChange={(e) => setFechaRecepcion(e.target.value)}
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

              {/* Bodega Destino */}
              <div>
                <label
                  htmlFor="bodega-destino"
                  style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#0F1E36", marginBottom: "5px" }}
                >
                  Bodega de Destino
                </label>
                <select
                  id="bodega-destino"
                  value={bodegaDestino}
                  onChange={(e) => setBodegaDestino(e.target.value)}
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

              {/* Observaciones de Recepción */}
              <div>
                <label
                  htmlFor="observaciones"
                  style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#0F1E36", marginBottom: "5px" }}
                >
                  Observaciones / Transportista
                </label>
                <input
                  id="observaciones"
                  type="text"
                  placeholder="Ej: Bultos precintados, sello intacto..."
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
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
          </div>

          {/* SECCIÓN 2: LECTOR DE CÓDIGO DE BARRAS Y BUSCADOR */}
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
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                gap: "20px",
                marginBottom: "20px",
              }}
            >
              {/* Lector de Código de Barras (Escáner físico / ISBN rápido) */}
              <div
                style={{
                  background: "#ffffff",
                  border: "2px solid #0F1E36",
                  borderRadius: "8px",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                    <span style={{ fontSize: "18px" }}>📦</span>
                    <strong style={{ fontSize: "13px", color: "#0F1E36" }}>
                      Lector de Código de Barras (Escaneo Continuo)
                    </strong>
                  </div>
                  <p style={{ fontSize: "11px", color: "#6b6565", margin: "0 0 10px" }}>
                    Escanea el código de barras o escribe el ISBN y presiona Enter para ingresar automáticamente.
                  </p>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    ref={inputBarcodeRef}
                    type="text"
                    placeholder="Escanear o digitar ISBN..."
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleScannerSubmit(e);
                      }
                    }}
                    style={{
                      flex: 1,
                      minHeight: "40px",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid #0F1E36",
                      fontSize: "13px",
                      fontFamily: "monospace",
                      outline: "none",
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleScannerSubmit}
                    className="erp-primary-button"
                    style={{
                      background: "#0F1E36",
                      color: "#ffffff",
                      padding: "0 16px",
                      borderRadius: "6px",
                      border: 0,
                      fontWeight: 600,
                      fontSize: "12px",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    + Escanear
                  </button>
                </div>

                {mensajeLector && (
                  <p
                    style={{
                      margin: "8px 0 0",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: mensajeLector.startsWith("✓") || mensajeLector.startsWith("+") ? "#166534" : "#dc2626",
                    }}
                  >
                    {mensajeLector}
                  </p>
                )}
              </div>

              {/* Búsqueda manual por Título o Autor */}
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #d1d5db",
                  borderRadius: "8px",
                  padding: "16px",
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                    <ErpIcon name="search" />
                    <strong style={{ fontSize: "13px", color: "#0F1E36" }}>
                      Búsqueda Manual en Catálogo
                    </strong>
                  </div>
                  <p style={{ fontSize: "11px", color: "#6b6565", margin: "0 0 10px" }}>
                    Escribe el título, autor o palabras clave si el ejemplar no cuenta con código legible.
                  </p>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    background: "#ffffff",
                    border: "1px solid #d1d5db",
                    borderRadius: "6px",
                    padding: "0 10px",
                  }}
                >
                  <ErpIcon name="search" />
                  <input
                    type="search"
                    placeholder="Buscar por título, autor o categoría..."
                    value={busquedaTexto}
                    onChange={(e) => setBusquedaTexto(e.target.value)}
                    style={{
                      width: "100%",
                      minHeight: "38px",
                      border: 0,
                      outline: "none",
                      fontSize: "12px",
                      background: "transparent",
                      color: "#2c2c2c",
                    }}
                  />
                </div>

                {/* Dropdown de resultados de búsqueda */}
                {busquedaTexto.trim().length > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      right: 0,
                      zIndex: 25,
                      background: "#ffffff",
                      border: "1px solid #0F1E36",
                      borderRadius: "8px",
                      boxShadow: "0 10px 20px rgba(0, 0, 0, 0.12)",
                      marginTop: "6px",
                      maxHeight: "240px",
                      overflowY: "auto",
                    }}
                  >
                    {librosFiltrados.length === 0 ? (
                      <p style={{ padding: "12px", color: "#6b6565", fontSize: "12px", margin: 0 }}>
                        No se encontraron títulos que coincidan.
                      </p>
                    ) : (
                      librosFiltrados.map((libro) => {
                        const yaAgregado = itemsRecibidos.some((i) => i.isbn === libro.isbn);
                        return (
                          <div
                            key={libro.isbn}
                            onClick={() => !yaAgregado && agregarLibroALista(libro)}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              padding: "9px 12px",
                              borderBottom: "1px solid #f3f4f6",
                              cursor: yaAgregado ? "not-allowed" : "pointer",
                              background: yaAgregado ? "#f9fafb" : "#ffffff",
                              opacity: yaAgregado ? 0.6 : 1,
                            }}
                          >
                            <div>
                              <strong style={{ fontSize: "12px", color: "#0F1E36", display: "block" }}>
                                {libro.titulo}
                              </strong>
                              <small style={{ color: "#6b6565", fontSize: "11px" }}>
                                ISBN: {libro.isbn} · {libro.autor}
                              </small>
                            </div>
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 600,
                                color: yaAgregado ? "#6b6565" : "#0F1E36",
                              }}
                            >
                              {yaAgregado ? "✓ En lista" : "+ Agregar"}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* SECCIÓN 3: PLANILLA DE ÍTEMS RECIBIDOS (.module-table-scroll + .module-table) */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "10px",
                marginBottom: "12px",
              }}
            >
              <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#0F1E36", margin: 0 }}>
                Planilla de Libros Recibidos
              </h3>
              <span style={{ fontSize: "12px", color: "#6b6565" }}>
                Total de títulos listados: <strong>{itemsRecibidos.length}</strong>
              </span>
            </div>

            <div className="module-table-scroll" role="region" aria-label="Tabla de libros recibidos" tabIndex={0}>
              <table className="module-table" style={{ background: "#ffffff", borderRadius: "8px", overflow: "hidden" }}>
                <thead>
                  <tr style={{ background: "#f8f9fa", borderBottom: "2px solid #e2dada" }}>
                    <th scope="col" style={{ width: "150px" }}>ISBN</th>
                    <th scope="col">Título y Autor</th>
                    <th scope="col" className="module-number" style={{ width: "100px" }}>Stock Actual</th>
                    <th scope="col" style={{ width: "150px" }}>Cantidad Recibida</th>
                    <th scope="col" className="module-number" style={{ width: "160px" }}>Costo Compra Unit.</th>
                    <th scope="col" className="module-number" style={{ width: "150px" }}>Subtotal Neto</th>
                    <th scope="col" style={{ width: "60px", textAlign: "center" }}>Quitar</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsRecibidos.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", padding: "36px 16px", color: "#6b6565" }}>
                        <p style={{ margin: 0, fontSize: "13px", fontWeight: 600 }}>
                          La planilla de recepción se encuentra vacía.
                        </p>
                        <small style={{ display: "block", marginTop: "4px" }}>
                          Usa el lector de código de barras o el buscador de arriba para incorporar los ejemplares que están ingresando.
                        </small>
                      </td>
                    </tr>
                  ) : (
                    itemsRecibidos.map((item) => {
                      const cant = Number(item.cantidad) || 0;
                      const costo = Number(item.costoUnitario) || 0;
                      const subtotalFila = cant * costo;
                      const errorCantidad = !item.cantidad || cant <= 0;
                      const errorCosto = !item.costoUnitario || costo <= 0;

                      return (
                        <tr
                          key={item.isbn}
                          style={{
                            background: errorCantidad || errorCosto ? "#fef2f2" : "transparent",
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
                          <td className="module-number" style={{ color: "#4b5563" }}>
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
                                value={item.cantidad}
                                onChange={(e) => actualizarCantidad(item.isbn, e.target.value)}
                                style={{
                                  width: "65px",
                                  textAlign: "center",
                                  height: "32px",
                                  borderRadius: "4px",
                                  border: `1px solid ${errorCantidad ? "#dc2626" : "#0F1E36"}`,
                                  fontWeight: 600,
                                  color: errorCantidad ? "#dc2626" : "#0F1E36",
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
                            {errorCantidad && (
                              <span style={{ display: "block", color: "#dc2626", fontSize: "10px", marginTop: "2px" }}>
                                Cantidad obligatoria (&gt; 0)
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
                                  width: "95px",
                                  textAlign: "right",
                                  height: "32px",
                                  borderRadius: "4px",
                                  border: `1px solid ${errorCosto ? "#dc2626" : "#0F1E36"}`,
                                  fontWeight: 600,
                                  color: errorCosto ? "#dc2626" : "#0F1E36",
                                  background: "#ffffff",
                                  paddingRight: "6px",
                                  outline: "none",
                                }}
                              />
                            </div>
                            {errorCosto && (
                              <span style={{ display: "block", color: "#dc2626", fontSize: "10px", marginTop: "2px" }}>
                                Costo inválido
                              </span>
                            )}
                          </td>
                          <td className="module-number" style={{ fontWeight: 700, color: "#0F1E36", fontSize: "13px" }}>
                            {money(subtotalFila)}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <button
                              type="button"
                              onClick={() => removerItem(item.isbn)}
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

            {/* TOTALIZADOR FINANCIERO */}
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
                <span style={{ fontSize: "11px", color: "#6b6565", display: "block" }}>Total Ejemplares Físicos</span>
                <strong style={{ fontSize: "18px", color: "#166534" }}>
                  +{resumenFinanciero.totalUnidades} un.
                </strong>
              </div>
              <div>
                <span style={{ fontSize: "11px", color: "#6b6565", display: "block" }}>Subtotal Neto</span>
                <strong style={{ fontSize: "18px", color: "#0F1E36" }}>
                  {money(resumenFinanciero.subtotalNeto)}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: "11px", color: "#6b6565", display: "block" }}>IVA Crédito Fiscal (19%)</span>
                <strong style={{ fontSize: "18px", color: "#4b5563" }}>
                  {money(resumenFinanciero.iva19)}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: "11px", color: "#6b6565", display: "block" }}>Total Factura Bruto</span>
                <strong style={{ fontSize: "20px", color: "#0F1E36" }}>
                  {money(resumenFinanciero.totalFacturado)}
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
                onClick={reiniciarRecepcion}
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
                  itemsRecibidos.length === 0 ||
                  erroresItems.length > 0 ||
                  !folioDocumento.trim() ||
                  !proveedor.trim()
                }
                className="erp-primary-button"
                style={{
                  background:
                    itemsRecibidos.length === 0 || erroresItems.length > 0 || !folioDocumento.trim() || !proveedor.trim()
                      ? "#94a3b8"
                      : "#0F1E36",
                  color: "#ffffff",
                  padding: "10px 24px",
                  borderRadius: "7px",
                  fontWeight: 600,
                  fontSize: "13px",
                  border: 0,
                  cursor:
                    itemsRecibidos.length === 0 || erroresItems.length > 0 || !folioDocumento.trim() || !proveedor.trim()
                      ? "not-allowed"
                      : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  transition: "background 0.2s ease",
                }}
              >
                {procesando ? (
                  <span>Asentando ingreso en bodega...</span>
                ) : (
                  <>
                    <span>Confirmar Recepción y Asentar Stock</span>
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
