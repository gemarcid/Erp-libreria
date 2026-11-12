"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import ErpModuleShell from "@/components/ErpModuleShell";
import ErpIcon from "@/components/ErpIcon";
import { money } from "@/lib/dashboard";
import { createCsv } from "@/lib/csv";

/**
 * Barra de navegación superior integrada para el Módulo de Inventario (.ventas-subnav)
 */
function InventarioNav({ activeTab }) {
  const links = [
    { href: "/inventario", label: "Catálogo de Existencias", icon: "inventory", key: "catalogo" },
    { href: "/inventario/ajuste-stock", label: "Ajuste de Stock", icon: "settings", key: "ajuste-stock" },
    { href: "/inventario?vista=critico", label: "Stock Bajo (Crítico)", icon: "bell", key: "stock-bajo" },
    { href: "/inventario/kardex", label: "Kardex de Movimientos", icon: "trend", key: "kardex" },
  ];

  return (
    <nav
      className="ventas-subnav"
      aria-label="Navegación del módulo de inventario"
      style={{ overflowX: "auto", whiteSpace: "nowrap" }}
    >
      {links.map((link) => {
        const isActive = activeTab === link.key;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`ventas-subnav-link ${isActive ? "is-active" : ""}`}
            aria-current={isActive ? "page" : undefined}
          >
            <ErpIcon name={link.icon} />
            <span>{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

const MOVIMIENTOS_KARDEX_INICIALES = [
  {
    id: 1,
    fecha: "2026-11-12 10:15",
    isbn: "978-84-376-0494-7",
    titulo: "Cien Años de Soledad",
    tipoOperacion: "Ajuste Salida", // Entrada, Salida, Ajuste Entrada, Ajuste Salida
    tipoComprobante: "Ajuste de Stock",
    documento: "AJ-2026-0089",
    motivo: "Merma por rotura de encuadernación en exhibición",
    entradaCantidad: null,
    entradaCostoUnit: null,
    entradaTotal: null,
    salidaCantidad: 2,
    salidaCostoUnit: 12500,
    salidaTotal: 25000,
    saldoCantidad: 14,
    saldoCostoPromedio: 12500,
    saldoValorTotal: 175000,
  },
  {
    id: 2,
    fecha: "2026-11-11 16:45",
    isbn: "978-84-206-8562-4",
    titulo: "Don Quijote de la Mancha",
    tipoOperacion: "Salida",
    tipoComprobante: "Boleta de Venta",
    documento: "BV-0004921",
    motivo: "Venta directa en mesón POS",
    entradaCantidad: null,
    entradaCostoUnit: null,
    entradaTotal: null,
    salidaCantidad: 1,
    salidaCostoUnit: 16800,
    salidaTotal: 16800,
    saldoCantidad: 8,
    saldoCostoPromedio: 16800,
    saldoValorTotal: 134400,
  },
  {
    id: 3,
    fecha: "2026-11-10 11:30",
    isbn: "978-956-247-456-1",
    titulo: "La Casa de los Espíritus",
    tipoOperacion: "Entrada",
    tipoComprobante: "Factura de Compra",
    documento: "FC-008412",
    motivo: "Recepción de pedido editorial Penguin Random House",
    entradaCantidad: 15,
    entradaCostoUnit: 10800,
    entradaTotal: 162000,
    salidaCantidad: null,
    salidaCostoUnit: null,
    salidaTotal: null,
    saldoCantidad: 19,
    saldoCostoPromedio: 10800,
    saldoValorTotal: 205200,
  },
  {
    id: 4,
    fecha: "2026-11-09 18:20",
    isbn: "978-84-376-0188-5",
    titulo: "Ficciones",
    tipoOperacion: "Salida",
    tipoComprobante: "Factura de Venta",
    documento: "FV-0001048",
    motivo: "Despacho a biblioteca escolar convenio",
    entradaCantidad: null,
    entradaCostoUnit: null,
    entradaTotal: null,
    salidaCantidad: 4,
    salidaCostoUnit: 9200,
    salidaTotal: 36800,
    saldoCantidad: 3,
    saldoCostoPromedio: 9200,
    saldoValorTotal: 27600,
  },
  {
    id: 5,
    fecha: "2026-11-08 14:10",
    isbn: "978-84-376-0457-2",
    titulo: "Rayuela",
    tipoOperacion: "Ajuste Entrada",
    tipoComprobante: "Ajuste de Stock",
    documento: "AJ-2026-0044",
    motivo: "Sobrante hallado en auditoría de estante C-01",
    entradaCantidad: 2,
    entradaCostoUnit: 13200,
    entradaTotal: 26400,
    salidaCantidad: null,
    salidaCostoUnit: null,
    salidaTotal: null,
    saldoCantidad: 5,
    saldoCostoPromedio: 13200,
    saldoValorTotal: 66000,
  },
  {
    id: 6,
    fecha: "2026-11-07 09:50",
    isbn: "978-84-663-3245-3",
    titulo: "El Aleph",
    tipoOperacion: "Salida",
    tipoComprobante: "Boleta de Venta",
    documento: "BV-0004810",
    motivo: "Venta mesón Casa Matriz",
    entradaCantidad: null,
    entradaCostoUnit: null,
    entradaTotal: null,
    salidaCantidad: 2,
    salidaCostoUnit: 8900,
    salidaTotal: 17800,
    saldoCantidad: 2,
    saldoCostoPromedio: 8900,
    saldoValorTotal: 17800,
  },
  {
    id: 7,
    fecha: "2026-11-05 15:00",
    isbn: "978-956-12-1405-7",
    titulo: "SubTerra",
    tipoOperacion: "Entrada",
    tipoComprobante: "Factura de Compra",
    documento: "FC-008290",
    motivo: "Reposición masiva Editorial Zig-Zag",
    entradaCantidad: 20,
    entradaCostoUnit: 6400,
    entradaTotal: 128000,
    salidaCantidad: null,
    salidaCostoUnit: null,
    salidaTotal: null,
    saldoCantidad: 22,
    saldoCostoPromedio: 6400,
    saldoValorTotal: 140800,
  },
];

export default function KardexPage() {
  // Estados de filtros
  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [movimientoDetalle, setMovimientoDetalle] = useState(null);

  // Filtrado de movimientos
  const movimientosFiltrados = useMemo(() => {
    return MOVIMIENTOS_KARDEX_INICIALES.filter((mov) => {
      // Filtro texto: ISBN, título, folio documento o motivo
      if (busqueda.trim()) {
        const query = busqueda.toLowerCase().trim();
        const textoFila = `${mov.isbn} ${mov.titulo} ${mov.documento} ${mov.motivo} ${mov.tipoComprobante}`.toLowerCase();
        if (!textoFila.includes(query)) return false;
      }

      // Filtro por tipo de movimiento
      if (filtroTipo !== "todos") {
        if (filtroTipo === "entradas" && !mov.tipoOperacion.includes("Entrada")) return false;
        if (filtroTipo === "salidas" && !mov.tipoOperacion.includes("Salida")) return false;
        if (filtroTipo === "ajustes" && !mov.tipoOperacion.includes("Ajuste")) return false;
      }

      // Filtro por fechas
      if (fechaDesde && mov.fecha.slice(0, 10) < fechaDesde) return false;
      if (fechaHasta && mov.fecha.slice(0, 10) > fechaHasta) return false;

      return true;
    });
  }, [busqueda, filtroTipo, fechaDesde, fechaHasta]);

  // Totales y KPIs calculados
  const metricas = useMemo(() => {
    let totalEntradasUnid = 0;
    let totalEntradasValor = 0;
    let totalSalidasUnid = 0;
    let totalSalidasValor = 0;

    movimientosFiltrados.forEach((m) => {
      if (m.entradaCantidad) {
        totalEntradasUnid += m.entradaCantidad;
        totalEntradasValor += m.entradaTotal || 0;
      }
      if (m.salidaCantidad) {
        totalSalidasUnid += m.salidaCantidad;
        totalSalidasValor += m.salidaTotal || 0;
      }
    });

    const valorizacionInventario = movimientosFiltrados.reduce(
      (acc, curr) => acc + (curr.saldoValorTotal || 0),
      0
    );

    return {
      totalEntradasUnid,
      totalEntradasValor,
      totalSalidasUnid,
      totalSalidasValor,
      totalMovimientos: movimientosFiltrados.length,
      valorizacionInventario,
    };
  }, [movimientosFiltrados]);

  // Exportar a CSV
  function handleExportarCsv() {
    const filas = [
      [
        "Fecha",
        "Documento",
        "Tipo Comprobante",
        "ISBN",
        "Título",
        "Tipo Movimiento",
        "Entrada Cant.",
        "Entrada Costo Unit.",
        "Entrada Total",
        "Salida Cant.",
        "Salida Costo Unit.",
        "Salida Total",
        "Saldo Cant.",
        "Costo Promedio",
        "Saldo Valor Total",
        "Motivo / Observaciones",
      ],
      ...movimientosFiltrados.map((m) => [
        m.fecha,
        m.documento,
        m.tipoComprobante,
        m.isbn,
        m.titulo,
        m.tipoOperacion,
        m.entradaCantidad ?? 0,
        m.entradaCostoUnit ?? 0,
        m.entradaTotal ?? 0,
        m.salidaCantidad ?? 0,
        m.salidaCostoUnit ?? 0,
        m.salidaTotal ?? 0,
        m.saldoCantidad,
        m.saldoCostoPromedio,
        m.saldoValorTotal,
        m.motivo,
      ]),
    ];

    const csvContent = createCsv(filas);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `kardex_movimientos_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function resetFiltros() {
    setBusqueda("");
    setFiltroTipo("todos");
    setFechaDesde("");
    setFechaHasta("");
  }

  return (
    <ErpModuleShell
      module="inventario"
      liveData={true}
      title="Kardex de Movimientos"
      description="Libro mayor de inventario físico y valorizado bajo método de Costo Promedio Ponderado (CPP)."
      subnav={<InventarioNav activeTab="kardex" />}
      actions={
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            type="button"
            onClick={handleExportarCsv}
            className="module-secondary-button"
            style={{
              background: "#ffffff",
              border: "1px solid #0F1E36",
              color: "#0F1E36",
              fontWeight: 600,
            }}
          >
            <ErpIcon name="trend" />
            <span>Descargar Planilla CSV</span>
          </button>
        </div>
      }
    >
      <div className="erp-module-screen" style={{ maxWidth: "1380px", margin: "0 auto" }}>
        
        {/* TARJETAS RESUMEN DE INDICADORES (KPIS) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px",
            marginBottom: "24px",
          }}
        >
          {/* Card 1: Entradas */}
          <div
            className="erp-card"
            style={{
              background: "#FDFBF7",
              border: "1px solid #e2dada",
              borderLeft: "4px solid #166534",
              borderRadius: "10px",
              padding: "18px 20px",
            }}
          >
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#166534", textTransform: "uppercase" }}>
              Total Entradas (Compras / Sobrantes)
            </span>
            <strong style={{ fontSize: "24px", display: "block", color: "#0F1E36", margin: "6px 0 2px" }}>
              {metricas.totalEntradasUnid} un.
            </strong>
            <small style={{ color: "#6b6565", fontSize: "12px" }}>
              Valor acumulado: {money(metricas.totalEntradasValor)}
            </small>
          </div>

          {/* Card 2: Salidas */}
          <div
            className="erp-card"
            style={{
              background: "#FDFBF7",
              border: "1px solid #e2dada",
              borderLeft: "4px solid #991b1b",
              borderRadius: "10px",
              padding: "18px 20px",
            }}
          >
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#991b1b", textTransform: "uppercase" }}>
              Total Salidas (Ventas / Mermas)
            </span>
            <strong style={{ fontSize: "24px", display: "block", color: "#0F1E36", margin: "6px 0 2px" }}>
              {metricas.totalSalidasUnid} un.
            </strong>
            <small style={{ color: "#6b6565", fontSize: "12px" }}>
              Costo de salida: {money(metricas.totalSalidasValor)}
            </small>
          </div>

          {/* Card 3: Operaciones Auditadas */}
          <div
            className="erp-card"
            style={{
              background: "#FDFBF7",
              border: "1px solid #e2dada",
              borderLeft: "4px solid #0F1E36",
              borderRadius: "10px",
              padding: "18px 20px",
            }}
          >
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#0F1E36", textTransform: "uppercase" }}>
              Movimientos Auditados
            </span>
            <strong style={{ fontSize: "24px", display: "block", color: "#0F1E36", margin: "6px 0 2px" }}>
              {metricas.totalMovimientos} registros
            </strong>
            <small style={{ color: "#6b6565", fontSize: "12px" }}>
              Filtro activo en el período seleccionado
            </small>
          </div>

          {/* Card 4: Valorización */}
          <div
            className="erp-card"
            style={{
              background: "#FDFBF7",
              border: "1px solid #e2dada",
              borderLeft: "4px solid #d97706",
              borderRadius: "10px",
              padding: "18px 20px",
            }}
          >
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#b45309", textTransform: "uppercase" }}>
              Valorización de Muestra
            </span>
            <strong style={{ fontSize: "24px", display: "block", color: "#0F1E36", margin: "6px 0 2px" }}>
              {money(metricas.valorizacionInventario)}
            </strong>
            <small style={{ color: "#6b6565", fontSize: "12px" }}>
              Costo Promedio Ponderado
            </small>
          </div>
        </div>

        {/* PANEL DE FILTROS (.module-panel + .erp-card) */}
        <section
          className="module-panel erp-card"
          style={{
            background: "#FDFBF7",
            border: "1px solid #e2dada",
            borderRadius: "12px",
            padding: "20px 24px",
            marginBottom: "24px",
          }}
          aria-label="Filtros del Kardex"
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <h2 style={{ fontSize: "15px", fontWeight: 700, color: "#0F1E36", margin: 0 }}>
              Criterios de Búsqueda y Rango de Fechas
            </h2>
            {(busqueda || filtroTipo !== "todos" || fechaDesde || fechaHasta) && (
              <button
                type="button"
                onClick={resetFiltros}
                style={{
                  background: "transparent",
                  border: 0,
                  color: "#0F1E36",
                  fontSize: "12px",
                  fontWeight: 600,
                  textDecoration: "underline",
                  cursor: "pointer",
                }}
              >
                Limpiar filtros
              </button>
            )}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "14px",
              alignItems: "end",
            }}
          >
            {/* Buscador de texto */}
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#6b6565", marginBottom: "4px" }}>
                Buscar por ISBN, Libro o Folio
              </label>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  background: "#ffffff",
                  border: "1px solid #0F1E36",
                  borderRadius: "7px",
                  padding: "0 10px",
                }}
              >
                <ErpIcon name="search" />
                <input
                  type="search"
                  placeholder="Ej: Cien Años, FC-008412..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  style={{
                    width: "100%",
                    minHeight: "38px",
                    border: 0,
                    outline: "none",
                    fontSize: "12px",
                    background: "transparent",
                  }}
                />
              </div>
            </div>

            {/* Selector de Tipo de Operación */}
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#6b6565", marginBottom: "4px" }}>
                Tipo de Movimiento
              </label>
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                style={{
                  width: "100%",
                  minHeight: "40px",
                  padding: "6px 12px",
                  borderRadius: "7px",
                  border: "1px solid #d1d5db",
                  background: "#ffffff",
                  fontSize: "12px",
                  outline: "none",
                }}
              >
                <option value="todos">Todos los movimientos</option>
                <option value="entradas">Sólo Entradas (Compras / Sobrantes)</option>
                <option value="salidas">Sólo Salidas (Ventas / Bajas)</option>
                <option value="ajustes">Sólo Ajustes Manuales de Stock</option>
              </select>
            </div>

            {/* Fecha Desde */}
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#6b6565", marginBottom: "4px" }}>
                Fecha Desde
              </label>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                style={{
                  width: "100%",
                  minHeight: "40px",
                  padding: "6px 10px",
                  borderRadius: "7px",
                  border: "1px solid #d1d5db",
                  background: "#ffffff",
                  fontSize: "12px",
                  outline: "none",
                }}
              />
            </div>

            {/* Fecha Hasta */}
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#6b6565", marginBottom: "4px" }}>
                Fecha Hasta
              </label>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                style={{
                  width: "100%",
                  minHeight: "40px",
                  padding: "6px 10px",
                  borderRadius: "7px",
                  border: "1px solid #d1d5db",
                  background: "#ffffff",
                  fontSize: "12px",
                  outline: "none",
                }}
              />
            </div>
          </div>
        </section>

        {/* TABLA PRINCIPAL DEL KARDEX (.module-panel + .module-table-scroll + .module-table) */}
        <section
          className="module-panel erp-card"
          style={{
            background: "#FDFBF7",
            border: "1px solid #e2dada",
            borderRadius: "12px",
            padding: "24px",
            marginBottom: "32px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div>
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#0F1E36", margin: 0 }}>
                Detalle Cronológico Físico y Valorizado
              </h3>
              <p style={{ fontSize: "12px", color: "#6b6565", margin: "4px 0 0" }}>
                Visualización de unidades y valor monetario correspondiente a cada transacción.
              </p>
            </div>
            <span style={{ fontSize: "12px", color: "#6b6565" }}>
              Mostrando <strong>{movimientosFiltrados.length}</strong> operaciones
            </span>
          </div>

          <div className="module-table-scroll" role="region" aria-label="Tabla de Kardex" tabIndex={0}>
            <table
              className="module-table"
              style={{
                background: "#ffffff",
                borderRadius: "8px",
                borderCollapse: "collapse",
                width: "100%",
              }}
            >
              <thead>
                {/* Fila superior de grupos de columnas */}
                <tr style={{ background: "#0F1E36", color: "#ffffff" }}>
                  <th colSpan={3} style={{ textAlign: "left", padding: "10px 12px", fontSize: "11px", letterSpacing: "0.05em" }}>
                    DOCUMENTO Y PRODUCTO
                  </th>
                  <th colSpan={3} style={{ textAlign: "center", padding: "10px 12px", fontSize: "11px", background: "#166534", color: "#ffffff" }}>
                    ENTRADAS (INGRESOS)
                  </th>
                  <th colSpan={3} style={{ textAlign: "center", padding: "10px 12px", fontSize: "11px", background: "#991b1b", color: "#ffffff" }}>
                    SALIDAS (EGRESOS)
                  </th>
                  <th colSpan={3} style={{ textAlign: "center", padding: "10px 12px", fontSize: "11px", background: "#1e3a8a", color: "#ffffff" }}>
                    SALDOS EN EXISTENCIA
                  </th>
                </tr>

                {/* Sub-encabezados específicos */}
                <tr style={{ background: "#f8f9fa", borderBottom: "2px solid #e2dada", fontSize: "10px" }}>
                  <th scope="col" style={{ width: "120px" }}>Fecha / Hora</th>
                  <th scope="col" style={{ width: "160px" }}>Comprobante</th>
                  <th scope="col">Título e ISBN</th>
                  
                  {/* Entradas */}
                  <th scope="col" className="module-number" style={{ width: "70px", color: "#166534" }}>Cant.</th>
                  <th scope="col" className="module-number" style={{ width: "85px", color: "#166534" }}>Costo U.</th>
                  <th scope="col" className="module-number" style={{ width: "95px", color: "#166534" }}>Total</th>

                  {/* Salidas */}
                  <th scope="col" className="module-number" style={{ width: "70px", color: "#991b1b" }}>Cant.</th>
                  <th scope="col" className="module-number" style={{ width: "85px", color: "#991b1b" }}>Costo U.</th>
                  <th scope="col" className="module-number" style={{ width: "95px", color: "#991b1b" }}>Total</th>

                  {/* Saldos */}
                  <th scope="col" className="module-number" style={{ width: "80px", color: "#1e3a8a", fontWeight: 700 }}>Stock</th>
                  <th scope="col" className="module-number" style={{ width: "85px", color: "#1e3a8a" }}>PPP</th>
                  <th scope="col" className="module-number" style={{ width: "100px", color: "#1e3a8a", fontWeight: 700 }}>Total Valor</th>
                </tr>
              </thead>

              <tbody>
                {movimientosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={12} style={{ textAlign: "center", padding: "36px 16px", color: "#6b6565" }}>
                      <p style={{ margin: 0, fontSize: "13px", fontWeight: 600 }}>
                        No se encontraron transacciones en el Kardex.
                      </p>
                      <small style={{ display: "block", marginTop: "4px" }}>
                        Intenta flexibilizar el rango de fechas o los términos de búsqueda.
                      </small>
                    </td>
                  </tr>
                ) : (
                  movimientosFiltrados.map((mov) => {
                    const esAjuste = mov.tipoOperacion.includes("Ajuste");
                    const esEntrada = mov.tipoOperacion.includes("Entrada");
                    const esSeleccionado = movimientoDetalle?.id === mov.id;

                    return (
                      <tr
                        key={mov.id}
                        onClick={() => setMovimientoDetalle(esSeleccionado ? null : mov)}
                        style={{
                          cursor: "pointer",
                          background: esSeleccionado ? "#fef3c7" : "transparent",
                          transition: "background 0.15s ease",
                        }}
                      >
                        {/* Fecha */}
                        <td style={{ fontSize: "11px", color: "#4b5563", whiteSpace: "nowrap" }}>
                          {mov.fecha}
                        </td>

                        {/* Comprobante */}
                        <td>
                          <span
                            style={{
                              display: "inline-block",
                              fontWeight: 700,
                              color: "#0F1E36",
                              fontSize: "12px",
                              fontFamily: "monospace",
                            }}
                          >
                            {mov.documento}
                          </span>
                          <small style={{ color: "#6b6565", display: "block" }}>
                            {mov.tipoComprobante}
                          </small>
                        </td>

                        {/* Producto */}
                        <td>
                          <strong style={{ color: "#0F1E36", display: "block", fontSize: "12px" }}>
                            {mov.titulo}
                          </strong>
                          <small style={{ color: "#6b6565", fontSize: "10px", fontFamily: "monospace" }}>
                            {mov.isbn}
                          </small>
                          {esAjuste && (
                            <span
                              style={{
                                display: "inline-block",
                                background: esEntrada ? "#dcfce7" : "#fee2e2",
                                color: esEntrada ? "#166534" : "#991b1b",
                                fontSize: "9px",
                                fontWeight: 700,
                                padding: "1px 6px",
                                borderRadius: "4px",
                                marginTop: "2px",
                              }}
                            >
                              {mov.tipoOperacion}
                            </span>
                          )}
                        </td>

                        {/* ENTRADAS */}
                        <td className="module-number" style={{ color: mov.entradaCantidad ? "#166534" : "#9ca3af", fontWeight: mov.entradaCantidad ? 600 : 400 }}>
                          {mov.entradaCantidad ? `+${mov.entradaCantidad}` : "—"}
                        </td>
                        <td className="module-number" style={{ color: mov.entradaCostoUnit ? "#2c2c2c" : "#9ca3af" }}>
                          {mov.entradaCostoUnit ? money(mov.entradaCostoUnit) : "—"}
                        </td>
                        <td className="module-number" style={{ color: mov.entradaTotal ? "#166534" : "#9ca3af", fontWeight: mov.entradaTotal ? 600 : 400 }}>
                          {mov.entradaTotal ? money(mov.entradaTotal) : "—"}
                        </td>

                        {/* SALIDAS */}
                        <td className="module-number" style={{ color: mov.salidaCantidad ? "#991b1b" : "#9ca3af", fontWeight: mov.salidaCantidad ? 600 : 400 }}>
                          {mov.salidaCantidad ? `-${mov.salidaCantidad}` : "—"}
                        </td>
                        <td className="module-number" style={{ color: mov.salidaCostoUnit ? "#2c2c2c" : "#9ca3af" }}>
                          {mov.salidaCostoUnit ? money(mov.salidaCostoUnit) : "—"}
                        </td>
                        <td className="module-number" style={{ color: mov.salidaTotal ? "#991b1b" : "#9ca3af", fontWeight: mov.salidaTotal ? 600 : 400 }}>
                          {mov.salidaTotal ? money(mov.salidaTotal) : "—"}
                        </td>

                        {/* SALDOS HISTÓRICOS */}
                        <td className="module-number" style={{ fontWeight: 700, color: "#0F1E36" }}>
                          {mov.saldoCantidad} un.
                        </td>
                        <td className="module-number" style={{ color: "#4b5563" }}>
                          {money(mov.saldoCostoPromedio)}
                        </td>
                        <td className="module-number" style={{ fontWeight: 700, color: "#0F1E36" }}>
                          {money(mov.saldoValorTotal)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* DETALLE INLINE DEL MOVIMIENTO SELECCIONADO */}
          {movimientoDetalle && (
            <div
              style={{
                marginTop: "20px",
                padding: "16px 20px",
                background: "#ffffff",
                border: "1px solid #0F1E36",
                borderRadius: "8px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "14px",
              }}
            >
              <div>
                <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#0F1E36" }}>
                  Auditoría del Documento: {movimientoDetalle.documento} ({movimientoDetalle.tipoComprobante})
                </span>
                <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#2c2c2c" }}>
                  <strong>Motivo / Glosa:</strong> {movimientoDetalle.motivo}
                </p>
                <small style={{ color: "#6b6565" }}>
                  Título: {movimientoDetalle.titulo} · Registrado el {movimientoDetalle.fecha}
                </small>
              </div>

              <button
                type="button"
                onClick={() => setMovimientoDetalle(null)}
                className="module-secondary-button"
                style={{ fontSize: "11px", padding: "6px 12px" }}
              >
                Cerrar Detalle ✕
              </button>
            </div>
          )}

          <p className="module-caption" style={{ marginTop: "16px" }}>
            Nota contable: El método de valorización aplicado es Costo Promedio Ponderado (CPP). Los ajustes manuales por merma se reflejan con impacto directo sobre el saldo valorizado para dar cumplimiento al estándar contable IFRS/NIIF de inventarios (NIC 2).
          </p>
        </section>
      </div>
    </ErpModuleShell>
  );
}
