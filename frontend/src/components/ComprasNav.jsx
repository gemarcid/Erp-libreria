"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ErpIcon from "@/components/ErpIcon";

export default function ComprasNav() {
  const pathname = usePathname();
  const esOrdenes = pathname === "/compras";
  const esHistorico = pathname === "/compras/reportes/historico";
  const esVariacion = pathname === "/compras/reportes/variacion-precios";

  return (
    <nav className="ventas-subnav" aria-label="Navegación de compras">
      <Link
        href="/compras"
        className={`ventas-subnav-link ${esOrdenes ? "is-active" : ""}`}
        aria-current={esOrdenes ? "page" : undefined}
      >
        <ErpIcon name="purchases" />
        Órdenes de compra
      </Link>
      <Link
        href="/compras/reportes/historico"
        className={`ventas-subnav-link ${esHistorico ? "is-active" : ""}`}
        aria-current={esHistorico ? "page" : undefined}
      >
        <ErpIcon name="trend" />
        Reporte histórico
      </Link>
      <Link
        href="/compras/reportes/variacion-precios"
        className={`ventas-subnav-link ${esVariacion ? "is-active" : ""}`}
        aria-current={esVariacion ? "page" : undefined}
      >
        <ErpIcon name="trend" />
        Variación de precios
      </Link>
    </nav>
  );
}
