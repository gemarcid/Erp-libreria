"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import ErpModuleShell from "@/components/ErpModuleShell";
import InventarioNav from "@/components/InventarioNav";
import ErpIcon from "@/components/ErpIcon";
import { useAuth } from "@/components/AuthProvider";
import { money } from "@/lib/dashboard";

const CATALOGO_BASE = [
  { isbn: "978-84-376-0494-7", titulo: "Cien Años de Soledad", autor: "Gabriel García Márquez", categoria: "Ficción", stock: 14, precio: 18500, estante: "A-01" },
  { isbn: "978-84-206-8562-4", titulo: "Don Quijote de la Mancha", autor: "Miguel de Cervantes", categoria: "Clásicos", stock: 8, precio: 24900, estante: "A-03" },
  { isbn: "978-84-376-0188-5", titulo: "Ficciones", autor: "Jorge Luis Borges", categoria: "Cuentos", stock: 3, precio: 14200, estante: "B-02" },
  { isbn: "978-956-247-456-1", titulo: "La Casa de los Espíritus", autor: "Isabel Allende", categoria: "Novela", stock: 19, precio: 16900, estante: "B-05" },
  { isbn: "978-84-376-0457-2", titulo: "Rayuela", autor: "Julio Cortázar", categoria: "Novela", stock: 5, precio: 19900, estante: "C-01" },
  { isbn: "978-84-663-3245-3", titulo: "El Aleph", autor: "Jorge Luis Borges", categoria: "Cuentos", stock: 2, precio: 13500, estante: "B-03" },
  { isbn: "978-84-9759-220-8", titulo: "Crónica de una Muerte Anunciada", autor: "Gabriel García Márquez", categoria: "Ficción", stock: 11, precio: 12900, estante: "A-02" },
  { isbn: "978-956-12-1405-7", titulo: "SubTerra", autor: "Baldomero Lillo", categoria: "Literatura Chilena", stock: 22, precio: 9900, estante: "D-01" },
];

export default function AjusteStockPage() {
  const { usuario } = useAuth();

  // Estados de catálogo y carga
  const [inventario, setInventario] = useState(CATALOGO_BASE);
  const [cargandoInventario, setCargandoInventario] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  // Formulario del ajuste
  const [tipoAjuste, setTipoAjuste] = useState("salida"); // 'entrada' | 'salida'
  const [motivoCategoria, setMotivoCategoria] = useState("");
  const [motivoDetalle, setMotivoDetalle] = useState("");
  const [documentoRef, setDocumentoRef] = useState("");
  const [sucursal, setSucursal] = useState("Casa Matriz - Bodega Central");

  // Lista de productos seleccionados para ajustar
  const [itemsAfectados, setItemsAfectados] = useState([]);

  // Estados de validación y confirmación
  const [erroresFormulario, setErroresFormulario] = useState([]);
  const [ajusteConfirmado, setAjusteConfirmado] = useState(null);
  const [procesando, setProcesando] = useState(false);

  // Intentar cargar libros reales de la API
  useEffect(() => {
    let cancelado = false;
    async function cargarLibros() {
      try {
        setCargandoInventario(true);
        const res = await fetch("/api/inventario", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0 && !cancelado) {
            setInventario(data);
          }
        }
      } catch {
        // En desarrollo o sin conexión, se conserva CATALOGO_BASE
      } finally {
        if (!cancelado) setCargandoInventario(false);
      }
    }
    cargarLibros();
    return () => { cancelado = true; };
  }, []);

  // Filtrar catálogo para selector de libros
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

  // Agregar libro a la lista de ajuste
  function agregarProducto(libro) {
    if (itemsAfectados.some((i) => i.isbn === libro.isbn)) {
      setBusqueda("");
      return;
    }
    const nuevoItem = {
      isbn: libro.isbn,
      titulo: libro.titulo,
      autor: libro.autor || "—",
      categoria: libro.categoria || "General",
      stockActual: Number(libro.stock) || 0,
      precio: Number(libro.precio) || 0,
      cantidad: 1,
    };
    setItemsAfectados((prev) => [...prev, nuevoItem]);
    setBusqueda("");
  }

  // Quitar libro de la lista
  function removerProducto(isbn) {
    setItemsAfectados((prev) => prev.filter((i) => i.isbn !== isbn));
  }

  // Actualizar cantidad con validación estricta
  function actualizarCantidad(isbn, nuevaCantidad) {
    const parsed = parseInt(nuevaCantidad, 10);
    const cantidadFinal = isNaN(parsed) ? "" : parsed;

    setItemsAfectados((prev) =>
      prev.map((item) => {
        if (item.isbn !== isbn) return item;
        return {
          ...item,
          cantidad: cantidadFinal,
        };
      })
    );
  }

  // Comprobar validez global
  const validacionItems = useMemo(() => {
    const listado = [];
    itemsAfectados.forEach((item) => {
      const cant = Number(item.cantidad);
      if (!item.cantidad || cant <= 0) {
        listado.push(`El libro "${item.titulo}" debe tener una cantidad mayor a 0.`);
      } else if (tipoAjuste === "salida" && cant > item.stockActual) {
        listado.push(
          `Stock insuficiente para "${item.titulo}": intentas dar salida a ${cant} un., pero solo hay ${item.stockActual} un. disponibles.`
        );
      }
    });
    return listado;
  }, [itemsAfectados, tipoAjuste]);

  const totalUnidades = useMemo(() => {
    return itemsAfectados.reduce((acc, curr) => acc + (Number(curr.cantidad) || 0), 0);
  }, [itemsAfectados]);

  // Manejo de envío
  function handleSubmitAjuste(e) {
    e.preventDefault();
    const errores = [];

    if (!motivoCategoria) {
      errores.push("El motivo general del ajuste es obligatorio.");
    }
    if (!motivoDetalle.trim()) {
      errores.push("Debes ingresar una justificación detallada para el registro de auditoría.");
    }
    if (itemsAfectados.length === 0) {
      errores.push("Debes seleccionar al menos un producto afectado por el ajuste.");
    }
    if (validacionItems.length > 0) {
      errores.push(...validacionItems);
    }

    if (errores.length > 0) {
      setErroresFormulario(errores);
      window.scrollTo({ top: 150, behavior: "smooth" });
      return;
    }

    setErroresFormulario([]);
    setProcesando(true);

    // Simular procesamiento del ajuste en el inventario local
    setTimeout(() => {
      const folioGenerado = `AJ-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      
      // Actualizar inventario local para reflejar el cambio inmediato
      setInventario((prev) =>
        prev.map((lib) => {
          const afectado = itemsAfectados.find((i) => i.isbn === lib.isbn);
          if (!afectado) return lib;
          const ajusteValor = tipoAjuste === "entrada" ? Number(afectado.cantidad) : -Number(afectado.cantidad);
          return {
            ...lib,
            stock: Math.max(0, Number(lib.stock) + ajusteValor),
          };
        })
      );

      setAjusteConfirmado({
        folio: folioGenerado,
        fecha: new Intl.DateTimeFormat("es-CL", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "America/Santiago",
        }).format(new Date()),
        tipo: tipoAjuste,
        motivo: motivoCategoria,
        detalle: motivoDetalle,
        documentoRef: documentoRef || "N/A",
        responsable: usuario?.nombre || "Encargado de Inventario",
        sucursal,
        items: [...itemsAfectados],
        totalUnidades,
      });

      setItemsAfectados([]);
      setMotivoCategoria("");
      setMotivoDetalle("");
      setDocumentoRef("");
      setProcesando(false);
    }, 600);
  }

  function reiniciarFormulario() {
    setAjusteConfirmado(null);
    setErroresFormulario([]);
    setItemsAfectados([]);
    setMotivoCategoria("");
    setMotivoDetalle("");
    setDocumentoRef("");
  }

  return (
    <ErpModuleShell
      module="inventario"
      liveData={true}
      title="Ajuste de Stock"
      description="Registro auditado de modificaciones directas de existencias por mermas, deterioros o cuadratura física."
      subnav={<InventarioNav activeTab="ajuste-stock" />}
    >
      <div className="erp-module-screen" style={{ maxWidth: "1280px", margin: "0 auto" }}>
        
        {/* MODAL DE ÉXITO TRAS APLICAR AJUSTE */}
        {ajusteConfirmado && (
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
                  ✓ Comprobante de Ajuste Generado
                </span>
                <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#0F1E36", margin: "10px 0 4px" }}>
                  Ajuste de Stock {ajusteConfirmado.folio} Aplicado con Éxito
                </h2>
                <p style={{ color: "#6b6565", fontSize: "13px" }}>
                  Las existencias en bodega han sido actualizadas. El movimiento quedó asentado para la trazabilidad del Kardex.
                </p>
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <Link
                  href="/inventario/kardex"
                  className="ventas-subnav-link is-active"
                  style={{ padding: "8px 16px", fontSize: "12px" }}
                >
                  Ver en Kardex de Movimientos →
                </Link>
                <button
                  type="button"
                  onClick={reiniciarFormulario}
                  className="module-secondary-button"
                  style={{ padding: "8px 16px", fontSize: "12px" }}
                >
                  Nuevo Ajuste
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
                <span style={{ fontSize: "11px", color: "#6b6565", display: "block" }}>Tipo de Operación</span>
                <strong style={{ color: ajusteConfirmado.tipo === "entrada" ? "#166534" : "#991b1b" }}>
                  {ajusteConfirmado.tipo === "entrada" ? "Entrada (+ Incremento)" : "Salida (- Deducción por Merma)"}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: "11px", color: "#6b6565", display: "block" }}>Motivo Registrado</span>
                <strong style={{ color: "#0F1E36" }}>{ajusteConfirmado.motivo}</strong>
              </div>
              <div>
                <span style={{ fontSize: "11px", color: "#6b6565", display: "block" }}>Total Unidades Afectadas</span>
                <strong style={{ color: "#0F1E36" }}>{ajusteConfirmado.totalUnidades} ejemplares</strong>
              </div>
              <div>
                <span style={{ fontSize: "11px", color: "#6b6565", display: "block" }}>Fecha / Responsable</span>
                <span style={{ fontSize: "12px", color: "#2c2c2c" }}>
                  {ajusteConfirmado.fecha} · <strong>{ajusteConfirmado.responsable}</strong>
                </span>
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

        {/* FORMULARIO PRINCIPAL (.module-panel + .module-form) */}
        <form onSubmit={handleSubmitAjuste} className="module-form" noValidate>
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
            {/* ENCABEZADO DEL FORMULARIO */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "14px",
                borderBottom: "1px solid #e2dada",
                paddingBottom: "18px",
                marginBottom: "22px",
              }}
            >
              <div>
                <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#0F1E36", margin: 0 }}>
                  Parámetros del Ajuste de Inventario
                </h2>
                <p style={{ fontSize: "12px", color: "#6b6565", marginTop: "4px" }}>
                  Ingresa el motivo obligatorio y selecciona el sentido de la variación de stock.
                </p>
              </div>

              {/* Selector de Sentido: Entrada vs Salida */}
              <div
                style={{
                  display: "inline-flex",
                  borderRadius: "8px",
                  padding: "4px",
                  background: "#ffffff",
                  border: "1px solid #e2dada",
                  gap: "4px",
                }}
              >
                <button
                  type="button"
                  onClick={() => setTipoAjuste("salida")}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "6px",
                    border: 0,
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    transition: "all 0.15s ease",
                    background: tipoAjuste === "salida" ? "#0F1E36" : "transparent",
                    color: tipoAjuste === "salida" ? "#ffffff" : "#6b6565",
                  }}
                >
                  <span>🔻 Salida (Merma / Baja)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTipoAjuste("entrada")}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "6px",
                    border: 0,
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    transition: "all 0.15s ease",
                    background: tipoAjuste === "entrada" ? "#0F1E36" : "transparent",
                    color: tipoAjuste === "entrada" ? "#ffffff" : "#6b6565",
                  }}
                >
                  <span>🔺 Entrada (Sobrante / Regularización)</span>
                </button>
              </div>
            </div>

            {/* GRILLA DE CAMPOS OBLIGATORIOS */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: "20px",
                marginBottom: "20px",
              }}
            >
              {/* Motivo del Ajuste (Obligatorio) */}
              <div>
                <label
                  htmlFor="motivo-ajuste"
                  style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#0F1E36",
                    marginBottom: "6px",
                  }}
                >
                  Motivo del Ajuste <span style={{ color: "#dc2626" }}>* (Obligatorio)</span>
                </label>
                <select
                  id="motivo-ajuste"
                  value={motivoCategoria}
                  onChange={(e) => setMotivoCategoria(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    minHeight: "42px",
                    padding: "8px 12px",
                    borderRadius: "7px",
                    border: "1px solid #0F1E36",
                    background: "#ffffff",
                    color: "#2c2c2c",
                    fontSize: "13px",
                    outline: "none",
                  }}
                >
                  <option value="">-- Seleccionar causa del ajuste --</option>
                  {tipoAjuste === "salida" ? (
                    <>
                      <option value="Merma por daño o deterioro físico">Merma por daño o deterioro físico</option>
                      <option value="Diferencia negativa en conteo físico cíclico">Diferencia negativa en conteo físico cíclico</option>
                      <option value="Ejemplar defectuoso de imprenta (devuelto a desecho)">Ejemplar defectuoso de imprenta (devuelto a desecho)</option>
                      <option value="Extravío o merma no justificada">Extravío o merma no justificada</option>
                      <option value="Baja por desactualización o vencimiento editorial">Baja por desactualización o vencimiento editorial</option>
                      <option value="Muestra comercial / Donación institucional">Muestra comercial / Donación institucional</option>
                    </>
                  ) : (
                    <>
                      <option value="Sobrante detectado en conteo físico">Sobrante detectado en conteo físico</option>
                      <option value="Reingreso regularizado por auditoría">Reingreso regularizado por auditoría</option>
                      <option value="Corrección de ingreso erróneo previo">Corrección de ingreso erróneo previo</option>
                      <option value="Donación / Remanente editorial recibido">Donación / Remanente editorial recibido</option>
                    </>
                  )}
                  <option value="Otro motivo justificado">Otro motivo justificado (detallar abajo)</option>
                </select>
              </div>

              {/* Documento o Acta de Respaldo */}
              <div>
                <label
                  htmlFor="documento-ref"
                  style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#0F1E36",
                    marginBottom: "6px",
                  }}
                >
                  Documento / Acta de Referencia
                </label>
                <input
                  id="documento-ref"
                  type="text"
                  placeholder="Ej: Acta de Merma #42, Memo B-102"
                  value={documentoRef}
                  onChange={(e) => setDocumentoRef(e.target.value)}
                  style={{
                    width: "100%",
                    minHeight: "42px",
                    padding: "8px 12px",
                    borderRadius: "7px",
                    border: "1px solid #d1d5db",
                    background: "#ffffff",
                    color: "#2c2c2c",
                    fontSize: "13px",
                    outline: "none",
                  }}
                />
              </div>

              {/* Sucursal / Bodega */}
              <div>
                <label
                  htmlFor="sucursal"
                  style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#0F1E36",
                    marginBottom: "6px",
                  }}
                >
                  Sucursal y Ubicación
                </label>
                <select
                  id="sucursal"
                  value={sucursal}
                  onChange={(e) => setSucursal(e.target.value)}
                  style={{
                    width: "100%",
                    minHeight: "42px",
                    padding: "8px 12px",
                    borderRadius: "7px",
                    border: "1px solid #d1d5db",
                    background: "#ffffff",
                    color: "#2c2c2c",
                    fontSize: "13px",
                    outline: "none",
                  }}
                >
                  <option value="Casa Matriz - Bodega Central">Casa Matriz - Bodega Central</option>
                  <option value="Sucursal Providencia - Sala de Ventas">Sucursal Providencia - Sala de Ventas</option>
                  <option value="Sucursal Centro - Exhibición">Sucursal Centro - Exhibición</option>
                </select>
              </div>
            </div>

            {/* Justificación detallada / Memo (Obligatorio) */}
            <div style={{ marginBottom: "16px" }}>
              <label
                htmlFor="motivo-detalle"
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#0F1E36",
                  marginBottom: "6px",
                }}
              >
                Justificación y Observaciones de Auditoría <span style={{ color: "#dc2626" }}>* (Obligatorio)</span>
              </label>
              <textarea
                id="motivo-detalle"
                rows={2}
                required
                placeholder="Describe claramente los hechos ocurridos, persona que detectó la anomalía y medidas tomadas..."
                value={motivoDetalle}
                onChange={(e) => setMotivoDetalle(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "7px",
                  border: "1px solid #0F1E36",
                  background: "#ffffff",
                  color: "#2c2c2c",
                  fontSize: "13px",
                  lineHeight: "1.5",
                  outline: "none",
                  resize: "vertical",
                }}
              />
            </div>
          </div>

          {/* SECCIÓN 2: BUSCADOR DE PRODUCTOS Y TABLA DE AFECTADOS */}
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
                gap: "12px",
                marginBottom: "16px",
              }}
            >
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#0F1E36", margin: 0 }}>
                  Productos Afectados por la Operación
                </h3>
                <p style={{ fontSize: "12px", color: "#6b6565", margin: "4px 0 0" }}>
                  Busca por ISBN o título del libro para agregarlo a la planilla de ajuste.
                </p>
              </div>

              {/* Resumen de totales */}
              <div
                style={{
                  display: "flex",
                  gap: "14px",
                  fontSize: "12px",
                  background: "#ffffff",
                  padding: "6px 14px",
                  borderRadius: "8px",
                  border: "1px solid #e2dada",
                }}
              >
                <span>
                  Líneas agregadas: <strong>{itemsAfectados.length}</strong>
                </span>
                <span>•</span>
                <span>
                  Total unidades a {tipoAjuste === "entrada" ? "ingresar" : "dar de baja"}:{" "}
                  <strong style={{ color: tipoAjuste === "entrada" ? "#166534" : "#991b1b" }}>
                    {totalUnidades} un.
                  </strong>
                </span>
              </div>
            </div>

            {/* Barra de Búsqueda de Libros */}
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
                  aria-label="Buscar producto para agregar al ajuste"
                  placeholder="Escribe ISBN, título del libro o autor para agregar..."
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

              {/* Menú flotante de resultados de búsqueda */}
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
                      No se encontraron títulos que coincidan con &quot;{busqueda}&quot;.
                    </p>
                  ) : (
                    librosFiltrados.map((libro) => {
                      const yaAgregado = itemsAfectados.some((i) => i.isbn === libro.isbn);
                      return (
                        <div
                          key={libro.isbn}
                          onClick={() => !yaAgregado && agregarProducto(libro)}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "10px 14px",
                            borderBottom: "1px solid #f3f4f6",
                            cursor: yaAgregado ? "not-allowed" : "pointer",
                            background: yaAgregado ? "#f9fafb" : "#ffffff",
                            opacity: yaAgregado ? 0.6 : 1,
                          }}
                        >
                          <div>
                            <strong style={{ fontSize: "13px", color: "#0F1E36", display: "block" }}>
                              {libro.titulo}
                            </strong>
                            <small style={{ color: "#6b6565", fontSize: "11px" }}>
                              ISBN: {libro.isbn} · {libro.autor || "Autor no esp."} · Cat: {libro.categoria || "General"}
                            </small>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <span style={{ fontSize: "11px", color: "#6b6565", display: "block" }}>
                              Stock: <strong>{libro.stock} un.</strong>
                            </span>
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 600,
                                color: yaAgregado ? "#6b6565" : "#0F1E36",
                              }}
                            >
                              {yaAgregado ? "✓ Agregado" : "+ Agregar a la lista"}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* TABLA DE PRODUCTOS A MODIFICAR (.module-table-scroll + .module-table) */}
            <div className="module-table-scroll" role="region" aria-label="Productos del ajuste" tabIndex={0}>
              <table className="module-table" style={{ background: "#ffffff", borderRadius: "8px", overflow: "hidden" }}>
                <thead>
                  <tr style={{ background: "#f8f9fa", borderBottom: "2px solid #e2dada" }}>
                    <th scope="col" style={{ width: "160px" }}>ISBN</th>
                    <th scope="col">Título del Libro</th>
                    <th scope="col" className="module-number" style={{ width: "120px" }}>Stock Actual</th>
                    <th scope="col" style={{ width: "170px" }}>
                      Cantidad {tipoAjuste === "entrada" ? "(+ Entrada)" : "(- Salida)"}
                    </th>
                    <th scope="col" className="module-number" style={{ width: "130px" }}>Stock Resultante</th>
                    <th scope="col" style={{ width: "120px", textAlign: "center" }}>Validación</th>
                    <th scope="col" style={{ width: "80px", textAlign: "center" }}>Quitar</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsAfectados.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", padding: "32px 16px", color: "#6b6565" }}>
                        <p style={{ margin: 0, fontSize: "13px", fontWeight: 500 }}>
                          No has añadido productos al ajuste.
                        </p>
                        <small style={{ display: "block", marginTop: "4px" }}>
                          Usa el buscador de arriba para seleccionar los títulos que sufrieron merma o cuadratura.
                        </small>
                      </td>
                    </tr>
                  ) : (
                    itemsAfectados.map((item) => {
                      const cantNum = Number(item.cantidad) || 0;
                      const excedeStock = tipoAjuste === "salida" && cantNum > item.stockActual;
                      const esInvalido = !item.cantidad || cantNum <= 0 || excedeStock;
                      const nuevoStock =
                        tipoAjuste === "entrada"
                          ? item.stockActual + cantNum
                          : Math.max(0, item.stockActual - cantNum);

                      return (
                        <tr
                          key={item.isbn}
                          style={{
                            background: excedeStock ? "#fef2f2" : "transparent",
                            transition: "background 0.2s ease",
                          }}
                        >
                          <td style={{ fontFamily: "monospace", fontSize: "12px", color: "#4b5563" }}>
                            {item.isbn}
                          </td>
                          <td>
                            <strong style={{ color: "#0F1E36", display: "block" }}>{item.titulo}</strong>
                            <small style={{ color: "#6b6565" }}>
                              {item.autor} · {item.categoria} · {money(item.precio)}
                            </small>
                          </td>
                          <td className="module-number" style={{ fontWeight: 600 }}>
                            {item.stockActual} un.
                          </td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <button
                                type="button"
                                onClick={() => actualizarCantidad(item.isbn, Math.max(1, cantNum - 1))}
                                style={{
                                  width: "28px",
                                  height: "32px",
                                  border: "1px solid #d1d5db",
                                  background: "#f3f4f6",
                                  borderRadius: "4px",
                                  fontWeight: "bold",
                                  cursor: "pointer",
                                }}
                                title="Restar 1"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="1"
                                max={tipoAjuste === "salida" ? item.stockActual : 9999}
                                value={item.cantidad}
                                onChange={(e) => actualizarCantidad(item.isbn, e.target.value)}
                                style={{
                                  width: "70px",
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
                                onClick={() => actualizarCantidad(item.isbn, cantNum + 1)}
                                style={{
                                  width: "28px",
                                  height: "32px",
                                  border: "1px solid #d1d5db",
                                  background: "#f3f4f6",
                                  borderRadius: "4px",
                                  fontWeight: "bold",
                                  cursor: "pointer",
                                }}
                                title="Sumar 1"
                              >
                                +
                              </button>
                            </div>
                            {excedeStock && (
                              <span style={{ display: "block", color: "#dc2626", fontSize: "10px", marginTop: "4px", fontWeight: 600 }}>
                                ¡Excede stock disponible ({item.stockActual})!
                              </span>
                            )}
                          </td>
                          <td className="module-number" style={{ fontWeight: 700, color: "#0F1E36" }}>
                            {nuevoStock} un.
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <span
                              className={`erp-status ${esInvalido ? "danger" : "success"}`}
                              style={{ fontSize: "10px", padding: "3px 8px" }}
                            >
                              {esInvalido ? "Error" : "Válido"}
                            </span>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <button
                              type="button"
                              onClick={() => removerProducto(item.isbn)}
                              style={{
                                border: 0,
                                background: "transparent",
                                color: "#dc2626",
                                cursor: "pointer",
                                fontSize: "16px",
                                padding: "4px 8px",
                              }}
                              title="Quitar libro de la lista"
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
                  itemsAfectados.length === 0 ||
                  validacionItems.length > 0 ||
                  !motivoCategoria ||
                  !motivoDetalle.trim()
                }
                className="erp-primary-button"
                style={{
                  background:
                    itemsAfectados.length === 0 || validacionItems.length > 0 || !motivoCategoria || !motivoDetalle.trim()
                      ? "#94a3b8"
                      : "#0F1E36",
                  color: "#ffffff",
                  padding: "10px 24px",
                  borderRadius: "7px",
                  fontWeight: 600,
                  fontSize: "13px",
                  border: 0,
                  cursor:
                    itemsAfectados.length === 0 || validacionItems.length > 0 || !motivoCategoria || !motivoDetalle.trim()
                      ? "not-allowed"
                      : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  transition: "background 0.2s ease",
                }}
              >
                {procesando ? (
                  <span>Procesando ajuste...</span>
                ) : (
                  <>
                    <span>Confirmar y Aplicar Ajuste en Bodega</span>
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
