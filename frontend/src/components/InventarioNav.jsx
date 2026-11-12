"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ErpIcon from "@/components/ErpIcon";

export default function InventarioNav({ activeTab }) {
  const pathname = usePathname();

  const links = [
    {
      href: "/inventario",
      label: "Catálogo de Existencias",
      icon: "inventory",
      key: "catalogo",
      exact: true,
    },
    {
      href: "/inventario/recepcion-compras",
      label: "Recepción de Compras",
      icon: "purchases",
      key: "recepcion-compras",
    },
    {
      href: "/inventario/transferencias",
      label: "Transferencias entre Bodegas",
      icon: "arrow",
      key: "transferencias",
    },
    {
      href: "/inventario/devoluciones",
      label: "Mermas y Devoluciones",
      icon: "logout",
      key: "devoluciones",
    },
    {
      href: "/inventario/ajuste-stock",
      label: "Ajuste de Stock",
      icon: "settings",
      key: "ajuste-stock",
    },
    {
      href: "/inventario?vista=critico",
      label: "Reporte: Stock Bajo",
      icon: "bell",
      key: "stock-bajo",
    },
    {
      href: "/inventario/kardex",
      label: "Reporte: Kardex de Movimientos",
      icon: "trend",
      key: "kardex",
    },
    {
      href: "/inventario/reportes/valorizacion",
      label: "Reporte: Valorización Global",
      icon: "accounting",
      key: "valorizacion",
    },
    {
      href: "/inventario/reportes/rotacion",
      label: "Reporte: Rotación y Antigüedad",
      icon: "clock",
      key: "rotacion",
    },
    {
      href: "/inventario/reportes/consolidado-bodegas",
      label: "Reporte: Consolidado por Sucursal",
      icon: "home",
      key: "consolidado-bodegas",
    },
  ];

  return (
    <nav
      className="ventas-subnav"
      aria-label="Navegación del módulo de inventario"
      style={{ overflowX: "auto", whiteSpace: "nowrap" }}
    >
      {links.map((link) => {
        const isActive = activeTab
          ? activeTab === link.key
          : link.exact
          ? pathname === link.href
          : pathname?.startsWith(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`ventas-subnav-link ${isActive ? "is-active" : ""}`}
            aria-current={isActive ? "page" : undefined}
          >
            <ErpIcon name={link.icon} />
            <span>{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
