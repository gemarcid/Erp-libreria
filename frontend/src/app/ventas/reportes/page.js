"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/components/AuthProvider";
import ErpModuleShell from "@/components/ErpModuleShell";
import VentasNav from "@/components/VentasNav";
import ErpIcon from "@/components/ErpIcon";
import { createCsv } from "@/lib/csv";

function formatMoney(value) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function formatNumber(value) {
  return new Intl.NumberFormat("es-CL").format(Number(value) || 0);
}

export default function ReportesVentasPage() {
  const { usuario, loading } = useAuth();

  // Tipo de Reporte: 'ranking' | 'producto' | 'cuentas-cobrar' | 'rotacion' | 'canales'
  const [reporteActivo, setReporteActivo] = useState("ranking");

  // Filtros comunes
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [categoria, setCategoria] = useState("todos");
  const [filtroRotacion, setFiltroRotacion] = useState("todos"); // 'todos' | 'top' | 'muerto'
  const [filtroCliente, setFiltroCliente] = useState("");

  // Datos
  const [datosReporte, setDatosReporte] = useState([]);
  const [resumen, setResumen] = useState({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  function cambiarReporte(nuevoReporte) {
    if (nuevoReporte === reporteActivo) return;
    setReporteActivo(nuevoReporte);
    setDatosReporte([]);
    setResumen({});
    setCargando(true);
    setError("");
  }

  async function consultarReporte(tipoAUsar = reporteActivo) {
    setCargando(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("tipo", tipoAUsar);
      if (desde) params.set("desde", desde);
      if (hasta) params.set("hasta", hasta);
      if (categoria !== "todos") params.set("categoria", categoria);
      if (filtroRotacion !== "todos") params.set("filtro", filtroRotacion);
      if (filtroCliente.trim()) params.set("cliente", filtroCliente.trim());

      const res = await fetch(`/api/ventas/reportes?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "No se pudo consultar el reporte.");

      setDatosReporte(data.reporte || []);
      setResumen(data);
    } catch (err) {
      setError(err.message || "Error al cargar la reportería.");
      setDatosReporte([]);
      setResumen({});
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    if (!loading && usuario) {
      consultarReporte(reporteActivo);
    }
  }, [loading, usuario, reporteActivo, categoria, filtroRotacion]);

  function exportarCsvActual() {
    let filas = [];
    const fechaHoy = new Date().toISOString().slice(0, 10);

    if (reporteActivo === "ranking") {
      filas = [
        ["Posición", "RUT", "Cliente", "Tipo", "Ventas", "Total Comprado", "% Participación", "% Acumulado", "Clasificación Pareto"],
        ...datosReporte.map((r) => [
          r.posicion,
          r.rut,
          r.nombre,
          r.tipo_cliente,
          r.cantidad_ventas,
          r.total_vendido,
          `${r.porcentaje}%`,
          `${r.porcentaje_acumulado}%`,
          `Zona ${r.clasificacion}`,
        ]),
      ];
    } else if (reporteActivo === "producto") {
      filas = [
        ["ISBN", "Título", "Autor", "Categoría", "Editorial", "Unidades Vendidas", "Total Recaudado", "Precio Promedio"],
        ...datosReporte.map((r) => [
          r.isbn,
          r.titulo,
          r.autor,
          r.categoria,
          r.editorial,
          r.unidades_vendidas,
          r.total_recaudado,
          r.precio_promedio,
        ]),
      ];
    } else if (reporteActivo === "cuentas-cobrar") {
      filas = [
        ["Folio", "Cliente", "RUT", "Tipo", "Fecha Emisión", "Fecha Vencimiento", "Días Mora", "Tramo", "Saldo Pendiente"],
        ...datosReporte.map((r, idx) => [
          r.folio || (r.id_venta ? `F-${r.id_venta}` : `DOC-${idx + 1}`),
          r.cliente?.nombre || r.cliente_nombre || "Cliente sin registrar",
          r.cliente?.rut || r.cliente_rut || "S/R",
          r.cliente?.tipo || r.tipo_cliente || "general",
          r.fecha_emision || r.fecha || "",
          r.fecha_vencimiento || "",
          r.dias_mora || 0,
          r.tramo || "",
          r.saldo_pendiente ?? r.total ?? 0,
        ]),
      ];
    } else if (reporteActivo === "rotacion") {
      filas = [
        ["ISBN", "Título", "Autor", "Categoría", "Editorial", "Stock Actual", "Unidades Vendidas", "Última Venta", "Días sin Vender", "Clasificación"],
        ...datosReporte.map((r) => [
          r.isbn,
          r.titulo,
          r.autor,
          r.categoria,
          r.editorial,
          r.stock_actual,
          r.unidades_vendidas,
          r.ultima_venta,
          r.dias_sin_vender,
          r.clasificacion,
        ]),
      ];
    } else if (reporteActivo === "canales") {
      filas = [
        ["Canal de Venta", "Operaciones", "Total Neto", "Total IVA", "Total Recaudado", "Ticket Promedio"],
        ...datosReporte.map((r) => [
          r.canal,
          r.cantidad_operaciones,
          r.total_neto,
          r.total_iva,
          r.total_recaudado,
          r.ticket_promedio,
        ]),
      ];
    }

    const csvData = createCsv(filas);
    const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `reporte_${reporteActivo}_${fechaHoy}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <ErpModuleShell
      usuario={usuario}
      module="ventas"
      title="Reportería Gerencial de Ventas"
      description="Los 5 reportes estratégicos del módulo de ventas según la propuesta del ERP: Pareto, productos, morosidad, rotación y canales."
      subnav={<VentasNav />}
      liveData={true}
    >
      <div className="ventas-report">
        {/* Selector de los 5 Reportes */}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1.2rem" }}>
          <button
            type="button"
            className={`erp-button ${reporteActivo === "ranking" ? "erp-button-primary" : "erp-button-secondary"}`}
            onClick={() => cambiarReporte("ranking")}
          >
            1. Ranking Clientes (Pareto)
          </button>
          <button
            type="button"
            className={`erp-button ${reporteActivo === "producto" ? "erp-button-primary" : "erp-button-secondary"}`}
            onClick={() => cambiarReporte("producto")}
          >
            2. Ventas por Producto y Categoría
          </button>
          <button
            type="button"
            className={`erp-button ${reporteActivo === "cuentas-cobrar" ? "erp-button-primary" : "erp-button-secondary"}`}
            onClick={() => cambiarReporte("cuentas-cobrar")}
          >
            3. Cuentas por Cobrar (Facturas)
          </button>
          <button
            type="button"
            className={`erp-button ${reporteActivo === "rotacion" ? "erp-button-primary" : "erp-button-secondary"}`}
            onClick={() => cambiarReporte("rotacion")}
          >
            4. Rotación de Ventas (Top vs Stock Muerto)
          </button>
          <button
            type="button"
            className={`erp-button ${reporteActivo === "canales" ? "erp-button-primary" : "erp-button-secondary"}`}
            onClick={() => cambiarReporte("canales")}
          >
            5. Ventas por Canal y Sucursal
          </button>
        </div>

        {/* Tarjetas de Resumen según el reporte activo */}
        <div className="ventas-report-summary">
          {reporteActivo === "ranking" && (
            <>
              <div className="ventas-report-summary-card">
                <span className="ventas-report-summary-label">Total Clientes Compradores</span>
                <strong>{resumen.total_clientes || 0}</strong>
              </div>
              <div className="ventas-report-summary-card">
                <span className="ventas-report-summary-label">Transacciones Pagadas</span>
                <strong>{resumen.total_ventas || 0}</strong>
              </div>
              <div className="ventas-report-summary-card">
                <span className="ventas-report-summary-label">Monto Total Recaudado</span>
                <strong>{formatMoney(resumen.total_vendido || 0)}</strong>
              </div>
            </>
          )}

          {reporteActivo === "producto" && (
            <>
              <div className="ventas-report-summary-card">
                <span className="ventas-report-summary-label">Títulos Vendidos</span>
                <strong>{resumen.total_titulos || 0}</strong>
              </div>
              <div className="ventas-report-summary-card">
                <span className="ventas-report-summary-label">Unidades Vendidas</span>
                <strong>{formatNumber(resumen.total_unidades || 0)} ejemplares</strong>
              </div>
              <div className="ventas-report-summary-card">
                <span className="ventas-report-summary-label">Recaudación Total</span>
                <strong>{formatMoney(resumen.total_recaudado || 0)}</strong>
              </div>
            </>
          )}

          {reporteActivo === "cuentas-cobrar" && (
            <>
              <div className="ventas-report-summary-card">
                <span className="ventas-report-summary-label">Documentos por Cobrar</span>
                <strong style={{ color: "#d97706" }}>{resumen.total_documentos || 0} facturas</strong>
              </div>
              <div className="ventas-report-summary-card">
                <span className="ventas-report-summary-label">Saldo Pendiente Global</span>
                <strong style={{ color: "#dc2626" }}>{formatMoney(resumen.saldo_total_pendiente || 0)}</strong>
              </div>
              <div className="ventas-report-summary-card">
                <span className="ventas-report-summary-label">Facturas en Mora (&gt;0 días)</span>
                <strong>{(resumen.resumen_tramos?.mora_30 || 0) + (resumen.resumen_tramos?.mora_60 || 0) + (resumen.resumen_tramos?.mora_90_mas || 0)}</strong>
              </div>
            </>
          )}

          {reporteActivo === "rotacion" && (
            <>
              <div className="ventas-report-summary-card">
                <span className="ventas-report-summary-label">Títulos Analizados</span>
                <strong>{datosReporte.length}</strong>
              </div>
              <div className="ventas-report-summary-card">
                <span className="ventas-report-summary-label">Libros Alta Rotación</span>
                <strong style={{ color: "#27ae60" }}>{datosReporte.filter((r) => r.clasificacion === "Alta rotación").length}</strong>
              </div>
              <div className="ventas-report-summary-card">
                <span className="ventas-report-summary-label">Libros Stock Muerto (Sin Ventas)</span>
                <strong style={{ color: "#dc2626" }}>{datosReporte.filter((r) => r.clasificacion === "Stock muerto").length}</strong>
              </div>
            </>
          )}

          {reporteActivo === "canales" && (
            <>
              <div className="ventas-report-summary-card">
                <span className="ventas-report-summary-label">Canales Comerciales</span>
                <strong>3 (Física, Digital, Retiro)</strong>
              </div>
              <div className="ventas-report-summary-card">
                <span className="ventas-report-summary-label">Operaciones Globales</span>
                <strong>{resumen.total_ventas || 0}</strong>
              </div>
              <div className="ventas-report-summary-card">
                <span className="ventas-report-summary-label">Recaudación Multicanal</span>
                <strong>{formatMoney(resumen.total_general || 0)}</strong>
              </div>
            </>
          )}
        </div>

        {/* Filtros dinámicos */}
        <section className="erp-card ventas-report-filters">
          <div className="erp-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2>
                {reporteActivo === "ranking" && "Filtros del Ranking Pareto (80/20)"}
                {reporteActivo === "producto" && "Filtros de Ventas por Producto"}
                {reporteActivo === "cuentas-cobrar" && "Filtros de Cuentas por Cobrar"}
                {reporteActivo === "rotacion" && "Filtros de Rotación e Índice de Salida"}
                {reporteActivo === "canales" && "Filtros Comparativos de Canales"}
              </h2>
              <p>Ajusta el período de consulta o criterios específicos de agrupación.</p>
            </div>
            <button type="button" className="erp-button erp-button-secondary" onClick={exportarCsvActual}>
              <ErpIcon name="trend" /> Exportar a CSV
            </button>
          </div>

          <div className="ventas-report-filter-grid">
            <label className="erp-field">
              <span>Desde</span>
              <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </label>

            <label className="erp-field">
              <span>Hasta</span>
              <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </label>

            {reporteActivo === "producto" && (
              <label className="erp-field">
                <span>Categoría</span>
                <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                  <option value="todos">Todas las categorías</option>
                  <option value="Novela">Novela</option>
                  <option value="Infantil">Infantil</option>
                  <option value="Clasicos">Clásicos</option>
                  <option value="Programacion">Programación</option>
                </select>
              </label>
            )}

            {reporteActivo === "rotacion" && (
              <label className="erp-field">
                <span>Criterio de Rotación</span>
                <select value={filtroRotacion} onChange={(e) => setFiltroRotacion(e.target.value)}>
                  <option value="todos">Todos los libros</option>
                  <option value="top">Mayor rotación ("Top Sellers")</option>
                  <option value="muerto">Baja o nula salida ("Stock Muerto")</option>
                </select>
              </label>
            )}

            {reporteActivo === "cuentas-cobrar" && (
              <label className="erp-field">
                <span>Cliente / Institución</span>
                <input
                  type="text"
                  placeholder="Nombre o RUT..."
                  value={filtroCliente}
                  onChange={(e) => setFiltroCliente(e.target.value)}
                />
              </label>
            )}

            <div className="ventas-report-filter-actions" style={{ alignSelf: "flex-end" }}>
              <button type="button" className="erp-button erp-button-primary" onClick={consultarReporte}>
                <ErpIcon name="sync" /> Generar Reporte
              </button>
            </div>
          </div>

          {error && <div className="erp-alert-error" style={{ marginTop: "1rem" }}>{error}</div>}
        </section>

        {/* ---------------- TABLA DE RESULTADOS ---------------- */}
        <section className="erp-card ventas-report-table-card">
          <div className="ventas-report-table-wrapper">
            {/* 1. TABLA RANKING PARETO */}
            {reporteActivo === "ranking" && (
              <table className="ventas-report-table">
                <thead>
                  <tr>
                    <th>Pos</th>
                    <th>RUT</th>
                    <th>Cliente</th>
                    <th>Tipo</th>
                    <th>Ventas</th>
                    <th>Total Vendido</th>
                    <th>% Total</th>
                    <th>% Acumulado</th>
                    <th>Zona Pareto</th>
                  </tr>
                </thead>
                <tbody>
                  {cargando ? (
                    <tr><td colSpan="9" style={{ textAlign: "center", padding: "2rem" }}>Generando ranking Pareto...</td></tr>
                  ) : datosReporte.length === 0 ? (
                    <tr><td colSpan="9" style={{ textAlign: "center", padding: "2rem" }}>No hay ventas registradas en el período.</td></tr>
                  ) : (
                    datosReporte.map((r, idx) => (
                      <tr key={r.id_cliente || r.rut || idx}>
                        <td><strong>#{r.posicion ?? (idx + 1)}</strong></td>
                        <td>{r.rut || "—"}</td>
                        <td><strong>{r.nombre || "Cliente"}</strong></td>
                        <td style={{ textTransform: "capitalize" }}>{r.tipo_cliente || "persona"}</td>
                        <td>{r.cantidad_ventas ?? 0}</td>
                        <td><strong>{formatMoney(r.total_vendido ?? 0)}</strong></td>
                        <td>{r.porcentaje ?? 0}%</td>
                        <td><strong>{r.porcentaje_acumulado ?? 0}%</strong></td>
                        <td>
                          <span className={`erp-badge ${r.clasificacion === "A" ? "erp-badge-green" : r.clasificacion === "B" ? "erp-badge-blue" : "erp-badge-gray"}`}>
                            Zona {r.clasificacion || "C"} {r.clasificacion === "A" ? "(80% ingresos)" : r.clasificacion === "B" ? "(15% ingresos)" : "(5% cola larga)"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {/* 2. TABLA VENTAS POR PRODUCTO Y CATEGORÍA */}
            {reporteActivo === "producto" && (
              <table className="ventas-report-table">
                <thead>
                  <tr>
                    <th>ISBN</th>
                    <th>Título del Libro</th>
                    <th>Autor</th>
                    <th>Editorial</th>
                    <th>Categoría</th>
                    <th>Unidades Vendidas</th>
                    <th>Precio Promedio</th>
                    <th>Total Recaudado</th>
                  </tr>
                </thead>
                <tbody>
                  {cargando ? (
                    <tr><td colSpan="8" style={{ textAlign: "center", padding: "2rem" }}>Cargando ventas por producto...</td></tr>
                  ) : datosReporte.length === 0 ? (
                    <tr><td colSpan="8" style={{ textAlign: "center", padding: "2rem" }}>No se registraron ventas en esta categoría o período.</td></tr>
                  ) : (
                    datosReporte.map((p, idx) => (
                      <tr key={p.isbn || idx}>
                        <td><code>{p.isbn || "—"}</code></td>
                        <td><strong>{p.titulo || "Título desconocido"}</strong></td>
                        <td>{p.autor || "—"}</td>
                        <td>{p.editorial || "—"}</td>
                        <td>
                          <span className="erp-badge erp-badge-blue">{p.categoria || "General"}</span>
                        </td>
                        <td><strong>{p.unidades_vendidas ?? 0} unid.</strong></td>
                        <td>{formatMoney(p.precio_promedio ?? 0)}</td>
                        <td><strong style={{ color: "#1a5c38" }}>{formatMoney(p.total_recaudado ?? 0)}</strong></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {/* 3. TABLA CUENTAS POR COBRAR (FACTURAS PENDIENTES) */}
            {reporteActivo === "cuentas-cobrar" && (
              <table className="ventas-report-table">
                <thead>
                  <tr>
                    <th>Folio</th>
                    <th>Cliente / Institución</th>
                    <th>RUT</th>
                    <th>Fecha Emisión</th>
                    <th>Fecha Vencimiento</th>
                    <th>Días de Mora</th>
                    <th>Tramo de Antigüedad</th>
                    <th>Saldo Pendiente</th>
                  </tr>
                </thead>
                <tbody>
                  {cargando ? (
                    <tr><td colSpan="8" style={{ textAlign: "center", padding: "2rem" }}>Cargando cuentas por cobrar...</td></tr>
                  ) : datosReporte.length === 0 ? (
                    <tr><td colSpan="8" style={{ textAlign: "center", padding: "2rem", color: "#27ae60" }}>
                      ¡Excelente! No hay facturas pendientes ni morosas. La cartera está al día.
                    </td></tr>
                  ) : (
                    datosReporte.map((f, idx) => {
                      const nombreCliente = f.cliente?.nombre || f.cliente_nombre || "Cliente sin registrar";
                      const tipoCliente = f.cliente?.tipo || f.tipo_cliente || "general";
                      const rutCliente = f.cliente?.rut || f.cliente_rut || "—";
                      const folio = f.folio || (f.id_venta ? `F-${f.id_venta}` : `DOC-${idx + 1}`);
                      const diasMora = Number(f.dias_mora || 0);

                      return (
                        <tr key={f.id_venta || f.folio || idx}>
                          <td><strong>{folio}</strong></td>
                          <td>
                            <strong>{nombreCliente}</strong>
                            <div style={{ fontSize: "0.8rem", color: "#666", textTransform: "capitalize" }}>{tipoCliente}</div>
                          </td>
                          <td>{rutCliente}</td>
                          <td>{f.fecha_emision || f.fecha || "—"}</td>
                          <td><strong>{f.fecha_vencimiento || "—"}</strong></td>
                          <td>
                            <strong style={{ color: diasMora > 0 ? "#dc2626" : "#27ae60" }}>
                              {diasMora > 0 ? `${diasMora} días` : "Al día"}
                            </strong>
                          </td>
                          <td>
                            <span className={`erp-badge ${diasMora > 30 ? "erp-badge-red" : diasMora > 0 ? "erp-badge-yellow" : "erp-badge-green"}`}>
                              {f.tramo || (diasMora > 0 ? `${diasMora} días mora` : "Vigente")}
                            </span>
                          </td>
                          <td><strong style={{ fontSize: "1.05rem", color: "#dc2626" }}>{formatMoney(f.saldo_pendiente ?? f.total ?? 0)}</strong></td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}

            {/* 4. TABLA ROTACIÓN DE VENTAS */}
            {reporteActivo === "rotacion" && (
              <table className="ventas-report-table">
                <thead>
                  <tr>
                    <th>ISBN</th>
                    <th>Título del Libro</th>
                    <th>Categoría</th>
                    <th>Editorial</th>
                    <th>Stock Actual</th>
                    <th>Vendidos (Período)</th>
                    <th>Última Venta</th>
                    <th>Días sin Vender</th>
                    <th>Índice de Rotación</th>
                  </tr>
                </thead>
                <tbody>
                  {cargando ? (
                    <tr><td colSpan="9" style={{ textAlign: "center", padding: "2rem" }}>Calculando rotación de estantería...</td></tr>
                  ) : datosReporte.length === 0 ? (
                    <tr><td colSpan="9" style={{ textAlign: "center", padding: "2rem" }}>No hay datos para el criterio seleccionado.</td></tr>
                  ) : (
                    datosReporte.map((r, idx) => (
                      <tr key={r.isbn || idx}>
                        <td><code>{r.isbn || "—"}</code></td>
                        <td><strong>{r.titulo || "Título desconocido"}</strong></td>
                        <td>{r.categoria || "—"}</td>
                        <td>{r.editorial || "—"}</td>
                        <td><strong>{r.stock_actual ?? 0} unid.</strong></td>
                        <td><strong>{r.unidades_vendidas ?? 0} unid.</strong></td>
                        <td>{r.ultima_venta || "Sin ventas"}</td>
                        <td>
                          <span style={{ color: (r.dias_sin_vender || 0) > 90 ? "#dc2626" : "#666" }}>
                            {(r.dias_sin_vender || 0) >= 999 ? "Nunca vendido" : `${r.dias_sin_vender || 0} días`}
                          </span>
                        </td>
                        <td>
                          <span className={`erp-badge ${r.clasificacion === "Alta rotación" ? "erp-badge-green" : r.clasificacion === "Rotación media" ? "erp-badge-blue" : "erp-badge-red"}`}>
                            {r.clasificacion || "Normal"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {/* 5. TABLA VENTAS POR CANAL Y SUCURSAL */}
            {reporteActivo === "canales" && (
              <table className="ventas-report-table">
                <thead>
                  <tr>
                    <th>Canal de Comercialización</th>
                    <th>Cantidad Transacciones</th>
                    <th>Total Neto</th>
                    <th>IVA Débito</th>
                    <th>Total Recaudado</th>
                    <th>Ticket Promedio</th>
                  </tr>
                </thead>
                <tbody>
                  {cargando ? (
                    <tr><td colSpan="6" style={{ textAlign: "center", padding: "2rem" }}>Calculando comparativa por canal...</td></tr>
                  ) : datosReporte.length === 0 ? (
                    <tr><td colSpan="6" style={{ textAlign: "center", padding: "2rem" }}>No hay operaciones registradas.</td></tr>
                  ) : (
                    datosReporte.map((c, idx) => (
                      <tr key={c.canal || idx}>
                        <td>
                          <strong style={{ textTransform: "capitalize", fontSize: "1.05rem" }}>
                            {c.canal === "tienda fisica" && "🏢 Tienda Física (Casa Matriz Chillán)"}
                            {c.canal === "tienda digital" && "🌐 Tienda Digital (Online E-Commerce)"}
                            {c.canal === "retiro en tienda" && "📦 Retiro en Tienda (Click & Collect)"}
                            {c.canal !== "tienda fisica" && c.canal !== "tienda digital" && c.canal !== "retiro en tienda" && (c.canal || "Canal General")}
                          </strong>
                        </td>
                        <td><strong>{c.cantidad_operaciones ?? 0} ventas</strong></td>
                        <td>{formatMoney(c.total_neto ?? 0)}</td>
                        <td>{formatMoney(c.total_iva ?? 0)}</td>
                        <td><strong style={{ color: "#1a5c38", fontSize: "1.1rem" }}>{formatMoney(c.total_recaudado ?? 0)}</strong></td>
                        <td><strong>{formatMoney(c.ticket_promedio ?? 0)}</strong></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </ErpModuleShell>
  );
}
