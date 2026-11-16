"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import ErpModuleShell from "@/components/ErpModuleShell";
import ErpIcon from "@/components/ErpIcon";
import InventarioNav from "@/components/InventarioNav";
import { money } from "@/lib/dashboard";
import { createCsv } from "@/lib/csv";

const SUCURSALES = [
  { id: "matriz", nombre: "Casa Matriz (Bodega Central)", shortName: "Casa Matriz" },
  { id: "providencia", nombre: "Sucursal Providencia (Sala)", shortName: "Providencia" },
  { id: "centro", nombre: "Sucursal Centro (Almacén)", shortName: "Centro" },
];

const CATALOGO_CONSOLIDADO_BASE = [
  {
    isbn: "978-84-376-0494-7",
    titulo: "Cien Años de Soledad",
    autor: "Gabriel García Márquez",
    categoria: "Ficción",
    costoUnitario: 11200,
    precioVenta: 18500,
    stocks: { matriz: 14, providencia: 0, centro: 2 },
  },
  {
    isbn: "978-84-206-8562-4",
    titulo: "Don Quijote de la Mancha",
    autor: "Miguel de Cervantes",
    categoria: "Clásicos",
    costoUnitario: 15400,
    precioVenta: 24900,
    stocks: { matriz: 8, providencia: 1, centro: 0 },
  },
  {
    isbn: "978-84-376-0188-5",
    titulo: "Ficciones",
    autor: "Jorge Luis Borges",
    categoria: "Cuentos",
    costoUnitario: 8900,
    precioVenta: 14200,
    stocks: { matriz: 12, providencia: 2, centro: 1 },
  },
  {
    isbn: "978-956-247-456-1",
    titulo: "La Casa de los Espíritus",
    autor: "Isabel Allende",
    categoria: "Novela",
    costoUnitario: 10500,
    precioVenta: 16900,
    stocks: { matriz: 19, providencia: 4, centro: 2 },
  },
  {
    isbn: "978-84-376-0457-2",
    titulo: "Rayuela",
    autor: "Julio Cortázar",
    categoria: "Novela",
    costoUnitario: 12800,
    precioVenta: 19900,
    stocks: { matriz: 9, providencia: 0, centro: 1 },
  },
  {
    isbn: "978-84-663-3245-3",
    titulo: "El Aleph",
    autor: "Jorge Luis Borges",
    categoria: "Cuentos",
    costoUnitario: 8400,
    precioVenta: 13500,
    stocks: { matriz: 7, providencia: 0, centro: 0 },
  },
  {
    isbn: "978-84-9759-220-8",
    titulo: "Crónica de una Muerte Anunciada",
    autor: "Gabriel García Márquez",
    categoria: "Ficción",
    costoUnitario: 7900,
    precioVenta: 12900,
    stocks: { matriz: 16, providencia: 3, centro: 0 },
  },
  {
    isbn: "978-956-12-1405-7",
    titulo: "SubTerra",
    autor: "Baldomero Lillo",
    categoria: "Literatura Chilena",
    costoUnitario: 5900,
    precioVenta: 9900,
    stocks: { matriz: 22, providencia: 5, centro: 3 },
  },
  {
    isbn: "978-956-239-111-0",
    titulo: "Poemas y Antipoemas",
    autor: "Nicanor Parra",
    categoria: "Literatura Chilena",
    costoUnitario: 6800,
    precioVenta: 11500,
    stocks: { matriz: 15, providencia: 2, centro: 0 },
  },
  {
    isbn: "978-84-376-0498-5",
    titulo: "La Metamorfosis",
    autor: "Franz Kafka",
    categoria: "Clásicos",
    costoUnitario: 5400,
    precioVenta: 8900,
    stocks: { matriz: 12, providencia: 3, centro: 1 },
  },
  {
    isbn: "978-84-670-3647-3",
    titulo: "La Odisea",
    autor: "Homero",
    categoria: "Clásicos",
    costoUnitario: 8200,
    precioVenta: 13900,
    stocks: { matriz: 7, providencia: 0, centro: 2 },
  },
  {
    isbn: "978-956-347-109-8",
    titulo: "Santa María de Iquique",
    autor: "Carlos Droguett",
    categoria: "Literatura Chilena",
    costoUnitario: 7200,
    precioVenta: 12500,
    stocks: { matriz: 6, providencia: 1, centro: 0 },
  },
];

export default function ReporteConsolidadoBodegasPage() {
  const [inventario, setInventario] = useState(CATALOGO_CONSOLIDADO_BASE);
  const [filtroEstado, setFiltroEstado] = useState("todos"); // 'todos' | 'desbalanceados' | 'balanceados'
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [busqueda, setBusqueda] = useState("");

  // Sincronización con la API de inventario si está disponible
  useEffect(() => {
    let cancelado = false;
    async function sincronizar() {
      try {
        const res = await fetch("/api/inventario", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0 && !cancelado) {
            setInventario((prev) =>
              prev.map((item) => {
                const enApi = data.find((d) => d.isbn === item.isbn);
                return enApi
                  ? {
                      ...item,
                      stocks: {
                        matriz: Number(enApi.stock) || item.stocks.matriz,
                        providencia: item.stocks.providencia,
                        centro: item.stocks.centro,
                      },
                    }
                  : item;
              })
            );
          }
        }
      } catch {
        // En desarrollo o modo offline, se conserva CATALOGO_CONSOLIDADO_BASE
      }
    }
    sincronizar();
    return () => { cancelado = true; };
  }, []);

  // Procesamiento y diagnóstico de distribución
  const librosProcesados = useMemo(() => {
    return inventario.map((libro) => {
      const stockMatriz = libro.stocks.matriz || 0;
      const stockProvidencia = libro.stocks.providencia || 0;
      const stockCentro = libro.stocks.centro || 0;
      const totalRed = stockMatriz + stockProvidencia + stockCentro;
      const valorTotalRed = totalRed * libro.costoUnitario;

      // Diagnóstico de balance
      const tieneQuiebreEnSucursal =
        totalRed > 0 && (stockProvidencia === 0 || stockCentro === 0 || stockMatriz === 0);
      const oportunidadTraslado = stockMatriz >= 5 && (stockProvidencia === 0 || stockCentro === 0);

      let estadoDistribucion = "Balanceado";
      let claseBadge = "success";
      let detalleOportunidad = "Stock balanceado en sucursales";

      if (totalRed === 0) {
        estadoDistribucion = "Quiebre Total en Red";
        claseBadge = "danger";
        detalleOportunidad = "Sin existencias en ninguna bodega";
      } else if (oportunidadTraslado) {
        estadoDistribucion = "Oportunidad de Traslado";
        claseBadge = "warning";
        const sucursalesVacias = [];
        if (stockProvidencia === 0) sucursalesVacias.push("Providencia");
        if (stockCentro === 0) sucursalesVacias.push("Centro");
        detalleOportunidad = `Sobrante en Matriz (${stockMatriz}), quiebre en ${sucursalesVacias.join(", ")}`;
      } else if (tieneQuiebreEnSucursal) {
        estadoDistribucion = "Desbalance Local";
        claseBadge = "neutral";
        detalleOportunidad = "Quiebre en una sucursal con bajo remanente central";
      }

      return {
        ...libro,
        stockMatriz,
        stockProvidencia,
        stockCentro,
        totalRed,
        valorTotalRed,
        tieneQuiebreEnSucursal,
        oportunidadTraslado,
        estadoDistribucion,
        claseBadge,
        detalleOportunidad,
      };
    });
  }, [inventario]);

  // Filtrado de libros
  const librosFiltrados = useMemo(() => {
    return librosProcesados.filter((l) => {
      if (filtroEstado === "desbalanceados" && !l.tieneQuiebreEnSucursal) return false;
      if (filtroEstado === "balanceados" && l.tieneQuiebreEnSucursal) return false;
      if (filtroCategoria !== "todas" && l.categoria !== filtroCategoria) return false;
      if (busqueda.trim()) {
        const q = busqueda.toLowerCase().trim();
        const texto = `${l.isbn} ${l.titulo} ${l.autor} ${l.categoria}`.toLowerCase();
        if (!texto.includes(q)) return false;
      }
      return true;
    });
  }, [librosProcesados, filtroEstado, filtroCategoria, busqueda]);

  // Totales y KPIs de la red
  const metricas = useMemo(() => {
    let stockTotalRed = 0;
    let valorMonetarioTotal = 0;
    let stockTotalMatriz = 0;
    let stockTotalProvidencia = 0;
    let stockTotalCentro = 0;
    let cantOportunidadesTraslado = 0;
    let cantQuiebresTotales = 0;

    librosProcesados.forEach((l) => {
      stockTotalRed += l.totalRed;
      valorMonetarioTotal += l.valorTotalRed;
      stockTotalMatriz += l.stockMatriz;
      stockTotalProvidencia += l.stockProvidencia;
      stockTotalCentro += l.stockCentro;

      if (l.oportunidadTraslado) cantOportunidadesTraslado += 1;
      if (l.totalRed === 0) cantQuiebresTotales += 1;
    });

    return {
      stockTotalRed,
      valorMonetarioTotal,
      stockTotalMatriz,
      stockTotalProvidencia,
      stockTotalCentro,
      cantOportunidadesTraslado,
      cantQuiebresTotales,
      bodegasActivas: SUCURSALES.length,
      totalTitulos: librosProcesados.length,
    };
  }, [librosProcesados]);

  // Categorías únicas
  const categoriasUnicas = useMemo(() => {
    const setCat = new Set(inventario.map((i) => i.categoria));
    return Array.from(setCat);
  }, [inventario]);

  // Exportar matriz a formato CSV
  function handleExportarCsv() {
    const filas = [
      [
        "ISBN",
        "Título del Libro",
        "Autor",
        "Categoría",
        "Casa Matriz (Bodega Central)",
        "Sucursal Providencia (Sala)",
        "Sucursal Centro (Almacén)",
        "Total Consolidado Red",
        "Costo Unitario",
        "Valorización Red al Costo",
        "Diagnóstico de Distribución",
        "Detalle Oportunidad Traslado",
      ],
      ...librosFiltrados.map((l) => [
        l.isbn,
        l.titulo,
        l.autor,
        l.categoria,
        l.stockMatriz,
        l.stockProvidencia,
        l.stockCentro,
        l.totalRed,
        l.costoUnitario,
        l.valorTotalRed,
        l.estadoDistribucion,
        l.detalleOportunidad,
      ]),
      [
        "TOTALES DE LA RED",
        `${metricas.totalTitulos} títulos`,
        "—",
        "—",
        metricas.stockTotalMatriz,
        metricas.stockTotalProvidencia,
        metricas.stockTotalCentro,
        metricas.stockTotalRed,
        "—",
        metricas.valorMonetarioTotal,
        `${metricas.cantOportunidadesTraslado} traslados sugeridos`,
        "—",
      ],
    ];

    const contenido = createCsv(filas);
    const blob = new Blob([contenido], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `consolidado_stock_bodegas_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <ErpModuleShell
      module="inventario"
      liveData={true}
      title="Consolidado de Stock por Bodega y Sucursal"
      description="Matriz comparativa de distribución de existencias entre Casa Matriz, salas de ventas y almacenes de la red."
      subnav={<InventarioNav activeTab="consolidado-bodegas" />}
      actions={
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <Link
            href="/inventario/transferencias"
            className="module-secondary-button"
            style={{
              background: "#0F1E36",
              color: "#ffffff",
              border: 0,
              fontWeight: 600,
              padding: "8px 14px",
              borderRadius: "7px",
            }}
          >
            <span>Transferir Stock entre Sucursales →</span>
          </Link>

          <button
            type="button"
            onClick={handleExportarCsv}
            className="module-secondary-button"
            style={{
              background: "#ffffff",
              border: "1px solid #0F1E36",
              color: "#0F1E36",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <ErpIcon name="trend" />
            <span>Exportar CSV</span>
          </button>
        </div>
      }
    >
      <div className="erp-module-screen" style={{ maxWidth: "1380px", margin: "0 auto" }}>
        
        {/* TARJETAS DE INDICADORES (KPIS) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px",
            marginBottom: "24px",
          }}
        >
          {/* KPI 1: Stock Total Consolidado */}
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
              Stock Total en la Red
            </span>
            <strong style={{ fontSize: "24px", display: "block", color: "#0F1E36", margin: "6px 0 2px" }}>
              {metricas.stockTotalRed} ejemplares
            </strong>
            <small style={{ color: "#6b6565", fontSize: "12px" }}>
              En {metricas.totalTitulos} títulos catalogados
            </small>
          </div>

          {/* KPI 2: Bodegas Activas */}
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
              Ubicaciones de la Red
            </span>
            <strong style={{ fontSize: "24px", display: "block", color: "#0F1E36", margin: "6px 0 2px" }}>
              {metricas.bodegasActivas} Bodegas / Salas
            </strong>
            <small style={{ color: "#6b6565", fontSize: "12px" }}>
              Casa Matriz · Providencia · Centro
            </small>
          </div>

          {/* KPI 3: Valorización de la Red */}
          <div
            className="erp-card"
            style={{
              background: "#FDFBF7",
              border: "1px solid #e2dada",
              borderLeft: "4px solid #2563eb",
              borderRadius: "10px",
              padding: "18px 20px",
            }}
          >
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#1e40af", textTransform: "uppercase" }}>
              Valorización Consolidada
            </span>
            <strong style={{ fontSize: "24px", display: "block", color: "#0F1E36", margin: "6px 0 2px" }}>
              {money(metricas.valorMonetarioTotal)}
            </strong>
            <small style={{ color: "#6b6565", fontSize: "12px" }}>
              Al Costo Promedio Ponderado
            </small>
          </div>

          {/* KPI 4: Oportunidades de Traslado */}
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
              Oportunidades de Traslado
            </span>
            <strong style={{ fontSize: "24px", display: "block", color: "#b45309", margin: "6px 0 2px" }}>
              {metricas.cantOportunidadesTraslado} títulos
            </strong>
            <small style={{ color: "#6b6565", fontSize: "12px" }}>
              Quiebre en sala con stock en matriz
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
          aria-label="Filtros del consolidado"
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "16px",
              alignItems: "end",
            }}
          >
            {/* Buscador de texto */}
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#6b6565", marginBottom: "4px" }}>
                Buscar por Título, Autor o ISBN
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
                  placeholder="Ej: Quijote, 978-84..."
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

            {/* Filtro por Diagnóstico de Distribución */}
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#6b6565", marginBottom: "4px" }}>
                Diagnóstico de Distribución
              </label>
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
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
                <option value="todos">Todos los títulos de la red</option>
                <option value="desbalanceados">Con quiebre en alguna sucursal (Desbalanceados)</option>
                <option value="balanceados">Con stock en todas las sucursales</option>
              </select>
            </div>

            {/* Filtro por Categoría */}
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#6b6565", marginBottom: "4px" }}>
                Categoría Editorial
              </label>
              <select
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
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
                <option value="todas">Todas las categorías</option>
                {categoriasUnicas.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* TABLA MATRIZ COMPARATIVA (.module-panel + .module-table-scroll + .module-table) */}
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
                Matriz Comparativa de Existencias por Sucursal
              </h3>
              <p style={{ fontSize: "12px", color: "#6b6565", margin: "4px 0 0" }}>
                Comparación cruzada de existencias disponibles en cada punto de distribución y bodega central.
              </p>
            </div>
            <span style={{ fontSize: "12px", color: "#6b6565" }}>
              Mostrando <strong>{librosFiltrados.length}</strong> títulos
            </span>
          </div>

          <div className="module-table-scroll" role="region" aria-label="Matriz comparativa de bodegas" tabIndex={0}>
            <table className="module-table" style={{ background: "#ffffff", borderRadius: "8px", overflow: "hidden" }}>
              <thead>
                <tr style={{ background: "#f8f9fa", borderBottom: "2px solid #e2dada", fontSize: "11px" }}>
                  <th scope="col" style={{ width: "140px" }}>ISBN</th>
                  <th scope="col">Título y Autor</th>
                  <th scope="col" className="module-number" style={{ width: "110px", color: "#0F1E36" }}>
                    Casa Matriz
                  </th>
                  <th scope="col" className="module-number" style={{ width: "110px", color: "#166534" }}>
                    Providencia
                  </th>
                  <th scope="col" className="module-number" style={{ width: "110px", color: "#1e40af" }}>
                    Centro
                  </th>
                  <th scope="col" className="module-number" style={{ width: "110px", fontWeight: 700 }}>
                    Total Red
                  </th>
                  <th scope="col" className="module-number" style={{ width: "140px" }}>
                    Valor Total Red
                  </th>
                  <th scope="col" style={{ width: "190px", textAlign: "center" }}>
                    Estado de Distribución
                  </th>
                  <th scope="col" style={{ width: "100px", textAlign: "center" }}>
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody>
                {librosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: "center", padding: "36px 16px", color: "#6b6565" }}>
                      No se encontraron libros bajo los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  librosFiltrados.map((libro) => {
                    return (
                      <tr
                        key={libro.isbn}
                        style={{
                          background: libro.oportunidadTraslado ? "#fffbeb" : "transparent",
                          transition: "background 0.15s ease",
                        }}
                      >
                        <td style={{ fontFamily: "monospace", fontSize: "12px", color: "#475569" }}>
                          {libro.isbn}
                        </td>
                        <td>
                          <strong style={{ color: "#0F1E36", display: "block", fontSize: "13px" }}>
                            {libro.titulo}
                          </strong>
                          <small style={{ color: "#6b6565" }}>
                            {libro.autor} · {libro.categoria}
                          </small>
                        </td>

                        {/* Casa Matriz */}
                        <td className="module-number" style={{ fontWeight: 600, color: libro.stockMatriz === 0 ? "#dc2626" : "#0F1E36" }}>
                          {libro.stockMatriz} un.
                        </td>

                        {/* Sucursal Providencia */}
                        <td className="module-number" style={{ fontWeight: 600, color: libro.stockProvidencia === 0 ? "#dc2626" : "#166534" }}>
                          {libro.stockProvidencia === 0 ? (
                            <span style={{ color: "#dc2626", fontWeight: 700 }}>0 un. (Quiebre)</span>
                          ) : (
                            `${libro.stockProvidencia} un.`
                          )}
                        </td>

                        {/* Sucursal Centro */}
                        <td className="module-number" style={{ fontWeight: 600, color: libro.stockCentro === 0 ? "#dc2626" : "#1e40af" }}>
                          {libro.stockCentro === 0 ? (
                            <span style={{ color: "#dc2626", fontWeight: 700 }}>0 un. (Quiebre)</span>
                          ) : (
                            `${libro.stockCentro} un.`
                          )}
                        </td>

                        {/* Total Red */}
                        <td className="module-number" style={{ fontWeight: 700, color: "#0F1E36", fontSize: "13px" }}>
                          {libro.totalRed} un.
                        </td>

                        {/* Valor Total Red */}
                        <td className="module-number" style={{ fontWeight: 700, color: "#0F1E36" }}>
                          {money(libro.valorTotalRed)}
                        </td>

                        {/* Estado / Diagnóstico */}
                        <td style={{ textAlign: "center" }}>
                          <span
                            className={`erp-status ${libro.claseBadge}`}
                            style={{ fontSize: "10px", padding: "3px 8px" }}
                            title={libro.detalleOportunidad}
                          >
                            {libro.estadoDistribucion}
                          </span>
                        </td>

                        {/* Acción / Traslado */}
                        <td style={{ textAlign: "center" }}>
                          {libro.oportunidadTraslado ? (
                            <Link
                              href="/inventario/transferencias"
                              style={{
                                display: "inline-block",
                                fontSize: "11px",
                                fontWeight: 700,
                                color: "#0F1E36",
                                textDecoration: "underline",
                              }}
                              title="Iniciar orden de traslado"
                            >
                              Trasladar ➔
                            </Link>
                          ) : (
                            <span style={{ color: "#94a3b8", fontSize: "11px" }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot>
                <tr style={{ background: "#f8f9fa", borderTop: "2px solid #0F1E36", fontWeight: 700 }}>
                  <td style={{ color: "#0F1E36" }}>TOTALES CONSOLIDADOS</td>
                  <td style={{ color: "#6b6565", fontSize: "11px" }}>Red Corporativa Enchiridion</td>
                  <td className="module-number" style={{ color: "#0F1E36", fontSize: "13px" }}>
                    {metricas.stockTotalMatriz} un.
                  </td>
                  <td className="module-number" style={{ color: "#166534", fontSize: "13px" }}>
                    {metricas.stockTotalProvidencia} un.
                  </td>
                  <td className="module-number" style={{ color: "#1e40af", fontSize: "13px" }}>
                    {metricas.stockTotalCentro} un.
                  </td>
                  <td className="module-number" style={{ color: "#0F1E36", fontSize: "14px" }}>
                    {metricas.stockTotalRed} un.
                  </td>
                  <td className="module-number" style={{ color: "#0F1E36", fontSize: "14px" }}>
                    {money(metricas.valorMonetarioTotal)}
                  </td>
                  <td style={{ textAlign: "center", color: "#b45309", fontSize: "11px" }}>
                    {metricas.cantOportunidadesTraslado} sugerencias
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <p className="module-caption" style={{ marginTop: "16px" }}>
            Criterio logístico de redistribución: Se destacan con alerta amarilla aquellos títulos que presentan quiebre de stock en sucursales de venta pero cuentan con existencias suficientes en Casa Matriz para realizar una transferencia interna inmediata.
          </p>
        </section>
      </div>
    </ErpModuleShell>
  );
}
