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

  const [clienteBusqueda, setClienteBusqueda] = useState("");
  const [clientes, setClientes] = useState([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [buscandoClientes, setBuscandoClientes] = useState(false);

  const [productoBusqueda, setProductoBusqueda] = useState("");
  const [libros, setLibros] = useState([]);
  const [buscandoLibros, setBuscandoLibros] = useState(false);

  const [detalles, setDetalles] = useState([]);

  const [formaPago, setFormaPago] = useState("efectivo");
  const [tipoDocumento, setTipoDocumento] = useState("boleta");

  const [registrando, setRegistrando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  /*
   * ------------------------------------------------------------
   * BUSCAR CLIENTES
   * ------------------------------------------------------------
   */

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
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "No se pudieron buscar clientes.");
        }

        setClientes(Array.isArray(result) ? result : result.clientes || []);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message || "No se pudieron buscar clientes.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setBuscandoClientes(false);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [clienteBusqueda]);

  /*
   * ------------------------------------------------------------
   * BUSCAR LIBROS
   * ------------------------------------------------------------
   */

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
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "No se pudieron buscar libros.");
        }

        setLibros(Array.isArray(result) ? result : result.libros || []);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message || "No se pudieron buscar libros.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setBuscandoLibros(false);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [productoBusqueda]);

  /*
   * ------------------------------------------------------------
   * AGREGAR PRODUCTO
   * ------------------------------------------------------------
   */

  function agregarProducto(libro) {
    setError("");
    setMensaje("");

    if (Number(libro.stock_actual) <= 0) {
      setError("Este libro no tiene stock disponible.");
      return;
    }

    setDetalles((actuales) => {
      const existente = actuales.find(
        (detalle) => detalle.isbn === libro.isbn,
      );

      if (existente) {
        if (existente.cantidad >= Number(libro.stock_actual)) {
          setError("No puedes agregar más unidades que el stock disponible.");
          return actuales;
        }

        return actuales.map((detalle) =>
          detalle.isbn === libro.isbn
            ? {
                ...detalle,
                cantidad: detalle.cantidad + 1,
              }
            : detalle,
        );
      }

      return [
        ...actuales,
        {
          isbn: libro.isbn,
          titulo: libro.titulo,
          autor: libro.autor,
          precio_unitario: Number(libro.precio_venta),
          stock_actual: Number(libro.stock_actual),
          cantidad: 1,
        },
      ];
    });
  }

  /*
   * ------------------------------------------------------------
   * CANTIDAD
   * ------------------------------------------------------------
   */

  function cambiarCantidad(isbn, cantidad) {
    const valor = Number(cantidad);

    if (!Number.isInteger(valor) || valor < 1) {
      return;
    }

    setDetalles((actuales) =>
      actuales.map((detalle) => {
        if (detalle.isbn !== isbn) {
          return detalle;
        }

        return {
          ...detalle,
          cantidad: Math.min(valor, detalle.stock_actual),
        };
      }),
    );
  }

  function eliminarProducto(isbn) {
    setDetalles((actuales) =>
      actuales.filter((detalle) => detalle.isbn !== isbn),
    );
  }

  /*
   * ------------------------------------------------------------
   * TOTALES
   * ------------------------------------------------------------
   */

  const neto = useMemo(
    () =>
      detalles.reduce(
        (total, detalle) =>
          total + detalle.precio_unitario * detalle.cantidad,
        0,
      ),
    [detalles],
  );

  const iva = useMemo(() => Math.round(neto * 0.19), [neto]);

  const descuento = 0;

  const total = neto + iva - descuento;

  /*
   * ------------------------------------------------------------
   * REGISTRAR VENTA
   * ------------------------------------------------------------
   */

  async function registrarVenta() {
    setError("");
    setMensaje("");

    if (!clienteSeleccionado) {
      setError("Selecciona un cliente antes de registrar la venta.");
      return;
    }

    if (detalles.length === 0) {
      setError("Agrega al menos un libro a la venta.");
      return;
    }

    if (!usuario?.id_usuario) {
      setError("No se pudo identificar al usuario de la sesión.");
      return;
    }

    setRegistrando(true);

    try {
      const body = {
        id_cliente: Number(clienteSeleccionado.id_cliente),
        id_usuario: Number(usuario.id_usuario),
        canal: "tienda",
        forma_pago: formaPago,
        tipo_documento: tipoDocumento,
        detalles: detalles.map((detalle) => ({
          isbn: detalle.isbn,
          cantidad: detalle.cantidad,
        })),
      };

      const response = await fetch("/api/ventas/registrar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "No se pudo registrar la venta.",
        );
      }

      setMensaje(
        `Venta #${result.id_venta} registrada correctamente por ${formatMoney(
          result.total,
        )}. Asiento contable #${result.id_asiento}.`,
      );

      setDetalles([]);
      setClienteSeleccionado(null);
      setClienteBusqueda("");
      setClientes([]);
      setProductoBusqueda("");
      setLibros([]);
      setFormaPago("efectivo");
      setTipoDocumento("boleta");
    } catch (err) {
      setError(err.message || "No se pudo registrar la venta.");
    } finally {
      setRegistrando(false);
    }
  }

  /*
   * ------------------------------------------------------------
   * RENDER
   * ------------------------------------------------------------
   */

  return (
    <ErpModuleShell
      module="ventas"
      liveData
      title="Ventas"
      description="Registra las ventas de la librería y gestiona sus productos."
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
          <div
            className="ventas-message ventas-message-success"
            role="status"
          >
            <ErpIcon name="info" />
            <span>{mensaje}</span>
          </div>
        )}

        <section className="erp-card ventas-card">
          <div className="erp-section-heading">
            <div>
              <p className="erp-eyebrow">CLIENTE</p>
              <h2>Seleccionar cliente</h2>
            </div>
          </div>

          {clienteSeleccionado ? (
            <div className="ventas-selected">
              <div>
                <strong>{clienteSeleccionado.nombre}</strong>
                <small>
                  {clienteSeleccionado.rut} ·{" "}
                  {clienteSeleccionado.tipo_cliente}
                </small>
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
                  placeholder="Buscar por RUT o nombre..."
                  value={clienteBusqueda}
                  onChange={(event) =>
                    setClienteBusqueda(event.target.value)
                  }
                />
              </label>

              {buscandoClientes && (
                <p className="ventas-loading">Buscando clientes...</p>
              )}

              {clientes.length > 0 && (
                <div className="ventas-results">
                  {clientes.map((cliente) => (
                    <button
                      type="button"
                      key={cliente.id_cliente}
                      className="ventas-result"
                      onClick={() => {
                        setClienteSeleccionado(cliente);
                        setClientes([]);
                        setClienteBusqueda("");
                      }}
                    >
                      <span className="erp-avatar">
                        {cliente.nombre
                          ?.split(" ")
                          .map((part) => part[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </span>

                      <span>
                        <strong>{cliente.nombre}</strong>
                        <small>
                          {cliente.rut} · {cliente.tipo_cliente}
                        </small>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        <section className="erp-card ventas-card">
          <div className="erp-section-heading">
            <div>
              <p className="erp-eyebrow">PRODUCTOS</p>
              <h2>Agregar libros</h2>
            </div>
          </div>

          <label className="erp-search ventas-search">
            <ErpIcon name="search" />
            <input
              type="search"
              placeholder="Buscar por ISBN, título o autor..."
              value={productoBusqueda}
              onChange={(event) =>
                setProductoBusqueda(event.target.value)
              }
            />
          </label>

          {buscandoLibros && (
            <p className="ventas-loading">Buscando libros...</p>
          )}

          {libros.length > 0 && (
            <div className="ventas-book-results">
              {libros.map((libro) => (
                <div className="ventas-book-result" key={libro.isbn}>
                  <div className="ventas-book-info">
                    <strong>{libro.titulo}</strong>
                    <small>
                      ISBN {libro.isbn}
                      {libro.autor ? ` · ${libro.autor}` : ""}
                    </small>
                  </div>

                  <div className="ventas-book-stock">
                    <span>{formatMoney(libro.precio_venta)}</span>
                    <small>
                      Stock: {Number(libro.stock_actual)}
                    </small>
                  </div>

                  <button
                    type="button"
                    className="module-secondary-button"
                    disabled={Number(libro.stock_actual) <= 0}
                    onClick={() => agregarProducto(libro)}
                  >
                    Agregar
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="erp-card ventas-card ventas-detail-card">
          <div className="erp-section-heading">
            <div>
              <p className="erp-eyebrow">DETALLE DE VENTA</p>
              <h2>Productos seleccionados</h2>
            </div>

            <span className="ventas-count">
              {detalles.length} producto{detalles.length === 1 ? "" : "s"}
            </span>
          </div>

          {detalles.length === 0 ? (
            <div className="ventas-empty">
              <ErpIcon name="book" />
              <strong>No hay productos agregados</strong>
              <span>
                Busca un libro arriba y presiona “Agregar”.
              </span>
            </div>
          ) : (
            <div className="ventas-detail-list">
              {detalles.map((detalle) => (
                <article className="ventas-detail-item" key={detalle.isbn}>
                  <div className="ventas-detail-info">
                    <strong>{detalle.titulo}</strong>
                    <small>
                      ISBN {detalle.isbn} ·{" "}
                      {formatMoney(detalle.precio_unitario)} c/u
                    </small>
                  </div>

                  <div className="ventas-quantity">
                    <label>
                      Cantidad
                      <input
                        type="number"
                        min="1"
                        max={detalle.stock_actual}
                        value={detalle.cantidad}
                        onChange={(event) =>
                          cambiarCantidad(
                            detalle.isbn,
                            event.target.value,
                          )
                        }
                      />
                    </label>
                  </div>

                  <strong className="ventas-subtotal">
                    {formatMoney(
                      detalle.precio_unitario * detalle.cantidad,
                    )}
                  </strong>

                  <button
                    type="button"
                    className="ventas-remove"
                    onClick={() => eliminarProducto(detalle.isbn)}
                    aria-label={`Eliminar ${detalle.titulo}`}
                    title="Eliminar"
                  >
                    ×
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="erp-card ventas-card ventas-summary-card">
          <div className="erp-section-heading">
            <div>
              <p className="erp-eyebrow">PAGO</p>
              <h2>Información de la venta</h2>
            </div>
          </div>

          <div className="ventas-form-grid">
            <label className="module-select-label">
              Forma de pago
              <select
                value={formaPago}
                onChange={(event) => setFormaPago(event.target.value)}
              >
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="transferencia">Transferencia</option>
                <option value="transferencia">Transferencia</option>
              </select>
            </label>

            <label className="module-select-label">
              Tipo de documento
              <select
                value={tipoDocumento}
                onChange={(event) =>
                  setTipoDocumento(event.target.value)
                }
              >
                <option value="boleta">Boleta</option>
                <option value="factura">Factura</option>
              </select>
            </label>
          </div>

          <div className="ventas-total-box">
            <div>
              <span>Neto</span>
              <strong>{formatMoney(neto)}</strong>
            </div>

            <div>
              <span>IVA (19%)</span>
              <strong>{formatMoney(iva)}</strong>
            </div>

            <div>
              <span>Descuento</span>
              <strong>{formatMoney(descuento)}</strong>
            </div>

            <div className="ventas-grand-total">
              <span>Total</span>
              <strong>{formatMoney(total)}</strong>
            </div>
          </div>

          <div className="ventas-actions">
            <button
              type="button"
              className="erp-primary-button"
              disabled={
                !puedeRegistrar ||
                registrando ||
                !clienteSeleccionado ||
                detalles.length === 0
              }
              onClick={registrarVenta}
            >
              {registrando ? "Registrando..." : "Registrar venta"}
            </button>
          </div>
        </section>
      </div>
    </ErpModuleShell>
  );
}
