"use client";

import { useId, useRef } from "react";
import Link from "next/link";
import ErpIcon from "@/components/ErpIcon";
import { canOpenModule, isCliente } from "@/lib/module-access";

const destinations = [
  ["home", "/", "Inicio", "home"],
  ["catalogo", "/catalogo", "Catálogo", "book"],
  ["compras", "/compras", "Compras", "purchases"],
  ["ventas", "/ventas", "Ventas", "sales"],
  ["inventario", "/inventario", "Inventario", "inventory"],
  ["contabilidad", "/contabilidad", "Contabilidad", "accounting"],
  ["administracion", "/administracion", "Administración y seguridad", "settings"],
  ["perfil", "/mi-perfil", "Mi perfil", "user"],
];

function NavigationLinks({ usuario, current, closing, onLogout, onNavigate }) {
  const links = destinations.filter(([module]) => module === "home"
    ? !isCliente(usuario)
    : canOpenModule(usuario, module));

  return (
    <nav className="erp-menu-links" aria-label="Navegación principal">
      {links.map(([module, href, label, icon]) => (
        <Link key={module} href={href} onNavigate={onNavigate}
          className={current === module ? "erp-nav-item is-active" : "erp-nav-item"}
          aria-current={current === module ? "page" : undefined}>
          <ErpIcon name={icon} />
          {label}
        </Link>
      ))}
      <button type="button" className="erp-nav-item" disabled={closing} onClick={onLogout}>
        <ErpIcon name="logout" />
        Cerrar sesión
      </button>
    </nav>
  );
}

export function ErpSidebar(props) {
  return (
    <aside className="erp-sidebar erp-menu-content">
      <Link href={isCliente(props.usuario) ? "/catalogo" : "/"} className="erp-brand">
        <span className="erp-brand-icon"><ErpIcon name="book" /></span>
        <span>Librería <b>ERP</b><small>SISTEMA DE GESTIÓN</small></span>
      </Link>
      <NavigationLinks {...props} />
    </aside>
  );
}

export default function ErpNavigation({ usuario, current, closing, onLogout }) {
  const dialog = useRef(null);
  const id = useId();
  const close = () => dialog.current?.close();

  return (
    <>
      <button type="button" className="erp-icon-button erp-menu-trigger" aria-label="Abrir menú"
        aria-haspopup="dialog" aria-controls={id} onClick={() => dialog.current.showModal()}>
        <ErpIcon name="menu" />
        <span>Menú</span>
      </button>
      <dialog ref={dialog} id={id} className="erp-menu-dialog" aria-labelledby={id + "-title"}
        onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
        <div className="erp-menu-content">
          <div className="erp-menu-heading">
            <h2 id={id + "-title"}><ErpIcon name="book" /> Menú principal</h2>
            <button type="button" className="erp-icon-button" onClick={close} aria-label="Cerrar menú">
              <span aria-hidden="true">×</span>
            </button>
          </div>
          <NavigationLinks usuario={usuario} current={current} closing={closing}
            onNavigate={close} onLogout={() => { close(); onLogout(); }} />
        </div>
      </dialog>
    </>
  );
}
