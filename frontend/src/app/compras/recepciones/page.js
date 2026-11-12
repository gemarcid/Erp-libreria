"use client";

import { useEffect, useState, useMemo } from "react";
import ErpModuleShell from "@/components/ErpModuleShell";
import ErpIcon from "@/components/ErpIcon";
import ComprasNav from "@/components/ComprasNav";
import {
  fetchRecepcionesPendientes,
  fetchDetalleParaRecepcion,
  registrarRecepcion,
} from "@/lib/compras-api";

export default function RecepcionMercanciaPage() {
  const [ordenesPendientes, setOrdenesPendientes] = useState([]);
  const [cargandoLista, setCargandoLista] = useState(true);
  const [errorLista, setErrorLista] = useState("");

  const [ordenSeleccionada, setOrdenSeleccionada] = useState(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  const [tipoDoc, setTipoDoc] = useState("guia de despacho");
  const [nroDoc, setNroDoc] = useState("");
  const [cantidadesInput, setCantidadesInput] = useState({});

  const [errorFormulario, setErrorFormulario] = useState("");
  const [mensajeExito, setMensajeExito] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function cargarOrdenesPendientes() {
    setCargandoLista(true);
    setErrorLista("");
    try {
      const lista = await fetchRecepcionesPendientes();
      setOrdenesPendientes(lista);
    } catch (err) {
      setErrorLista(err.message || "No se pudieron cargar las órdenes pendientes de recepción.");
    } finally {
      setCargandoLista(false);
    }
  }

  useEffect(() => {
    cargarOrdenesPendientes();
  }, []);

  async function handleSeleccionarOrden(idOc) {
    setErrorFormulario("");
    setMensajeExito("");
    setCargandoDetalle(true);
    try {
      const detalle = await fetchDetalleParaRecepcion(idOc);
      setOrdenSeleccionada(detalle);
      setTipoDoc("guia de despacho");
      setNroDoc("");

      const inicial = {};
      (detalle.Lineas || detalle.lineas || []).forEach((l) => {
        const isbn = l.Isbn ?? l.isbn;
        const pendiente = Number(l.CantidadPendiente ?? l.cantidad_pendiente ?? 0);
        inicial[isbn] = pendiente;
      });
      setCantidadesInput(inicial);
    } catch (err) {
      setErrorFormulario(err.message || "No se pudo cargar el detalle de la orden seleccionada.");
      setOrdenSeleccionada(null);
    } finally {
      setCargandoDetalle(false);
    }
  }

  function handleCantidadChange(isbn, valorStr) {
    setErrorFormulario("");
    const limpio = valorStr === "" ? "" : parseInt(valorStr, 10);
    setCantidadesInput((prev) => ({
      ...prev,
      [isbn]: Number.isNaN(limpio) ? 0 : limpio,
    }));
  }

  const lineasOrden = useMemo(() => {
    if (!ordenSeleccionada) return [];
    return (ordenSeleccionada.Lineas || ordenSeleccionada.lineas || []).map((l) => {
      const isbn = l.Isbn ?? l.isbn;
      const titulo = l.Titulo ?? l.titulo;
      const pedida = Number(l.CantidadPedida ?? l.cantidad_pedida ?? 0);
      const recibida = Number(l.CantidadRecibida ?? l.cantidad_recibida ?? 0);
      const pendiente = Number(l.CantidadPendiente ?? l.cantidad_pendiente ?? 0);
      const rawInput = cantidadesInput[isbn];
      const aRecibir = rawInput === "" || rawInput === undefined ? 0 : Number(rawInput);
      const faltanteTrasRecepcion = Math.max(0, pendiente - Math.max(0, aRecibir));
      const excedePendiente = aRecibir > pendiente;
      const esNegativa = aRecibir < 0;

      return {
        isbn,
        titulo,
        pedida,
        recibida,
        pendiente,
        rawInput: rawInput ?? 0,
        aRecibir,
        faltanteTrasRecepcion,
        excedePendiente,
        esNegativa,
      };
    });
  }, [ordenSeleccionada, cantidadesInput]);

  const resumenRecepcion = useMemo(() => {
    let totalPendienteActual = 0;
    let totalARecibirAhora = 0;
    let totalFaltanteRestante = 0;
    let hayExceso = false;
    let hayNegativo = false;
    const productosConFaltante = [];

    lineasOrden.forEach((l) => {
      totalPendienteActual += l.pendiente;
      totalARecibirAhora += Math.max(0, l.aRecibir);
      totalFaltanteRestante += l.faltanteTrasRecepcion;
      if (l.excedePendiente) hayExceso = true;
      if (l.esNegativa) hayNegativo = true;
      if (l.faltanteTrasRecepcion > 0) {
        productosConFaltante.push({
          isbn: l.isbn,
          titulo: l.titulo,
          faltante: l.faltanteTrasRecepcion,
        });
      }
    });

    const estadoResultante = totalFaltanteRestante === 0 ? "recibida" : "recibida parcial";

    return {
      totalPendienteActual,
      totalARecibirAhora,
      totalFaltanteRestante,
      hayExceso,
      hayNegativo,
      alMenosUnoMayorACero: totalARecibirAhora > 0,
      productosConFaltante,
      estadoResultante,
    };
  }, [lineasOrden]);

  async function handleConfirmarRecepcion(e) {
    e.preventDefault();
    if (!ordenSeleccionada) return;

    setErrorFormulario("");
    setMensajeExito("");

    if (!nroDoc.trim()) {
      setErrorFormulario("Debes ingresar el número de documento (guía de despacho o factura).");
      return;
    }

    if (resumenRecepcion.hayNegativo) {
      setErrorFormulario("Ninguna cantidad recibida puede ser negativa.");
      return;
    }

    if (resumenRecepcion.hayExceso) {
      setErrorFormulario("Ninguna cantidad recibida puede superar la cantidad pendiente del producto.");
      return;
    }

    if (!resumenRecepcion.alMenosUnoMayorACero) {
      setErrorFormulario("Debes ingresar al menos una cantidad recibida mayor a 0.");
      return;
    }

    const idOc = ordenSeleccionada.IdOc ?? ordenSeleccionada.id_oc;
    const payload = {
      id_oc: idOc,
      tipo_doc: tipoDoc,
      nro_doc: nroDoc.trim(),
      lineas: lineasOrden.map((l) => ({
        isbn: l.isbn,
        cantidad: l.aRecibir,
      })),
    };

    setGuardando(true);
    try {
      const resp = await registrarRecepcion(payload);
      setMensajeExito(
        resp.mensaje ||
          `Recepción registrada correctamente. Estado de la orden #${idOc}: ${resp.estado_orden || resp.estadoOrden}.`
      );
      setOrdenSeleccionada(null);
      setCantidadesInput({});
      setNroDoc("");
      await cargarOrdenesPendientes();
    } catch (err) {
      setErrorFormulario(err.message || "Error al registrar la recepción de mercancía.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <ErpModuleShell
      module="compras"
      title="Recepción de mercancía"
      description="Selecciona una orden de compra aprobada o con recepción parcial, verifica las cantidades recibidas por producto y confirma el ingreso al inventario."
      liveData
      subnav={<ComprasNav />}
    >
      <div className="erp-main">

        {mensajeExito && (
          <div className="compras-alert compras-alert--ok" role="status">
            <strong>Recepción confirmada:</strong> {mensajeExito}
          </div>
        )}

        {errorLista && (
          <div className="compras-alert compras-alert--error" role="alert">
            <strong>Error:</strong> {errorLista}
          </div>
        )}

        <section className="compras-panel">
          <div className="compras-panel-header">
            <div>
              <h2>Órdenes pendientes de recepción</h2>
              <p>
                Órdenes en estado <strong>Aprobada</strong> o <strong>Recibida parcial</strong> con
                unidades pendientes por ingresar.
              </p>
            </div>
            <button
              type="button"
              className="compras-btn compras-btn--ghost"
              onClick={cargarOrdenesPendientes}
              disabled={cargandoLista}
            >
              Actualizar lista
            </button>
          </div>

          {cargandoLista ? (
            <p className="compras-empty">Cargando órdenes pendientes de recepción...</p>
          ) : ordenesPendientes.length === 0 ? (
            <div className="compras-empty" role="status">
              No hay órdenes de compra pendientes de recepción en este momento.
            </div>
          ) : (
            <div className="compras-table-wrap">
              <table className="compras-table">
                <thead>
                  <tr>
                    <th>N° Orden</th>
                    <th>Proveedor</th>
                    <th>Fecha Emisión</th>
                    <th>Entrega Estimada</th>
                    <th>Estado</th>
                    <th>Pendiente Total</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {ordenesPendientes.map((oc) => {
                    const idOc = oc.IdOc ?? oc.id_oc;
                    const prov = oc.ProveedorNombre ?? oc.proveedor;
                    const estado = (oc.Estado ?? oc.estado ?? "aprobada").toLowerCase();
                    const fecha = oc.Fecha ?? oc.fecha;
                    const entrega = oc.FechaEntrega ?? oc.fecha_entrega ?? "—";
                    const lineas = oc.Lineas || oc.lineas || [];
                    const totalPendienteOc = lineas.reduce(
                      (acc, l) => acc + Number(l.CantidadPendiente ?? l.cantidad_pendiente ?? 0),
                      0
                    );
                    const seleccionada =
                      (ordenSeleccionada?.IdOc ?? ordenSeleccionada?.id_oc) === idOc;

                    return (
                      <tr key={idOc} className={seleccionada ? "is-selected" : ""}>
                        <td>
                          <strong>#{idOc}</strong>
                        </td>
                        <td>{prov}</td>
                        <td>{fecha}</td>
                        <td>{entrega}</td>
                        <td>
                          <span
                            className={`compras-badge ${
                              estado === "recibida parcial"
                                ? "compras-badge--warning"
                                : "compras-badge--info"
                            }`}
                          >
                            {estado === "recibida parcial" ? "Recibida parcial" : "Aprobada"}
                          </span>
                        </td>
                        <td>{totalPendienteOc} u.</td>
                        <td>
                          <button
                            type="button"
                            className="compras-btn compras-btn--primary"
                            onClick={() => handleSeleccionarOrden(idOc)}
                            disabled={cargandoDetalle}
                          >
                            {seleccionada ? "Seleccionada" : "Recibir mercancía"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {ordenSeleccionada && (
          <section className="compras-panel" style={{ marginTop: "1.5rem" }}>
            <div className="compras-panel-header">
              <div>
                <h2>
                  Registrar recepción — Orden #{ordenSeleccionada.IdOc ?? ordenSeleccionada.id_oc}
                </h2>
                <p>
                  Proveedor:{" "}
                  <strong>
                    {ordenSeleccionada.ProveedorNombre ?? ordenSeleccionada.proveedor}
                  </strong>{" "}
                  · Estado actual:{" "}
                  <strong>{ordenSeleccionada.Estado ?? ordenSeleccionada.estado}</strong>
                </p>
              </div>
              <button
                type="button"
                className="compras-btn compras-btn--ghost"
                onClick={() => {
                  setOrdenSeleccionada(null);
                  setErrorFormulario("");
                }}
              >
                Cancelar selección
              </button>
            </div>

            {errorFormulario && (
              <div
                className="compras-alert compras-alert--error"
                role="alert"
                style={{ marginBottom: "1rem" }}
              >
                <strong>Atención:</strong> {errorFormulario}
              </div>
            )}

            <form onSubmit={handleConfirmarRecepcion}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "1rem",
                  marginBottom: "1.25rem",
                }}
              >
                <div className="compras-field">
                  <label htmlFor="recepcion-tipo-doc">Tipo de documento respaldatorio *</label>
                  <select
                    id="recepcion-tipo-doc"
                    className="compras-select"
                    value={tipoDoc}
                    onChange={(e) => setTipoDoc(e.target.value)}
                  >
                    <option value="guia de despacho">Guía de despacho</option>
                    <option value="factura">Factura</option>
                  </select>
                </div>

                <div className="compras-field">
                  <label htmlFor="recepcion-nro-doc">N° de documento *</label>
                  <input
                    id="recepcion-nro-doc"
                    type="text"
                    className="compras-input"
                    placeholder="Ej: GD-10452 o FAC-8891"
                    value={nroDoc}
                    onChange={(e) => setNroDoc(e.target.value)}
                    maxLength={50}
                    required
                  />
                </div>
              </div>

              <div className="compras-table-wrap">
                <table className="compras-table">
                  <thead>
                    <tr>
                      <th>ISBN</th>
                      <th>Producto (Libro)</th>
                      <th>Cant. Pedida</th>
                      <th>Ya Recibida</th>
                      <th>Pendiente</th>
                      <th>Cant. Recibida Ahora</th>
                      <th>Faltante tras Recepción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineasOrden.map((linea) => (
                      <tr key={linea.isbn}>
                        <td>{linea.isbn}</td>
                        <td>
                          <strong>{linea.titulo}</strong>
                        </td>
                        <td>{linea.pedida}</td>
                        <td>{linea.recibida}</td>
                        <td>
                          <strong>{linea.pendiente}</strong>
                        </td>
                        <td>
                          {linea.pendiente === 0 ? (
                            <span>0 (Completado)</span>
                          ) : (
                            <div>
                              <input
                                type="number"
                                className="compras-input"
                                style={{ width: "110px" }}
                                min={0}
                                max={linea.pendiente}
                                value={linea.rawInput}
                                onChange={(e) => handleCantidadChange(linea.isbn, e.target.value)}
                              />
                              {linea.excedePendiente && (
                                <div
                                  style={{
                                    color: "#dc2626",
                                    fontSize: "0.78rem",
                                    marginTop: "0.25rem",
                                  }}
                                >
                                  Máximo permitido: {linea.pendiente}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td>
                          <span
                            className={`compras-badge ${
                              linea.faltanteTrasRecepcion > 0
                                ? "compras-badge--warning"
                                : "compras-badge--ok"
                            }`}
                          >
                            {linea.faltanteTrasRecepcion > 0
                              ? `${linea.faltanteTrasRecepcion} faltante(s)`
                              : "0 (Completo)"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div
                style={{
                  marginTop: "1.25rem",
                  padding: "1rem 1.25rem",
                  borderRadius: "10px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                }}
              >
                <h3 style={{ marginTop: 0, marginBottom: "0.5rem", fontSize: "1rem" }}>
                  Resumen de recepción y faltantes
                </h3>
                <p style={{ margin: "0.25rem 0" }}>
                  Unidades a ingresar ahora: <strong>{resumenRecepcion.totalARecibirAhora}</strong> de{" "}
                  <strong>{resumenRecepcion.totalPendienteActual}</strong> pendientes.
                </p>
                <p style={{ margin: "0.25rem 0" }}>
                  Unidades faltantes tras esta recepción:{" "}
                  <strong>{resumenRecepcion.totalFaltanteRestante}</strong>
                </p>
                {resumenRecepcion.productosConFaltante.length > 0 ? (
                  <ul style={{ margin: "0.4rem 0", paddingLeft: "1.25rem", fontSize: "0.9rem" }}>
                    {resumenRecepcion.productosConFaltante.map((pf) => (
                      <li key={pf.isbn}>
                        {pf.titulo} ({pf.isbn}): quedan <strong>{pf.faltante}</strong> unidad(es)
                        pendientes.
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ margin: "0.25rem 0", color: "#15803d", fontWeight: 600 }}>
                    No quedarán productos faltantes en esta orden.
                  </p>
                )}
                <p style={{ margin: "0.35rem 0 0" }}>
                  Estado en que quedará la orden al confirmar:{" "}
                  <strong style={{ textTransform: "uppercase" }}>
                    {resumenRecepcion.estadoResultante}
                  </strong>
                </p>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "0.75rem",
                  marginTop: "1.25rem",
                }}
              >
                <button
                  type="submit"
                  className="compras-btn compras-btn--primary"
                  disabled={
                    guardando ||
                    resumenRecepcion.hayExceso ||
                    resumenRecepcion.hayNegativo ||
                    !resumenRecepcion.alMenosUnoMayorACero
                  }
                >
                  {guardando ? "Registrando recepción..." : "Confirmar recepción"}
                </button>
              </div>
            </form>
          </section>
        )}
      </div>
    </ErpModuleShell>
  );
}

