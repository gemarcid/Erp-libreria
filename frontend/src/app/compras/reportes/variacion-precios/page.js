"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import ErpModuleShell from "@/components/ErpModuleShell";
import ComprasNav from "@/components/ComprasNav";
import ErpIcon from "@/components/ErpIcon";
import {
  fetchProveedores,
  fetchLibrosParaCompra,
  fetchReporteVariacionPrecios,
} from "@/lib/compras-api";

function formatMoney(value) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function formatSignedMoney(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  const absFormatted = formatMoney(Math.abs(num));
  if (num > 0) return `+${absFormatted}`;
  if (num < 0) return `-${absFormatted}`;
  return "$0";
}

function formatPercent(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  const formatted = Math.abs(num).toLocaleString("es-CL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (num > 0) return `+${formatted}%`;
  if (num < 0) return `-${formatted}%`;
  return "0,00%";
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

export default function ReporteVariacionPreciosPage() {
  const { usuario, loading: authLoading, error: authError } = useAuth();
  const router = useRouter();

  // Filtros
  const [desde, setDesde] = useState(getHace12MesesISO());
  const [hasta, setHasta] = useState(getHoyISO());
  const [isbn, setIsbn] = useState("");
  const [idProveedor, setIdProveedor] = useState("");

  // Catálogos y reporte
  const [proveedores, setProveedores] = useState([]);
  const [libros, setLibros] = useState([]);
  const [reporte, setReporte] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [rangoMostrado, setRangoMostrado] = useState({ desde: "", hasta: "" });

  useEffect(() => {
    if (!authLoading && !usuario && !authError) {
      router.replace("/login");
    }
  }, [authLoading, usuario, authError, router]);

  useEffect(() => {
    if (!usuario) return;
    async function cargarCatalogos() {
      try {
        const [provs, listaLibros] = await Promise.all([
          fetchProveedores(),
          fetchLibrosParaCompra(),
        ]);
        setProveedores(provs);
        setLibros(listaLibros);
      } catch (err) {
        console.error("Error al cargar catálogos para filtros:", err);
      }
    }
    cargarCatalogos();
  }, [usuario]);

  const consultarReporte = useCallback(
    async (filtroDesde, filtroHasta, filtroIsbn, filtroIdProv) => {
      if (filtroDesde && filtroHasta && filtroDesde > filtroHasta) {
        setError("La fecha 'desde' no puede ser posterior a la fecha 'hasta'.");
        setReporte(null);
        return;
      }

      setCargando(true);
      setError("");

      try {
        const res = await fetchReporteVariacionPrecios({
          desde: filtroDesde || undefined,
          hasta: filtroHasta || undefined,
          isbn: filtroIsbn || undefined,
          idProveedor: filtroIdProv ? parseInt(filtroIdProv, 10) : undefined,
        });
        setReporte(res);
        setRangoMostrado({
          desde: res.desde || filtroDesde,
          hasta: res.hasta || filtroHasta,
        });
      } catch (err) {
        setError(err.message || "Error al generar el reporte de variación de precios.");
        setReporte(null);
      } finally {
        setCargando(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!usuario) return;
    const timer = setTimeout(
      () => consultarReporte(getHace12MesesISO(), getHoyISO(), "", ""),
      0
    );
    return () => clearTimeout(timer);
  }, [usuario, consultarReporte]);

  const handleGenerar = (e) => {
    e.preventDefault();
    consultarReporte(desde, hasta, isbn, idProveedor);
  };

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
        title="Variación de Precios"
        description="Evolución histórica de precios pactados por producto y proveedor."
      >
        <div
          className="erp-card"
          style={{ padding: "30px", textAlign: "center", color: "var(--color-danger)" }}
        >
          <p>
            <strong>Acceso Restringido:</strong> Tu rol actual ({usuario?.rol || "Sin rol"}) no tiene
            permisos para ver este reporte.
          </p>
        </div>
      </ErpModuleShell>
    );
  }

  const filas = reporte?.filas || [];
  const mayorAlza = reporte?.mayorAlza ?? reporte?.mayor_alza ?? null;
  const mayorBaja = reporte?.mayorBaja ?? reporte?.mayor_baja ?? null;
  const unicaCompraSinVariacion =
    Boolean(reporte?.unicaCompraSinVariacion ?? reporte?.unica_compra_sin_variacion) ||
    filas.length === 1;

  return (
    <ErpModuleShell
      module="compras"
      title="Variación de Precios"
      description="Comparativa de precios pactados (netos) por producto y proveedor en órdenes aprobadas o recibidas."
      liveData
      subnav={<ComprasNav />}
    >
      <div className="inventory-screen" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
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
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: "1 1 240px" }}>
              <label htmlFor="filtro-producto" style={{ fontSize: "13px", fontWeight: "600" }}>
                Producto
              </label>
              <select
                id="filtro-producto"
                value={isbn}
                onChange={(e) => setIsbn(e.target.value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: "1px solid var(--color-border, #cbd5e1)",
                  fontSize: "14px",
                  backgroundColor: "#fff",
                }}
              >
                <option value="">Todos los productos</option>
                {libros.map((b) => (
                  <option key={b.isbn} value={b.isbn}>
                    {b.titulo} ({b.isbn})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: "1 1 220px" }}>
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
            <p>Generando reporte de variación de precios…</p>
          </div>
        )}

        {/* CONTENIDO DEL REPORTE */}
        {!cargando && !error && (
          <>
            {/* Caso especial: Sin compras con los filtros -> sin tarjetas ni tabla */}
            {filas.length === 0 ? (
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
                <p style={{ fontSize: "16px", fontWeight: "600", margin: 0 }}>
                  No hay compras registradas con esos filtros
                </p>
              </div>
            ) : (
              <>
                {/* Caso especial: Una sola compra de un solo producto y proveedor */}
                {unicaCompraSinVariacion && (
                  <div
                    className="erp-card"
                    role="status"
                    style={{
                      padding: "16px 20px",
                      backgroundColor: "#fff8e1",
                      border: "1px solid #ffb74d",
                      borderRadius: "8px",
                      color: "#e65100",
                      fontSize: "14px",
                      fontWeight: "600",
                    }}
                  >
                    Precio registrado: {formatMoney(filas[0].precioPactado ?? filas[0].precio_pactado)} — No hay otra compra con la cual calcular la variación
                  </div>
                )}

                {/* Dos tarjetas: "Mayor alza" y "Mayor baja" */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                    gap: "16px",
                  }}
                >
                  {/* Tarjeta Mayor alza */}
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
                      Mayor alza
                    </span>
                    {mayorAlza ? (
                      <>
                        <span style={{ fontSize: "24px", fontWeight: "700", color: "#c62828" }}>
                          ▲ {formatPercent(mayorAlza.variacionPorcentaje ?? mayorAlza.variacion_porcentaje)}
                        </span>
                        <span style={{ fontSize: "13px", fontWeight: "600" }}>
                          {mayorAlza.libroTitulo ?? mayorAlza.libro_titulo}
                        </span>
                        <span style={{ fontSize: "12px", color: "var(--color-text-muted, #64748b)" }}>
                          Proveedor: {mayorAlza.proveedorNombre ?? mayorAlza.proveedor_nombre}
                        </span>
                      </>
                    ) : (
                      <span style={{ fontSize: "14px", color: "var(--color-text-muted, #64748b)" }}>
                        Sin alzas registradas en el período
                      </span>
                    )}
                  </div>

                  {/* Tarjeta Mayor baja */}
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
                      Mayor baja
                    </span>
                    {mayorBaja ? (
                      <>
                        <span style={{ fontSize: "24px", fontWeight: "700", color: "#166534" }}>
                          ▼ {formatPercent(mayorBaja.variacionPorcentaje ?? mayorBaja.variacion_porcentaje)}
                        </span>
                        <span style={{ fontSize: "13px", fontWeight: "600" }}>
                          {mayorBaja.libroTitulo ?? mayorBaja.libro_titulo}
                        </span>
                        <span style={{ fontSize: "12px", color: "var(--color-text-muted, #64748b)" }}>
                          Proveedor: {mayorBaja.proveedorNombre ?? mayorBaja.proveedor_nombre}
                        </span>
                      </>
                    ) : (
                      <span style={{ fontSize: "14px", color: "var(--color-text-muted, #64748b)" }}>
                        Sin bajas registradas en el período
                      </span>
                    )}
                  </div>
                </div>

                {/* Tabla de Variación de Precios */}
                <section
                  className="erp-card inventory-table-panel"
                  style={{
                    padding: "20px",
                    backgroundColor: "#fff",
                    borderRadius: "10px",
                    border: "1px solid var(--color-border, #e2e8f0)",
                  }}
                >
                  <div className="module-table-scroll" role="region" aria-label="Tabla de variación de precios" tabIndex={0}>
                    <table className="module-table" style={{ width: "100%" }}>
                      <thead>
                        <tr>
                          <th scope="col" style={{ width: "110px", textAlign: "left" }}>Fecha</th>
                          <th scope="col" style={{ width: "85px", textAlign: "left" }}>N° OC</th>
                          <th scope="col" style={{ textAlign: "left" }}>Producto</th>
                          <th scope="col" style={{ textAlign: "left" }}>Proveedor</th>
                          <th scope="col" style={{ width: "150px", textAlign: "right" }}>Precio unitario (neto)</th>
                          <th scope="col" style={{ width: "140px", textAlign: "right" }}>Variación $</th>
                          <th scope="col" style={{ width: "140px", textAlign: "right" }}>Variación %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filas.map((f, index) => {
                          const idOc = f.idOc ?? f.id_oc;
                          const prod = f.libroTitulo ?? f.libro_titulo;
                          const prov = f.proveedorNombre ?? f.proveedor_nombre;
                          const precio = f.precioPactado ?? f.precio_pactado;
                          const varMonto = f.variacionMonto ?? f.variacion_monto;
                          const varPct = f.variacionPorcentaje ?? f.variacion_porcentaje;
                          const tieneVariacion =
                            varMonto !== null &&
                            varMonto !== undefined &&
                            varPct !== null &&
                            varPct !== undefined;

                          const numMonto = Number(varMonto);
                          const esAlza = tieneVariacion && numMonto > 0;
                          const esBaja = tieneVariacion && numMonto < 0;
                          const colorVariacion = esAlza
                            ? "#c62828"
                            : esBaja
                            ? "#166534"
                            : "var(--color-text-muted)";
                          const flecha = esAlza ? "▲ " : esBaja ? "▼ " : "";

                          return (
                            <tr key={`${idOc}-${f.isbn}-${index}`}>
                              <td style={{ color: "var(--color-text-muted)" }}>{f.fecha}</td>
                              <td style={{ fontFamily: "monospace", fontWeight: "700" }}>#{idOc}</td>
                              <td>
                                <strong>{prod}</strong>{" "}
                                <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
                                  ({f.isbn})
                                </span>
                              </td>
                              <td>{prov}</td>
                              <td style={{ textAlign: "right", fontWeight: "600" }}>
                                {formatMoney(precio)}
                              </td>
                              <td style={{ textAlign: "right", fontWeight: "600", color: colorVariacion }}>
                                {tieneVariacion ? `${flecha}${formatSignedMoney(varMonto)}` : "—"}
                              </td>
                              <td style={{ textAlign: "right", fontWeight: "600", color: colorVariacion }}>
                                {tieneVariacion ? `${flecha}${formatPercent(varPct)}` : "—"}
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
          </>
        )}
      </div>
    </ErpModuleShell>
  );
}

