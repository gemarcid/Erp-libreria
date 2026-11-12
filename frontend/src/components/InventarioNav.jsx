"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function InventarioNav({ activeTab }) {
  const pathname = usePathname();

  const links = [
    {
      href: "/inventario",
      label: "Existencias",
      key: "catalogo",
      exact: true,
    },
    {
      href: "/inventario/recepcion-compras",
      label: "Recepción de compras",
      key: "recepcion-compras",
    },
    {
      href: "/inventario/transferencias",
      label: "Transferencias",
      key: "transferencias",
    },
    {
      href: "/inventario/devoluciones",
      label: "Devoluciones",
      key: "devoluciones",
    },
    {
      href: "/inventario/ajuste-stock",
      label: "Ajuste de stock",
      key: "ajuste-stock",
    },
    {
      href: "/inventario?vista=critico",
      label: "Stock crítico",
      key: "stock-bajo",
    },
    {
      href: "/inventario/kardex",
      label: "Kardex",
      key: "kardex",
    },
    {
      href: "/inventario/reportes/valorizacion",
      label: "Valorización",
      key: "valorizacion",
    },
    {
      href: "/inventario/reportes/rotacion",
      label: "Rotación",
      key: "rotacion",
    },
    {
      href: "/inventario/reportes/consolidado-bodegas",
      label: "Consolidado por bodega",
      key: "consolidado-bodegas",
    },
  ];

  return (
    <nav
      className="module-tabs inventory-tabs"
      aria-label="Navegación del módulo de inventario"
      style={{ width: "100%", overflowX: "auto", flexWrap: "nowrap", marginBottom: 24 }}
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
            className={`inventory-tab ${isActive ? "is-selected" : ""}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              flex: "0 0 auto",
              borderBottom: `2px solid ${isActive ? "var(--color-primary)" : "transparent"}`,
              color: isActive ? "var(--color-primary)" : "var(--color-text-muted)",
              fontWeight: isActive ? 600 : 400,
              padding: "13px 16px",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
            aria-current={isActive ? "page" : undefined}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
