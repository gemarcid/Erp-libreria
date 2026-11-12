"use server";

import { cookies } from "next/headers";
import { requestVentasBackend as requestBackend } from "@/lib/ventas-backend";
import { normalizeComprasData } from "@/lib/compras-data";

async function requestVentasBackend(path, options) {
  const { response, result } = await requestBackend(path, options);
  return { response, result: normalizeComprasData(result) };
}

async function obtenerToken() {
  const cookieStore = await cookies();
  const token = cookieStore.get("erp_session")?.value;
  if (!token) {
    throw new Error("Debes iniciar sesión para acceder a este módulo.");
  }
  return token;
}

export async function fetchProveedores(buscar = "", { soloActivos = false } = {}) {
  const token = await obtenerToken();
  const params = new URLSearchParams();
  if (buscar && buscar.trim()) params.set("buscar", buscar.trim());
  if (soloActivos) params.set("soloActivos", "true");
  const query = params.toString() ? `?${params.toString()}` : "";
  const { response, result } = await requestVentasBackend(`/api/proveedores${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(result.error || "No se pudieron obtener los proveedores.");
  }

  return Array.isArray(result) ? result : [];
}

export async function fetchProveedoresActivos(buscar = "") {
  return fetchProveedores(buscar, { soloActivos: true });
}

export async function fetchProveedorPorId(id) {
  const token = await obtenerToken();
  const { response, result } = await requestVentasBackend(`/api/proveedores/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(result.error || "No se pudo obtener el proveedor.");
  }

  return result;
}

export async function crearProveedor(datos) {
  const token = await obtenerToken();
  const { response, result } = await requestVentasBackend("/api/proveedores", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(datos),
  });

  if (!response.ok) {
    throw new Error(result.error || "No se pudo registrar el proveedor.");
  }

  return result;
}

export async function editarProveedor(id, datos) {
  const token = await obtenerToken();
  const { response, result } = await requestVentasBackend(`/api/proveedores/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(datos),
  });

  if (!response.ok) {
    throw new Error(result.error || "No se pudo actualizar el proveedor.");
  }

  return result;
}

export async function fetchOrdenesCompra({ estado, proveedor, numero } = {}) {
  const token = await obtenerToken();
  const params = new URLSearchParams();
  if (estado) params.set("estado", estado);
  if (proveedor) params.set("proveedor", proveedor);
  if (numero) params.set("numero", numero);

  const query = params.toString() ? `?${params.toString()}` : "";
  const { response, result } = await requestVentasBackend(`/api/ordenes-compra${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(result.error || "No se pudieron obtener las órdenes de compra.");
  }

  return Array.isArray(result) ? result : [];
}

export async function fetchOrdenCompraPorId(id) {
  const token = await obtenerToken();
  const { response, result } = await requestVentasBackend(`/api/ordenes-compra/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(result.error || "No se pudo obtener el detalle de la orden de compra.");
  }

  return result;
}

export async function crearOrdenCompra(datos) {
  const token = await obtenerToken();
  const { response, result } = await requestVentasBackend("/api/ordenes-compra", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(datos),
  });

  if (!response.ok) {
    throw new Error(result.error || "No se pudo crear la orden de compra.");
  }

  return result;
}

export async function enviarOrdenCompraProveedor(idOc) {
  const token = await obtenerToken();
  const { response, result } = await requestVentasBackend(`/api/ordenes-compra/${idOc}/enviar`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(result.error || "No se pudo enviar la orden de compra al proveedor.");
  }

  return result;
}

export async function aprobarOrdenCompra(id) {
  const token = await obtenerToken();
  const { response, result } = await requestVentasBackend(`/api/ordenes-compra/${id}/aprobar`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(result.error || "No se pudo aprobar la orden de compra.");
  }

  return result;
}

export async function rechazarOrdenCompra(id) {
  const token = await obtenerToken();
  const { response, result } = await requestVentasBackend(`/api/ordenes-compra/${id}/rechazar`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(result.error || "No se pudo rechazar la orden de compra.");
  }

  return result;
}

export async function fetchLibrosParaCompra(buscar = "") {
  const token = await obtenerToken();
  const query = buscar ? `?buscar=${encodeURIComponent(buscar.trim())}` : "";
  const { response, result } = await requestVentasBackend(`/api/ordenes-compra/libros${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(result.error || "No se pudo consultar el catálogo de libros.");
  }

  return Array.isArray(result) ? result : [];
}

export async function fetchRecepcionesPendientes() {
  const token = await obtenerToken();
  const { response, result } = await requestVentasBackend("/api/recepciones/pendientes", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(result.error || "No se pudieron obtener las órdenes pendientes de recepción.");
  }

  return Array.isArray(result) ? result : [];
}

export async function fetchDetalleParaRecepcion(idOc) {
  const token = await obtenerToken();
  const { response, result } = await requestVentasBackend(`/api/recepciones/orden/${idOc}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(result.error || "No se pudo obtener el detalle de la orden.");
  }

  return result;
}

export async function registrarRecepcion(datos) {
  const token = await obtenerToken();
  const { response, result } = await requestVentasBackend("/api/recepciones", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(datos),
  });

  if (!response.ok) {
    throw new Error(result.error || "No se pudo registrar la recepción.");
  }

  return result;
}

export async function fetchHistorialRecepciones({ oc, proveedor } = {}) {
  const token = await obtenerToken();
  const params = new URLSearchParams();
  if (oc) params.set("oc", oc);
  if (proveedor) params.set("proveedor", proveedor);

  const query = params.toString() ? `?${params.toString()}` : "";
  const { response, result } = await requestVentasBackend(`/api/recepciones/historial${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(result.error || "No se pudo obtener el historial de recepciones.");
  }

  return Array.isArray(result) ? result : [];
}

export async function fetchReporteHistorico({ desde, hasta, idProveedor } = {}) {
  const token = await obtenerToken();
  const params = new URLSearchParams();
  if (desde) params.set("desde", desde);
  if (hasta) params.set("hasta", hasta);
  if (idProveedor) params.set("id_proveedor", idProveedor);

  const query = params.toString() ? `?${params.toString()}` : "";
  const { response, result } = await requestVentasBackend(`/api/compras/reportes/historico${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(result.error || "No se pudo obtener el reporte histórico de compras.");
  }

  return result;
}

export async function fetchReporteVariacionPrecios({ desde, hasta, isbn, idProveedor } = {}) {
  const token = await obtenerToken();
  const params = new URLSearchParams();
  if (desde) params.set("desde", desde);
  if (hasta) params.set("hasta", hasta);
  if (isbn) params.set("isbn", isbn);
  if (idProveedor) params.set("id_proveedor", idProveedor);

  const query = params.toString() ? `?${params.toString()}` : "";
  const { response, result } = await requestVentasBackend(`/api/compras/reportes/variacion-precios${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(result.error || "No se pudo obtener el reporte de variación de precios.");
  }

  return result;
}



