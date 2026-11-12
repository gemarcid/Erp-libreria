"use client";

import { useEffect, useState } from "react";
import ErpModuleShell from "@/components/ErpModuleShell";
import ErpIcon from "@/components/ErpIcon";
import ComprasNav from "@/components/ComprasNav";
import { fetchProveedores, fetchReporteCumplimientoEntregas } from "@/lib/compras-api";

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

export default function ReporteCumplimientoEntregasPage() {
  const [proveedores, setProveedores] = useState([]);
  const [idProveedor, setIdProveedor] = useState("");
  const [desde, setDesde] = useState(() => getHace12MesesISO());
  const [hasta, setHasta] = useState(() => getHoyISO());

  const [reporte, setReporte] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelado = false;
    async function inicializar() {
      try {
        const provs = await fetchProveedores("");
        if (!cancelado) setProveedores(provs);
      } catch {
        // Silencioso en filtro
      }
      if (!cancelado) {
        await ejecutarConsulta(getHace12MesesISO(), getHoyISO(), "");
      }
    }
    inicializar();
    return () => {
      cancelado = true;
    };
  }, []);

  async function ejecutarConsulta(desdeParam, hastaParam, provParam) {
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
      const data = await fetchReporteCumplimientoEntregas({
        desde: desdeParam,
        hasta: hastaParam,
        idProveedor: provParam || undefined,
      });
      setReporte(data);
    } catch (err) {
      setError(err.message || "No se pudo generar el reporte de cumplimiento de entregas.");
      setReporte(null);
    } finally {
      setCargando(false);
    }
  }

  function handleGenerar(e) {
    e.preventDefault();
    ejecutarConsulta(desde, hasta, idProveedor);
  }

  const totalOrdenes = Number(
    reporte?.TotalOrdenesConsideradas ?? reporte?.total_ordenes_consideradas ?? 0
  );
  const pctATiempoGeneral = Number(
    reporte?.PorcentajeATiempoGeneral ?? reporte?.porcentaje_a_tiempo_general ?? 0
  );
  const pctCantidadGeneral = Number(
    reporte?.PorcentajeCantidadGeneral ?? reporte?.porcentaje_cantidad_general ?? 0
  );
  const resumenProveedores = reporte?.Proveedores || reporte?.proveedores || [];
  const detalleOrdenes = reporte?.Ordenes || reporte?.ordenes || [];

  function estiloFilaEstado(nivel) {
    if (nivel === "verde") {
      return { backgroundColor: "#f0fdf4", color: "#166534" };
    }
    if (nivel === "ambar") {
      return { backgroundColor: "#fffbeb", color: "#92400e" };
    }
    return { backgroundColor: "#fef2f2", color: "#991b1b" };
  }

  function estiloBadgeEstado(nivel) {
    if (nivel === "verde") {
      return {
        backgroundColor: "#dcfce7",
        color: "#15803d",
        border: "1px solid #86efac",
        padding: "0.2rem 0.55rem",
        borderRadius: "999px",
        fontWeight: 600,
        fontSize: "0.8rem",
      };
    }
    if (nivel === "ambar") {
      return {
        backgroundColor: "#fef3c7",
        color: "#b45309",
        border: "1px solid #fcd34d",
        padding: "0.2rem 0.55rem",
        borderRadius: "999px",
        fontWeight: 600,
        fontSize: "0.8rem",
      };
    }
    return {
      backgroundColor: "#fee2e2",
      color: "#b91c1c",
      border: "1px solid #fca5a5",
      padding: "0.2rem 0.55rem",
      borderRadius: "999px",
      fontWeight: 600,
      fontSize: "0.8rem",
    };
  }

  return (
    <ErpModuleShell
      module="compras"
      title="Cumplimiento de entregas"
      description="Evalúa el cumplimiento en plazo y cantidad de las órdenes de compra frente a las recepciones registradas en bodega según la fecha de entrega pactada."
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
              <label htmlFor="cump-proveedor">Proveedor (opcional)</label>
              <select
                id="cump-proveedor"
                className="compras-select"
                value={idProveedor}
                onChange={(e) => setIdProveedor(e.target.value)}
              >
                <option value="">Todos los proveedores</option>
                {proveedores.map((p) => {
                  const id = p.IdProveedor ?? p.id_proveedor ?? p.id;
                  const razon = p.RazonSocial ?? p.razon_social ?? p.nombre;
                  return (
                    <option key={id} value={id}>
                      {razon}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="compras-field">
              <label htmlFor="cump-desde">Fecha entrega Desde *</label>
              <input
                id="cump-desde"
                type="date"
                className="compras-input"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
              />
            </div>

            <div className="compras-field">
              <label htmlFor="cump-hasta">Fecha entrega Hasta *</label>
              <input
                id="cump-hasta"
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
            <p className="compras-empty">Calculando indicadores de cumplimiento de entregas...</p>
          </section>
        )}

        {!error && !cargando && reporte && totalOrdenes === 0 && (
          <section className="compras-panel">
            <div className="compras-empty" role="status">
              No hay órdenes con recepciones o entregas vencidas para los filtros seleccionados
            </div>
          </section>
        )}

        {!error && !cargando && reporte && totalOrdenes > 0 && (
          <>
            <section
              className="compras-kpis"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "1rem",
                marginBottom: "1.5rem",
              }}
            >
              <article className="compras-kpi-card">
                <span className="compras-kpi-label">% de entregas a tiempo</span>
                <strong className="compras-kpi-value">{pctATiempoGeneral.toFixed(2)}%</strong>
                <small>Sobre {totalOrdenes} orden(es) considerada(s)</small>
              </article>

              <article className="compras-kpi-card">
                <span className="compras-kpi-label">% de cumplimiento en cantidad</span>
                <strong className="compras-kpi-value">{pctCantidadGeneral.toFixed(2)}%</strong>
                <small>Unidades recibidas / unidades pedidas</small>
              </article>
            </section>

            <section className="compras-panel" style={{ marginBottom: "1.5rem" }}>
              <div className="compras-panel-header">
                <div>
                  <h2>Resumen de cumplimiento por proveedor</h2>
                  <p>
                    Indicadores agregados sobre las órdenes consideradas en el rango de fechas de
                    entrega pactada.
                  </p>
                </div>
              </div>

              <div className="compras-table-wrap">
                <table className="compras-table">
                  <thead>
                    <tr>
                      <th>Proveedor</th>
                      <th>Órdenes consideradas</th>
                      <th>% Entregas a tiempo</th>
                      <th>% Cumplimiento en cantidad</th>
                      <th>Promedio días de atraso (con atraso)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumenProveedores.map((p) => {
                      const idProv = p.IdProveedor ?? p.id_proveedor;
                      const nombre = p.ProveedorNombre ?? p.proveedor;
                      const consideradas = Number(
                        p.OrdenesConsideradas ?? p.ordenes_consideradas ?? 0
                      );
                      const pctTiempo = Number(p.PorcentajeATiempo ?? p.porcentaje_a_tiempo ?? 0);
                      const pctCant = Number(p.PorcentajeCantidad ?? p.porcentaje_cantidad ?? 0);
                      const promAtraso =
                        p.PromedioDiasAtraso ?? p.promedio_dias_atraso ?? null;

                      return (
                        <tr key={idProv}>
                          <td>
                            <strong>{nombre}</strong>
                          </td>
                          <td>{consideradas}</td>
                          <td>{pctTiempo.toFixed(2)}%</td>
                          <td>{pctCant.toFixed(2)}%</td>
                          <td>
                            {promAtraso !== null && promAtraso !== undefined
                              ? `${Number(promAtraso).toFixed(2)} día(s)`
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="compras-panel">
              <div className="compras-panel-header">
                <div>
                  <h2>Detalle de cumplimiento por orden</h2>
                  <p>
                    A tiempo en verde, Con atraso e Incompleta en ámbar, y No entregada en rojo.
                  </p>
                </div>
              </div>

              <div className="compras-table-wrap">
                <table className="compras-table">
                  <thead>
                    <tr>
                      <th>N° OC</th>
                      <th>Proveedor</th>
                      <th>Fecha Pactada</th>
                      <th>Fecha Última Recepción</th>
                      <th>Pedido</th>
                      <th>Recibido</th>
                      <th>% Cantidad</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalleOrdenes.map((o) => {
                      const idOc = o.IdOc ?? o.id_oc;
                      const prov = o.ProveedorNombre ?? o.proveedor;
                      const pactada = o.FechaPactada ?? o.fecha_pactada;
                      const ultRec =
                        o.FechaUltimaRecepcion ?? o.fecha_ultima_recepcion ?? "—";
                      const pedida = Number(o.CantidadPedida ?? o.cantidad_pedida ?? 0);
                      const recibida = Number(o.CantidadRecibida ?? o.cantidad_recibida ?? 0);
                      const pct = Number(o.PorcentajeCantidad ?? o.porcentaje_cantidad ?? 0);
                      const estado = o.EstadoCumplimiento ?? o.estado_cumplimiento;
                      const diasAtr = Number(o.DiasAtraso ?? o.dias_atraso ?? 0);
                      const nivel = o.NivelAlerta ?? o.nivel_alerta ?? "verde";

                      const etiquetaEstado =
                        estado === "Con atraso"
                          ? `Con atraso (${diasAtr} día(s))`
                          : estado;

                      return (
                        <tr key={idOc} style={estiloFilaEstado(nivel)}>
                          <td>
                            <strong>#{idOc}</strong>
                          </td>
                          <td>{prov}</td>
                          <td>{pactada}</td>
                          <td>{ultRec || "—"}</td>
                          <td>{pedida}</td>
                          <td>{recibida}</td>
                          <td>{pct.toFixed(2)}%</td>
                          <td>
                            <span style={estiloBadgeEstado(nivel)}>{etiquetaEstado}</span>
                          </td>
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

