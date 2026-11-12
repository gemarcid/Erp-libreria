"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { moduleAccessLevel } from "@/lib/module-access";
import ErpModuleShell from "@/components/ErpModuleShell";
import ComprasNav from "@/components/ComprasNav";
import ErpIcon from "@/components/ErpIcon";
import { formatCurrency } from "@/lib/compras-format";
import {
  fetchProveedores,
  fetchProveedorPorId,
  fetchCategoriasProveedor,
  guardarProveedorCatalogo,
} from "@/lib/compras-api";

function validarRutChileno(rutInput) {
  if (!rutInput || !rutInput.trim()) {
    return { valido: false, error: "El RUT es obligatorio." };
  }
  const clean = rutInput.trim().replace(/\./g, "").replace(/-/g, "").toUpperCase();
  if (clean.length < 7 || clean.length > 9) {
    return {
      valido: false,
      error: "El RUT debe contener entre 6 y 8 dígitos más el dígito verificador.",
    };
  }
  const cuerpo = clean.slice(0, -1);
  const dv = clean.slice(-1);
  if (!/^\d+$/.test(cuerpo) || Number(cuerpo) <= 0) {
    return { valido: false, error: "El cuerpo del RUT debe ser numérico." };
  }
  let suma = 0;
  let mult = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * mult;
    mult = mult === 7 ? 2 : mult + 1;
  }
  const resto = 11 - (suma % 11);
  const dvEsperado = resto === 11 ? "0" : resto === 10 ? "K" : String(resto);
  if (dv !== dvEsperado) {
    return { valido: false, error: "El dígito verificador del RUT no es válido." };
  }
  return { valido: true, error: "" };
}

function esCorreoValido(correo) {
  if (!correo || !correo.trim()) return true;
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo.trim());
}

export default function ProveedoresPage() {
  const { usuario, loading: authLoading, error: authError } = useAuth();
  const router = useRouter();

  const [proveedores, setProveedores] = useState([]);
  const [categoriasDisponibles, setCategoriasDisponibles] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorGeneral, setErrorGeneral] = useState("");
  const [mensajeExito, setMensajeExito] = useState("");

  // Filtros del listado
  const [filtroBuscar, setFiltroBuscar] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [filtroCategoria, setFiltroCategoria] = useState("");

  // Modal "Ver" (ficha en modo lectura)
  const [fichaLectura, setFichaLectura] = useState(null);
  const [cargandoFicha, setCargandoFicha] = useState(false);

  // Modal "Nuevo / Editar"
  const [modalFormAbierto, setModalFormAbierto] = useState(false);
  const [idEditando, setIdEditando] = useState(null);
  const [formRut, setFormRut] = useState("");
  const [formRazonSocial, setFormRazonSocial] = useState("");
  const [formContacto, setFormContacto] = useState("");
  const [formCorreo, setFormCorreo] = useState("");
  const [formCondicionPago, setFormCondicionPago] = useState("30 dias");
  const [formLimiteCredito, setFormLimiteCredito] = useState("0");
  const [formDiasCredito, setFormDiasCredito] = useState("30");
  const [formCategorias, setFormCategorias] = useState([]);
  const [formActivo, setFormActivo] = useState(true);

  const [guardando, setGuardando] = useState(false);
  const [errorFormulario, setErrorFormulario] = useState("");
  const [proveedorConflicto, setProveedorConflicto] = useState(null);

  useEffect(() => {
    if (!authLoading && !usuario && !authError) {
      router.replace("/login");
    }
  }, [authLoading, usuario, authError, router]);

  const nivelAcceso = usuario ? moduleAccessLevel(usuario, "compras") : "none";
  const puedeEditar = nivelAcceso === "edit";

  const cargarCategorias = useCallback(async () => {
    if (!usuario) return;
    try {
      const cats = await fetchCategoriasProveedor();
      setCategoriasDisponibles(cats);
    } catch {
      // Silencioso en caso de fallo auxiliar
    }
  }, [usuario]);

  const cargarProveedores = useCallback(async () => {
    if (!usuario) return;
    setCargando(true);
    setErrorGeneral("");
    try {
      const lista = await fetchProveedores(filtroBuscar, {
        estado: filtroEstado === "todos" ? "" : filtroEstado,
        categoria: filtroCategoria,
      });
      setProveedores(lista);
    } catch (err) {
      setErrorGeneral(err.message || "Error al consultar el catálogo de proveedores.");
    } finally {
      setCargando(false);
    }
  }, [usuario, filtroBuscar, filtroEstado, filtroCategoria]);

  useEffect(() => {
    cargarCategorias();
  }, [cargarCategorias]);

  useEffect(() => {
    cargarProveedores();
  }, [cargarProveedores]);

  const abrirVerFicha = async (prov) => {
    const id = prov.idProveedor ?? prov.id_proveedor;
    setCargandoFicha(true);
    setFichaLectura(prov);
    try {
      const fresco = await fetchProveedorPorId(id);
      setFichaLectura(fresco);
    } catch (err) {
      setErrorGeneral(err.message || "No se pudo consultar la ficha del proveedor.");
    } finally {
      setCargandoFicha(false);
    }
  };

  const abrirModalNuevo = () => {
    setIdEditando(null);
    setFormRut("");
    setFormRazonSocial("");
    setFormContacto("");
    setFormCorreo("");
    setFormCondicionPago("30 dias");
    setFormLimiteCredito("0");
    setFormDiasCredito("30");
    setFormCategorias([]);
    setFormActivo(true);
    setErrorFormulario("");
    setProveedorConflicto(null);
    setModalFormAbierto(true);
  };

  const poblarFormularioDesdeProveedor = (prov) => {
    const id = prov.idProveedor ?? prov.id_proveedor;
    const cats = Array.isArray(prov.categorias)
      ? prov.categorias
      : prov.categoriasTexto
        ? String(prov.categoriasTexto)
            .split(",")
            .map((c) => c.trim())
            .filter(Boolean)
        : [];
    setIdEditando(id);
    setFormRut(prov.rut || "");
    setFormRazonSocial(prov.razonSocial ?? prov.razon_social ?? "");
    setFormContacto(prov.contacto || "");
    setFormCorreo(prov.correo || "");
    setFormCondicionPago(prov.condicionPago ?? prov.condicion_pago ?? "");
    setFormLimiteCredito(String(prov.limiteCredito ?? prov.limite_credito ?? 0));
    setFormDiasCredito(String(prov.diasCredito ?? prov.dias_credito ?? 0));
    setFormCategorias(cats);
    setFormActivo(prov.activo !== false);
    setErrorFormulario("");
    setProveedorConflicto(null);
    setModalFormAbierto(true);
  };

  const abrirModalEditar = async (prov) => {
    const id = prov.idProveedor ?? prov.id_proveedor;
    try {
      const fresco = await fetchProveedorPorId(id);
      poblarFormularioDesdeProveedor(fresco);
    } catch {
      poblarFormularioDesdeProveedor(prov);
    }
  };

  const toggleCategoria = (cat) => {
    setFormCategorias((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorFormulario("");
    setProveedorConflicto(null);

    const checkRut = validarRutChileno(formRut);
    if (!checkRut.valido) {
      setErrorFormulario(checkRut.error);
      return;
    }

    if (!formRazonSocial.trim()) {
      setErrorFormulario("La razón social es obligatoria.");
      return;
    }

    if (!esCorreoValido(formCorreo)) {
      setErrorFormulario("El formato del correo electrónico no es válido.");
      return;
    }

    const limiteNum = Number(formLimiteCredito);
    const diasNum = Number(formDiasCredito);
    if (Number.isNaN(limiteNum) || limiteNum < 0) {
      setErrorFormulario("El límite de crédito no puede ser negativo.");
      return;
    }

    if (Number.isNaN(diasNum) || !Number.isInteger(diasNum) || diasNum < 0) {
      setErrorFormulario("Los días de crédito deben ser un número entero no negativo.");
      return;
    }

    setGuardando(true);
    try {
      const payload = {
        rut: formRut.trim(),
        razonSocial: formRazonSocial.trim(),
        contacto: formContacto.trim() || null,
        correo: formCorreo.trim() || null,
        condicionPago: formCondicionPago.trim() || null,
        limiteCredito: limiteNum,
        diasCredito: diasNum,
        categorias: formCategorias,
        activo: Boolean(formActivo),
      };

      const res = await guardarProveedorCatalogo(payload, idEditando);
      if (!res.ok) {
        setErrorFormulario(res.error || "No se pudo guardar el proveedor.");
        if (res.status === 409 && res.proveedorExistente) {
          setProveedorConflicto(res.proveedorExistente);
        }
        return;
      }

      setModalFormAbierto(false);
      setMensajeExito(
        idEditando
          ? `Proveedor "${res.proveedor.razonSocial || formRazonSocial.trim()}" actualizado correctamente.`
          : `Proveedor "${res.proveedor.razonSocial || formRazonSocial.trim()}" registrado correctamente.`
      );
      await cargarProveedores();
    } catch (err) {
      setErrorFormulario(err.message || "Error inesperado al guardar el proveedor.");
    } finally {
      setGuardando(false);
    }
  };

  if (authLoading) {
    return <p className="erp-empty">Verificando sesión…</p>;
  }

  if (!usuario) return null;

  return (
    <ErpModuleShell
      usuario={usuario}
      activeSection="compras"
      eyebrow="Adquisiciones y Abastecimiento"
      title="Catálogo de Proveedores"
      description="Registra, edita y consulta proveedores, sus condiciones comerciales, cupos de crédito y categorías suministradas."
      subnav={<ComprasNav />}
      actions={
        puedeEditar ? (
          <button
            type="button"
            className="ventas-ShiftButton"
            style={{
              backgroundColor: "var(--color-primary)",
              color: "#fff",
              border: "none",
              padding: "10px 18px",
              borderRadius: "8px",
              fontWeight: 600,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
            }}
            onClick={abrirModalNuevo}
          >
            <ErpIcon name="plus" />
            Nuevo proveedor
          </button>
        ) : null
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {errorGeneral && (
          <p className="ventas-message ventas-message-error" role="alert">
            {errorGeneral}
          </p>
        )}

        {mensajeExito && (
          <p
            className="ventas-message"
            role="status"
            style={{
              backgroundColor: "#ecfdf5",
              color: "#065f46",
              border: "1px solid #a7f3d0",
              padding: "12px 16px",
              borderRadius: "8px",
              fontWeight: 500,
            }}
          >
            {mensajeExito}
          </p>
        )}

        {/* Filtros de búsqueda, estado y categoría */}
        <section
          className="erp-card"
          style={{
            padding: "16px 20px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px",
            alignItems: "end",
          }}
        >
          <div>
            <label
              htmlFor="buscar-prov"
              style={{
                display: "block",
                fontSize: "11px",
                fontWeight: 600,
                marginBottom: "4px",
                color: "var(--color-text-muted)",
              }}
            >
              BUSCAR POR RAZÓN SOCIAL O RUT
            </label>
            <input
              id="buscar-prov"
              type="text"
              placeholder="Ej: 76.111.111-1 o Editorial..."
              value={filtroBuscar}
              onChange={(e) => setFiltroBuscar(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "7px",
                border: "1px solid var(--color-border)",
              }}
            />
          </div>

          <div>
            <label
              htmlFor="estado-prov"
              style={{
                display: "block",
                fontSize: "11px",
                fontWeight: 600,
                marginBottom: "4px",
                color: "var(--color-text-muted)",
              }}
            >
              ESTADO
            </label>
            <select
              id="estado-prov"
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "7px",
                border: "1px solid var(--color-border)",
              }}
            >
              <option value="todos">Todos</option>
              <option value="activo">Activos</option>
              <option value="inactivo">Inactivos</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="categoria-prov"
              style={{
                display: "block",
                fontSize: "11px",
                fontWeight: 600,
                marginBottom: "4px",
                color: "var(--color-text-muted)",
              }}
            >
              CATEGORÍA DE LIBRO
            </label>
            <select
              id="categoria-prov"
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "7px",
                border: "1px solid var(--color-border)",
              }}
            >
              <option value="">Todas las categorías</option>
              {categoriasDisponibles.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* Tabla del catálogo de proveedores */}
        <section className="erp-card inventory-table-panel" style={{ padding: "20px" }}>
          {cargando ? (
            <p className="erp-empty" role="status">
              Cargando proveedores…
            </p>
          ) : proveedores.length === 0 ? (
            <p className="erp-empty" role="status" style={{ padding: "28px 0", textAlign: "center" }}>
              No se encontraron proveedores con los filtros seleccionados.
            </p>
          ) : (
            <div className="module-table-scroll" role="region" aria-label="Tabla de proveedores" tabIndex={0}>
              <table className="module-table" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th scope="col" style={{ textAlign: "left" }}>RUT</th>
                    <th scope="col" style={{ textAlign: "left" }}>Razón Social</th>
                    <th scope="col" style={{ textAlign: "left" }}>Contacto / Correo</th>
                    <th scope="col" style={{ textAlign: "left" }}>Condición / Crédito</th>
                    <th scope="col" style={{ textAlign: "left" }}>Categorías</th>
                    <th scope="col" style={{ textAlign: "center" }}>Estado</th>
                    <th scope="col" style={{ textAlign: "right" }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {proveedores.map((prov) => {
                    const id = prov.idProveedor ?? prov.id_proveedor;
                    const razon = prov.razonSocial ?? prov.razon_social;
                    const cond = prov.condicionPago ?? prov.condicion_pago ?? "—";
                    const limite = prov.limiteCredito ?? prov.limite_credito ?? 0;
                    const dias = prov.diasCredito ?? prov.dias_credito ?? 0;
                    const cats = Array.isArray(prov.categorias) ? prov.categorias : [];
                    const activo = prov.activo !== false;

                    return (
                      <tr key={id}>
                        <td style={{ fontFamily: "monospace", fontWeight: 600 }}>{prov.rut}</td>
                        <td>
                          <strong>{razon}</strong>
                        </td>
                        <td style={{ fontSize: "13px" }}>
                          <div>{prov.contacto || "—"}</div>
                          <div style={{ color: "var(--color-text-muted)", fontSize: "12px" }}>
                            {prov.correo || "Sin correo"}
                          </div>
                        </td>
                        <td style={{ fontSize: "13px" }}>
                          <div>{cond}</div>
                          <div style={{ color: "var(--color-text-muted)", fontSize: "12px" }}>
                            Cupo: {formatCurrency(limite)} ({dias} días)
                          </div>
                        </td>
                        <td>
                          {cats.length === 0 ? (
                            <span style={{ color: "var(--color-text-muted)", fontSize: "12px" }}>
                              Sin asignar
                            </span>
                          ) : (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                              {cats.map((c) => (
                                <span
                                  key={c}
                                  style={{
                                    backgroundColor: "var(--color-bg-app)",
                                    border: "1px solid var(--color-border)",
                                    borderRadius: "999px",
                                    padding: "2px 8px",
                                    fontSize: "11px",
                                    fontWeight: 600,
                                  }}
                                >
                                  {c}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <span className={`erp-status ${activo ? "erp-status-ok" : "erp-status-danger"}`}>
                            {activo ? "Activo" : "Inactivo"}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: "8px" }}>
                            <button
                              type="button"
                              onClick={() => abrirVerFicha(prov)}
                              style={{
                                padding: "5px 10px",
                                borderRadius: "6px",
                                border: "1px solid var(--color-border)",
                                backgroundColor: "transparent",
                                cursor: "pointer",
                                fontSize: "12px",
                                fontWeight: 600,
                              }}
                            >
                              Ver
                            </button>
                            {puedeEditar && (
                              <button
                                type="button"
                                onClick={() => abrirModalEditar(prov)}
                                style={{
                                  padding: "5px 10px",
                                  borderRadius: "6px",
                                  border: "none",
                                  backgroundColor: "var(--color-primary)",
                                  color: "#fff",
                                  cursor: "pointer",
                                  fontSize: "12px",
                                  fontWeight: 600,
                                }}
                              >
                                Editar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Modal "Ver" (Ficha completa en modo lectura) */}
        {fichaLectura && (
          <div
            className="module-modal-backdrop"
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(0,0,0,0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              padding: "16px",
            }}
            onClick={() => setFichaLectura(null)}
          >
            <div
              className="erp-card"
              style={{
                width: "100%",
                maxWidth: "600px",
                padding: "24px",
                borderRadius: "12px",
                backgroundColor: "var(--color-surface-card)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  borderBottom: "1px solid var(--color-border)",
                  paddingBottom: "12px",
                  marginBottom: "16px",
                }}
              >
                <div>
                  <p className="erp-eyebrow">FICHA DE PROVEEDOR (MODO LECTURA)</p>
                  <h2 style={{ margin: "4px 0", fontSize: "19px" }}>
                    {fichaLectura.razonSocial ?? fichaLectura.razon_social}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setFichaLectura(null)}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: "20px",
                    cursor: "pointer",
                  }}
                >
                  ✕
                </button>
              </div>

              {cargandoFicha ? (
                <p className="erp-empty">Consultando ficha actualizada…</p>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "14px",
                    fontSize: "14px",
                  }}
                >
                  <div>
                    <strong>ID Proveedor:</strong> #{fichaLectura.idProveedor ?? fichaLectura.id_proveedor}
                  </div>
                  <div>
                    <strong>RUT:</strong> {fichaLectura.rut}
                  </div>
                  <div>
                    <strong>Estado:</strong>{" "}
                    {fichaLectura.activo !== false ? "Activo" : "Inactivo (Historial conservado)"}
                  </div>
                  <div>
                    <strong>Contacto:</strong> {fichaLectura.contacto || "—"}
                  </div>
                  <div>
                    <strong>Correo electrónico:</strong> {fichaLectura.correo || "—"}
                  </div>
                  <div>
                    <strong>Condición comercial:</strong>{" "}
                    {fichaLectura.condicionPago ?? fichaLectura.condicion_pago ?? "—"}
                  </div>
                  <div>
                    <strong>Límite de crédito:</strong>{" "}
                    {formatCurrency(fichaLectura.limiteCredito ?? fichaLectura.limite_credito ?? 0)}
                  </div>
                  <div>
                    <strong>Días de crédito:</strong>{" "}
                    {fichaLectura.diasCredito ?? fichaLectura.dias_credito ?? 0} días
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <strong>Categorías suministradas:</strong>{" "}
                    {Array.isArray(fichaLectura.categorias) && fichaLectura.categorias.length > 0
                      ? fichaLectura.categorias.join(", ")
                      : fichaLectura.categoriasTexto || "Sin categorías asignadas"}
                  </div>
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                  marginTop: "20px",
                  paddingTop: "14px",
                  borderTop: "1px solid var(--color-border)",
                }}
              >
                {puedeEditar && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = fichaLectura;
                      setFichaLectura(null);
                      poblarFormularioDesdeProveedor(target);
                    }}
                    style={{
                      padding: "8px 14px",
                      borderRadius: "7px",
                      border: "none",
                      backgroundColor: "var(--color-primary)",
                      color: "#fff",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Editar ficha
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setFichaLectura(null)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "7px",
                    border: "1px solid var(--color-border)",
                    backgroundColor: "transparent",
                    cursor: "pointer",
                  }}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Nuevo / Editar Proveedor */}
        {modalFormAbierto && (
          <div
            className="module-modal-backdrop"
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(0,0,0,0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              padding: "16px",
            }}
            onClick={() => !guardando && setModalFormAbierto(false)}
          >
            <div
              className="erp-card"
              style={{
                width: "100%",
                maxWidth: "660px",
                padding: "24px",
                borderRadius: "12px",
                backgroundColor: "var(--color-surface-card)",
                maxHeight: "90vh",
                overflowY: "auto",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  borderBottom: "1px solid var(--color-border)",
                  paddingBottom: "12px",
                  marginBottom: "16px",
                }}
              >
                <div>
                  <p className="erp-eyebrow">
                    {idEditando ? `EDITAR PROVEEDOR #${idEditando}` : "REGISTRAR NUEVO PROVEEDOR"}
                  </p>
                  <h2 style={{ margin: "4px 0", fontSize: "19px" }}>
                    {idEditando ? "Modificar datos del proveedor" : "Nuevo proveedor"}
                  </h2>
                </div>
                <button
                  type="button"
                  disabled={guardando}
                  onClick={() => setModalFormAbierto(false)}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: "20px",
                    cursor: "pointer",
                  }}
                >
                  ✕
                </button>
              </div>

              {errorFormulario && (
                <div
                  className="ventas-message ventas-message-error"
                  role="alert"
                  style={{ marginBottom: "16px" }}
                >
                  <div>{errorFormulario}</div>
                  {proveedorConflicto && (
                    <div style={{ marginTop: "8px" }}>
                      <button
                        type="button"
                        onClick={() => poblarFormularioDesdeProveedor(proveedorConflicto)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: "6px",
                          border: "none",
                          backgroundColor: "var(--color-primary)",
                          color: "#fff",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Abrir ficha de {proveedorConflicto.razonSocial ?? proveedorConflicto.razon_social} para editarla
                      </button>
                    </div>
                  )}
                </div>
              )}

              <form onSubmit={handleSubmit} style={{ display: "grid", gap: "14px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                      RUT *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="76.111.111-1"
                      value={formRut}
                      onChange={(e) => setFormRut(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "7px",
                        border: "1px solid var(--color-border)",
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                      Razón Social *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Nombre legal de la empresa"
                      value={formRazonSocial}
                      onChange={(e) => setFormRazonSocial(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "7px",
                        border: "1px solid var(--color-border)",
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                      Contacto
                    </label>
                    <input
                      type="text"
                      placeholder="Nombre o teléfono de contacto"
                      value={formContacto}
                      onChange={(e) => setFormContacto(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "7px",
                        border: "1px solid var(--color-border)",
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                      Correo electrónico
                    </label>
                    <input
                      type="email"
                      placeholder="ventas@proveedor.cl"
                      value={formCorreo}
                      onChange={(e) => setFormCorreo(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "7px",
                        border: "1px solid var(--color-border)",
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                      Condición comercial
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: 30 dias"
                      value={formCondicionPago}
                      onChange={(e) => setFormCondicionPago(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "7px",
                        border: "1px solid var(--color-border)",
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                      Límite de crédito ($)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={formLimiteCredito}
                      onChange={(e) => setFormLimiteCredito(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "7px",
                        border: "1px solid var(--color-border)",
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                      Días de crédito
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={formDiasCredito}
                      onChange={(e) => setFormDiasCredito(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "7px",
                        border: "1px solid var(--color-border)",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "6px" }}>
                    Categorías de libros suministradas (LIBRO.categoria)
                  </label>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "8px",
                      padding: "10px",
                      borderRadius: "8px",
                      border: "1px solid var(--color-border)",
                      backgroundColor: "var(--color-bg-app)",
                    }}
                  >
                    {categoriasDisponibles.map((cat) => {
                      const seleccionada = formCategorias.includes(cat);
                      return (
                        <label
                          key={cat}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "4px 10px",
                            borderRadius: "999px",
                            border: "1px solid var(--color-border)",
                            backgroundColor: seleccionada ? "var(--color-primary)" : "#fff",
                            color: seleccionada ? "#fff" : "inherit",
                            fontSize: "12px",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={seleccionada}
                            onChange={() => toggleCategoria(cat)}
                            style={{ display: "none" }}
                          />
                          {cat}
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={formActivo}
                      onChange={(e) => setFormActivo(e.target.checked)}
                    />
                    Proveedor activo (desmarcar para desactivar sin borrar historial de órdenes)
                  </label>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "10px",
                    marginTop: "8px",
                    paddingTop: "12px",
                    borderTop: "1px solid var(--color-border)",
                  }}
                >
                  <button
                    type="button"
                    disabled={guardando}
                    onClick={() => setModalFormAbierto(false)}
                    style={{
                      padding: "8px 14px",
                      borderRadius: "7px",
                      border: "1px solid var(--color-border)",
                      backgroundColor: "transparent",
                      cursor: "pointer",
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={guardando}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "7px",
                      border: "none",
                      backgroundColor: "var(--color-primary)",
                      color: "#fff",
                      fontWeight: 600,
                      cursor: guardando ? "not-allowed" : "pointer",
                    }}
                  >
                    {guardando ? "Guardando…" : idEditando ? "Guardar cambios" : "Registrar proveedor"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </ErpModuleShell>
  );
}

