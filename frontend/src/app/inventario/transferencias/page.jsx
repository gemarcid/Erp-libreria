"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import ErpModuleShell from "@/components/ErpModuleShell";
import ErpIcon from "@/components/ErpIcon";
import { useAuth } from "@/components/AuthProvider";
import InventarioNav from "@/components/InventarioNav";
import { money } from "@/lib/dashboard";

const SUCURSALES_DISPONIBLES = [
  { id: "matriz", nombre: "Casa Matriz - Bodega Central" },
  { id: "providencia", nombre: "Sucursal Providencia - Sala de Ventas" },
  { id: "centro", nombre: "Sucursal Centro - Almacén" },
];

const CATALOGO_MULTISUCURSAL = [
  {
    isbn: "978-84-376-0494-7",
    titulo: "Cien Años de Soledad",
    autor: "Gabriel García Márquez",
    categoria: "Ficción",
    precio: 18500,
    costo: 11200,
    stocks: { matriz: 14, providencia: 2, centro: 0 },
  },
  {
    isbn: "978-84-206-8562-4",
    titulo: "Don Quijote de la Mancha",
    autor: "Miguel de Cervantes",
    categoria: "Clásicos",
    precio: 24900,
    costo: 15400,
    stocks: { matriz: 8, providencia: 0, centro: 1 },
  },
  {
    isbn: "978-84-376-0188-5",
    titulo: "Ficciones",
    autor: "Jorge Luis Borges",
    categoria: "Cuentos",
    precio: 14200,
    costo: 8900,
    stocks: { matriz: 12, providencia: 1, centro: 0 },
  },
  {
    isbn: "978-956-247-456-1",
    titulo: "La Casa de los Espíritus",
    autor: "Isabel Allende",
    categoria: "Novela",
    precio: 16900,
    costo: 10500,
    stocks: { matriz: 19, providencia: 4, centro: 2 },
  },
  {
    isbn: "978-84-376-0457-2",
    titulo: "Rayuela",
    autor: "Julio Cortázar",
    categoria: "Novela",
    precio: 19900,
    costo: 12800,
    stocks: { matriz: 9, providencia: 0, centro: 1 },
  },
  {
    isbn: "978-84-663-3245-3",
    titulo: "El Aleph",
    autor: "Jorge Luis Borges",
    categoria: "Cuentos",
    precio: 13500,
    costo: 8400,
    stocks: { matriz: 7, providencia: 1, centro: 0 },
  },
  {
    isbn: "978-84-9759-220-8",
    titulo: "Crónica de una Muerte Anunciada",
    autor: "Gabriel García Márquez",
    categoria: "Ficción",
    precio: 12900,
    costo: 7900,
    stocks: { matriz: 16, providencia: 3, centro: 0 },
  },
  {
    isbn: "978-956-12-1405-7",
    titulo: "SubTerra",
    autor: "Baldomero Lillo",
    categoria: "Literatura Chilena",
    precio: 9900,
    costo: 5900,
    stocks: { matriz: 22, providencia: 5, centro: 3 },
  },
];

export default function TransferenciasBodegasPage() {
  const { usuario } = useAuth();

  // Estado del catálogo y existencias por sucursal
  const [catalogo, setCatalogo] = useState(CATALOGO_MULTISUCURSAL);
  const [busqueda, setBusqueda] = useState("");

  // Cabecera del traslado
  const [bodegaOrigen, setBodegaOrigen] = useState("matriz");
  const [bodegaDestino, setBodegaDestino] = useState("providencia");
  const [responsable, setResponsable] = useState("");
  const [motivo, setMotivo] = useState("Reposición de stock para sala de ventas");
  const [observaciones, setObservaciones] = useState("");
  const [fechaDespacho, setFechaDespacho] = useState(
    new Date().toISOString().slice(0, 10)
  );

  // Planilla de libros a transferir
  // Estructura: [{ isbn, titulo, autor, cantidad: 1 }]
  const [itemsTraslado, setItemsTraslado] = useState([]);

  // Estados de control y feedback
  const [erroresFormulario, setErroresFormulario] = useState([]);
  const [trasladoConfirmado, setTrasladoConfirmado] = useState(null);
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    if (usuario?.nombre && !responsable) {
      setResponsable(usuario.nombre);
    }
  }, [usuario, responsable]);

  // Libros filtrados para el selector
  const librosFiltrados = useMemo(() => {
    if (!busqueda.trim()) return [];
    const query = busqueda.toLowerCase().trim();
    return catalogo
      .filter((item) =>
        `${item.isbn} ${item.titulo} ${item.autor || ""} ${item.categoria || ""}`
          .toLowerCase()
          .includes(query)
      )
      .slice(0, 6);
  }, [catalogo, busqueda]);

  // Agregar libro al listado de traslado
  function agregarLibro(libro) {
    if (itemsTraslado.some((i) => i.isbn === libro.isbn)) {
      setBusqueda("");
      return;
    }
    const nuevo = {
      isbn: libro.isbn,
      titulo: libro.titulo,
      autor: libro.autor,
      categoria: libro.categoria,
      costo: libro.costo,
      cantidad: 1,
    };
    setItemsTraslado((prev) => [...prev, nuevo]);
    setBusqueda("");
  }

  // Quitar libro de la planilla
  function removerLibro(isbn) {
    setItemsTraslado((prev) => prev.filter((i) => i.isbn !== isbn));
  }

  // Actualizar cantidad a trasladar
  function actualizarCantidad(isbn, valor) {
    const parsed = parseInt(valor, 10);
    const cantidad = isNaN(parsed) ? "" : parsed;
    setItemsTraslado((prev) =>
      prev.map((i) => (i.isbn === isbn ? { ...i, cantidad } : i))
    );
  }

  // Validación estricta de stock disponible en la bodega de origen
  const validacionesItems = useMemo(() => {
    const listado = [];
    itemsTraslado.forEach((item) => {
      const libroCatalogo = catalogo.find((c) => c.isbn === item.isbn);
      const stockDisponibleOrigen = libroCatalogo?.stocks[bodegaOrigen] ?? 0;
      const cant = Number(item.cantidad);

      if (!item.cantidad || cant <= 0) {
        listado.push(`El libro "${item.titulo}" debe tener una cantidad a transferir mayor a 0.`);
      } else if (cant > stockDisponibleOrigen) {
        listado.push(
          `Stock insuficiente en origen para "${item.titulo}": intentas transferir ${cant} un., pero solo hay ${stockDisponibleOrigen} un. en bodega.`
        );
      }
    });
    return listado;
  }, [itemsTraslado, catalogo, bodegaOrigen]);

  // Cálculos de resumen
  const totalesTraslado = useMemo(() => {
    let unidadesTotales = 0;
    let valorEstimado = 0;

    itemsTraslado.forEach((item) => {
      const cant = Number(item.cantidad) || 0;
      unidadesTotales += cant;
      valorEstimado += cant * (item.costo || 0);
    });

    return {
      lineas: itemsTraslado.length,
      unidadesTotales,
      valorEstimado,
    };
  }, [itemsTraslado]);

  // Confirmar y asentar la transferencia
  function handleConfirmarTraslado(e) {
    e.preventDefault();
    const errores = [];

    if (bodegaOrigen === bodegaDestino) {
      errores.push("La bodega de origen y la bodega de destino no pueden ser iguales.");
    }
    if (!responsable.trim()) {
      errores.push("Debes indicar el responsable de la emisión y despacho.");
    }
    if (!motivo.trim()) {
      errores.push("El motivo u objetivo de la transferencia es obligatorio.");
    }
    if (itemsTraslado.length === 0) {
      errores.push("Debes agregar al menos un título a la guía de traslado.");
    }
    if (validacionesItems.length > 0) {
      errores.push(...validacionesItems);
    }

    if (errores.length > 0) {
      setErroresFormulario(errores);
      window.scrollTo({ top: 140, behavior: "smooth" });
      return;
    }

    setErroresFormulario([]);
    setProcesando(true);

    setTimeout(() => {
      const folioGenerado = `TR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

      // Actualizar el stock descontando de origen e incrementando en destino
      setCatalogo((prev) =>
        prev.map((lib) => {
          const itemTransferido = itemsTraslado.find((i) => i.isbn === lib.isbn);
          if (!itemTransferido) return lib;

          const cant = Number(itemTransferido.cantidad) || 0;
          return {
            ...lib,
            stocks: {
              ...lib.stocks,
              [bodegaOrigen]: Math.max(0, (lib.stocks[bodegaOrigen] || 0) - cant),
              [bodegaDestino]: (lib.stocks[bodegaDestino] || 0) + cant,
            },
          };
        })
      );

      const nombreOrigen = SUCURSALES_DISPONIBLES.find((s) => s.id === bodegaOrigen)?.nombre;
      const nombreDestino = SUCURSALES_DISPONIBLES.find((s) => s.id === bodegaDestino)?.nombre;

      setTrasladoConfirmado({
        folio: folioGenerado,
        bodegaOrigen: nombreOrigen,
        bodegaDestino: nombreDestino,
        responsable,
        motivo,
        observaciones: observaciones || "Traslado interno sin observaciones.",
        fecha: fechaDespacho,
        hora: new Intl.DateTimeFormat("es-CL", { timeStyle: "short" }).format(new Date()),
        resumen: { ...totalesTraslado },
        items: [...itemsTraslado],
      });

      // Limpiar planilla
      setItemsTraslado([]);
      setObservaciones("");
      setProcesando(false);
    }, 600);
  }

  function reiniciarFormulario() {
    setTrasladoConfirmado(null);
    setErroresFormulario([]);
    setItemsTraslado([]);
    setObservaciones("");
  }

  return (
    <ErpModuleShell
      module="inventario"
      liveData={true}
      title="Transferencias entre Sucursales / Bodegas"
      description="Emisión de guías internas de movimiento y redistribución física de stock entre salas de venta y bodegas."
      subnav={<InventarioNav activeTab="transferencias" />}
    >
      <div className="erp-module-screen" style={{ maxWidth: "1380px", margin: "0 auto" }}>
        
        {/* COMPROBANTE DE TRASLADO EMITIDO CON ÉXITO */}
        {trasladoConfirmado && (
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
                  ✓ Guía de Traslado Interno Emitida
                </span>
                <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#0F1E36", margin: "10px 0 4px" }}>
                  Movimiento {trasladoConfirmado.folio} Asentado Correctamente
                </h2>
                <p style={{ color: "#6b6565", fontSize: "13px" }}>
                  Se ha rebajado el stock en <strong>{trasladoConfirmado.bodegaOrigen}</strong> y acreditado en <strong>{trasladoConfirmado.bodegaDestino}</strong>.
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
                  onClick={reiniciarFormulario}
                  className="module-secondary-button"
                  style={{ padding: "8px 16px", fontSize: "12px" }}
                >
                  Nuevo Traslado
                </button>
              </div>
            </div>

            {/* Resumen de la Guía */}
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
                <span style={{ fontSize: "11px", color: "#6b6565", display: "block" }}>Ruta de Despacho</span>
                <strong style={{ color: "#0F1E36", fontSize: "12px", display: "block" }}>
                  {trasladoConfirmado.bodegaOrigen}
                </strong>
                <span style={{ fontSize: "11px", color: "#166534", fontWeight: 600 }}>
                  ➔ {trasladoConfirmado.bodegaDestino}
                </span>
              </div>
              <div>
                <span style={{ fontSize: "11px", color: "#6b6565", display: "block" }}>Carga Fisiológica</span>
                <strong style={{ color: "#0F1E36", fontSize: "16px" }}>
                  {trasladoConfirmado.resumen.unidadesTotales} ejemplares
                </strong>
                <small style={{ color: "#6b6565", display: "block" }}>
                  {trasladoConfirmado.resumen.lineas} títulos distintos
                </small>
              </div>
              <div>
                <span style={{ fontSize: "11px", color: "#6b6565", display: "block" }}>Valorización Estimada</span>
                <strong style={{ color: "#0F1E36", fontSize: "16px" }}>
                  {money(trasladoConfirmado.resumen.valorEstimado)}
                </strong>
                <small style={{ color: "#6b6565", display: "block" }}>Costo Ponderado</small>
              </div>
              <div>
                <span style={{ fontSize: "11px", color: "#6b6565", display: "block" }}>Fecha / Responsable</span>
                <span style={{ fontSize: "12px", color: "#2c2c2c" }}>
                  {trasladoConfirmado.fecha} {trasladoConfirmado.hora}
                </span>
                <strong style={{ display: "block", color: "#0F1E36", fontSize: "12px" }}>
                  {trasladoConfirmado.responsable}
                </strong>
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
              <span>Observaciones detectadas en la orden de traslado:</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: "24px", color: "#b91c1c", fontSize: "12px", lineHeight: "1.6" }}>
              {erroresFormulario.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* FORMULARIO DE TRASLADO */}
        <form onSubmit={handleConfirmarTraslado} className="module-form" noValidate>
          
          {/* SECCIÓN 1: CABECERA Y SELECCIÓN DE BODEGAS */}
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
                  Definición de Bodegas y Ruta de Despacho
                </h2>
                <p style={{ fontSize: "12px", color: "#6b6565", marginTop: "3px" }}>
                  Configura el origen para verificar existencias y el destino donde se incorporará el stock.
                </p>
              </div>

              {bodegaOrigen === bodegaDestino && (
                <span
                  style={{
                    background: "#fee2e2",
                    color: "#991b1b",
                    fontSize: "12px",
                    fontWeight: 700,
                    padding: "4px 10px",
                    borderRadius: "6px",
                  }}
                >
                  ⚠ Origen y destino no pueden coincidir
                </span>
              )}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "18px",
                marginBottom: "16px",
              }}
            >
              {/* Bodega de Origen */}
              <div>
                <label
                  htmlFor="bodega-origen"
                  style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#0F1E36", marginBottom: "5px" }}
                >
                  Bodega de Origen (Rebaja Stock) <span style={{ color: "#dc2626" }}>*</span>
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
                    border: "1px solid #0F1E36",
                    background: "#ffffff",
                    fontSize: "13px",
                    outline: "none",
                  }}
                >
                  {SUCURSALES_DISPONIBLES.map((suc) => (
                    <option key={suc.id} value={suc.id}>
                      {suc.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {/* Bodega de Destino */}
              <div>
                <label
                  htmlFor="bodega-destino"
                  style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#0F1E36", marginBottom: "5px" }}
                >
                  Bodega de Destino (Suma Stock) <span style={{ color: "#dc2626" }}>*</span>
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
                    border: `1px solid ${bodegaOrigen === bodegaDestino ? "#dc2626" : "#0F1E36"}`,
                    background: "#ffffff",
                    fontSize: "13px",
                    outline: "none",
                  }}
                >
                  {SUCURSALES_DISPONIBLES.map((suc) => (
                    <option key={suc.id} value={suc.id}>
                      {suc.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {/* Responsable del Despacho */}
              <div>
                <label
                  htmlFor="responsable"
                  style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#0F1E36", marginBottom: "5px" }}
                >
                  Responsable de Logística / Despacho <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input
                  id="responsable"
                  type="text"
                  placeholder="Nombre de quien autoriza y despacha..."
                  value={responsable}
                  onChange={(e) => setResponsable(e.target.value)}
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

              {/* Fecha de Despacho */}
              <div>
                <label
                  htmlFor="fecha-despacho"
                  style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#0F1E36", marginBottom: "5px" }}
                >
                  Fecha Programada de Envío <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input
                  id="fecha-despacho"
                  type="date"
                  value={fechaDespacho}
                  onChange={(e) => setFechaDespacho(e.target.value)}
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
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "18px",
              }}
            >
              {/* Motivo del Traslado */}
              <div>
                <label
                  htmlFor="motivo-traslado"
                  style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#0F1E36", marginBottom: "5px" }}
                >
                  Motivo de la Transferencia <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <select
                  id="motivo-traslado"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
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
                  <option value="Reposición de stock para sala de ventas">Reposición de stock para sala de ventas</option>
                  <option value="Rebalanceo de inventario entre sucursales">Rebalanceo de inventario entre sucursales</option>
                  <option value="Solicitud especial o reserva de cliente en sucursal">Solicitud especial o reserva de cliente en sucursal</option>
                  <option value="Redistribución por feria o evento local">Redistribución por feria o evento local</option>
                  <option value="Devolución de excedentes a bodega central">Devolución de excedentes a bodega central</option>
                </select>
              </div>

              {/* Observaciones de Transporte */}
              <div>
                <label
                  htmlFor="observaciones"
                  style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#0F1E36", marginBottom: "5px" }}
                >
                  Transporte / Vehículo / Observaciones
                </label>
                <input
                  id="observaciones"
                  type="text"
                  placeholder="Ej: Conductor Juan Pérez, furgón placa JJ-9012, 3 cajas selladas"
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

          {/* SECCIÓN 2: BUSCADOR Y PLANILLA DE TRASLADO */}
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
                  Libros a Trasladar y Verificación de Stock en Origen
                </h3>
                <p style={{ fontSize: "12px", color: "#6b6565", margin: "3px 0 0" }}>
                  El sistema valida en tiempo real que las unidades a transferir no superen las existencias de la bodega de origen.
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
                  Líneas agregadas: <strong>{totalesTraslado.lineas}</strong>
                </span>
                <span>•</span>
                <span>
                  Total ejemplares a trasladar:{" "}
                  <strong style={{ color: "#0F1E36" }}>{totalesTraslado.unidadesTotales} un.</strong>
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
                  placeholder="Buscar por ISBN, título o autor para agregar a la guía de traslado..."
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
                      const yaAgregado = itemsTraslado.some((i) => i.isbn === libro.isbn);
                      const stockEnOrigen = libro.stocks[bodegaOrigen] ?? 0;

                      return (
                        <div
                          key={libro.isbn}
                          onClick={() => !yaAgregado && stockEnOrigen > 0 && agregarLibro(libro)}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "10px 14px",
                            borderBottom: "1px solid #f3f4f6",
                            cursor: yaAgregado || stockEnOrigen === 0 ? "not-allowed" : "pointer",
                            background: yaAgregado ? "#f9fafb" : stockEnOrigen === 0 ? "#fef2f2" : "#ffffff",
                            opacity: yaAgregado || stockEnOrigen === 0 ? 0.6 : 1,
                          }}
                        >
                          <div>
                            <strong style={{ fontSize: "13px", color: "#0F1E36", display: "block" }}>
                              {libro.titulo}
                            </strong>
                            <small style={{ color: "#6b6565", fontSize: "11px" }}>
                              ISBN: {libro.isbn} · {libro.autor}
                            </small>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <span style={{ fontSize: "11px", color: stockEnOrigen === 0 ? "#dc2626" : "#166534", display: "block", fontWeight: 600 }}>
                              Disp. en Origen: {stockEnOrigen} un.
                            </span>
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 600,
                                color: yaAgregado ? "#6b6565" : stockEnOrigen === 0 ? "#dc2626" : "#0F1E36",
                              }}
                            >
                              {yaAgregado ? "✓ En lista" : stockEnOrigen === 0 ? "Sin stock en origen" : "+ Agregar a guía"}
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
            <div className="module-table-scroll" role="region" aria-label="Planilla de transferencia" tabIndex={0}>
              <table className="module-table" style={{ background: "#ffffff", borderRadius: "8px", overflow: "hidden" }}>
                <thead>
                  <tr style={{ background: "#f8f9fa", borderBottom: "2px solid #e2dada" }}>
                    <th scope="col" style={{ width: "150px" }}>ISBN</th>
                    <th scope="col">Título del Libro</th>
                    <th scope="col" className="module-number" style={{ width: "120px" }}>Disp. en Origen</th>
                    <th scope="col" style={{ width: "160px" }}>Cantidad a Trasladar</th>
                    <th scope="col" className="module-number" style={{ width: "120px" }}>Queda en Origen</th>
                    <th scope="col" className="module-number" style={{ width: "120px" }}>Nuevo en Destino</th>
                    <th scope="col" style={{ width: "100px", textAlign: "center" }}>Validación</th>
                    <th scope="col" style={{ width: "60px", textAlign: "center" }}>Quitar</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsTraslado.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: "center", padding: "36px 16px", color: "#6b6565" }}>
                        <p style={{ margin: 0, fontSize: "13px", fontWeight: 600 }}>
                          No hay títulos seleccionados para la transferencia.
                        </p>
                        <small style={{ display: "block", marginTop: "4px" }}>
                          Usa el buscador de arriba para añadir los libros que saldrán en el despacho interno.
                        </small>
                      </td>
                    </tr>
                  ) : (
                    itemsTraslado.map((item) => {
                      const libroCat = catalogo.find((c) => c.isbn === item.isbn);
                      const stockOrigen = libroCat?.stocks[bodegaOrigen] ?? 0;
                      const stockDestino = libroCat?.stocks[bodegaDestino] ?? 0;
                      const cant = Number(item.cantidad) || 0;

                      const excedeStock = cant > stockOrigen;
                      const esInvalido = !item.cantidad || cant <= 0 || excedeStock;
                      const remanenteOrigen = Math.max(0, stockOrigen - cant);
                      const proyectadoDestino = stockDestino + cant;

                      return (
                        <tr
                          key={item.isbn}
                          style={{
                            background: excedeStock ? "#fef2f2" : "transparent",
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
                          <td className="module-number" style={{ fontWeight: 600, color: stockOrigen === 0 ? "#dc2626" : "#2c2c2c" }}>
                            {stockOrigen} un.
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
                                max={stockOrigen}
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
                                ¡Supera existencias ({stockOrigen})!
                              </span>
                            )}
                          </td>
                          <td className="module-number" style={{ fontWeight: 600, color: "#4b5563" }}>
                            {remanenteOrigen} un.
                          </td>
                          <td className="module-number" style={{ fontWeight: 700, color: "#166534" }}>
                            {proyectadoDestino} un.
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <span
                              className={`erp-status ${esInvalido ? "danger" : "success"}`}
                              style={{ fontSize: "10px", padding: "3px 8px" }}
                            >
                              {esInvalido ? "Error" : "Disponible"}
                            </span>
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
                              title="Quitar libro de la guía"
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
                  itemsTraslado.length === 0 ||
                  validacionesItems.length > 0 ||
                  bodegaOrigen === bodegaDestino ||
                  !responsable.trim() ||
                  !motivo.trim()
                }
                className="erp-primary-button"
                style={{
                  background:
                    itemsTraslado.length === 0 ||
                    validacionesItems.length > 0 ||
                    bodegaOrigen === bodegaDestino ||
                    !responsable.trim() ||
                    !motivo.trim()
                      ? "#94a3b8"
                      : "#0F1E36",
                  color: "#ffffff",
                  padding: "10px 24px",
                  borderRadius: "7px",
                  fontWeight: 600,
                  fontSize: "13px",
                  border: 0,
                  cursor:
                    itemsTraslado.length === 0 ||
                    validacionesItems.length > 0 ||
                    bodegaOrigen === bodegaDestino ||
                    !responsable.trim() ||
                    !motivo.trim()
                      ? "not-allowed"
                      : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  transition: "background 0.2s ease",
                }}
              >
                {procesando ? (
                  <span>Emitiendo guía y trasladando existencias...</span>
                ) : (
                  <>
                    <span>Confirmar y Generar Guía de Traslado</span>
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
