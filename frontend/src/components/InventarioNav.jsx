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
