"use client";

import { useState, useEffect, useMemo } from "react";
import ErpModuleShell from "@/components/ErpModuleShell";
import ErpIcon from "@/components/ErpIcon";
import InventarioNav from "@/components/InventarioNav";
import { money } from "@/lib/dashboard";
import { createCsv } from "@/lib/csv";

const DATOS_ROTACION_BASE = [
  {
    isbn: "978-84-376-0494-7",
    titulo: "Cien Años de Soledad",
    autor: "Gabriel García Márquez",
    categoria: "Ficción",
    stock: 14,
    costoUnitario: 11200,
    diasEnBodega: 18,
    fechaUltimaVenta: "2026-11-10",
    ventasUltimos90Dias: 38,
  },
  {
    isbn: "978-84-206-8562-4",
    titulo: "Don Quijote de la Mancha",
    autor: "Miguel de Cervantes",
    categoria: "Clásicos",
    stock: 8,
    costoUnitario: 15400,
    diasEnBodega: 42,
    fechaUltimaVenta: "2026-11-04",
    ventasUltimos90Dias: 16,
  },
  {
    isbn: "978-84-376-0188-5",
    titulo: "Ficciones",
    autor: "Jorge Luis Borges",
    categoria: "Cuentos",
    stock: 3,
    costoUnitario: 8900,
    diasEnBodega: 22,
    fechaUltimaVenta: "2026-11-08",
    ventasUltimos90Dias: 19,
  },
  {
    isbn: "978-956-247-456-1",
    titulo: "La Casa de los Espíritus",
    autor: "Isabel Allende",
    categoria: "Novela",
    stock: 19,
    costoUnitario: 10500,
    diasEnBodega: 15,
    fechaUltimaVenta: "2026-11-11",
    ventasUltimos90Dias: 44,
  },
  {
    isbn: "978-84-376-0457-2",
    titulo: "Rayuela",
    autor: "Julio Cortázar",
    categoria: "Novela",
    stock: 5,
    costoUnitario: 12800,
    diasEnBodega: 55,
    fechaUltimaVenta: "2026-10-18",
    ventasUltimos90Dias: 9,
  },
  {
    isbn: "978-84-663-3245-3",
    titulo: "El Aleph",
    autor: "Jorge Luis Borges",
    categoria: "Cuentos",
    stock: 2,
    costoUnitario: 8400,
    diasEnBodega: 34,
    fechaUltimaVenta: "2026-11-01",
    ventasUltimos90Dias: 12,
  },
  {
    isbn: "978-84-9759-220-8",
    titulo: "Crónica de una Muerte Anunciada",
    autor: "Gabriel García Márquez",
    categoria: "Ficción",
    stock: 11,
    costoUnitario: 7900,
    diasEnBodega: 28,
    fechaUltimaVenta: "2026-11-06",
    ventasUltimos90Dias: 26,
  },
  {
    isbn: "978-956-12-1405-7",
    titulo: "SubTerra",
    autor: "Baldomero Lillo",
    categoria: "Literatura Chilena",
    stock: 22,
    costoUnitario: 5900,
    diasEnBodega: 125,
    fechaUltimaVenta: "2026-07-24",
    ventasUltimos90Dias: 2,
  },
  {
    isbn: "978-956-239-111-0",
    titulo: "Poemas y Antipoemas",
    autor: "Nicanor Parra",
    categoria: "Literatura Chilena",
    stock: 15,
    costoUnitario: 6800,
    diasEnBodega: 98,
    fechaUltimaVenta: "2026-08-05",
    ventasUltimos90Dias: 3,
  },
  {
    isbn: "978-84-376-0498-5",
    titulo: "La Metamorfosis",
    autor: "Franz Kafka",
    categoria: "Clásicos",
    stock: 12,
    costoUnitario: 5400,
    diasEnBodega: 30,
    fechaUltimaVenta: "2026-11-07",
    ventasUltimos90Dias: 28,
  },
  {
    isbn: "978-84-670-3647-3",
    titulo: "La Odisea",
    autor: "Homero",
    categoria: "Clásicos",
    stock: 7,
    costoUnitario: 8200,
    diasEnBodega: 64,
    fechaUltimaVenta: "2026-09-29",
    ventasUltimos90Dias: 8,
  },
  {
    isbn: "978-956-347-109-8",
    titulo: "Santa María de Iquique",
    autor: "Carlos Droguett",
    categoria: "Literatura Chilena",
    stock: 6,
    costoUnitario: 7200,
    diasEnBodega: 142,
    fechaUltimaVenta: "2026-06-20",
    ventasUltimos90Dias: 0,
  },
];

export default function ReporteRotacionPage() {
  const [inventario, setInventario] = useState(DATOS_ROTACION_BASE);
  const [filtroRotacion, setFiltroRotacion] = useState("todos");
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
                      stock: Number(enApi.stock),
                      titulo: enApi.titulo || item.titulo,
                    }
                  : item;
              })
            );
          }
        }
      } catch {
        // Modo offline / mock
      }
    }
    sincronizar();
    return () => { cancelado = true; };
  }, []);

  // Clasificación dinámica de rotación
  const librosAnalizados = useMemo(() => {
    return inventario.map((libro) => {
      let clasificacion = "regular";
      let etiqueta = "Rotación Regular";
      let claseBadge = "neutral";
      let accionSugerida = "Mantener nivel";

      if (libro.diasEnBodega > 90 || libro.ventasUltimos90Dias <= 2) {
        clasificacion = "estancado";
        etiqueta = "Stock Estancado / Obsolescencia";
        claseBadge = "danger";
        accionSugerida = "Promoción / Devolución";
      } else if (libro.diasEnBodega <= 30 && libro.ventasUltimos90Dias >= 15) {
        clasificacion = "alta";
        etiqueta = "Alta Rotación";
        claseBadge = "success";
        accionSugerida = "Reordenar preventivo";
      }

      const capitalInmovilizado = libro.stock * libro.costoUnitario;

      return {
        ...libro,
        clasificacion,
        etiqueta,
        claseBadge,
        accionSugerida,
        capitalInmovilizado,
      };
    });
  }, [inventario]);

  // Filtrado de libros
  const librosFiltrados = useMemo(() => {
    return librosAnalizados.filter((l) => {
      if (filtroRotacion !== "todos" && l.clasificacion !== filtroRotacion) return false;
      if (filtroCategoria !== "todas" && l.categoria !== filtroCategoria) return false;
      if (busqueda.trim()) {
        const q = busqueda.toLowerCase().trim();
        const texto = `${l.isbn} ${l.titulo} ${l.autor} ${l.categoria}`.toLowerCase();
        if (!texto.includes(q)) return false;
      }
      return true;
    });
  }, [librosAnalizados, filtroRotacion, filtroCategoria, busqueda]);

  // Cálculo de KPIs de rotación
  const metricas = useMemo(() => {
    let totalStock = 0;
    let sumaPonderadaDias = 0;
    let capitalEstancado = 0;
    let cantAlta = 0;
    let cantRegular = 0;
    let cantEstancados = 0;
    let ventasTotales = 0;

    librosAnalizados.forEach((l) => {
      totalStock += l.stock;
      sumaPonderadaDias += l.stock * l.diasEnBodega;
      ventasTotales += l.ventasUltimos90Dias;

      if (l.clasificacion === "estancado") {
        capitalEstancado += l.capitalInmovilizado;
        cantEstancados += 1;
      } else if (l.clasificacion === "alta") {
        cantAlta += 1;
      } else {
        cantRegular += 1;
      }
    });

    const diasPromedioPermanencia = totalStock > 0 ? Math.round(sumaPonderadaDias / totalStock) : 0;
    // Ratio de rotación anualizada: (Ventas 90 días * 4) / Stock promedio
    const indiceRotacion = totalStock > 0 ? ((ventasTotales * 4) / totalStock).toFixed(1) : "0.0";
    const porcentajeEstancado = librosAnalizados.length > 0 ? ((cantEstancados / librosAnalizados.length) * 100).toFixed(1) : 0;

    return {
      diasPromedioPermanencia,
      indiceRotacion,
      capitalEstancado,
      cantEstancados,
      cantAlta,
      cantRegular,
      porcentajeEstancado,
      totalTitulos: librosAnalizados.length,
    };
  }, [librosAnalizados]);

  // Categorías únicas para filtro
  const categoriasUnicas = useMemo(() => {
    const setCat = new Set(inventario.map((i) => i.categoria));
    return Array.from(setCat);
  }, [inventario]);

  // Exportar a CSV
  function handleExportarCsv() {
    const filas = [
      [
        "ISBN",
        "Título del Libro",
        "Autor",
        "Categoría",
        "Stock Actual",
        "Días en Bodega",
        "Última Venta",
        "Ventas Últimos 90 Días",
        "Costo Unitario",
        "Capital Inmovilizado",
        "Clasificación Rotación",
        "Acción Recomendada",
      ],
      ...librosFiltrados.map((l) => [
        l.isbn,
        l.titulo,
        l.autor,
        l.categoria,
        l.stock,
        l.diasEnBodega,
        l.fechaUltimaVenta,
        l.ventasUltimos90Dias,
        l.costoUnitario,
        l.capitalInmovilizado,
        l.etiqueta,
        l.accionSugerida,
      ]),
    ];

    const contenido = createCsv(filas);
    const blob = new Blob([contenido], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `reporte_rotacion_stock_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <ErpModuleShell
      module="inventario"
      liveData={true}
      title="Reporte de Rotación y Antigüedad de Stock"
      description="Análisis de velocidad de salida, permanencia en estante y capital inmovilizado con riesgo de obsolescencia."
      subnav={<InventarioNav activeTab="rotacion" />}
      actions={
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
          <span>Exportar Planilla CSV</span>
        </button>
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
          {/* KPI 1: Índice de Rotación */}
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
              Índice de Rotación Anual
            </span>
            <strong style={{ fontSize: "24px", display: "block", color: "#0F1E36", margin: "6px 0 2px" }}>
              {metricas.indiceRotacion}x al año
            </strong>
            <small style={{ color: "#6b6565", fontSize: "12px" }}>
              Velocidad media de ciclo comercial
            </small>
          </div>

          {/* KPI 2: Días Promedio de Permanencia */}
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
              Permanencia Media en Estante
            </span>
            <strong style={{ fontSize: "24px", display: "block", color: "#0F1E36", margin: "6px 0 2px" }}>
              {metricas.diasPromedioPermanencia} días
            </strong>
            <small style={{ color: "#6b6565", fontSize: "12px" }}>
              Promedio ponderado en bodega
            </small>
          </div>

          {/* KPI 3: Capital Inmovilizado Crítico (> 90 días) */}
          <div
            className="erp-card"
            style={{
              background: "#FDFBF7",
              border: "1px solid #e2dada",
              borderLeft: "4px solid #dc2626",
              borderRadius: "10px",
              padding: "18px 20px",
            }}
          >
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#dc2626", textTransform: "uppercase" }}>
              Capital Estancado (&gt; 90 días)
            </span>
            <strong style={{ fontSize: "24px", display: "block", color: "#dc2626", margin: "6px 0 2px" }}>
              {money(metricas.capitalEstancado)}
            </strong>
            <small style={{ color: "#6b6565", fontSize: "12px" }}>
              {metricas.cantEstancados} títulos sin movimiento ({metricas.porcentajeEstancado}%)
            </small>
          </div>

          {/* KPI 4: Distribución de Catálogo */}
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
              Salud del Catálogo
            </span>
            <strong style={{ fontSize: "18px", display: "block", color: "#0F1E36", margin: "8px 0 4px" }}>
              {metricas.cantAlta} Alta · {metricas.cantRegular} Regular
            </strong>
            <small style={{ color: "#6b6565", fontSize: "12px" }}>
              Sobre un total de {metricas.totalTitulos} títulos analizados
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
          aria-label="Filtros del reporte de rotación"
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
                  placeholder="Ej: García Márquez, 978-84..."
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

            {/* Filtro por Estado de Rotación */}
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#6b6565", marginBottom: "4px" }}>
                Nivel de Rotación
              </label>
              <select
                value={filtroRotacion}
                onChange={(e) => setFiltroRotacion(e.target.value)}
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
                <option value="todos">Todos los niveles</option>
                <option value="alta">Alta Rotación (&lt; 30 días)</option>
                <option value="regular">Rotación Regular (30 a 90 días)</option>
                <option value="estancado">Stock Estancado (&gt; 90 días)</option>
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

        {/* TABLA ANALÍTICA DE ROTACIÓN (.module-panel + .module-table-scroll + .module-table) */}
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
                Matriz Analítica de Antigüedad y Desempeño
              </h3>
              <p style={{ fontSize: "12px", color: "#6b6565", margin: "4px 0 0" }}>
                Control individual de permanencia en estante y capital monetario cautivo.
              </p>
            </div>
            <span style={{ fontSize: "12px", color: "#6b6565" }}>
              Mostrando <strong>{librosFiltrados.length}</strong> de {librosAnalizados.length} títulos
            </span>
          </div>

          <div className="module-table-scroll" role="region" aria-label="Tabla de rotación" tabIndex={0}>
            <table className="module-table" style={{ background: "#ffffff", borderRadius: "8px", overflow: "hidden" }}>
              <thead>
                <tr style={{ background: "#f8f9fa", borderBottom: "2px solid #e2dada", fontSize: "11px" }}>
                  <th scope="col" style={{ width: "150px" }}>ISBN</th>
                  <th scope="col">Título del Libro</th>
                  <th scope="col" className="module-number" style={{ width: "90px" }}>Stock</th>
                  <th scope="col" className="module-number" style={{ width: "120px" }}>Días en Bodega</th>
                  <th scope="col" style={{ width: "110px" }}>Última Venta</th>
                  <th scope="col" className="module-number" style={{ width: "100px" }}>Ventas (90d)</th>
                  <th scope="col" className="module-number" style={{ width: "140px" }}>Capital Inmovilizado</th>
                  <th scope="col" style={{ width: "160px", textAlign: "center" }}>Nivel de Rotación</th>
                  <th scope="col" style={{ width: "160px" }}>Acción Sugerida</th>
                </tr>
              </thead>
              <tbody>
                {librosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: "center", padding: "36px 16px", color: "#6b6565" }}>
                      No se encontraron libros bajo los filtros indicados.
                    </td>
                  </tr>
                ) : (
                  librosFiltrados.map((libro) => {
                    return (
                      <tr
                        key={libro.isbn}
                        style={{
                          background: libro.clasificacion === "estancado" ? "#fef2f2" : "transparent",
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
                        <td className="module-number" style={{ fontWeight: 600, color: "#0F1E36" }}>
                          {libro.stock} un.
                        </td>
                        <td className="module-number" style={{ fontWeight: 700, color: libro.diasEnBodega > 90 ? "#dc2626" : "#0F1E36" }}>
                          {libro.diasEnBodega} días
                        </td>
                        <td style={{ fontSize: "11px", color: "#475569", whiteSpace: "nowrap" }}>
                          {libro.fechaUltimaVenta}
                        </td>
                        <td className="module-number" style={{ fontWeight: 600, color: libro.ventasUltimos90Dias >= 15 ? "#166534" : "#475569" }}>
                          {libro.ventasUltimos90Dias} un.
                        </td>
                        <td className="module-number" style={{ fontWeight: 700, color: libro.clasificacion === "estancado" ? "#dc2626" : "#0F1E36" }}>
                          {money(libro.capitalInmovilizado)}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <span className={`erp-status ${libro.claseBadge}`} style={{ fontSize: "10px", padding: "3px 8px" }}>
                            {libro.etiqueta}
                          </span>
                        </td>
                        <td style={{ fontSize: "11px", fontWeight: 600, color: libro.clasificacion === "estancado" ? "#dc2626" : "#0F1E36" }}>
                          {libro.accionSugerida}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <p className="module-caption" style={{ marginTop: "16px" }}>
            Criterio logístico: Los títulos con más de 90 días en estante o ventas inferiores a 3 unidades en el trimestre son categorizados con riesgo de obsolescencia para activar campañas de liquidación o rebalanceo inter-sucursal.
          </p>
        </section>
      </div>
    </ErpModuleShell>
  );
}
