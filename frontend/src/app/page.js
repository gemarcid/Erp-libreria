"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ErpIcon from "@/components/ErpIcon";
import ErpNavigation, { ErpSidebar } from "@/components/ErpNavigation";
import { useAuth } from "@/components/AuthProvider";
import "./erp.css";
import { canOpenModule, isCliente } from "@/lib/module-access";
import { money, comparison, localDateLabel, activityDate, chartMaximum } from "@/lib/dashboard";

export default function Home() {
  const [search, setSearch] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const router = useRouter();
  const { usuario, iniciales, loading, error, logout, refreshSession } =
    useAuth();
  const [logoutError, setLogoutError] = useState("");
  const [closingSession, setClosingSession] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!usuario || isCliente(usuario)) return;
    const controller = new AbortController();
    let requestRevision = 0;
    async function loadDashboard() {
      const currentRevision = ++requestRevision;
      setDashboardLoading(true);
      setDashboardError("");
      try {
        const response = await fetch("/api/dashboard", { cache: "no-store", signal: controller.signal });
        const result = await response.json();
        if (!response.ok || result.success !== true) throw new Error(result.error || "No se pudieron consultar los datos del inicio.");
        if (!controller.signal.aborted && currentRevision === requestRevision) setDashboard(result);
      } catch (err) {
        if (!controller.signal.aborted && currentRevision === requestRevision) setDashboardError(err.message);
      } finally {
        if (!controller.signal.aborted && currentRevision === requestRevision) setDashboardLoading(false);
      }
    }
    const onVisibility = () => { if (document.visibilityState === "visible") loadDashboard(); };
    loadDashboard();
    window.addEventListener("focus", loadDashboard);
    document.addEventListener("visibilitychange", onVisibility);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") loadDashboard();
    }, 60000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", loadDashboard);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [usuario, revision]);

  useEffect(() => {
    if (!loading && !usuario && !error) router.replace("/login");
    if (!loading && isCliente(usuario)) router.replace("/catalogo");
  }, [loading, usuario, error, router]);

  const nombreUsuario = usuario?.nombre || "";

  async function handleLogout() {
    if (closingSession) return;
    setClosingSession(true);
    setLogoutError("");
    try {
      await logout();
      router.replace("/login");
    } catch (error) {
      setLogoutError(error.message || "No se pudo cerrar sesión.");
    } finally {
      setClosingSession(false);
    }
  }

  const ready = !!dashboard && !dashboardLoading && !dashboardError;
  const data = ready ? dashboard : null;
  const books = data?.books || [];
  const days = data?.days || [];
  const orders = data?.orders || [];
  const activity = data?.activity || [];
  const chartMax = chartMaximum(days);
  const sales = canOpenModule(usuario, "ventas");
  const purchases = canOpenModule(usuario, "compras");
  const inventory = canOpenModule(usuario, "inventario");
  const metrics = [
    { title: "Ventas del día", value: data ? money(data.salesToday) : "—",
      detail: data ? `${comparison(data.salesToday, data.salesYesterday)} respecto a ayer` : "",
      icon: "sales", tone: data && data.salesToday < data.salesYesterday ? "danger" : "success" },
    { title: "Stock crítico", value: data ? `${data.criticalStock} títulos` : "—",
      detail: "Stock igual o menor al mínimo", icon: "inventory", tone: data?.criticalStock ? "danger" : "neutral" },
    { title: "Cuentas por pagar", value: data ? money(data.payable) : "—",
      detail: "Facturas de proveedores pendientes", icon: "accounting", tone: "warning" },
    { title: "Recepciones pendientes", value: data ? String(data.pendingReceipts) : "—",
      detail: "Órdenes aprobadas sin recepción", icon: "purchases", tone: "neutral" },
  ].filter((_, index) => [sales, inventory, purchases, purchases][index]);
  const visibleBooks = books.filter((book) =>
    `${book.title} ${book.author}`
      .toLocaleLowerCase("es")
      .includes(search.toLocaleLowerCase("es").trim()),
  );

  if (loading || !usuario || error || isCliente(usuario)) {
    return (
      <main className="erp-screen erp-auth-state" lang="es">
        <p role="status">{error || "Comprobando tu sesión…"}</p>
        {error && (
          <>
            <button
              type="button"
              className="erp-primary-button"
              onClick={refreshSession}
            >
              Reintentar
            </button>
            <Link href="/login">Volver al login</Link>
          </>
        )}
      </main>
    );
  }

  return (
    <div className="erp-screen erp-home" lang="es">
      <a className="erp-skip" href="#main-content">
        Saltar al contenido
      </a>
      <ErpSidebar usuario={usuario} current="home" closing={closingSession} onLogout={handleLogout} />
      <div className="erp-workspace">
        <header className="erp-topbar">
          <ErpNavigation usuario={usuario} current="home" closing={closingSession} onLogout={handleLogout} />
          <div className="erp-branch">
            <span className="erp-muted">Sucursal</span>
            <strong>Casa Matriz</strong>
          </div>
          <span className="erp-demo-badge">Datos del sistema</span>
          <div className="erp-topbar-actions">
            <div className="erp-notifications">
              <button
                className="erp-icon-button"
                aria-label="Notificaciones"
                aria-expanded={notificationsOpen}
                aria-controls="erp-notifications"
                onClick={() => setNotificationsOpen(!notificationsOpen)}
              >
                <ErpIcon name="bell" />
                {data && (data.criticalStock > 0 || data.pendingOrders > 0) && <span className="erp-notification-dot" />}
              </button>
              {notificationsOpen && (
                <div className="erp-notification-panel" id="erp-notifications">
                  <strong>Notificaciones</strong>
                  {!ready && <p>{dashboardError || "Cargando notificaciones…"}</p>}
                  {data?.criticalStock > 0 && <p>
                    <span className="erp-status danger">Inventario</span>{data.criticalStock} títulos requieren reposición.
                  </p>}
                  {data?.pendingOrders > 0 && <p>
                    <span className="erp-status warning">Compras</span>{data.pendingOrders} órdenes esperan aprobación.
                  </p>}
                  {data && data.criticalStock === 0 && data.pendingOrders === 0 && <p>No hay alertas pendientes.</p>}
                </div>
              )}
            </div>

            {/* SECCIÓN PERFIL TOPBAR (Dinámica) */}
            <button
              type="button"
              className="erp-topbar-profile erp-profile-button"
              title={usuario.rol}
              onClick={handleLogout}
              disabled={closingSession}
              aria-label="Cerrar sesión"
            >
              <span className="erp-avatar">{iniciales}</span>
              <span>
                {nombreUsuario}
                <small>{closingSession ? "Cerrando…" : "Cerrar sesión"}</small>
              </span>
            </button>

          </div>
        </header>

        <main id="main-content" className="erp-main">
          {logoutError && (
            <p className="erp-login-message" role="alert">
              {logoutError}
            </p>
          )}
          <div className="erp-page-heading">
            <div>
              <p className="erp-eyebrow">TU LIBRERÍA, DE UN VISTAZO</p>
              <h1>Bienvenido, {nombreUsuario}</h1>
              <p className="erp-muted">
                Un resumen para comenzar el día con todo en orden.
              </p>
            </div>
            <div className="erp-dashboard-controls">
              <span className="erp-date">
                <ErpIcon name="calendar" />{data ? localDateLabel(data.date, { day: "numeric", month: "long", year: "numeric" }) : "—"}
                <small>Hora de Chile</small>
              </span>
              <button type="button" className="erp-dashboard-refresh" disabled={dashboardLoading}
                onClick={() => setRevision((value) => value + 1)}>
                {dashboardLoading ? "Actualizando…" : "Actualizar"}
              </button>
            </div>
          </div>

          {dashboardError && <p className="erp-login-message" role="alert">{dashboardError}</p>}
          {dashboardLoading && <p className="erp-empty" role="status">Cargando datos del inicio…</p>}

          <section
            className="erp-metrics"
            aria-label="Indicadores de la librería"
          >
            {metrics.map((metric) => (
              <article key={metric.title} className="erp-card erp-metric">
                <div className="erp-metric-heading">
                  <h2>{metric.title}</h2>
                  <span className={`erp-metric-icon ${metric.tone}`}>
                    <ErpIcon name={metric.icon} />
                  </span>
                </div>
                <strong className="erp-metric-value">{metric.value}</strong>
                <p className={`erp-metric-detail ${metric.tone}`}>
                  {metric.detail}
                </p>
              </article>
            ))}
          </section>

          <div className="erp-overview-grid">
            {sales && <section className="erp-card erp-sales-panel">
              <div className="erp-section-heading">
                <div>
                  <p className="erp-eyebrow">EL PULSO DE TU NEGOCIO</p>
                  <h2>Ventas de la semana</h2>
                </div>
                <span className="erp-period">Últimos 7 días</span>
              </div>
              <div className="erp-chart-total">
                <strong>{data ? money(data.weekTotal) : "—"}</strong>
                {data && <span className={`erp-status ${data.weekTotal >= data.previousWeekTotal ? "success" : "danger"}`}>
                  {comparison(data.weekTotal, data.previousWeekTotal)}
                </span>}
                <span className="erp-muted">vs. semana anterior</span>
              </div>
              <div
                className="erp-chart"
                role="img"
                aria-label={data ? `Ventas de los últimos 7 días: ${days.map((day) => `${day.date}: ${money(day.total)}`).join("; ")}` : "Ventas todavía no disponibles"}
              >
                <div className="erp-chart-scale">
                  {[1, 2 / 3, 1 / 3, 0].map((ratio) => <span key={ratio}>{data ? money(chartMax * ratio) : "—"}</span>)}
                </div>
                <div className="erp-chart-plot">
                  <div className="erp-chart-grid" />
                  {days.map(
                    (day) => (
                      <div className="erp-chart-column" key={day.date} title={`${localDateLabel(day.date, { day: "numeric", month: "short" })}: ${money(day.total)}`}>
                        <div className="erp-bar" style={{ height: `${(day.total / chartMax) * 141}px`, background: day.date === data.date ? "var(--color-primary)" : undefined }} />
                        <span>{localDateLabel(day.date, { weekday: "short" })}</span>
                      </div>
                    ),
                  )}
                </div>
              </div>
              <div className="erp-chart-legend">
                <span className="erp-dot" />
                Ventas totales en pesos chilenos
              </div>
              {data && data.weekTotal === 0 && <p className="erp-empty">No hay ventas pagadas en los últimos 7 días.</p>}
            </section>}

            {purchases && <section className="erp-card erp-orders-panel">
              <div className="erp-section-heading">
                <div>
                  <p className="erp-eyebrow">POR REVISAR</p>
                  <h2>Órdenes pendientes</h2>
                </div>
                <span className="erp-count">{data ? data.pendingOrders : "—"}</span>
              </div>
              <p className="erp-muted erp-section-description">
                Compras que esperan aprobación.
              </p>
              {orders.map(({code, supplier, total}) => (
                <article key={code} className="erp-order">
                  <div>
                    <strong>{code}</strong>
                    <span className="erp-status warning">Pendiente</span>
                  </div>
                  <p className="erp-muted">{supplier}</p>
                  <strong className="erp-order-amount">{money(total)}</strong>
                </article>
              ))}
              {data && orders.length === 0 && <p className="erp-empty">No hay órdenes pendientes.</p>}
              {data && data.pendingOrders > orders.length && <p className="erp-muted">Mostrando las {orders.length} más recientes.</p>}
              <p className="erp-panel-footnote">
                <ErpIcon name="info" />
                <Link href="/compras">Abrir órdenes de compra</Link>
              </p>
            </section>}
          </div>

          <div className="erp-details-grid">
            {sales && <section className="erp-card erp-books-panel">
              <div className="erp-section-heading">
                <div>
                  <p className="erp-eyebrow">HISTORIAS QUE SE MUEVEN</p>
                  <h2>Libros más vendidos</h2>
                </div>
                <span className="erp-period">Este mes</span>
              </div>
              <label className="erp-search">
                <ErpIcon name="search" />
                <input
                  type="search"
                  aria-label="Buscar por título o autor"
                  placeholder="Buscar por título o autor…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
              <ul className="erp-book-list">
                {visibleBooks.map((book, index) => (
                  <li key={book.isbn}>
                    <span
                      className={`erp-book-cover ${["sage", "clay", "sand", "rose"][index % 4]}`}
                      aria-hidden="true"
                    >
                      <ErpIcon name="book" />
                    </span>
                    <div>
                      <strong>{book.title}</strong>
                      <span>{book.author}</span>
                    </div>
                    <span className="erp-book-sales">
                      <strong>{book.sales}</strong> unidades
                    </span>
                  </li>
                ))}
              </ul>
              {data && visibleBooks.length === 0 && (
                <p className="erp-empty" role="status">
                  {books.length === 0 ? "No hay libros vendidos este mes." : "No hay libros que coincidan con tu búsqueda."}
                </p>
              )}
            </section>}

            <section className="erp-card erp-activity-panel">
              <div className="erp-section-heading">
                <div>
                  <p className="erp-eyebrow">LO ÚLTIMO EN TU LIBRERÍA</p>
                  <h2>Actividad reciente</h2>
                </div>
                <ErpIcon name="clock" />
              </div>
              <ol className="erp-activity-list">
                {activity.map((item) => (
                  <li key={item.id}>
                    <span className="erp-activity-icon">
                      <ErpIcon name={item.icon} />
                    </span>
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.detail}</p>
                      <small>{activityDate(item)}</small>
                    </div>
                  </li>
                ))}
              </ol>
              {data && activity.length === 0 && <p className="erp-empty">Todavía no hay operaciones registradas.</p>}
            </section>
          </div>

          <footer className="erp-footer">
            <span>Librería ERP</span>
            <span>Compras · Ventas · Inventario · Contabilidad</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
