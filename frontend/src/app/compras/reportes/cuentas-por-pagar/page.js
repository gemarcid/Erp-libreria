"use client";

import { useEffect, useState } from "react";
import ErpModuleShell from "@/components/ErpModuleShell";
import ErpIcon from "@/components/ErpIcon";
import ComprasNav from "@/components/ComprasNav";
import { fetchProveedores, fetchReporteCuentasPorPagar } from "@/lib/compras-api";
import { formatCurrency } from "@/lib/compras-format";

function hoyIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function ReporteCuentasPorPagarPage() {
  const [proveedores, setProveedores] = useState([]);
  const [idProveedor, setIdProveedor] = useState("");
  const [fechaCorte, setFechaCorte] = useState(() => hoyIso());

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
        await ejecutarConsulta(hoyIso(), "");
      }
    }
    inicializar();
    return () => {
      cancelado = true;
    };
  }, []);

  async function ejecutarConsulta(corteParam, provParam) {
    setError("");
    if (!corteParam || !/^\d{4}-\d{2}-\d{2}$/.test(corteParam.trim())) {
      setError("La fecha de corte es obligatoria y debe ser una fecha válida.");
      setReporte(null);
      setCargando(false);
      return;
    }

    setCargando(true);
    try {
      const data = await fetchReporteCuentasPorPagar({
        fechaCorte: corteParam.trim(),
        idProveedor: provParam || undefined,
      });
      setReporte(data);
    } catch (err) {
      setError(err.message || "No se pudo generar el reporte de cuentas por pagar.");
      setReporte(null);
    } finally {
      setCargando(false);
    }
  }

  function handleGenerar(e) {
    e.preventDefault();
    ejecutarConsulta(fechaCorte, idProveedor);
  }

  const totalFacturas = Number(reporte?.TotalFacturas ?? reporte?.total_facturas ?? 0);
  const totalPendientePago = Number(
    reporte?.TotalPendientePago ?? reporte?.total_pendiente_pago ?? 0
  );
  const tramos = reporte?.Tramos || reporte?.tramos || [];
  const facturas = reporte?.Facturas || reporte?.facturas || [];

  function estiloFilaPorAlerta(nivel) {
    if (nivel === "rojo") {
      return { backgroundColor: "#fef2f2", color: "#991b1b" };
    }
    if (nivel === "ambar") {
      return { backgroundColor: "#fffbeb", color: "#92400e" };
    }
    return { backgroundColor: "#f0fdf4", color: "#166534" };
  }

  function estiloBadgePorAlerta(nivel) {
    if (nivel === "rojo") {
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
      backgroundColor: "#dcfce7",
      color: "#15803d",
      border: "1px solid #86efac",
      padding: "0.2rem 0.55rem",
      borderRadius: "999px",
      fontWeight: 600,
      fontSize: "0.8rem",
    };
  }

  return (
    <ErpModuleShell
      module="compras"
      title="Cuentas por pagar"
      description="Visualiza las facturas de proveedor pendientes de pago clasificadas por tramo de antigüedad y vencimiento respecto a la fecha de corte seleccionada."
      liveData
      subnav={<ComprasNav />}
    >
      <div className="erp-main">

        <section className="compras-panel" style={{ marginBottom: "1.5rem" }}>
          <form
            onSubmit={handleGenerar}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "1rem",
              alignItems: "end",
            }}
          >
            <div className="compras-field">
              <label htmlFor="cpp-proveedor">Proveedor (opcional)</label>
              <select
                id="cpp-proveedor"
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
              <label htmlFor="cpp-fecha-corte">Fecha de corte *</label>
              <input
                id="cpp-fecha-corte"
                type="date"
                className="compras-input"
                value={fechaCorte}
                onChange={(e) => setFechaCorte(e.target.value)}
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
            <p className="compras-empty">Consultando cuentas por pagar...</p>
          </section>
        )}

        {!error && !cargando && reporte && totalFacturas === 0 && (
          <section className="compras-panel">
            <div className="compras-empty" role="status">
              No hay facturas pendientes de pago con los filtros seleccionados
            </div>
          </section>
        )}

        {!error && !cargando && reporte && totalFacturas > 0 && (
          <>
            <section
              className="compras-kpis"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "1rem",
                marginBottom: "1.25rem",
              }}
            >
              <article className="compras-kpi-card">
                <span className="compras-kpi-label">Total pendiente de pago</span>
                <strong className="compras-kpi-value">{formatCurrency(totalPendientePago)}</strong>
                <small>Fecha de corte: {reporte.FechaCorte ?? reporte.fecha_corte}</small>
              </article>

              <article className="compras-kpi-card">
                <span className="compras-kpi-label">Cantidad de facturas pendientes</span>
                <strong className="compras-kpi-value">{totalFacturas}</strong>
                <small>Facturas con estado distinto de pagada</small>
              </article>
            </section>

            <section
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(185px, 1fr))",
                gap: "0.85rem",
                marginBottom: "1.5rem",
              }}
            >
              {tramos.map((t) => {
                const cod = t.Codigo ?? t.codigo;
                const etiq = t.Etiqueta ?? t.etiqueta;
                const cant = Number(t.CantidadFacturas ?? t.cantidad_facturas ?? 0);
                const monto = Number(t.MontoTotal ?? t.monto_total ?? 0);
                const esVig = cod === "vigentes";
                const esPorVencer = cod === "por_vencer";

                return (
                  <article
                    key={cod}
                    className="compras-kpi-card"
                    style={{
                      borderLeft: `4px solid ${
                        esVig ? "#16a34a" : esPorVencer ? "#d97706" : "#dc2626"
                      }`,
                    }}
                  >
                    <span className="compras-kpi-label">{etiq}</span>
                    <strong className="compras-kpi-value" style={{ fontSize: "1.25rem" }}>
                      {formatCurrency(monto)}
                    </strong>
                    <small>{cant} factura(s)</small>
                  </article>
                );
              })}
            </section>

            <section className="compras-panel">
              <div className="compras-panel-header">
                <div>
                  <h2>Detalle de facturas por pagar</h2>
                  <p>
                    Ordenadas por fecha de vencimiento (vencidas en rojo, por vencer en ámbar y
                    vigentes en verde).
                  </p>
                </div>
              </div>

              <div className="compras-table-wrap">
                <table className="compras-table">
                  <thead>
                    <tr>
                      <th>Proveedor</th>
                      <th>N° Factura</th>
                      <th>N° OC</th>
                      <th>Vencimiento</th>
                      <th>Días de atraso / para vencer</th>
                      <th>Monto Total</th>
                      <th>Estado de la Factura</th>
                      <th>Fecha de Pago Programada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {facturas.map((f) => {
                      const idFac = f.IdFactura ?? f.id_factura;
                      const prov = f.ProveedorNombre ?? f.proveedor;
                      const nroFac = f.NroFactura ?? f.nro_factura;
                      const idOc = f.IdOc ?? f.id_oc;
                      const venc = f.FechaVencimiento ?? f.fecha_vencimiento;
                      const diasDif = Number(f.DiasDiferencia ?? f.dias_diferencia ?? 0);
                      const diasAtr = Number(f.DiasAtraso ?? f.dias_atraso ?? 0);
                      const diasVenc = Number(f.DiasParaVencer ?? f.dias_para_vencer ?? 0);
                      const nivel = f.NivelAlerta ?? f.nivel_alerta ?? "verde";
                      const tramoEtiq = f.TramoEtiqueta ?? f.tramo_etiqueta;
                      const monto = Number(f.MontoTotal ?? f.monto_total ?? 0);
                      const estado = f.EstadoFactura ?? f.estado_factura;
                      const fechaPagoProg =
                        f.FechaPagoProgramada ?? f.fecha_pago_programada ?? "—";

                      const textoDias =
                        diasDif < 0
                          ? `${diasAtr} día(s) de atraso (${tramoEtiq})`
                          : diasDif === 0
                          ? `Vence hoy (${tramoEtiq})`
                          : `${diasVenc} día(s) para vencer (${tramoEtiq})`;

                      return (
                        <tr key={idFac} style={estiloFilaPorAlerta(nivel)}>
                          <td>
                            <strong>{prov}</strong>
                          </td>
                          <td>{nroFac}</td>
                          <td>#{idOc}</td>
                          <td>{venc}</td>
                          <td>
                            <span style={estiloBadgePorAlerta(nivel)}>{textoDias}</span>
                          </td>
                          <td>
                            <strong>{formatCurrency(monto)}</strong>
                          </td>
                          <td>{estado}</td>
                          <td>{fechaPagoProg || "—"}</td>
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

