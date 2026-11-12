"use client";

import { useState, useEffect, useMemo } from "react";
import ErpModuleShell from "@/components/ErpModuleShell";
import ErpIcon from "@/components/ErpIcon";
import InventarioNav from "@/components/InventarioNav";
import { money } from "@/lib/dashboard";
import { createCsv } from "@/lib/csv";

const DATOS_VALORIZACION_BASE = [
  { isbn: "978-84-376-0494-7", titulo: "Cien Años de Soledad", autor: "Gabriel García Márquez", categoria: "Ficción", estante: "A-01", stock: 14, costoUnitario: 11200, precioVenta: 18500 },
  { isbn: "978-84-206-8562-4", titulo: "Don Quijote de la Mancha", autor: "Miguel de Cervantes", categoria: "Clásicos", estante: "A-03", stock: 8, costoUnitario: 15400, precioVenta: 24900 },
  { isbn: "978-84-376-0188-5", titulo: "Ficciones", autor: "Jorge Luis Borges", categoria: "Cuentos", estante: "B-02", stock: 3, costoUnitario: 8900, precioVenta: 14200 },
  { isbn: "978-956-247-456-1", titulo: "La Casa de los Espíritus", autor: "Isabel Allende", categoria: "Novela", estante: "B-05", stock: 19, costoUnitario: 10500, precioVenta: 16900 },
  { isbn: "978-84-376-0457-2", titulo: "Rayuela", autor: "Julio Cortázar", categoria: "Novela", estante: "C-01", stock: 5, costoUnitario: 12800, precioVenta: 19900 },
  { isbn: "978-84-663-3245-3", titulo: "El Aleph", autor: "Jorge Luis Borges", categoria: "Cuentos", estante: "B-03", stock: 2, costoUnitario: 8400, precioVenta: 13500 },
  { isbn: "978-84-9759-220-8", titulo: "Crónica de una Muerte Anunciada", autor: "Gabriel García Márquez", categoria: "Ficción", estante: "A-02", stock: 11, costoUnitario: 7900, precioVenta: 12900 },
  { isbn: "978-956-12-1405-7", titulo: "SubTerra", autor: "Baldomero Lillo", categoria: "Literatura Chilena", estante: "D-01", stock: 22, costoUnitario: 5900, precioVenta: 9900 },
  { isbn: "978-956-239-111-0", titulo: "Poemas y Antipoemas", autor: "Nicanor Parra", categoria: "Literatura Chilena", estante: "D-02", stock: 15, costoUnitario: 6800, precioVenta: 11500 },
  { isbn: "978-84-376-0498-5", titulo: "La Metamorfosis", autor: "Franz Kafka", categoria: "Clásicos", estante: "A-04", stock: 12, costoUnitario: 5400, precioVenta: 8900 },
  { isbn: "978-84-670-3647-3", titulo: "La Odisea", autor: "Homero", categoria: "Clásicos", estante: "A-05", stock: 7, costoUnitario: 8200, precioVenta: 13900 },
  { isbn: "978-956-347-109-8", titulo: "Santa María de Iquique", autor: "Carlos Droguett", categoria: "Literatura Chilena", estante: "D-03", stock: 6, costoUnitario: 7200, precioVenta: 12500 },
];

export default function ReporteValorizacionPage() {
  const [inventario, setInventario] = useState(DATOS_VALORIZACION_BASE);
  const [agrupacion, setAgrupacion] = useState("categoria"); // 'categoria' | 'estante'
  const [sucursal, setSucursal] = useState("todas");
  const [busqueda, setBusqueda] = useState("");
  const [grupoExpandido, setGrupoExpandido] = useState(null);

  // Sincronización con API de inventario si está disponible
  useEffect(() => {
    let cancelado = false;
    async function cargarInventario() {
      try {
        const res = await fetch("/api/inventario", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0 && !cancelado) {
            setInventario(
              data.map((item) => ({
                isbn: item.isbn,
                titulo: item.titulo,
                autor: item.autor || "—",
                categoria: item.categoria || "Sin Categoría",
                estante: item.estante || "General",
                stock: Number(item.stock) || 0,
                costoUnitario: Number(item.costoUnitario) || (item.precio ? Math.round(Number(item.precio) * 0.6) : 9000),
                precioVenta: Number(item.precio) || 15000,
              }))
            );
          }
        }
      } catch {
        // En desarrollo o sin conexión, se preserva DATOS_VALORIZACION_BASE
      }
    }
    cargarInventario();
    return () => { cancelado = true; };
  }, []);

  // Filtrado de libros según búsqueda
  const librosFiltrados = useMemo(() => {
    if (!busqueda.trim()) return inventario;
    const q = busqueda.toLowerCase().trim();
    return inventario.filter(
      (b) =>
        b.titulo.toLowerCase().includes(q) ||
        b.isbn.toLowerCase().includes(q) ||
        b.autor.toLowerCase().includes(q) ||
        b.categoria.toLowerCase().includes(q) ||
        b.estante.toLowerCase().includes(q)
    );
  }, [inventario, busqueda]);

  // Totales y KPIs globales
  const kpis = useMemo(() => {
    let totalTitulos = librosFiltrados.length;
    let totalEjemplares = 0;
    let valorCostoTotal = 0;
    let valorVentaTotal = 0;

    librosFiltrados.forEach((l) => {
      totalEjemplares += l.stock;
      valorCostoTotal += l.stock * l.costoUnitario;
      valorVentaTotal += l.stock * l.precioVenta;
    });

    const costoPromedioPorEjemplar = totalEjemplares > 0 ? Math.round(valorCostoTotal / totalEjemplares) : 0;
    const margenPotencialNeto = valorVentaTotal - valorCostoTotal;
    const margenPorcentual = valorCostoTotal > 0 ? ((margenPotencialNeto / valorCostoTotal) * 100).toFixed(1) : 0;

    return {
      totalTitulos,
      totalEjemplares,
      valorCostoTotal,
      valorVentaTotal,
      costoPromedioPorEjemplar,
      margenPotencialNeto,
      margenPorcentual,
    };
  }, [librosFiltrados]);

  // Agrupación consolidada por Categoría o Estante
  const grupos = useMemo(() => {
    const mapa = {};

    librosFiltrados.forEach((libro) => {
      const clave = agrupacion === "categoria" ? libro.categoria : `Estante ${libro.estante}`;
      if (!mapa[clave]) {
        mapa[clave] = {
          nombre: clave,
          titulos: [],
          unidades: 0,
          valorCosto: 0,
          valorVenta: 0,
        };
      }
      mapa[clave].titulos.push(libro);
      mapa[clave].unidades += libro.stock;
      mapa[clave].valorCosto += libro.stock * libro.costoUnitario;
      mapa[clave].valorVenta += libro.stock * libro.precioVenta;
    });

    const lista = Object.values(mapa).map((g) => {
      const participacion = kpis.valorCostoTotal > 0 ? (g.valorCosto / kpis.valorCostoTotal) * 100 : 0;
      const cpp = g.unidades > 0 ? Math.round(g.valorCosto / g.unidades) : 0;
      return {
        ...g,
        cantTitulos: g.titulos.length,
        costoPromedio: cpp,
        participacion: Number(participacion.toFixed(1)),
      };
    });

    // Ordenar de mayor a menor valor de inventario
    return lista.sort((a, b) => b.valorCosto - a.valorCosto);
  }, [librosFiltrados, agrupacion, kpis.valorCostoTotal]);

  // Exportar reporte a formato CSV
  function handleExportarCsv() {
    const filas = [
      [
        agrupacion === "categoria" ? "Categoría Editorial" : "Ubicación / Estante",
        "Cantidad de Títulos",
        "Ejemplares Físicos",
        "Costo Unitario Promedio (CPP)",
        "Valorización al Costo",
        "Valorización a Precio Venta",
        "% Participación Global",
      ],
      ...grupos.map((g) => [
        g.nombre,
        g.cantTitulos,
        g.unidades,
        g.costoPromedio,
        g.valorCosto,
        g.valorVenta,
        `${g.participacion}%`,
      ]),
      [
        "TOTAL CONSOLIDADO",
        kpis.totalTitulos,
        kpis.totalEjemplares,
        kpis.costoPromedioPorEjemplar,
        kpis.valorCostoTotal,
        kpis.valorVentaTotal,
        "100.0%",
      ],
    ];

    const contenido = createCsv(filas);
    const blob = new Blob([contenido], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `valorizacion_inventario_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <ErpModuleShell
      module="inventario"
      liveData={true}
      title="Valorización Global de Inventario"
      description="Evaluación monetaria de existencias físicas según Costo Promedio Ponderado (CPP) y valor proyectado de venta."
      subnav={<InventarioNav activeTab="valorizacion" />}
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
          {/* KPI 1: Valorización al Costo */}
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
              Valor Total al Costo (CPP)
            </span>
            <strong style={{ fontSize: "24px", display: "block", color: "#0F1E36", margin: "6px 0 2px" }}>
              {money(kpis.valorCostoTotal)}
            </strong>
            <small style={{ color: "#6b6565", fontSize: "12px" }}>
              Costo Promedio Ponderado de libros
            </small>
          </div>

          {/* KPI 2: Total Ejemplares y Títulos */}
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
              Existencias Físicas Totales
            </span>
            <strong style={{ fontSize: "24px", display: "block", color: "#0F1E36", margin: "6px 0 2px" }}>
              {kpis.totalEjemplares} ejemplares
            </strong>
            <small style={{ color: "#6b6565", fontSize: "12px" }}>
              En {kpis.totalTitulos} títulos catalogados
            </small>
          </div>

          {/* KPI 3: Costo Promedio por Ejemplar */}
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
              Costo Unitario Promedio
            </span>
            <strong style={{ fontSize: "24px", display: "block", color: "#0F1E36", margin: "6px 0 2px" }}>
              {money(kpis.costoPromedioPorEjemplar)}
            </strong>
            <small style={{ color: "#6b6565", fontSize: "12px" }}>
              Por cada ejemplar físico en stock
            </small>
          </div>

          {/* KPI 4: Valorización a Precio de Venta */}
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
              Valor Proyectado de Venta
            </span>
            <strong style={{ fontSize: "24px", display: "block", color: "#0F1E36", margin: "6px 0 2px" }}>
              {money(kpis.valorVentaTotal)}
            </strong>
            <small style={{ color: "#166534", fontSize: "12px", fontWeight: 600 }}>
              Margen potencial: +{kpis.margenPorcentual}% ({money(kpis.margenPotencialNeto)})
            </small>
          </div>
        </div>

        {/* PANEL DE CONTROL Y FILTROS (.module-panel + .erp-card) */}
        <section
          className="module-panel erp-card"
          style={{
            background: "#FDFBF7",
            border: "1px solid #e2dada",
            borderRadius: "12px",
            padding: "20px 24px",
            marginBottom: "24px",
          }}
          aria-label="Controles del reporte"
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "14px",
            }}
          >
            {/* Buscador de texto */}
            <div style={{ flex: "1 1 280px" }}>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#6b6565", marginBottom: "4px" }}>
                Filtrar por Categoría, Título o Estante
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
                  placeholder="Ej: Ficción, Clásicos, B-02..."
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

            {/* Selector de Agrupación */}
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#6b6565", marginBottom: "4px" }}>
                Criterio de Agrupación
              </label>
              <div
                style={{
                  display: "inline-flex",
                  borderRadius: "8px",
                  padding: "3px",
                  background: "#ffffff",
                  border: "1px solid #e2dada",
                  gap: "4px",
                }}
              >
                <button
                  type="button"
                  onClick={() => setAgrupacion("categoria")}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "6px",
                    border: 0,
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    background: agrupacion === "categoria" ? "#0F1E36" : "transparent",
                    color: agrupacion === "categoria" ? "#ffffff" : "#6b6565",
                  }}
                >
                  Por Categoría
                </button>
                <button
                  type="button"
                  onClick={() => setAgrupacion("estante")}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "6px",
                    border: 0,
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    background: agrupacion === "estante" ? "#0F1E36" : "transparent",
                    color: agrupacion === "estante" ? "#ffffff" : "#6b6565",
                  }}
                >
                  Por Estante / Ubicación
                </button>
              </div>
            </div>

            {/* Selector de Sucursal */}
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#6b6565", marginBottom: "4px" }}>
                Bodega / Sucursal
              </label>
              <select
                value={sucursal}
                onChange={(e) => setSucursal(e.target.value)}
                style={{
                  minHeight: "38px",
                  padding: "6px 12px",
                  borderRadius: "7px",
                  border: "1px solid #d1d5db",
                  background: "#ffffff",
                  fontSize: "12px",
                  outline: "none",
                }}
              >
                <option value="todas">Todas las Bodegas (Consolidado)</option>
                <option value="matriz">Casa Matriz - Bodega Central</option>
                <option value="providencia">Sucursal Providencia</option>
                <option value="centro">Sucursal Centro</option>
              </select>
            </div>
          </div>
        </section>

        {/* TABLA PRINCIPAL DE VALORIZACIÓN (.module-panel + .module-table-scroll + .module-table) */}
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
                Desglose Consolidado por {agrupacion === "categoria" ? "Categoría Editorial" : "Estante de Bodega"}
              </h3>
              <p style={{ fontSize: "12px", color: "#6b6565", margin: "4px 0 0" }}>
                Haz clic en cualquier fila para inspeccionar los libros individuales que componen el grupo.
              </p>
            </div>
            <span style={{ fontSize: "12px", color: "#6b6565" }}>
              Total grupos analizados: <strong>{grupos.length}</strong>
            </span>
          </div>

          <div className="module-table-scroll" role="region" aria-label="Tabla de Valorización" tabIndex={0}>
            <table className="module-table" style={{ background: "#ffffff", borderRadius: "8px", overflow: "hidden" }}>
              <thead>
                <tr style={{ background: "#f8f9fa", borderBottom: "2px solid #e2dada", fontSize: "11px" }}>
                  <th scope="col" style={{ width: "220px" }}>
                    {agrupacion === "categoria" ? "Categoría Editorial" : "Estante / Ubicación"}
                  </th>
                  <th scope="col" className="module-number" style={{ width: "110px" }}>Títulos</th>
                  <th scope="col" className="module-number" style={{ width: "120px" }}>Ejemplares</th>
                  <th scope="col" className="module-number" style={{ width: "130px" }}>Costo Promedio (CPP)</th>
                  <th scope="col" className="module-number" style={{ width: "160px" }}>Valorización Costo</th>
                  <th scope="col" className="module-number" style={{ width: "160px" }}>Valorización Venta</th>
                  <th scope="col" style={{ width: "170px" }}>% Participación</th>
                  <th scope="col" style={{ width: "80px", textAlign: "center" }}>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {grupos.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: "36px 16px", color: "#6b6565" }}>
                      No se encontraron registros bajo los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  grupos.map((g) => {
                    const expandido = grupoExpandido === g.nombre;
                    return (
                      <>
                        <tr
                          key={g.nombre}
                          onClick={() => setGrupoExpandido(expandido ? null : g.nombre)}
                          style={{
                            cursor: "pointer",
                            background: expandido ? "#f1f5f9" : "transparent",
                            transition: "background 0.15s ease",
                          }}
                        >
                          <td>
                            <strong style={{ color: "#0F1E36", fontSize: "13px" }}>{g.nombre}</strong>
                          </td>
                          <td className="module-number" style={{ color: "#4b5563" }}>
                            {g.cantTitulos}
                          </td>
                          <td className="module-number" style={{ fontWeight: 600, color: "#0F1E36" }}>
                            {g.unidades} un.
                          </td>
                          <td className="module-number" style={{ color: "#4b5563" }}>
                            {money(g.costoPromedio)}
                          </td>
                          <td className="module-number" style={{ fontWeight: 700, color: "#0F1E36", fontSize: "13px" }}>
                            {money(g.valorCosto)}
                          </td>
                          <td className="module-number" style={{ fontWeight: 600, color: "#166534" }}>
                            {money(g.valorVenta)}
                          </td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <div
                                style={{
                                  flex: 1,
                                  height: "6px",
                                  borderRadius: "3px",
                                  background: "#e2e8f0",
                                  overflow: "hidden",
                                }}
                              >
                                <div
                                  style={{
                                    width: `${Math.min(100, g.participacion)}%`,
                                    height: "100%",
                                    background: "#0F1E36",
                                    borderRadius: "3px",
                                  }}
                                />
                              </div>
                              <span style={{ fontSize: "11px", fontWeight: 700, color: "#0F1E36", minWidth: "38px" }}>
                                {g.participacion}%
                              </span>
                            </div>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <span style={{ fontSize: "12px", color: "#0F1E36", fontWeight: 700 }}>
                              {expandido ? "▲" : "▼"}
                            </span>
                          </td>
                        </tr>

                        {/* DESGLOSE HIJO EXPANDIBLE DE TÍTULOS DEL GRUPO */}
                        {expandido && (
                          <tr key={`${g.nombre}-sub`}>
                            <td colSpan={8} style={{ padding: "0 12px 16px", background: "#f8fafc" }}>
                              <div
                                style={{
                                  background: "#ffffff",
                                  border: "1px solid #cbd5e1",
                                  borderRadius: "8px",
                                  padding: "14px",
                                  marginTop: "8px",
                                }}
                              >
                                <strong style={{ fontSize: "12px", color: "#0F1E36", display: "block", marginBottom: "8px" }}>
                                  Títulos pertenecientes a {g.nombre}:
                                </strong>
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                                  <thead>
                                    <tr style={{ color: "#6b6565", borderBottom: "1px solid #e2e8f0" }}>
                                      <th style={{ textAlign: "left", padding: "6px 8px" }}>ISBN</th>
                                      <th style={{ textAlign: "left", padding: "6px 8px" }}>Título y Autor</th>
                                      <th style={{ textAlign: "left", padding: "6px 8px" }}>Estante</th>
                                      <th style={{ textAlign: "right", padding: "6px 8px" }}>Stock</th>
                                      <th style={{ textAlign: "right", padding: "6px 8px" }}>Costo Unit.</th>
                                      <th style={{ textAlign: "right", padding: "6px 8px" }}>Subtotal Costo</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {g.titulos.map((t) => (
                                      <tr key={t.isbn} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                        <td style={{ fontFamily: "monospace", padding: "6px 8px", color: "#475569" }}>{t.isbn}</td>
                                        <td style={{ padding: "6px 8px" }}>
                                          <strong style={{ color: "#0F1E36" }}>{t.titulo}</strong> <span style={{ color: "#64748b" }}>({t.autor})</span>
                                        </td>
                                        <td style={{ padding: "6px 8px", color: "#64748b" }}>{t.estante}</td>
                                        <td style={{ textAlign: "right", padding: "6px 8px", fontWeight: 600 }}>{t.stock} un.</td>
                                        <td style={{ textAlign: "right", padding: "6px 8px" }}>{money(t.costoUnitario)}</td>
                                        <td style={{ textAlign: "right", padding: "6px 8px", fontWeight: 700, color: "#0F1E36" }}>
                                          {money(t.stock * t.costoUnitario)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })
                )}
              </tbody>
              <tfoot>
                <tr style={{ background: "#f8f9fa", borderTop: "2px solid #0F1E36", fontWeight: 700 }}>
                  <td style={{ color: "#0F1E36" }}>TOTAL CONSOLIDADO</td>
                  <td className="module-number">{kpis.totalTitulos}</td>
                  <td className="module-number">{kpis.totalEjemplares} un.</td>
                  <td className="module-number">{money(kpis.costoPromedioPorEjemplar)}</td>
                  <td className="module-number" style={{ color: "#0F1E36", fontSize: "14px" }}>{money(kpis.valorCostoTotal)}</td>
                  <td className="module-number" style={{ color: "#166534", fontSize: "14px" }}>{money(kpis.valorVentaTotal)}</td>
                  <td style={{ fontWeight: 700, color: "#0F1E36" }}>100.0%</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <p className="module-caption" style={{ marginTop: "16px" }}>
            Criterio contable: Valuación bajo la Norma Internacional de Contabilidad NIC 2 (Inventarios), calculada al Costo Promedio Ponderado móvil y su correspondiente proyección de realización en venta bruta.
          </p>
        </section>
      </div>
    </ErpModuleShell>
  );
}
