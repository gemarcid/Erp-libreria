"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ErpIcon from "@/components/ErpIcon";

export default function VentasNav() {
  const pathname = usePathname();

  const links = [
    { href: "/ventas", label: "Punto de Venta (POS)", icon: "sales", exact: true },
    { href: "/ventas/historial", label: "Historial y Monitor", icon: "clipboard" },
    { href: "/ventas/clientes", label: "Clientes", icon: "user" },
    { href: "/ventas/pedidos", label: "Cotizaciones y Pedidos", icon: "book" },
    { href: "/ventas/promociones", label: "Promociones", icon: "sparkles" },
    { href: "/ventas/reportes", label: "Reportes", icon: "trend", match: ["/ventas/reportes", "/ventas/reporte"] },
  ];

  return (
    <nav className="ventas-subnav" aria-label="Navegación de ventas" style={{ overflowX: "auto", whiteSpace: "nowrap" }}>
      {links.map((link) => {
        const isActive = link.exact
          ? pathname === link.href
          : link.match
          ? link.match.includes(pathname)
          : pathname.startsWith(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`ventas-subnav-link ${isActive ? "is-active" : ""}`}
            aria-current={isActive ? "page" : undefined}
          >
            <ErpIcon name={link.icon} />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
