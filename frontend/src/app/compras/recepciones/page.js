"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/components/AuthProvider";
import { moduleAccessLevel } from "@/lib/module-access";
import ErpModuleShell from "@/components/ErpModuleShell";
import ErpIcon from "@/components/ErpIcon";
import ComprasNav from "@/components/ComprasNav";
import {
  fetchRecepcionesPendientes,
  fetchDetalleParaRecepcion,
  registrarRecepcion,
} from "@/lib/compras-api";
import "../compras.css";

export default function RecepcionMercanciaPage() {
  const { usuario } = useAuth();
  const puedeEditar = usuario ? moduleAccessLevel(usuario, "compras") >= 2 : false;

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
    if (!puedeEditar) return;
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
        const pendiente = Number(
          l.cantidadPendiente ?? l.CantidadPendiente ?? l.cantidad_pendiente ?? 0
        );
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
      const pedida = Number(l.cantidadPedida ?? l.CantidadPedida ?? l.cantidad_pedida ?? 0);
      const recibida = Number(l.cantidadRecibida ?? l.CantidadRecibida ?? l.cantidad_recibida ?? 0);
      const pendiente = Number(l.cantidadPendiente ?? l.CantidadPendiente ?? l.cantidad_pendiente ?? 0);
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
    if (!ordenSeleccionada || !puedeEditar) return;

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

    const idOc = ordenSeleccionada.idOc ?? ordenSeleccionada.IdOc ?? ordenSeleccionada.id_oc;
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
      actions={!puedeEditar ? <span className="erp-status warning">Solo lectura</span> : null}
    >
      <div className="inventory-screen">
        {!puedeEditar && (
          <div className="compras-readonly-note" role="status">
            <ErpIcon name="info" />
            <span>Solo lectura — Tu perfil puede consultar recepciones pendientes, sin registrar ingresos.</span>
          </div>
        )}

        {mensajeExito && (
          <div className="ventas-message ventas-message-success" role="status">
            <strong>Recepción confirmada:</strong> {mensajeExito}
          </div>
        )}

        {errorLista && (
          <div className="ventas-message ventas-message-error" role="alert">
            <strong>Error:</strong> {errorLista}
          </div>
        )}

        <section className="erp-card inventory-table-panel">
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
              className="module-secondary-button"
              onClick={cargarOrdenesPendientes}
              disabled={cargandoLista}
            >
              Actualizar lista
            </button>
          </div>

          {cargandoLista ? (
            <p className="erp-empty">Cargando órdenes pendientes de recepción...</p>
          ) : ordenesPendientes.length === 0 ? (
            <div className="erp-empty" role="status">
              No hay órdenes de compra pendientes de recepción en este momento.
            </div>
          ) : (
            <div className="module-table-scroll">
              <table className="module-table">
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
                    const idOc = oc.idOc ?? oc.IdOc ?? oc.id_oc;
                    const prov = oc.proveedorNombre ?? oc.ProveedorNombre ?? oc.proveedor;
                    const estado = (oc.Estado ?? oc.estado ?? "aprobada").toLowerCase();
                    const fecha = oc.Fecha ?? oc.fecha;
                    const entrega = oc.fechaEntrega ?? oc.FechaEntrega ?? oc.fecha_entrega ?? "—";
                    const lineas = oc.Lineas || oc.lineas || [];
                    const totalPendienteOc = lineas.reduce(
                      (acc, l) =>
                        acc + Number(l.cantidadPendiente ?? l.CantidadPendiente ?? l.cantidad_pendiente ?? 0),
                      0
                    );
                    const seleccionada =
                      (ordenSeleccionada?.idOc ?? ordenSeleccionada?.IdOc ?? ordenSeleccionada?.id_oc) === idOc;

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
                            className={`erp-status ${
                              estado === "recibida parcial" ? "warning" : "neutral"
                            }`}
                          >
                            {estado === "recibida parcial" ? "Recibida parcial" : "Aprobada"}
                          </span>
                        </td>
                        <td>{totalPendienteOc} u.</td>
                        <td>
                          {puedeEditar ? (
                            <button
                              type="button"
                              className="module-primary-button"
                              onClick={() => handleSeleccionarOrden(idOc)}
                              disabled={cargandoDetalle}
                            >
                              {seleccionada ? "Seleccionada" : "Recibir mercancía"}
                            </button>
                          ) : (
                            <span className="erp-status neutral">Solo lectura</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {ordenSeleccionada && puedeEditar && (
          <section className="erp-card inventory-table-panel">
            <div className="compras-panel-header">
              <div>
                <h2>
                  Registrar recepción — Orden #{ordenSeleccionada.idOc ?? ordenSeleccionada.IdOc ?? ordenSeleccionada.id_oc}
                </h2>
                <p>
                  Proveedor:{" "}
                  <strong>
                    {ordenSeleccionada.proveedorNombre ?? ordenSeleccionada.ProveedorNombre ?? ordenSeleccionada.proveedor}
                  </strong>{" "}
                  · Estado actual:{" "}
                  <strong>{ordenSeleccionada.Estado ?? ordenSeleccionada.estado}</strong>
                </p>
              </div>
              <button
                type="button"
                className="module-secondary-button"
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
                className="ventas-message ventas-message-error"
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

              <div className="module-table-scroll">
                <table className="module-table">
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
                            className={`erp-status ${
                              linea.faltanteTrasRecepcion > 0 ? "warning" : "success"
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

              <div className="compras-summary-box" style={{ marginTop: "1.25rem" }}>
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
                  <p style={{ margin: "0.25rem 0", color: "var(--status-success-text)", fontWeight: 600 }}>
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
                  className="module-primary-button"
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
