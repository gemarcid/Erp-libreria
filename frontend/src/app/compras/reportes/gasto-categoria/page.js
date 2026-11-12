"use client";

import { useEffect, useState } from "react";
import ErpModuleShell from "@/components/ErpModuleShell";
import ErpIcon from "@/components/ErpIcon";
import ComprasNav from "@/components/ComprasNav";
import { fetchReporteGastoCategoria } from "@/lib/compras-api";
import { formatCurrency } from "@/lib/compras-format";

function getHoyISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getHace12MesesISO() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function ReporteGastoCategoriaPage() {
  const [categoriasDisponibles, setCategoriasDisponibles] = useState([]);
  const [categoria, setCategoria] = useState("");
  const [desde, setDesde] = useState(() => getHace12MesesISO());
  const [hasta, setHasta] = useState(() => getHoyISO());

  const [reporte, setReporte] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    ejecutarConsulta(getHace12MesesISO(), getHoyISO(), "");
  }, []);

  async function ejecutarConsulta(desdeParam, hastaParam, catParam) {
    setError("");

    if (!desdeParam || !hastaParam) {
      setError("Debes indicar las fechas Desde y Hasta.");
      setReporte(null);
      setCargando(false);
      return;
    }

    if (desdeParam > hastaParam) {
      setError("La fecha 'Desde' no puede ser posterior a la fecha 'Hasta'.");
      setReporte(null);
      setCargando(false);
      return;
    }

    setCargando(true);
    try {
      const data = await fetchReporteGastoCategoria({
        desde: desdeParam,
        hasta: hastaParam,
        categoria: catParam || undefined,
      });
      setReporte(data);
      const cats = data.CategoriasDisponibles || data.categorias_disponibles || [];
      if (cats.length > 0) {
        setCategoriasDisponibles(cats);
      }
    } catch (err) {
      setError(err.message || "No se pudo generar el reporte de gasto por categoría.");
      setReporte(null);
    } finally {
      setCargando(false);
    }
  }

  function handleGenerar(e) {
    e.preventDefault();
    ejecutarConsulta(desde, hasta, categoria);
  }

  const categorias = reporte?.Categorias || reporte?.categorias || [];
  const gastoTotal = Number(
    reporte?.GastoTotalPeriodo ?? reporte?.gasto_total_periodo ?? 0
  );
  const catMayor =
    reporte?.CategoriaMayorGasto ?? reporte?.categoria_mayor_gasto ?? "—";
  const montoMayor = Number(
    reporte?.MontoMayorGasto ?? reporte?.monto_mayor_gasto ?? 0
  );
  const pctMayor = Number(
    reporte?.PorcentajeMayorGasto ?? reporte?.porcentaje_mayor_gasto ?? 0
  );
  const haySinCategoria = Boolean(
    reporte?.HaySinCategoria ?? reporte?.hay_sin_categoria
  );

  const maxMontoCategoria =
    categorias.length > 0
      ? Math.max(...categorias.map((c) => Number(c.MontoGasto ?? c.monto_gasto ?? 0)), 1)
      : 1;

  return (
    <ErpModuleShell
      module="compras"
      title="Gasto por categoría"
      description="Analiza la distribución del gasto en compras (IVA incluido) y las unidades adquiridas por categoría de libro dentro del período seleccionado."
      liveData
      subnav={<ComprasNav />}
    >
      <div className="erp-main">

        <section className="compras-panel" style={{ marginBottom: "1.5rem" }}>
          <form
            onSubmit={handleGenerar}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "1rem",
              alignItems: "end",
            }}
          >
            <div className="compras-field">
              <label htmlFor="gasto-cat-select">Categoría (opcional)</label>
              <select
                id="gasto-cat-select"
                className="compras-select"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
              >
                <option value="">Todas las categorías</option>
                {categoriasDisponibles.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="compras-field">
              <label htmlFor="gasto-cat-desde">Fecha Desde *</label>
              <input
                id="gasto-cat-desde"
                type="date"
                className="compras-input"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
              />
            </div>

            <div className="compras-field">
              <label htmlFor="gasto-cat-hasta">Fecha Hasta *</label>
              <input
                id="gasto-cat-hasta"
                type="date"
                className="compras-input"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
              />
            </div>

            <div>
              <button
                type="submit"
                className="compras-btn compras-btn--primary"
                disabled={cargando}
              >
                <ErpIcon name="search" />
                {cargando ? "Generando..." : "Generar"}
              </button>
            </div>
          </form>
        </section>

        {error && (
          <div className="compras-alert compras-alert--error" role="alert">
            <strong>Error:</strong> {error}
          </div>
        )}

        {!error && cargando && (
          <section className="compras-panel">
            <p className="compras-empty">Calculando gasto por categoría...</p>
          </section>
        )}

        {!error && !cargando && reporte && categorias.length === 0 && (
          <section className="compras-panel">
            <div className="compras-empty" role="status">
              No hay compras registradas con esos filtros
            </div>
          </section>
        )}

        {!error && !cargando && reporte && categorias.length > 0 && (
          <>
            {haySinCategoria && (
              <div
                className="compras-alert"
                role="alert"
                style={{
                  backgroundColor: "#fffbeb",
                  border: "1px solid #fcd34d",
                  color: "#92400e",
                  marginBottom: "1.25rem",
                }}
              >
                <strong>Advertencia:</strong> Existen compras de libros agrupados como{" "}
                <strong>Sin categoría</strong> (incluidos en el total). Se recomienda asignarles una
                categoría en el catálogo de libros.
              </div>
            )}

            <section
              className="compras-kpis"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "1rem",
                marginBottom: "1.5rem",
              }}
            >
              <article className="compras-kpi-card">
                <span className="compras-kpi-label">Gasto total del período</span>
                <strong className="compras-kpi-value">{formatCurrency(gastoTotal)}</strong>
                <small>
                  Período {reporte.Desde ?? reporte.desde} a {reporte.Hasta ?? reporte.hasta} (IVA
                  incluido)
                </small>
              </article>

              <article className="compras-kpi-card">
                <span className="compras-kpi-label">Categoría con mayor gasto</span>
                <strong className="compras-kpi-value">{catMayor}</strong>
                <small>
                  {formatCurrency(montoMayor)} ({pctMayor.toFixed(2)}% del total)
                </small>
              </article>
            </section>

            <section className="compras-panel" style={{ marginBottom: "1.5rem" }}>
              <div className="compras-panel-header">
                <div>
                  <h2>Distribución de monto por categoría</h2>
                  <p>Comparación visual del gasto acumulado por categoría de libro.</p>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                {categorias.map((c) => {
                  const nombre = c.Categoria ?? c.categoria;
                  const monto = Number(c.MontoGasto ?? c.monto_gasto ?? 0);
                  const pct = Number(
                    c.PorcentajeParticipacion ?? c.porcentaje_participacion ?? 0
                  );
                  const anchoPct = Math.max(4, Math.round((monto / maxMontoCategoria) * 100));

                  return (
                    <div key={nombre}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "0.9rem",
                          marginBottom: "0.25rem",
                        }}
                      >
                        <strong>{nombre}</strong>
                        <span>
                          {formatCurrency(monto)} ({pct.toFixed(2)}%)
                        </span>
                      </div>
                      <div
                        style={{
                          width: "100%",
                          height: "12px",
                          backgroundColor: "#e2e8f0",
                          borderRadius: "999px",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${anchoPct}%`,
                            height: "100%",
                            backgroundColor: "#2563eb",
                            borderRadius: "999px",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="compras-panel">
              <div className="compras-panel-header">
                <div>
                  <h2>Detalle de rotación y gasto por categoría</h2>
                  <p>Ordenado de mayor a menor monto de gasto (IVA incluido).</p>
                </div>
              </div>

              <div className="compras-table-wrap">
                <table className="compras-table">
                  <thead>
                    <tr>
                      <th>Categoría</th>
                      <th>Unidades</th>
                      <th>Órdenes</th>
                      <th>Monto (IVA incluido)</th>
                      <th>% de Participación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categorias.map((c) => {
                      const nombre = c.Categoria ?? c.categoria;
                      const unidades = Number(
                        c.UnidadesCompradas ?? c.unidades_compradas ?? 0
                      );
                      const ordenes = Number(c.NumeroOrdenes ?? c.numero_ordenes ?? 0);
                      const monto = Number(c.MontoGasto ?? c.monto_gasto ?? 0);
                      const pct = Number(
                        c.PorcentajeParticipacion ?? c.porcentaje_participacion ?? 0
                      );

                      return (
                        <tr key={nombre}>
                          <td>
                            <strong>{nombre}</strong>
                          </td>
                          <td>{unidades}</td>
                          <td>{ordenes}</td>
                          <td>
                            <strong>{formatCurrency(monto)}</strong>
                          </td>
                          <td>{pct.toFixed(2)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </ErpModuleShell>
  );
}

