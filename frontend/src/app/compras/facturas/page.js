"use client";

import { useEffect, useState, useMemo } from "react";
import ErpModuleShell from "@/components/ErpModuleShell";
import ErpIcon from "@/components/ErpIcon";
import ComprasNav from "@/components/ComprasNav";
import {
  fetchOrdenesPendientesFacturar,
  fetchFacturasProveedor,
  registrarFacturaProveedor,
} from "@/lib/compras-api";
import { formatCurrency } from "@/lib/compras-format";

function hoyIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function sumarDiasIso(fechaIso, dias = 30) {
  if (!fechaIso) return "";
  const [y, m, d] = fechaIso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + dias);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export default function FacturasProveedorPage() {
  const [ordenesPendientes, setOrdenesPendientes] = useState([]);
  const [facturasRegistradas, setFacturasRegistradas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState("");

  const [ordenSeleccionada, setOrdenSeleccionada] = useState(null);
  const [nroFactura, setNroFactura] = useState("");
  const [fechaEmision, setFechaEmision] = useState("");
  const [fechaVencimiento, setFechaVencimiento] = useState("");
  const [montoNeto, setMontoNeto] = useState("");
  const [iva, setIva] = useState("");

  const [errorFormulario, setErrorFormulario] = useState("");
  const [facturaDuplicada, setFacturaDuplicada] = useState(null);
  const [mensajeExito, setMensajeExito] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function cargarDatos() {
    setCargando(true);
    setErrorCarga("");
    try {
      const [pendientes, facturas] = await Promise.all([
        fetchOrdenesPendientesFacturar(),
        fetchFacturasProveedor(),
      ]);
      setOrdenesPendientes(pendientes);
      setFacturasRegistradas(facturas);
    } catch (err) {
      setErrorCarga(err.message || "No se pudieron cargar los datos de facturación.");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarDatos();
  }, []);

  function handleSeleccionarOrden(oc) {
    setOrdenSeleccionada(oc);
    setErrorFormulario("");
    setFacturaDuplicada(null);
    setMensajeExito("");

    const hoy = hoyIso();
    const cond = String(oc.CondicionPago ?? oc.condicion_pago ?? "");
    const matchDias = cond.match(/^(\d+)/);
    const diasPlazo = matchDias ? parseInt(matchDias[1], 10) : 30;

    setNroFactura("");
    setFechaEmision(hoy);
    setFechaVencimiento(sumarDiasIso(hoy, diasPlazo));
    setMontoNeto(String(oc.NetoSugerido ?? oc.neto_sugerido ?? 0));
    setIva(String(oc.IvaSugerido ?? oc.iva_sugerido ?? 0));
  }

  const calculos = useMemo(() => {
    const netoNum = Number(montoNeto);
    const ivaNum = Number(iva);
    const netoValido = !Number.isNaN(netoNum) && montoNeto !== "" ? netoNum : 0;
    const ivaValido = !Number.isNaN(ivaNum) && iva !== "" ? ivaNum : 0;
    const totalCalculado = Math.round((netoValido + ivaValido) * 100) / 100;

    const hoy = hoyIso();
    const emisionFutura = Boolean(fechaEmision && fechaEmision > hoy);
    const vencimientoAnterior = Boolean(
      fechaEmision && fechaVencimiento && fechaVencimiento < fechaEmision
    );
    const montosInvalidos = netoValido <= 0 || ivaValido <= 0;

    return {
      netoValido,
      ivaValido,
      totalCalculado,
      emisionFutura,
      vencimientoAnterior,
      montosInvalidos,
    };
  }, [montoNeto, iva, fechaEmision, fechaVencimiento]);

  async function handleConfirmarFactura(e) {
    e.preventDefault();
    if (!ordenSeleccionada) return;

    setErrorFormulario("");
    setFacturaDuplicada(null);
    setMensajeExito("");

    if (!nroFactura.trim()) {
      setErrorFormulario("El número de factura es obligatorio.");
      return;
    }

    if (!fechaEmision || !fechaVencimiento) {
      setErrorFormulario("Las fechas de emisión y de vencimiento son obligatorias.");
      return;
    }

    if (calculos.emisionFutura) {
      setErrorFormulario("La fecha de emisión no puede ser futura.");
      return;
    }

    if (calculos.vencimientoAnterior) {
      setErrorFormulario("La fecha de vencimiento no puede ser anterior a la fecha de emisión.");
      return;
    }

    if (calculos.montosInvalidos) {
      setErrorFormulario("Los montos neto e IVA deben ser mayores a 0.");
      return;
    }

    const idOc = ordenSeleccionada.IdOc ?? ordenSeleccionada.id_oc;
    setGuardando(true);
    try {
      const resp = await registrarFacturaProveedor({
        id_oc: idOc,
        nro_factura: nroFactura.trim(),
        fecha_emision: fechaEmision,
        fecha_vencimiento: fechaVencimiento,
        monto_neto: calculos.netoValido,
        iva: calculos.ivaValido,
      });

      if (!resp.ok) {
        setErrorFormulario(resp.error || "No se pudo registrar la factura.");
        if (resp.facturaExistente) {
          setFacturaDuplicada(resp.facturaExistente);
        }
        return;
      }

      setMensajeExito(
        resp.mensaje ||
          `Factura N° ${nroFactura.trim()} registrada exitosamente para la orden #${idOc}.`
      );
      setOrdenSeleccionada(null);
      setNroFactura("");
      await cargarDatos();
    } catch (err) {
      setErrorFormulario(err.message || "Error al registrar la factura de proveedor.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <ErpModuleShell
      module="compras"
      title="Facturas de proveedor"
      description="Selecciona una orden de compra recibida (total o parcialmente) pendiente de facturar, verifica o ajusta los montos neto e IVA y registra la factura para su conciliación."
      liveData
      subnav={<ComprasNav />}
    >
      <div className="erp-main">

        {mensajeExito && (
          <div className="compras-alert compras-alert--ok" role="status">
            <strong>Factura registrada:</strong> {mensajeExito}
          </div>
        )}

        {errorCarga && (
          <div className="compras-alert compras-alert--error" role="alert">
            <strong>Error:</strong> {errorCarga}
          </div>
        )}

        <section className="compras-panel">
          <div className="compras-panel-header">
            <div>
              <h2>Órdenes pendientes de facturar</h2>
              <p>
                Órdenes en estado <strong>Recibida parcial</strong> o <strong>Recibida</strong> que
                aún no tienen factura asociada.
              </p>
            </div>
            <button
              type="button"
              className="compras-btn compras-btn--ghost"
              onClick={cargarDatos}
              disabled={cargando}
            >
              Actualizar
            </button>
          </div>

          {cargando ? (
            <p className="compras-empty">Cargando órdenes pendientes de facturar...</p>
          ) : ordenesPendientes.length === 0 ? (
            <div className="compras-empty" role="status">
              No hay órdenes en estado recibida o recibida parcial pendientes de facturar.
            </div>
          ) : (
            <div className="compras-table-wrap">
              <table className="compras-table">
                <thead>
                  <tr>
                    <th>N° Orden</th>
                    <th>Proveedor</th>
                    <th>RUT</th>
                    <th>Fecha Orden</th>
                    <th>Estado Orden</th>
                    <th>Neto Orden</th>
                    <th>IVA Orden</th>
                    <th>Total Orden</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {ordenesPendientes.map((oc) => {
                    const idOc = oc.IdOc ?? oc.id_oc;
                    const prov = oc.ProveedorNombre ?? oc.proveedor;
                    const rut = oc.ProveedorRut ?? oc.proveedor_rut ?? "—";
                    const fecha = oc.FechaOrden ?? oc.fecha_orden;
                    const estado = (oc.Estado ?? oc.estado ?? "").toLowerCase();
                    const netoSug = Number(oc.NetoSugerido ?? oc.neto_sugerido ?? 0);
                    const ivaSug = Number(oc.IvaSugerido ?? oc.iva_sugerido ?? 0);
                    const totalOc = Number(oc.TotalOrden ?? oc.total_orden ?? 0);
                    const seleccionada =
                      (ordenSeleccionada?.IdOc ?? ordenSeleccionada?.id_oc) === idOc;

                    return (
                      <tr key={idOc} className={seleccionada ? "is-selected" : ""}>
                        <td>
                          <strong>#{idOc}</strong>
                        </td>
                        <td>{prov}</td>
                        <td>{rut}</td>
                        <td>{fecha}</td>
                        <td>
                          <span
                            className={`compras-badge ${
                              estado === "recibida"
                                ? "compras-badge--ok"
                                : "compras-badge--warning"
                            }`}
                          >
                            {estado === "recibida" ? "Recibida" : "Recibida parcial"}
                          </span>
                        </td>
                        <td>{formatCurrency(netoSug)}</td>
                        <td>{formatCurrency(ivaSug)}</td>
                        <td>
                          <strong>{formatCurrency(totalOc)}</strong>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="compras-btn compras-btn--primary"
                            onClick={() => handleSeleccionarOrden(oc)}
                          >
                            {seleccionada ? "Seleccionada" : "Registrar factura"}
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
                  Registrar factura — Orden #{ordenSeleccionada.IdOc ?? ordenSeleccionada.id_oc}
                </h2>
                <p>
                  Proveedor:{" "}
                  <strong>
                    {ordenSeleccionada.ProveedorNombre ?? ordenSeleccionada.proveedor}
                  </strong>{" "}
                  ({ordenSeleccionada.ProveedorRut ?? ordenSeleccionada.proveedor_rut}) · Condición
                  de pago:{" "}
                  <strong>
                    {ordenSeleccionada.CondicionPago ?? ordenSeleccionada.condicion_pago ?? "30 días"}
                  </strong>{" "}
                  · Total OC:{" "}
                  <strong>
                    {formatCurrency(
                      ordenSeleccionada.TotalOrden ?? ordenSeleccionada.total_orden ?? 0
                    )}
                  </strong>
                </p>
              </div>
              <button
                type="button"
                className="compras-btn compras-btn--ghost"
                onClick={() => {
                  setOrdenSeleccionada(null);
                  setErrorFormulario("");
                  setFacturaDuplicada(null);
                }}
              >
                Cancelar
              </button>
            </div>

            {errorFormulario && (
              <div
                className="compras-alert compras-alert--error"
                role="alert"
                style={{ marginBottom: "1rem" }}
              >
                <strong>Error:</strong> {errorFormulario}
                {facturaDuplicada && (
                  <div
                    style={{
                      marginTop: "0.6rem",
                      padding: "0.75rem",
                      background: "#fff",
                      borderRadius: "8px",
                      border: "1px solid #fca5a5",
                      color: "#1e293b",
                    }}
                  >
                    <strong>Factura existente encontrada:</strong> Factura N°{" "}
                    <strong>
                      {facturaDuplicada.NroFactura ?? facturaDuplicada.nro_factura}
                    </strong>{" "}
                    (ID #{facturaDuplicada.IdFactura ?? facturaDuplicada.id_factura}) · Orden #
                    {facturaDuplicada.IdOc ?? facturaDuplicada.id_oc} · Proveedor:{" "}
                    {facturaDuplicada.ProveedorNombre ?? facturaDuplicada.proveedor} · Emisión:{" "}
                    {facturaDuplicada.FechaEmision ?? facturaDuplicada.fecha_emision} · Total:{" "}
                    <strong>
                      {formatCurrency(
                        facturaDuplicada.MontoTotal ?? facturaDuplicada.monto_total ?? 0
                      )}
                    </strong>{" "}
                    · Estado:{" "}
                    <strong>
                      {facturaDuplicada.EstadoPago ?? facturaDuplicada.estado_pago}
                    </strong>
                  </div>
                )}
              </div>
            )}

            <div className="compras-table-wrap" style={{ marginBottom: "1.25rem" }}>
              <table className="compras-table">
                <thead>
                  <tr>
                    <th>ISBN</th>
                    <th>Libro</th>
                    <th>Cantidad OC</th>
                    <th>Precio Pactado</th>
                    <th>IVA %</th>
                    <th>Subtotal Neto</th>
                  </tr>
                </thead>
                <tbody>
                  {(ordenSeleccionada.Lineas || ordenSeleccionada.lineas || []).map((l) => (
                    <tr key={l.Isbn ?? l.isbn}>
                      <td>{l.Isbn ?? l.isbn}</td>
                      <td>{l.Titulo ?? l.titulo}</td>
                      <td>{l.Cantidad ?? l.cantidad}</td>
                      <td>{formatCurrency(l.PrecioPactado ?? l.precio_pactado ?? 0)}</td>
                      <td>{l.IvaPorcentaje ?? l.iva_porcentaje ?? 19}%</td>
                      <td>{formatCurrency(l.SubtotalNeto ?? l.subtotal_neto ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <form onSubmit={handleConfirmarFactura}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "1rem",
                  marginBottom: "1.25rem",
                }}
              >
                <div className="compras-field">
                  <label htmlFor="factura-nro">Número de factura *</label>
                  <input
                    id="factura-nro"
                    type="text"
                    className="compras-input"
                    placeholder="Ej: F-70010"
                    value={nroFactura}
                    onChange={(e) => setNroFactura(e.target.value)}
                    maxLength={50}
                    required
                  />
                </div>

                <div className="compras-field">
                  <label htmlFor="factura-emision">Fecha de emisión *</label>
                  <input
                    id="factura-emision"
                    type="date"
                    className="compras-input"
                    max={hoyIso()}
                    value={fechaEmision}
                    onChange={(e) => setFechaEmision(e.target.value)}
                    required
                  />
                  {calculos.emisionFutura && (
                    <small style={{ color: "#dc2626" }}>
                      La fecha de emisión no puede ser futura.
                    </small>
                  )}
                </div>

                <div className="compras-field">
                  <label htmlFor="factura-vencimiento">Fecha de vencimiento *</label>
                  <input
                    id="factura-vencimiento"
                    type="date"
                    className="compras-input"
                    min={fechaEmision || undefined}
                    value={fechaVencimiento}
                    onChange={(e) => setFechaVencimiento(e.target.value)}
                    required
                  />
                  {calculos.vencimientoAnterior && (
                    <small style={{ color: "#dc2626" }}>
                      El vencimiento no puede ser anterior a la emisión.
                    </small>
                  )}
                </div>

                <div className="compras-field">
                  <label htmlFor="factura-neto">Monto Neto ($) *</label>
                  <input
                    id="factura-neto"
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="compras-input"
                    value={montoNeto}
                    onChange={(e) => setMontoNeto(e.target.value)}
                    required
                  />
                </div>

                <div className="compras-field">
                  <label htmlFor="factura-iva">IVA ($) *</label>
                  <input
                    id="factura-iva"
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="compras-input"
                    value={iva}
                    onChange={(e) => setIva(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div
                style={{
                  padding: "1rem 1.25rem",
                  borderRadius: "10px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  marginBottom: "1.25rem",
                }}
              >
                <h3 style={{ marginTop: 0, marginBottom: "0.5rem", fontSize: "1rem" }}>
                  Resumen de la factura a registrar
                </h3>
                <p style={{ margin: "0.25rem 0" }}>
                  Orden asociada: <strong>#{ordenSeleccionada.IdOc ?? ordenSeleccionada.id_oc}</strong>{" "}
                  · Proveedor:{" "}
                  <strong>
                    {ordenSeleccionada.ProveedorNombre ?? ordenSeleccionada.proveedor}
                  </strong>
                </p>
                <p style={{ margin: "0.25rem 0" }}>
                  Factura N°: <strong>{nroFactura.trim() || "—"}</strong> · Emisión:{" "}
                  <strong>{fechaEmision || "—"}</strong> · Vencimiento:{" "}
                  <strong>{fechaVencimiento || "—"}</strong>
                </p>
                <p style={{ margin: "0.25rem 0" }}>
                  Monto Neto: <strong>{formatCurrency(calculos.netoValido)}</strong> + IVA:{" "}
                  <strong>{formatCurrency(calculos.ivaValido)}</strong> = Total Factura:{" "}
                  <strong>{formatCurrency(calculos.totalCalculado)}</strong>
                </p>
                <p style={{ margin: "0.25rem 0 0" }}>
                  Estado inicial al guardar: <strong>pendiente de conciliacion</strong>
                </p>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button
                  type="submit"
                  className="compras-btn compras-btn--primary"
                  disabled={guardando}
                >
                  {guardando ? "Registrando factura..." : "Confirmar y registrar factura"}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="compras-panel" style={{ marginTop: "1.5rem" }}>
          <div className="compras-panel-header">
            <div>
              <h2>Facturas de proveedor registradas</h2>
              <p>Historial de facturas asociadas a órdenes de compra.</p>
            </div>
          </div>

          {facturasRegistradas.length === 0 ? (
            <p className="compras-empty">No hay facturas registradas.</p>
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
                  </tr>
                </thead>
                <tbody>
                  {facturasRegistradas.map((f) => {
                    const idFac = f.IdFactura ?? f.id_factura;
                    const nro = f.NroFactura ?? f.nro_factura;
                    const idOc = f.IdOc ?? f.id_oc;
                    const prov = f.ProveedorNombre ?? f.proveedor;
                    const emision = f.FechaEmision ?? f.fecha_emision;
                    const venc = f.FechaVencimiento ?? f.fecha_vencimiento ?? "—";
                    const neto = Number(f.MontoNeto ?? f.monto_neto ?? 0);
                    const ivaVal = Number(f.Iva ?? f.iva ?? 0);
                    const total = Number(f.MontoTotal ?? f.monto_total ?? 0);
                    const estado = f.EstadoPago ?? f.estado_pago;

                    return (
                      <tr key={idFac}>
                        <td>#{idFac}</td>
                        <td>
                          <strong>{nro}</strong>
                        </td>
                        <td>#{idOc}</td>
                        <td>{prov}</td>
                        <td>{emision}</td>
                        <td>{venc}</td>
                        <td>{formatCurrency(neto)}</td>
                        <td>{formatCurrency(ivaVal)}</td>
                        <td>
                          <strong>{formatCurrency(total)}</strong>
                        </td>
                        <td>
                          <span className="compras-badge compras-badge--info">{estado}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </ErpModuleShell>
  );
}

