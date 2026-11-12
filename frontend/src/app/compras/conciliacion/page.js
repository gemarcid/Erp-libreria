"use client";

import { useEffect, useState, useMemo } from "react";
import ErpModuleShell from "@/components/ErpModuleShell";
import ErpIcon from "@/components/ErpIcon";
import ComprasNav from "@/components/ComprasNav";
import {
  fetchFacturasPendientesConciliacion,
  evaluarConciliacionFactura,
  conciliarFacturaYProgramarPago,
} from "@/lib/compras-api";
import { formatCurrency } from "@/lib/compras-format";

function hoyIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function ConciliacionYPagosPage() {
  const [facturasPendientes, setFacturasPendientes] = useState([]);
  const [cargandoLista, setCargandoLista] = useState(true);
  const [errorLista, setErrorLista] = useState("");

  const [evaluacion, setEvaluacion] = useState(null);
  const [evaluando, setEvaluando] = useState(false);

  const [fechaPago, setFechaPago] = useState("");
  const [errorAccion, setErrorAccion] = useState("");
  const [mensajeExito, setMensajeExito] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function cargarFacturasPendientes() {
    setCargandoLista(true);
    setErrorLista("");
    try {
      const data = await fetchFacturasPendientesConciliacion();
      setFacturasPendientes(data);
    } catch (err) {
      setErrorLista(err.message || "No se pudieron cargar las facturas pendientes de conciliación.");
    } finally {
      setCargandoLista(false);
    }
  }

  useEffect(() => {
    cargarFacturasPendientes();
  }, []);

  async function handleEvaluarFactura(idFactura) {
    setErrorAccion("");
    setMensajeExito("");
    setEvaluando(true);
    try {
      const res = await evaluarConciliacionFactura(idFactura);
      setEvaluacion(res);

      const fac = res.Factura || res.factura || {};
      const hoy = hoyIso();
      const emision = fac.FechaEmision ?? fac.fecha_emision ?? hoy;
      const vencimiento = fac.FechaVencimiento ?? fac.fecha_vencimiento ?? "";
      const minFecha = emision > hoy ? emision : hoy;

      if (vencimiento && vencimiento >= minFecha) {
        setFechaPago(vencimiento);
      } else {
        setFechaPago(minFecha);
      }

      await cargarFacturasPendientes();
    } catch (err) {
      setErrorAccion(err.message || "No se pudo evaluar la conciliación de la factura.");
      setEvaluacion(null);
    } finally {
      setEvaluando(false);
    }
  }

  const datosEvaluacion = useMemo(() => {
    if (!evaluacion) return null;
    const fac = evaluacion.Factura || evaluacion.factura || {};
    const lineas = (evaluacion.Lineas || evaluacion.lineas || []).map((l) => ({
      isbn: l.Isbn ?? l.isbn,
      titulo: l.Titulo ?? l.titulo,
      pedida: Number(l.CantidadPedida ?? l.cantidad_pedida ?? 0),
      recibida: Number(l.CantidadRecibida ?? l.cantidad_recibida ?? 0),
      difCantidad: Number(l.DiferenciaCantidad ?? l.diferencia_cantidad ?? 0),
      precioPactado: Number(l.PrecioPactado ?? l.precio_pactado ?? 0),
      ivaPorcentaje: Number(l.IvaPorcentaje ?? l.iva_porcentaje ?? 19),
      subtotalNetoEsperado: Number(l.SubtotalNetoEsperado ?? l.subtotal_neto_esperado ?? 0),
      ivaEsperado: Number(l.IvaEsperado ?? l.iva_esperado ?? 0),
      totalEsperadoLinea: Number(l.TotalEsperadoLinea ?? l.total_esperado_linea ?? 0),
    }));

    const hoy = hoyIso();
    const fechaEmision = fac.FechaEmision ?? fac.fecha_emision ?? "";
    const fechaAnteriorAHoy = Boolean(fechaPago && fechaPago < hoy);
    const fechaAnteriorAEmision = Boolean(
      fechaPago && fechaEmision && fechaPago < fechaEmision
    );

    return {
      idFactura: fac.IdFactura ?? fac.id_factura,
      idOc: fac.IdOc ?? fac.id_oc,
      nroFactura: fac.NroFactura ?? fac.nro_factura,
      proveedor: fac.ProveedorNombre ?? fac.proveedor,
      fechaEmision,
      fechaVencimiento: fac.FechaVencimiento ?? fac.fecha_vencimiento ?? "—",
      estadoActual:
        evaluacion.EstadoActualizado ??
        evaluacion.estado_actualizado ??
        fac.EstadoPago ??
        fac.estado_pago,
      estadoOrden: evaluacion.EstadoOrden ?? evaluacion.estado_orden,
      netoFactura: Number(evaluacion.NetoFactura ?? evaluacion.neto_factura ?? 0),
      ivaFactura: Number(evaluacion.IvaFactura ?? evaluacion.iva_factura ?? 0),
      totalFactura: Number(evaluacion.TotalFactura ?? evaluacion.total_factura ?? 0),
      netoEsperado: Number(evaluacion.NetoEsperado ?? evaluacion.neto_esperado ?? 0),
      ivaEsperado: Number(evaluacion.IvaEsperado ?? evaluacion.iva_esperado ?? 0),
      totalEsperado: Number(evaluacion.TotalEsperado ?? evaluacion.total_esperado ?? 0),
      difNeto: Number(evaluacion.DiferenciaNeto ?? evaluacion.diferencia_neto ?? 0),
      difIva: Number(evaluacion.DiferenciaIva ?? evaluacion.diferencia_iva ?? 0),
      difTotal: Number(evaluacion.DiferenciaTotal ?? evaluacion.diferencia_total ?? 0),
      tolerancia: Number(evaluacion.ToleranciaRedondeo ?? evaluacion.tolerancia_redondeo ?? 1),
      hayDifCantidad: Boolean(
        evaluacion.HayDiferenciaCantidad ?? evaluacion.hay_diferencia_cantidad
      ),
      hayDifMonto: Boolean(evaluacion.HayDiferenciaMonto ?? evaluacion.hay_diferencia_monto),
      cuadra: Boolean(evaluacion.Cuadra ?? evaluacion.cuadra),
      lineas,
      fechaAnteriorAHoy,
      fechaAnteriorAEmision,
    };
  }, [evaluacion, fechaPago]);

  async function handleConfirmarConciliacion(e) {
    e.preventDefault();
    if (!datosEvaluacion || !datosEvaluacion.cuadra) return;

    setErrorAccion("");
    setMensajeExito("");

    if (!fechaPago) {
      setErrorAccion("La fecha de pago es obligatoria.");
      return;
    }

    if (datosEvaluacion.fechaAnteriorAHoy) {
      setErrorAccion("La fecha de pago no puede ser anterior a hoy.");
      return;
    }

    if (datosEvaluacion.fechaAnteriorAEmision) {
      setErrorAccion("La fecha de pago no puede ser anterior a la fecha de emisión de la factura.");
      return;
    }

    setGuardando(true);
    try {
      const resp = await conciliarFacturaYProgramarPago(datosEvaluacion.idFactura, fechaPago);
      if (!resp.ok) {
        setErrorAccion(resp.error || "No se pudo conciliar la factura.");
        if (resp.evaluacion) {
          setEvaluacion(resp.evaluacion);
        }
        await cargarFacturasPendientes();
        return;
      }

      setMensajeExito(
        resp.mensaje ||
          `Factura N° ${datosEvaluacion.nroFactura} conciliada y pago programado para el ${fechaPago}.`
      );
      setEvaluacion(null);
      setFechaPago("");
      await cargarFacturasPendientes();
    } catch (err) {
      setErrorAccion(err.message || "Error al conciliar la factura.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <ErpModuleShell
      module="compras"
      title="Conciliación y pagos"
      description="Compara las facturas de proveedor contra la orden de compra y las cantidades efectivamente recibidas en bodega antes de programar su fecha de pago."
      liveData
      subnav={<ComprasNav />}
    >
      <div className="erp-main">

        {mensajeExito && (
          <div className="compras-alert compras-alert--ok" role="status">
            <strong>Conciliación exitosa:</strong> {mensajeExito}
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
              <h2>Facturas por conciliar</h2>
              <p>
                Facturas en estado <strong>Pendiente de conciliación</strong> o{" "}
                <strong>Con discrepancias</strong>.
              </p>
            </div>
            <button
              type="button"
              className="compras-btn compras-btn--ghost"
              onClick={cargarFacturasPendientes}
              disabled={cargandoLista}
            >
              Actualizar lista
            </button>
          </div>

          {cargandoLista ? (
            <p className="compras-empty">Cargando facturas por conciliar...</p>
          ) : facturasPendientes.length === 0 ? (
            <div className="compras-empty" role="status">
              No hay facturas en estado pendiente de conciliación o con discrepancias en este momento.
            </div>
          ) : (
            <div className="compras-table-wrap">
              <table className="compras-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>N° Factura</th>
                    <th>Orden</th>
                    <th>Proveedor</th>
                    <th>Emisión</th>
                    <th>Vencimiento</th>
                    <th>Neto</th>
                    <th>IVA</th>
                    <th>Total</th>
                    <th>Estado</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {facturasPendientes.map((f) => {
                    const idFac = f.IdFactura ?? f.id_factura;
                    const nro = f.NroFactura ?? f.nro_factura;
                    const idOc = f.IdOc ?? f.id_oc;
                    const prov = f.ProveedorNombre ?? f.proveedor;
                    const emision = f.FechaEmision ?? f.fecha_emision;
                    const venc = f.FechaVencimiento ?? f.fecha_vencimiento ?? "—";
                    const neto = Number(f.MontoNeto ?? f.monto_neto ?? 0);
                    const iva = Number(f.Iva ?? f.iva ?? 0);
                    const total = Number(f.MontoTotal ?? f.monto_total ?? 0);
                    const estado = (f.EstadoPago ?? f.estado_pago ?? "").toLowerCase();
                    const seleccionada = datosEvaluacion?.idFactura === idFac;

                    return (
                      <tr key={idFac} className={seleccionada ? "is-selected" : ""}>
                        <td>#{idFac}</td>
                        <td>
                          <strong>{nro}</strong>
                        </td>
                        <td>#{idOc}</td>
                        <td>{prov}</td>
                        <td>{emision}</td>
                        <td>{venc}</td>
                        <td>{formatCurrency(neto)}</td>
                        <td>{formatCurrency(iva)}</td>
                        <td>
                          <strong>{formatCurrency(total)}</strong>
                        </td>
                        <td>
                          <span
                            className={`compras-badge ${
                              estado === "con discrepancias"
                                ? "compras-badge--danger"
                                : "compras-badge--warning"
                            }`}
                          >
                            {estado}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="compras-btn compras-btn--primary"
                            onClick={() => handleEvaluarFactura(idFac)}
                            disabled={evaluando}
                          >
                            {seleccionada ? "Reevaluar" : "Evaluar conciliación"}
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

        {datosEvaluacion && (
          <section className="compras-panel" style={{ marginTop: "1.5rem" }}>
            <div className="compras-panel-header">
              <div>
                <h2>
                  Evaluación de conciliación — Factura N° {datosEvaluacion.nroFactura} (Orden #
                  {datosEvaluacion.idOc})
                </h2>
                <p>
                  Proveedor: <strong>{datosEvaluacion.proveedor}</strong> · Emisión:{" "}
                  <strong>{datosEvaluacion.fechaEmision}</strong> · Vencimiento:{" "}
                  <strong>{datosEvaluacion.fechaVencimiento}</strong> · Estado factura:{" "}
                  <strong>{datosEvaluacion.estadoActual}</strong>
                </p>
              </div>
              <button
                type="button"
                className="compras-btn compras-btn--ghost"
                onClick={() => {
                  setEvaluacion(null);
                  setErrorAccion("");
                }}
              >
                Cerrar evaluación
              </button>
            </div>

            {errorAccion && (
              <div
                className="compras-alert compras-alert--error"
                role="alert"
                style={{ marginBottom: "1rem" }}
              >
                <strong>Error:</strong> {errorAccion}
              </div>
            )}

            <h3 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>
              1. Detalle por producto (Orden vs Mercancía Recibida)
            </h3>
            <div className="compras-table-wrap" style={{ marginBottom: "1.25rem" }}>
              <table className="compras-table">
                <thead>
                  <tr>
                    <th>ISBN</th>
                    <th>Producto</th>
                    <th>Pedido OC</th>
                    <th>Recibido Bodega</th>
                    <th>Dif. Cantidad</th>
                    <th>Precio Pactado</th>
                    <th>IVA %</th>
                    <th>Subtotal Neto Esperado</th>
                  </tr>
                </thead>
                <tbody>
                  {datosEvaluacion.lineas.map((l) => (
                    <tr key={l.isbn}>
                      <td>{l.isbn}</td>
                      <td>
                        <strong>{l.titulo}</strong>
                      </td>
                      <td>{l.pedida}</td>
                      <td>{l.recibida}</td>
                      <td>
                        <span
                          className={`compras-badge ${
                            l.difCantidad === 0
                              ? "compras-badge--ok"
                              : "compras-badge--danger"
                          }`}
                        >
                          {l.difCantidad === 0
                            ? "0 (Sin diferencia)"
                            : `${l.difCantidad > 0 ? "+" : ""}${l.difCantidad} u.`}
                        </span>
                      </td>
                      <td>{formatCurrency(l.precioPactado)}</td>
                      <td>{l.ivaPorcentaje}%</td>
                      <td>
                        <strong>{formatCurrency(l.subtotalNetoEsperado)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>
              2. Comparación de montos (Factura vs Esperado según recepción — Tolerancia de{" "}
              {formatCurrency(datosEvaluacion.tolerancia)})
            </h3>
            <div className="compras-table-wrap" style={{ marginBottom: "1.25rem" }}>
              <table className="compras-table">
                <thead>
                  <tr>
                    <th>Concepto</th>
                    <th>Monto en Factura</th>
                    <th>Monto Esperado (Recibido × Pactado)</th>
                    <th>Diferencia ($)</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <strong>Monto Neto</strong>
                    </td>
                    <td>{formatCurrency(datosEvaluacion.netoFactura)}</td>
                    <td>{formatCurrency(datosEvaluacion.netoEsperado)}</td>
                    <td>{formatCurrency(datosEvaluacion.difNeto)}</td>
                    <td>
                      {Math.abs(datosEvaluacion.difNeto) <= datosEvaluacion.tolerancia
                        ? "Cuadra"
                        : "Con diferencia"}
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <strong>IVA</strong>
                    </td>
                    <td>{formatCurrency(datosEvaluacion.ivaFactura)}</td>
                    <td>{formatCurrency(datosEvaluacion.ivaEsperado)}</td>
                    <td>{formatCurrency(datosEvaluacion.difIva)}</td>
                    <td>
                      {Math.abs(datosEvaluacion.difIva) <= datosEvaluacion.tolerancia
                        ? "Cuadra"
                        : "Con diferencia"}
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Monto Total</strong>
                    </td>
                    <td>
                      <strong>{formatCurrency(datosEvaluacion.totalFactura)}</strong>
                    </td>
                    <td>
                      <strong>{formatCurrency(datosEvaluacion.totalEsperado)}</strong>
                    </td>
                    <td>
                      <strong>{formatCurrency(datosEvaluacion.difTotal)}</strong>
                    </td>
                    <td>
                      {Math.abs(datosEvaluacion.difTotal) <= datosEvaluacion.tolerancia
                        ? "Cuadra"
                        : "Con diferencia"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {!datosEvaluacion.cuadra ? (
              <div className="compras-alert compras-alert--error" role="alert">
                <strong>Factura con discrepancias:</strong> La factura ha pasado a estado{" "}
                <strong>con discrepancias</strong> y no se permite programar su pago.
                <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.25rem" }}>
                  {datosEvaluacion.hayDifCantidad && (
                    <li>
                      Existen diferencias de cantidad entre lo pedido en la orden y lo recibido en
                      bodega.
                    </li>
                  )}
                  {datosEvaluacion.hayDifMonto && (
                    <li>
                      Existen diferencias de monto superiores a la tolerancia de{" "}
                      {formatCurrency(datosEvaluacion.tolerancia)} (Dif. Neto:{" "}
                      {formatCurrency(datosEvaluacion.difNeto)}, Dif. IVA:{" "}
                      {formatCurrency(datosEvaluacion.difIva)}, Dif. Total:{" "}
                      {formatCurrency(datosEvaluacion.difTotal)}).
                    </li>
                  )}
                </ul>
              </div>
            ) : (
              <form
                onSubmit={handleConfirmarConciliacion}
                style={{
                  padding: "1.25rem",
                  borderRadius: "10px",
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                }}
              >
                <p style={{ marginTop: 0, color: "#166534", fontWeight: 600 }}>
                  La factura cuadra con la orden de compra y la mercancía recibida. Puedes programar
                  su fecha de pago:
                </p>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "flex-end",
                    gap: "1rem",
                  }}
                >
                  <div className="compras-field" style={{ minWidth: "240px" }}>
                    <label htmlFor="conciliacion-fecha-pago">Fecha de pago programada *</label>
                    <input
                      id="conciliacion-fecha-pago"
                      type="date"
                      className="compras-input"
                      min={
                        datosEvaluacion.fechaEmision > hoyIso()
                          ? datosEvaluacion.fechaEmision
                          : hoyIso()
                      }
                      value={fechaPago}
                      onChange={(e) => setFechaPago(e.target.value)}
                      required
                    />
                    {datosEvaluacion.fechaAnteriorAHoy && (
                      <small style={{ color: "#dc2626" }}>
                        La fecha de pago no puede ser anterior a hoy.
                      </small>
                    )}
                    {datosEvaluacion.fechaAnteriorAEmision && (
                      <small style={{ color: "#dc2626" }}>
                        La fecha de pago no puede ser anterior a la emisión (
                        {datosEvaluacion.fechaEmision}).
                      </small>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="compras-btn compras-btn--primary"
                    disabled={guardando}
                  >
                    {guardando
                      ? "Confirmando conciliación..."
                      : "Confirmar conciliación y programar pago"}
                  </button>
                </div>
              </form>
            )}
          </section>
        )}
      </div>
    </ErpModuleShell>
  );
}

