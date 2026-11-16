"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import ErpModuleShell from "@/components/ErpModuleShell";
import ComprasNav from "@/components/ComprasNav";
import ErpIcon from "@/components/ErpIcon";
import { fetchProveedores, fetchReporteHistorico } from "@/lib/compras-api";

function formatMoney(value) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function getHoyISO() {
  const d = new Date();
  return d.toISOString().split("T")[0];
}

function getHace12MesesISO() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().split("T")[0];
}

export default function ReporteHistoricoComprasPage() {
  const { usuario, loading: authLoading, error: authError } = useAuth();
  const router = useRouter();

  // Estados de filtros
  const [desde, setDesde] = useState(getHace12MesesISO());
  const [hasta, setHasta] = useState(getHoyISO());
  const [idProveedor, setIdProveedor] = useState("");

  // Datos
  const [proveedores, setProveedores] = useState([]);
  const [reporte, setReporte] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [exportando, setExportando] = useState(false);
  const [errorExportacion, setErrorExportacion] = useState("");
  const [rangoMostrado, setRangoMostrado] = useState({ desde: "", hasta: "" });

  // Redirección si no hay sesión
  useEffect(() => {
    if (!authLoading && !usuario && !authError) {
      router.replace("/login");
    }
  }, [authLoading, usuario, authError, router]);

  // Cargar lista de proveedores para el desplegable (API Parte 1)
  useEffect(() => {
    if (!usuario) return;
    async function cargarListaProveedores() {
      try {
        const provs = await fetchProveedores();
        setProveedores(provs);
      } catch (err) {
        console.error("Error al cargar proveedores para el filtro:", err);
      }
    }
    cargarListaProveedores();
  }, [usuario]);

  // Función para consultar el reporte
  const consultarReporte = useCallback(
    async (filtroDesde, filtroHasta, filtroIdProv) => {
      // Validación cliente: desde no mayor que hasta
      if (filtroDesde && filtroHasta && filtroDesde > filtroHasta) {
        setError("La fecha 'desde' no puede ser posterior a la fecha 'hasta'.");
        setReporte(null);
        return;
      }

      setCargando(true);
      setError("");

      try {
        const params = {
          desde: filtroDesde || undefined,
          hasta: filtroHasta || undefined,
          idProveedor: filtroIdProv ? parseInt(filtroIdProv, 10) : undefined,
        };

        const res = await fetchReporteHistorico(params);
        setReporte(res);
        setRangoMostrado({
          desde: res.desde || filtroDesde,
          hasta: res.hasta || filtroHasta,
        });
      } catch (err) {
        setError(err.message || "Error al generar el reporte histórico.");
        setReporte(null);
      } finally {
        setCargando(false);
      }
    },
    []
  );

  // Carga inicial automática con valores por defecto
  useEffect(() => {
    if (!usuario) return;
    const timer = setTimeout(() => consultarReporte(getHace12MesesISO(), getHoyISO(), ""), 0);
    return () => clearTimeout(timer);
  }, [usuario, consultarReporte]);

  // Manejar clic en "Generar"
  const handleGenerar = (e) => {
    e.preventDefault();
    consultarReporte(desde, hasta, idProveedor);
  };

  const exportarPDF = async () => {
    if (!reporte?.proveedores?.length || exportando) return;
    setExportando(true);
    setErrorExportacion("");
    try {
      const { createPurchasesPdf } = await import("@/lib/purchases-pdf");
      const doc = createPurchasesPdf({ report: reporte, from: rangoMostrado.desde, to: rangoMostrado.hasta });
      doc.save(`historico_compras_proveedor_${getHoyISO()}.pdf`);
    } catch (err) {
      setErrorExportacion(err.message || "No se pudo generar el PDF.");
    } finally {
      setExportando(false);
    }
  };
  // Verificación de rol
  const roleNormalizado = (usuario?.rol || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
  const tieneAcceso = [
    "administrador",
    "administradora",
    "admin",
    "comprador",
    "compradora",
    "contador",
    "contadora",
  ].includes(roleNormalizado);

  if (authLoading) {
    return (
      <main className="erp-app">
        <div style={{ padding: "40px", textAlign: "center" }}>Cargando sesión…</div>
      </main>
    );
  }

  if (!tieneAcceso && usuario) {
    return (
      <ErpModuleShell
        module="compras"
        title="Histórico de Compras por Proveedor"
        description="Reporte analítico de órdenes de compra aprobadas y recibidas."
      >
        <div
          className="erp-card"
          style={{ padding: "30px", textAlign: "center", color: "var(--color-danger)" }}
        >
          <p>
            <strong>Acceso Restringido:</strong> Tu rol actual ({usuario?.rol || "Sin rol"}) no tiene
            permisos para ver este reporte. Se requiere perfil Administrador, Comprador o Contador.
          </p>
        </div>
      </ErpModuleShell>
    );
  }

  const filas = reporte?.proveedores || [];
  const totalOrdenes = reporte?.total_ordenes ?? reporte?.totalOrdenes ?? 0;
  const totalUnidades = reporte?.total_unidades ?? reporte?.totalUnidades ?? 0;
  const totalMonto = reporte?.total_monto ?? reporte?.totalMonto ?? 0;

  // Monto máximo para calcular ancho de barras proporcionales
  const maxMonto = filas.reduce((max, f) => {
    const m = Number(f.monto_acumulado ?? f.montoAcumulado ?? 0);
    return m > max ? m : max;
  }, 0) || 1;

  return (
    <ErpModuleShell
      module="compras"
      title="Histórico de Compras por Proveedor"
      description="Compras aprobadas y recibidas por proveedor, frecuencia y monto promedio."
      liveData
      subnav={<ComprasNav />}
      actions={
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            type="button"
            className="module-secondary-button"
            onClick={exportarPDF}
            disabled={cargando || exportando || filas.length === 0}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              cursor: cargando || filas.length === 0 ? "not-allowed" : "pointer",
            }}
          >
            <ErpIcon name="download" size={15} />
            {exportando ? "Generando PDF…" : "Exportar PDF"}
          </button>
        </div>
      }
    >
      <div className="inventory-screen" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {errorExportacion && <p className="module-alert" role="alert">{errorExportacion}</p>}
        {/* PANEL DE FILTROS */}
        <section
          className="erp-card"
          style={{
            padding: "20px",
            backgroundColor: "var(--color-bg-card, #ffffff)",
            border: "1px solid var(--color-border, #e2e8f0)",
            borderRadius: "10px",
          }}
        >
          <form
            onSubmit={handleGenerar}
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "16px",
              alignItems: "flex-end",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label htmlFor="filtro-desde" style={{ fontSize: "13px", fontWeight: "600" }}>
                Fecha Desde
              </label>
              <input
                id="filtro-desde"
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: "1px solid var(--color-border, #cbd5e1)",
                  fontSize: "14px",
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label htmlFor="filtro-hasta" style={{ fontSize: "13px", fontWeight: "600" }}>
                Fecha Hasta
              </label>
              <input
                id="filtro-hasta"
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: "1px solid var(--color-border, #cbd5e1)",
                  fontSize: "14px",
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: "1 1 240px" }}>
              <label htmlFor="filtro-proveedor" style={{ fontSize: "13px", fontWeight: "600" }}>
                Proveedor
              </label>
              <select
                id="filtro-proveedor"
                value={idProveedor}
                onChange={(e) => setIdProveedor(e.target.value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: "1px solid var(--color-border, #cbd5e1)",
                  fontSize: "14px",
                  backgroundColor: "#fff",
                }}
              >
                <option value="">Todos los proveedores</option>
                {proveedores.map((p) => {
                  const id = p.idProveedor ?? p.id_proveedor;
                  const razon = p.razonSocial ?? p.razon_social;
                  return (
                    <option key={id} value={id}>
                      {razon}
                    </option>
                  );
                })}
              </select>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="submit"
                className="module-primary-button"
                disabled={cargando}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "9px 18px",
                  borderRadius: "6px",
                  fontWeight: "600",
                  cursor: cargando ? "not-allowed" : "pointer",
                }}
              >
                <ErpIcon name="search" size={15} />
                {cargando ? "Generando…" : "Generar"}
              </button>
            </div>
          </form>

          {/* Rango consultado */}
          {rangoMostrado.desde && rangoMostrado.hasta && (
            <div
              style={{
                marginTop: "14px",
                paddingTop: "12px",
                borderTop: "1px dashed var(--color-border, #e2e8f0)",
                fontSize: "13px",
                color: "var(--color-text-muted, #64748b)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <ErpIcon name="calendar" size={14} />
              <span>
                Período consultado: <strong>{rangoMostrado.desde}</strong> al{" "}
                <strong>{rangoMostrado.hasta}</strong>
                {idProveedor && (
                  <span>
                    {" "}
                    (Filtrado por proveedor:{" "}
                    <strong>
                      {proveedores.find((p) => String(p.idProveedor ?? p.id_proveedor) === String(idProveedor))
                        ?.razonSocial || `#${idProveedor}`}
                    </strong>
                    )
                  </span>
                )}
              </span>
            </div>
          )}
        </section>

        {/* MENSAJES DE ERROR */}
        {error && (
          <div
            className="erp-card"
            role="alert"
            style={{
              padding: "14px 18px",
              backgroundColor: "var(--status-danger-bg, #fee2e2)",
              color: "var(--color-danger, #b91c1c)",
              border: "1px solid #fca5a5",
              borderRadius: "8px",
              fontSize: "14px",
            }}
          >
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* ESTADO DE CARGA */}
        {cargando && (
          <div
            className="erp-card"
            style={{ padding: "40px", textAlign: "center", color: "var(--color-text-muted)" }}
          >
            <p>Generando reporte histórico de compras…</p>
          </div>
        )}

        {/* CONTENIDO PRINCIPAL DEL REPORTE */}
        {!cargando && !error && (
          <>
            {/* TARJETAS RESUMEN (solo cuando hay compras en el período) */}
            {filas.length > 0 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "16px",
                }}
              >
                <div
                  className="erp-card"
                  style={{
                    padding: "18px 22px",
                    borderRadius: "10px",
                    border: "1px solid var(--color-border, #e2e8f0)",
                    backgroundColor: "#fff",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: "600",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      color: "var(--color-text-muted, #64748b)",
                    }}
                  >
                    Órdenes de Compra
                  </span>
                  <span
                    style={{
                      fontSize: "26px",
                      fontWeight: "700",
                      color: "var(--color-primary, #0f172a)",
                    }}
                  >
                    {totalOrdenes}
                  </span>
                  <span style={{ fontSize: "12px", color: "var(--color-text-muted, #64748b)" }}>
                    Aprobadas, recibidas parciales o recibidas en el rango
                  </span>
                </div>

                <div
                  className="erp-card"
                  style={{
                    padding: "18px 22px",
                    borderRadius: "10px",
                    border: "1px solid var(--color-border, #e2e8f0)",
                    backgroundColor: "#fff",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: "600",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      color: "var(--color-text-muted, #64748b)",
                    }}
                  >
                    Unidades Compradas
                  </span>
                  <span
                    style={{
                      fontSize: "26px",
                      fontWeight: "700",
                      color: "var(--color-primary, #0f172a)",
                    }}
                  >
                    {totalUnidades.toLocaleString("es-CL")}
                  </span>
                  <span style={{ fontSize: "12px", color: "var(--color-text-muted, #64748b)" }}>
                    Total de libros solicitados
                  </span>
                </div>

                <div
                  className="erp-card"
                  style={{
                    padding: "18px 22px",
                    borderRadius: "10px",
                    border: "1px solid var(--color-border, #e2e8f0)",
                    backgroundColor: "#fff",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: "600",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      color: "var(--color-text-muted, #64748b)",
                    }}
                  >
                    Monto Acumulado Total
                  </span>
                  <span
                    style={{
                      fontSize: "26px",
                      fontWeight: "700",
                      color: "#166534",
                    }}
                  >
                    {formatMoney(totalMonto)}
                  </span>
                  <span style={{ fontSize: "12px", color: "var(--color-text-muted, #64748b)" }}>
                    Total compras (IVA incluido)
                  </span>
                </div>
              </div>
            )}

            {/* SI NO HAY FILAS */}
            {filas.length === 0 && (
              <div
                className="erp-card"
                style={{
                  padding: "48px 24px",
                  textAlign: "center",
                  backgroundColor: "#fff",
                  borderRadius: "10px",
                  border: "1px solid var(--color-border, #e2e8f0)",
                }}
              >
                <p style={{ fontSize: "16px", fontWeight: "600", margin: "0 0 6px 0" }}>
                  No hay compras registradas para ese proveedor en el período
                </p>
                <p style={{ fontSize: "13px", color: "var(--color-text-muted)", margin: 0 }}>
                  Prueba ampliando el rango de fechas o seleccionando otro proveedor.
                </p>
              </div>
            )}

            {/* GRÁFICO DE BARRAS HORIZONTALES (CSS PURO) */}
            {filas.length > 0 && (
              <section
                className="erp-card"
                style={{
                  padding: "22px",
                  backgroundColor: "#fff",
                  borderRadius: "10px",
                  border: "1px solid var(--color-border, #e2e8f0)",
                }}
              >
                <div style={{ marginBottom: "16px" }}>
                  <p className="erp-eyebrow" style={{ margin: 0 }}>
                    DISTRIBUCIÓN DE COMPRAS
                  </p>
                  <h3 style={{ margin: "4px 0", fontSize: "16px" }}>
                    Monto Acumulado por Proveedor
                  </h3>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {filas.map((fila) => {
                    const id = fila.id_proveedor ?? fila.idProveedor;
                    const razon = fila.razon_social ?? fila.razonSocial;
                    const monto = Number(fila.monto_acumulado ?? fila.montoAcumulado ?? 0);
                    const ordenes = fila.numero_ordenes ?? fila.numeroOrdenes;
                    const porcentajeDelMax = Math.max(3, Math.round((monto / maxMonto) * 100));
                    const porcentajeDelTotal =
                      totalMonto > 0 ? ((monto / totalMonto) * 100).toFixed(1) : "0.0";

                    return (
                      <div
                        key={id}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "4px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "baseline",
                            fontSize: "13px",
                          }}
                        >
                          <span style={{ fontWeight: "600", color: "var(--color-text-main)" }}>
                            {razon}
                            <span
                              style={{
                                marginLeft: "8px",
                                fontSize: "11px",
                                fontWeight: "normal",
                                color: "var(--color-text-muted)",
                              }}
                            >
                              ({ordenes} {ordenes === 1 ? "orden" : "órdenes"})
                            </span>
                          </span>
                          <span style={{ fontWeight: "600", color: "var(--color-primary, #9b4444)" }}>
                            {formatMoney(monto)}{" "}
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: "normal",
                                color: "var(--color-text-muted)",
                              }}
                            >
                              ({porcentajeDelTotal}%)
                            </span>
                          </span>
                        </div>

                        {/* Barra horizontal CSS */}
                        <div
                          style={{
                            width: "100%",
                            height: "18px",
                            backgroundColor: "#f5eaea",
                            borderRadius: "4px",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${porcentajeDelMax}%`,
                              height: "100%",
                              background: "linear-gradient(90deg, var(--color-primary, #9b4444), #bd7676)",
                              borderRadius: "4px",
                              transition: "width 0.4s ease-out",
                            }}
                            title={`${razon}: ${formatMoney(monto)} (${porcentajeDelTotal}%)`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* TABLA DE DATOS COMPLETA */}
            {filas.length > 0 && (
              <section
                className="erp-card inventory-table-panel"
                style={{
                  padding: "20px",
                  backgroundColor: "#fff",
                  borderRadius: "10px",
                  border: "1px solid var(--color-border, #e2e8f0)",
                }}
              >
                <div style={{ marginBottom: "14px" }}>
                  <p className="erp-eyebrow" style={{ margin: 0 }}>
                    DETALLE ESTADÍSTICO
                  </p>
                  <h3 style={{ margin: "4px 0", fontSize: "16px" }}>
                    Resumen Consolidado por Proveedor
                  </h3>
                </div>

                <div
                  className="module-table-scroll"
                  role="region"
                  aria-label="Tabla de compras por proveedor"
                  tabIndex={0}
                >
                  <table className="module-table" style={{ width: "100%" }}>
                    <thead>
                      <tr>
                        <th scope="col" style={{ width: "60px", textAlign: "left" }}>
                          ID
                        </th>
                        <th scope="col" style={{ textAlign: "left" }}>
                          Razón Social
                        </th>
                        <th scope="col" style={{ textAlign: "right" }}>
                          Órdenes
                        </th>
                        <th scope="col" style={{ textAlign: "right" }}>
                          Unidades
                        </th>
                        <th scope="col" style={{ textAlign: "right" }}>
                          Monto Acumulado
                        </th>
                        <th scope="col" style={{ textAlign: "right" }}>
                          Ticket Promedio
                        </th>
                        <th scope="col" style={{ textAlign: "center" }}>
                          1ª Compra
                        </th>
                        <th scope="col" style={{ textAlign: "center" }}>
                          Última Compra
                        </th>
                        <th scope="col" style={{ textAlign: "right" }}>
                          Órd / Mes
                        </th>
                        <th scope="col" style={{ textAlign: "right" }}>
                          Días Prom.
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filas.map((f) => {
                        const id = f.id_proveedor ?? f.idProveedor;
                        const razon = f.razon_social ?? f.razonSocial;
                        const ordenes = f.numero_ordenes ?? f.numeroOrdenes;
                        const unidades = f.unidades_compradas ?? f.unidadesCompradas;
                        const monto = Number(f.monto_acumulado ?? f.montoAcumulado ?? 0);
                        const ticket = Number(f.ticket_promedio ?? f.ticketPromedio ?? 0);
                        const primera = f.primera_compra ?? f.primeraCompra ?? "—";
                        const ultima = f.ultima_compra ?? f.ultimaCompra ?? "—";
                        const ordenesMes = Number(f.ordenes_por_mes ?? f.ordenesPorMes ?? 0);
                        const diasProm =
                          f.dias_promedio_entre_ordenes ?? f.diasPromedioEntreOrdenes;

                        return (
                          <tr key={id}>
                            <td style={{ fontFamily: "monospace", color: "var(--color-text-muted)" }}>
                              #{id}
                            </td>
                            <td>
                              <strong>{razon}</strong>
                            </td>
                            <td style={{ textAlign: "right", fontWeight: "600" }}>{ordenes}</td>
                            <td style={{ textAlign: "right" }}>
                              {unidades.toLocaleString("es-CL")}
                            </td>
                            <td style={{ textAlign: "right", fontWeight: "600", color: "#166534" }}>
                              {formatMoney(monto)}
                            </td>
                            <td style={{ textAlign: "right" }}>{formatMoney(ticket)}</td>
                            <td
                              style={{
                                textAlign: "center",
                                fontSize: "12px",
                                color: "var(--color-text-muted)",
                              }}
                            >
                              {primera}
                            </td>
                            <td
                              style={{
                                textAlign: "center",
                                fontSize: "12px",
                                color: "var(--color-text-muted)",
                              }}
                            >
                              {ultima}
                            </td>
                            <td style={{ textAlign: "right", fontSize: "13px" }}>
                              {ordenesMes.toFixed(2)}
                            </td>
                            <td style={{ textAlign: "right", fontSize: "13px" }}>
                              {diasProm !== null && diasProm !== undefined ? (
                                <span>{Number(diasProm).toFixed(1)} d</span>
                              ) : (
                                <span style={{ color: "var(--color-text-muted)" }}>—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr
                        style={{
                          fontWeight: "700",
                          borderTop: "2px solid var(--color-border, #cbd5e1)",
                          backgroundColor: "var(--color-bg-secondary, #f8fafc)",
                        }}
                      >
                        <td colSpan={2} style={{ textAlign: "left" }}>
                          Totales Generales ({filas.length} proveedores)
                        </td>
                        <td style={{ textAlign: "right" }}>{totalOrdenes}</td>
                        <td style={{ textAlign: "right" }}>{totalUnidades.toLocaleString("es-CL")}</td>
                        <td style={{ textAlign: "right", color: "#166534" }}>
                          {formatMoney(totalMonto)}
                        </td>
                        <td colSpan={5} style={{ textAlign: "right" }}>
                          —
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </ErpModuleShell>
  );
}
