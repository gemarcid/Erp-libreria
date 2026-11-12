"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ErpIcon from "@/components/ErpIcon";

export default function ComprasNav() {
  const pathname = usePathname();
  const esOrdenes = pathname === "/compras";
  const esRecepciones = pathname === "/compras/recepciones";
  const esFacturas = pathname === "/compras/facturas";
  const esConciliacion = pathname === "/compras/conciliacion";
  const esHistorico = pathname === "/compras/reportes/historico";
  const esVariacion = pathname === "/compras/reportes/variacion-precios";
  const esCuentasPorPagar = pathname === "/compras/reportes/cuentas-por-pagar";

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
        href="/compras/recepciones"
        className={`ventas-subnav-link ${esRecepciones ? "is-active" : ""}`}
        aria-current={esRecepciones ? "page" : undefined}
      >
        <ErpIcon name="inventory" />
        Recepción de mercancía
      </Link>
      <Link
        href="/compras/facturas"
        className={`ventas-subnav-link ${esFacturas ? "is-active" : ""}`}
        aria-current={esFacturas ? "page" : undefined}
      >
        <ErpIcon name="accounting" />
        Facturas de proveedor
      </Link>
      <Link
        href="/compras/conciliacion"
        className={`ventas-subnav-link ${esConciliacion ? "is-active" : ""}`}
        aria-current={esConciliacion ? "page" : undefined}
      >
        <ErpIcon name="calendar" />
        Conciliación y pagos
      </Link>
      <Link
        href="/compras/reportes/cuentas-por-pagar"
        className={`ventas-subnav-link ${esCuentasPorPagar ? "is-active" : ""}`}
        aria-current={esCuentasPorPagar ? "page" : undefined}
      >
        <ErpIcon name="accounting" />
        Cuentas por pagar
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
