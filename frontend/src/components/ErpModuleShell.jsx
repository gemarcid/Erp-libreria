"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import ErpIcon from "@/components/ErpIcon";
import ErpNavigation, { ErpSidebar } from "@/components/ErpNavigation";
import { canOpenModule } from "@/lib/module-access";
import "@/app/erp.css";
import "@/app/modules.css";

export default function ErpModuleShell({
  module,
  title,
  description,
  children,
  actions,
  subnav,
  liveData = false,
  dataLabel = liveData ? "Datos del sistema" : "Datos de prueba",
}) {
  const router = useRouter();
  const { usuario, iniciales, loading, error, logout, refreshSession } =
    useAuth();
  const [closing, setClosing] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  useEffect(() => {
    if (!loading && !usuario && !error) router.replace("/login");
  }, [loading, usuario, error, router]);

  async function handleLogout() {
    if (closing) return;
    setClosing(true);
    setLogoutError("");
    try {
      await logout();
      router.replace("/login");
    } catch {
      setLogoutError("No se pudo cerrar sesión. Intenta nuevamente.");
    } finally {
      setClosing(false);
    }
  }

  if (loading || !usuario || error) {
    return (
      <main className="erp-screen erp-auth-state" lang="es">
        <p role="status">{error || "Comprobando tu sesión…"}</p>
        {error && (
          <>
            <button className="erp-primary-button" onClick={refreshSession}>
              Reintentar
            </button>
            <Link href="/login">Volver al login</Link>
          </>
        )}
      </main>
    );
  }
  if (!canOpenModule(usuario, module)) {
    return (
      <main className="erp-screen erp-auth-state" lang="es">
        <ErpIcon name="lock" />
        <h1>Acceso no disponible</h1>
        <p>Tu perfil no tiene acceso a este módulo.</p>
        <Link href="/">Volver al inicio</Link>
      </main>
    );
  }

  return (
    <div className="erp-screen erp-home erp-module-screen" lang="es">
      <a className="erp-skip" href="#module-content">
        Saltar al contenido
      </a>
      <ErpSidebar usuario={usuario} current={module} closing={closing} onLogout={handleLogout} />
      <div className="erp-workspace">
        <header className="erp-topbar">
          <ErpNavigation usuario={usuario} current={module} closing={closing} onLogout={handleLogout} />
          <div className="erp-branch">
            <span className="erp-muted">Sucursal</span>
            <strong>Casa Matriz</strong>
          </div>
          <span className="erp-demo-badge">{dataLabel}</span>
          <div className="erp-topbar-actions">
            <button
              className="erp-topbar-profile erp-profile-button"
              onClick={handleLogout}
              disabled={closing}
              title={usuario.rol}
            >
              <span className="erp-avatar">{iniciales}</span>
              <span>
                {usuario.nombre}
                <small>{closing ? "Cerrando…" : "Cerrar sesión"}</small>
              </span>
            </button>
          </div>
        </header>
        <main className="erp-main" id="module-content">
          {logoutError && (
            <p className="erp-login-message" role="alert">
              {logoutError}
            </p>
          )}
          <p className="module-breadcrumb">
            <Link href="/">Inicio</Link>
            <span> / </span>
            {title}
          </p>
          <div className="erp-page-heading">
            <div>
              <p className="erp-eyebrow">MÓDULO DE GESTIÓN</p>
              <h1>{title}</h1>
              <p className="erp-muted">{description}</p>
            </div>
            {actions}
          </div>

          {subnav}

          {!liveData && <div className="erp-demo-note">
            <ErpIcon name="info" />
            <span>
              Vista de consulta con datos de prueba. Los registros mostrados no
              modifican la sesión ni las operaciones del sistema.
            </span>
          </div>}
          {children}
          <footer className="erp-footer">
            <span>Librería ERP</span>
            <span>{title} · {dataLabel}</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
