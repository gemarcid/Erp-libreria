"use client";

import { useEffect, useMemo, useState } from "react";
import ErpModuleShell from "@/components/ErpModuleShell";
import ErpIcon from "@/components/ErpIcon";
import { useAuth } from "@/components/AuthProvider";
import VentasNav from "@/components/VentasNav";
import { moduleAccessLevel } from "@/lib/module-access";

function formatMoney(value) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

export default function VentasPage() {
  const { usuario } = useAuth();
  const puedeRegistrar = moduleAccessLevel(usuario, "ventas") >= 2;

  // Estado Cliente
  const [clienteBusqueda, setClienteBusqueda] = useState("");
  const [clientes, setClientes] = useState([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [buscandoClientes, setBuscandoClientes] = useState(false);

  // Estado Productos / POS
  const [productoBusqueda, setProductoBusqueda] = useState("");
  const [libros, setLibros] = useState([]);
  const [buscandoLibros, setBuscandoLibros] = useState(false);
  const [detalles, setDetalles] = useState([]);

  // Promociones y Fidelización
  const [promociones, setPromociones] = useState([]);
  const [canjearPuntos, setCanjearPuntos] = useState(false);
  const [puntosACanjear, setPuntosACanjear] = useState(0);

  // Opciones de Facturación
  const [canal, setCanal] = useState("tienda fisica");
  const [formaPago, setFormaPago] = useState("efectivo");
  const [tipoDocumento, setTipoDocumento] = useState("boleta");

  // Transacción
  const [registrando, setRegistrando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [comprobanteEmitido, setComprobanteEmitido] = useState(null);

  // Cargar promociones activas
  useEffect(() => {
    async function cargarPromos() {
      try {
        const res = await fetch("/api/ventas/promociones?activas=true", { cache: "no-store" });
        const data = await res.json();
        if (data.promociones) setPromociones(data.promociones);
      } catch {}
    }
    cargarPromos();
  }, []);

  // Buscar clientes
  useEffect(() => {
    const texto = clienteBusqueda.trim();
    if (!texto) {
      setClientes([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setBuscandoClientes(true);
      setError("");

      try {
        const response = await fetch(
          `/api/ventas/clientes?buscar=${encodeURIComponent(texto)}`,
          { cache: "no-store", signal: controller.signal },
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "No se pudieron buscar clientes.");
        setClientes(Array.isArray(result) ? result : result.clientes || []);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message || "No se pudieron buscar clientes.");
        }
      } finally {
        if (!controller.signal.aborted) setBuscandoClientes(false);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [clienteBusqueda]);

  // Buscar libros
  useEffect(() => {
    const texto = productoBusqueda.trim();
    if (!texto) {
      setLibros([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setBuscandoLibros(true);
      setError("");

      try {
        const response = await fetch(
          `/api/ventas/libros?buscar=${encodeURIComponent(texto)}`,
          { cache: "no-store", signal: controller.signal },
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "No se pudieron buscar libros.");
        setLibros(Array.isArray(result) ? result : result.libros || []);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message || "No se pudieron buscar libros.");
        }
      } finally {
        if (!controller.signal.aborted) setBuscandoLibros(false);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [productoBusqueda]);

  // Soporte escáner código de barras ISBN (Enter)
  async function manejarEnterScanner(e) {
    if (e.key === "Enter" && productoBusqueda.trim()) {
      e.preventDefault();
      const query = productoBusqueda.trim();
      try {
        const response = await fetch(`/api/ventas/libros?buscar=${encodeURIComponent(query)}`);
        const result = await response.json();
        const lista = Array.isArray(result) ? result : result.libros || [];
        const matchExacto = lista.find(
          (l) => l.isbn.replace(/-/g, "") === query.replace(/-/g, "") || l.isbn === query,
        );
        if (matchExacto) {
          agregarProducto(matchExacto);
          setProductoBusqueda("");
          setLibros([]);
        } else if (lista.length === 1) {
          agregarProducto(lista[0]);
          setProductoBusqueda("");
          setLibros([]);
        }
      } catch {}
    }
  }

  function agregarProducto(libro) {
    setError("");
    setMensaje("");

    if (Number(libro.stock_actual) <= 0) {
      setError(`El libro "${libro.titulo}" no cuenta con stock disponible en este momento.`);
      return;
    }

    setDetalles((actuales) => {
      const existente = actuales.find((d) => d.isbn === libro.isbn);
      if (existente) {
        if (existente.cantidad >= Number(libro.stock_actual)) {
          setError(`Stock insuficiente. Sólo hay ${libro.stock_actual} unidad(es) de "${libro.titulo}".`);
          return actuales;
        }
        return actuales.map((d) =>
          d.isbn === libro.isbn ? { ...d, cantidad: d.cantidad + 1 } : d,
        );
      }

      return [
        ...actuales,
        {
          isbn: libro.isbn,
          titulo: libro.titulo,
          autor: libro.autor,
          categoria: libro.categoria,
          precio_unitario: Number(libro.precio_venta),
          stock_actual: Number(libro.stock_actual),
          cantidad: 1,
        },
      ];
    });
  }

  function cambiarCantidad(isbn, cantidad) {
    const valor = Number(cantidad);
    if (!Number.isInteger(valor) || valor < 1) return;

    setDetalles((actuales) =>
      actuales.map((d) => {
        if (d.isbn !== isbn) return d;
        if (valor > d.stock_actual) {
          setError(`No puedes agregar más de ${d.stock_actual} unidades.`);
          return { ...d, cantidad: d.stock_actual };
        }
        return { ...d, cantidad: valor };
      }),
    );
  }

  function eliminarProducto(isbn) {
    setDetalles((actuales) => actuales.filter((d) => d.isbn !== isbn));
  }

  // Cálculos automáticos de Promociones y Descuentos
  const { subtotalBruto, descuentoPromocion, promocionAplicadaNombre } = useMemo(() => {
    let subtotal = 0;
    let descPromo = 0;
    let promoNombre = "";

    detalles.forEach((item) => {
      const itemSubtotal = item.precio_unitario * item.cantidad;
      subtotal += itemSubtotal;

      // Buscar si aplica alguna promoción
      const promo = promociones.find(
        (p) =>
          p.activo &&
          ((p.isbn && p.isbn === item.isbn) ||
            (p.categoria && item.categoria && p.categoria.toLowerCase() === item.categoria.toLowerCase())),
      );

      if (promo) {
        promoNombre = promo.nombre;
        if (promo.tipo === "porcentaje") {
          descPromo += Math.round(itemSubtotal * (Number(promo.valor) / 100));
        } else if (promo.tipo === "monto_fijo") {
          descPromo += Number(promo.valor);
        } else if (promo.tipo === "2x1" && item.cantidad >= 2) {
          const gratis = Math.floor(item.cantidad / 2);
          descPromo += gratis * item.precio_unitario;
        }
      }
    });

    return {
      subtotalBruto: subtotal,
      descuentoPromocion: descPromo,
      promocionAplicadaNombre: promoNombre,
    };
  }, [detalles, promociones]);

  // Descuento por puntos de fidelidad
  const descuentoPuntos = useMemo(() => {
    if (!canjearPuntos || puntosACanjear <= 0) return 0;
    return puntosACanjear * 10; // $10 CLP por cada punto
  }, [canjearPuntos, puntosACanjear]);

  const totalDescuentos = descuentoPromocion + descuentoPuntos;
  const neto = Math.max(0, subtotalBruto - totalDescuentos);
  const iva = Math.round(neto * 0.19);
  const total = neto + iva;

  // Actualizar puntos máximos a canjear
  useEffect(() => {
    if (clienteSeleccionado) {
      const maxPuntos = clienteSeleccionado.puntos_fidelidad || 0;
      setPuntosACanjear(Math.min(maxPuntos, Math.floor(subtotalBruto / 10)));
    } else {
      setCanjearPuntos(false);
      setPuntosACanjear(0);
    }
  }, [clienteSeleccionado, subtotalBruto]);

  async function registrarVenta() {
    setError("");
    setMensaje("");

    if (!clienteSeleccionado) {
      setError("Debes seleccionar un cliente para emitir el comprobante (Boleta o Factura).");
      return;
    }

    if (detalles.length === 0) {
      setError("El carro está vacío. Escanea o busca libros para agregar.");
      return;
    }

    if (!usuario?.id_usuario) {
      setError("No se pudo identificar la sesión activa.");
      return;
    }

    setRegistrando(true);

    try {
      const body = {
        id_cliente: Number(clienteSeleccionado.id_cliente),
        id_usuario: Number(usuario.id_usuario),
        canal: canal,
        forma_pago: canjearPuntos && puntosACanjear > 0 && total === 0 ? "puntos" : formaPago,
        tipo_documento: tipoDocumento,
        descuento: totalDescuentos,
        puntos_canjeados: canjearPuntos ? puntosACanjear : 0,
        detalles: detalles.map((d) => ({
          isbn: d.isbn,
          cantidad: d.cantidad,
        })),
      };

      const response = await fetch("/api/ventas/registrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "No se pudo registrar la venta.");
      }

      setComprobanteEmitido({
        id_venta: result.id_venta,
        folio: result.folio || `V-${result.id_venta}`,
        fecha: new Date().toLocaleString("es-CL"),
        cliente: clienteSeleccionado,
        cajero: usuario.nombre || "Cajero POS",
        items: [...detalles],
        subtotal: subtotalBruto,
        descuento: totalDescuentos,
        neto: neto,
        iva: iva,
        total: total,
        forma_pago: formaPago,
        tipo_documento: tipoDocumento,
        canal: canal,
        id_asiento: result.id_asiento,
        puntos_ganados: result.puntos_ganados || Math.floor(total / 1000),
      });

      setMensaje(`Venta #${result.id_venta} finalizada con éxito.`);
      setDetalles([]);
      setClienteSeleccionado(null);
      setClienteBusqueda("");
      setProductoBusqueda("");
      setLibros([]);
      setCanjearPuntos(false);
    } catch (err) {
      setError(err.message || "Error al procesar el cobro.");
    } finally {
      setRegistrando(false);
    }
  }

  return (
    <ErpModuleShell
      module="ventas"
      liveData
      title="Punto de Venta (POS) y Facturación"
      description="Emisión de boletas y facturas electrónicas con control de inventario en tiempo real y descuentos comerciales."
      subnav={<VentasNav />}
    >
      <div className="ventas-layout">
        {error && (
          <div className="ventas-message ventas-message-error" role="alert">
            <ErpIcon name="info" />
            <span>{error}</span>
          </div>
        )}

        {mensaje && (
          <div className="ventas-message ventas-message-success" role="status">
            <ErpIcon name="info" />
            <span>{mensaje}</span>
          </div>
        )}

        {/* 1. SECCIÓN CLIENTE */}
        <section className="erp-card ventas-card">
          <div className="erp-section-heading">
            <div>
              <p className="erp-eyebrow">INFORMACIÓN TRIBUTARIA</p>
              <h2>Cliente y Facturación</h2>
            </div>
            {clienteSeleccionado && (
              <span className="erp-badge erp-badge-green">Identificado</span>
            )}
          </div>

          {clienteSeleccionado ? (
            <div className="ventas-selected" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <strong>{clienteSeleccionado.nombre}</strong>
                <small style={{ display: "block", marginTop: "2px" }}>
                  RUT: {clienteSeleccionado.rut} · Tipo: <b style={{ textTransform: "capitalize" }}>{clienteSeleccionado.tipo_cliente}</b>
                </small>
                <div style={{ marginTop: "4px", fontSize: "0.85rem", color: "#1a5c38" }}>
                  ★ <strong>{clienteSeleccionado.puntos_fidelidad || 0}</strong> puntos de lectura acumulados
                </div>
              </div>

              <button
                type="button"
                className="module-secondary-button"
                onClick={() => {
                  setClienteSeleccionado(null);
                  setClienteBusqueda("");
                  setClientes([]);
                }}
              >
                Cambiar
              </button>
            </div>
          ) : (
            <>
              <label className="erp-search ventas-search">
                <ErpIcon name="search" />
                <input
                  type="search"
                  placeholder="Buscar cliente por RUT o Nombre..."
                  value={clienteBusqueda}
                  onChange={(e) => setClienteBusqueda(e.target.value)}
                />
              </label>

              {buscandoClientes && <p className="ventas-loading">Buscando clientes...</p>}

              {clientes.length > 0 && (
                <div className="ventas-results">
                  {clientes.map((c) => (
                    <button
                      type="button"
                      key={c.id_cliente}
                      className="ventas-result"
                      onClick={() => {
                        setClienteSeleccionado(c);
                        setClientes([]);
                        setClienteBusqueda("");
                      }}
                    >
                      <span className="erp-avatar">
                        {c.nombre?.slice(0, 2).toUpperCase()}
                      </span>
                      <span>
                        <strong>{c.nombre}</strong>
                        <small>{c.rut} · {c.tipo_cliente} · {c.puntos_fidelidad || 0} pts</small>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Opciones de fidelización */}
          {clienteSeleccionado && clienteSeleccionado.puntos_fidelidad > 0 && (
            <div style={{ marginTop: "1rem", padding: "0.8rem", background: "#f8faf9", borderRadius: "8px", border: "1px dashed #2d7a4f" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={canjearPuntos}
                  onChange={(e) => setCanjearPuntos(e.target.checked)}
                />
                <span style={{ fontSize: "0.9rem" }}>
                  Canjear <strong>{puntosACanjear}</strong> puntos de fidelidad por un descuento de <strong>{formatMoney(descuentoPuntos)}</strong>
                </span>
              </label>
            </div>
          )}
        </section>

        {/* 2. SECCIÓN AGREGAR LIBROS / ESCÁNER */}
        <section className="erp-card ventas-card">
          <div className="erp-section-heading">
            <div>
              <p className="erp-eyebrow">PUNTO DE VENTA (POS)</p>
              <h2>Escanear o Buscar Libros</h2>
            </div>
            <span style={{ fontSize: "0.8rem", color: "#666" }}>
              Listo para lector de código de barras
            </span>
          </div>

          <label className="erp-search ventas-search">
            <ErpIcon name="search" />
            <input
              type="search"
              placeholder="Escanea el código de barras (ISBN) o escribe el título y pulsa Enter..."
              value={productoBusqueda}
              onChange={(e) => setProductoBusqueda(e.target.value)}
              onKeyDown={manejarEnterScanner}
            />
          </label>

          {buscandoLibros && <p className="ventas-loading">Consultando disponibilidad en catálogo...</p>}

          {libros.length > 0 && (
            <div className="ventas-book-results">
              {libros.map((libro) => {
                const sinStock = Number(libro.stock_actual) <= 0;
                return (
                  <div key={libro.isbn} className="ventas-book-result">
                    <div className="ventas-book-info">
                      <strong>{libro.titulo}</strong>
                      <small>{libro.autor} · {libro.categoria || "General"} · ISBN: {libro.isbn}</small>
                    </div>

                    <div className="ventas-book-stock">
                      <span>{formatMoney(libro.precio_venta)}</span>
                      <small style={{ color: sinStock ? "#c0392b" : "#27ae60", fontWeight: "bold" }}>
                        {sinStock ? "Agotado" : `Stock: ${libro.stock_actual}`}
                      </small>
                    </div>

                    <button
                      type="button"
                      className="module-secondary-button"
                      disabled={sinStock}
                      onClick={() => agregarProducto(libro)}
                    >
                      {sinStock ? "Sin stock" : "Agregar"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 3. RESUMEN DE LA ORDEN Y COBRO */}
        <section className="erp-card ventas-card">
          <div className="erp-section-heading">
            <div>
              <p className="erp-eyebrow">DETALLE DE VENTA</p>
              <h2>Resumen del Carro</h2>
            </div>
            <span className="ventas-count">{detalles.length} ítem(s)</span>
          </div>

          {detalles.length === 0 ? (
            <div className="ventas-empty">
              <ErpIcon name="book" />
              <strong>El carro de venta está vacío</strong>
              <p>Escanea un código de barras o busca libros para comenzar.</p>
            </div>
          ) : (
            <div className="ventas-detail-list">
              {detalles.map((detalle) => (
                <div key={detalle.isbn} className="ventas-detail-item">
                  <div className="ventas-detail-info">
                    <strong>{detalle.titulo}</strong>
                    <small>{formatMoney(detalle.precio_unitario)} c/u · Stock: {detalle.stock_actual}</small>
                  </div>

                  <div className="ventas-quantity">
                    <label>
                      <span>Cant:</span>
                      <input
                        type="number"
                        min="1"
                        max={detalle.stock_actual}
                        value={detalle.cantidad}
                        onChange={(e) => cambiarCantidad(detalle.isbn, e.target.value)}
                      />
                    </label>
                  </div>

                  <div className="ventas-subtotal">
                    <strong>{formatMoney(detalle.precio_unitario * detalle.cantidad)}</strong>
                  </div>

                  <button
                    type="button"
                    className="ventas-remove"
                    title="Quitar libro"
                    onClick={() => eliminarProducto(detalle.isbn)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Configuración de pago y documento */}
          <div className="ventas-form-grid" style={{ marginTop: "1.5rem" }}>
            <label className="module-select-label">
              <span>Canal de Venta</span>
              <select value={canal} onChange={(e) => setCanal(e.target.value)}>
                <option value="tienda fisica">Tienda Física (Casa Matriz)</option>
                <option value="tienda digital">Tienda Digital (Online)</option>
                <option value="retiro en tienda">Retiro en Tienda (Click & Collect)</option>
              </select>
            </label>

            <label className="module-select-label">
              <span>Tipo de Documento</span>
              <select value={tipoDocumento} onChange={(e) => setTipoDocumento(e.target.value)}>
                <option value="boleta">Boleta Electrónica</option>
                <option value="factura">Factura Electrónica</option>
              </select>
            </label>

            <label className="module-select-label">
              <span>Forma de Pago</span>
              <select value={formaPago} onChange={(e) => setFormaPago(e.target.value)}>
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta (Débito/Crédito POS)</option>
                <option value="transferencia">Transferencia Bancaria</option>
              </select>
            </label>
          </div>

          {/* Caja de Totales */}
          <div className="ventas-total-box" style={{ marginTop: "1rem" }}>
            <div>
              <span>Subtotal Bruto:</span>
              <strong>{formatMoney(subtotalBruto)}</strong>
            </div>

            {descuentoPromocion > 0 && (
              <div style={{ color: "#2d7a4f" }}>
                <span>Promoción ({promocionAplicadaNombre || "Comercial"}):</span>
                <strong>- {formatMoney(descuentoPromocion)}</strong>
              </div>
            )}

            {descuentoPuntos > 0 && (
              <div style={{ color: "#2d7a4f" }}>
                <span>Canje Puntos de Lectura ({puntosACanjear} pts):</span>
                <strong>- {formatMoney(descuentoPuntos)}</strong>
              </div>
            )}

            <div>
              <span>Neto:</span>
              <strong>{formatMoney(neto)}</strong>
            </div>

            <div>
              <span>IVA (19%):</span>
              <strong>{formatMoney(iva)}</strong>
            </div>

            <div className="ventas-grand-total">
              <span>Total a Pagar:</span>
              <strong>{formatMoney(total)}</strong>
            </div>
          </div>

          <div className="ventas-actions" style={{ marginTop: "1.2rem" }}>
            <button
              type="button"
              className="erp-primary-button"
              disabled={registrando || detalles.length === 0 || !clienteSeleccionado || !puedeRegistrar}
              onClick={registrarVenta}
              style={{ width: "100%", padding: "0.9rem", fontSize: "1.05rem" }}
            >
              {registrando ? "Procesando Cobro..." : `Confirmar Cobro · ${formatMoney(total)}`}
            </button>
          </div>
        </section>

        {/* Modal de Comprobante / Éxito */}
        {comprobanteEmitido && (
          <div className="erp-modal-overlay" style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center",
            justifyContent: "center", zIndex: 1000
          }}>
            <div className="erp-card" style={{ maxWidth: "480px", width: "95%", textAlign: "center", padding: "2rem" }}>
              <div style={{ fontSize: "3rem", color: "#27ae60", marginBottom: "0.5rem" }}>✓</div>
              <h2 style={{ marginBottom: "0.2rem" }}>¡Venta Confirmada!</h2>
              <p style={{ color: "#666", marginBottom: "1.2rem" }}>
                {comprobanteEmitido.tipo_documento.toUpperCase()} ELECTRÓNICA
              </p>

              <div style={{ background: "#fcfbf7", padding: "1rem", borderRadius: "8px", border: "1px dashed #d5d0c2", textAlign: "left", fontSize: "0.9rem", lineHeight: "1.6" }}>
                <div><strong>Folio:</strong> {comprobanteEmitido.folio}</div>
                <div><strong>Fecha:</strong> {comprobanteEmitido.fecha}</div>
                <div><strong>Cliente:</strong> {comprobanteEmitido.cliente.nombre} ({comprobanteEmitido.cliente.rut})</div>
                <div><strong>Canal:</strong> {comprobanteEmitido.canal}</div>
                <div><strong>Forma de Pago:</strong> {comprobanteEmitido.forma_pago}</div>
                <div><strong>Asiento Contable:</strong> #{comprobanteEmitido.id_asiento}</div>
                <hr style={{ margin: "0.8rem 0", borderColor: "#e5e0d2" }} />
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Total Pagado:</span>
                  <strong style={{ fontSize: "1.1rem" }}>{formatMoney(comprobanteEmitido.total)}</strong>
                </div>
                {comprobanteEmitido.puntos_ganados > 0 && (
                  <div style={{ color: "#1a5c38", marginTop: "4px" }}>
                    ★ Cliente acumuló +{comprobanteEmitido.puntos_ganados} puntos de fidelidad
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: "0.8rem", marginTop: "1.5rem", justifyContent: "center" }}>
                <button
                  type="button"
                  className="erp-button erp-button-secondary"
                  onClick={() => window.print()}
                >
                  <ErpIcon name="clipboard" /> Imprimir Comprobante
                </button>
                <button
                  type="button"
                  className="erp-button erp-button-primary"
                  onClick={() => setComprobanteEmitido(null)}
                >
                  Nueva Venta
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ErpModuleShell>
  );
}
