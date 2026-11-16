"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { canOpenModule } from "@/lib/module-access";
import ErpModuleShell from "@/components/ErpModuleShell";
import InventarioNav from "@/components/InventarioNav";
import ErpIcon from "@/components/ErpIcon";
import { money } from "@/lib/dashboard";

function InventarioModuleContent() {
  const { usuario } = useAuth();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [inventario, setInventario] = useState([]);
  const vistaReporte = searchParams.get("vista") === "critico";
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!usuario || !canOpenModule(usuario, "inventario")) return;
    const controller = new AbortController();
    async function consultarInventario() {
      try {
        const response = await fetch("/api/inventario", { cache: "no-store", signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "No se pudo consultar el inventario.");
        if (!Array.isArray(result)) throw new Error("El servicio no devolvió un inventario válido.");
        if (!controller.signal.aborted) { setInventario(result); setError(""); }
      } catch (err) {
        if (!controller.signal.aborted) setError(err.message);
      } finally {
        if (!controller.signal.aborted) setCargando(false);
      }
    }
    consultarInventario();
    return () => controller.abort();
  }, [usuario, revision]);

  function actualizar() {
    setCargando(true);
    setError("");
    setRevision((value) => value + 1);
  }
  const criticos = inventario.filter((item) => Number(item.stock) <= Number(item.minimo));
  const libros = (vistaReporte ? criticos : inventario).filter((item) =>
    `${item.isbn} ${item.titulo} ${item.autor} ${item.categoria}`.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es").trim()));

  return (
    <ErpModuleShell module="inventario" liveData title={vistaReporte ? "Títulos que requieren reposición" : "Inventario de Libros"}
      description={vistaReporte ? "Listado de libros cuyas existencias se encuentran en el umbral mínimo o por debajo de él." : "Supervisa los niveles de stock, estantes y precios de venta actuales."}
      subnav={<InventarioNav activeTab={vistaReporte ? "stock-bajo" : "catalogo"} />}
      actions={<div className="inventory-heading-actions">
        <button type="button" className="module-secondary-button" onClick={actualizar} disabled={cargando}>Actualizar</button>
        <Link className={`inventory-view-button ${vistaReporte ? "is-return" : ""}`} href={vistaReporte ? "/inventario" : "/inventario?vista=critico"}>
          {vistaReporte ? "Volver al Inventario General" : "Ver Reporte de Stock Crítico"}
        </Link>
      </div>}>
      <div className="inventory-screen">
      {error && <p className="ventas-message ventas-message-error" role="alert">{error}</p>}
      <section className="erp-card inventory-search-panel" aria-label="Buscar en inventario">
          <label className="erp-search">
            <ErpIcon name="search" />
            <input type="search" aria-label="Buscar libros del inventario" placeholder="Buscar por ISBN, título, autor o categoría…" value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
      </section>
      <section className={`erp-card inventory-table-panel ${vistaReporte ? "is-critical" : ""}`}>
        {vistaReporte && <div className="inventory-report-summary">
          <strong>Total de títulos críticos detectados: {cargando || error ? "—" : criticos.length}</strong>
          <span>Fecha de emisión: {new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago" }).format(new Date())}</span>
        </div>}
        {cargando ? <p className="erp-empty" role="status">Cargando inventario…</p> : !error && <>
          <div className="module-table-scroll" role="region" aria-label="Tabla de inventario" tabIndex={0}>
            <table className="module-table inventory-table">
              <caption className="module-visually-hidden">{vistaReporte ? "Reporte de stock crítico" : "Existencias y precios de libros"}</caption>
              <thead><tr>
                <th scope="col">ISBN</th><th scope="col">Título</th>
                {vistaReporte ? <th scope="col">Categoría</th> : <><th scope="col">Autor</th><th scope="col">Estante</th><th scope="col" className="module-number">Precio</th></>}
                <th scope="col" className="module-number">{vistaReporte ? "Stock Actual" : "Stock"}</th>
                {vistaReporte && <th scope="col" className="module-number">Stock Mínimo Requerido</th>}
                <th scope="col" className={vistaReporte ? "module-number" : undefined}>{vistaReporte ? "Déficit a Comprar" : "Estado Operativo"}</th>
              </tr></thead>
              <tbody>{libros.map((libro) => <tr key={libro.isbn}>
                <td>{libro.isbn}</td><td><strong>{libro.titulo}</strong></td>
                {vistaReporte ? <td>{libro.categoria || "—"}</td> : <><td>{libro.autor || "—"}</td><td>{libro.estante || "—"}</td><td className="module-number">{money(libro.precio)}</td></>}
                <td className="module-number inventory-stock">{libro.stock} un.</td>{vistaReporte && <td className="module-number">{libro.minimo} un.</td>}
                <td className={vistaReporte ? "module-number inventory-deficit" : undefined}>{vistaReporte ? `+${Math.max(0, Number(libro.minimo) - Number(libro.stock))} un. (Reponer)` :
                  <span className={`erp-status ${Number(libro.stock) <= Number(libro.minimo) ? "danger" : "success"}`}>{Number(libro.stock) <= Number(libro.minimo) ? "Stock crítico" : "Disponible"}</span>}</td>
              </tr>)}</tbody>
            </table>
          </div>
          {libros.length === 0 && <p className="erp-empty" role="status">{search ? "No hay libros que coincidan con la búsqueda." : vistaReporte ? "No hay títulos en stock crítico." : "Todavía no hay libros registrados."}</p>}
          {vistaReporte && <p className="module-caption">Se incluyen los títulos con stock igual o inferior al mínimo. El déficit indica las unidades para alcanzar ese mínimo.</p>}
        </>}
      </section>
      </div>
    </ErpModuleShell>
  );
}

export default function InventarioModule() {
  return (
    <Suspense
      fallback={
        <main className="erp-screen erp-auth-state" lang="es">
          <p role="status">Cargando inventario…</p>
        </main>
      }
    >
      <InventarioModuleContent />
    </Suspense>
  );
}
