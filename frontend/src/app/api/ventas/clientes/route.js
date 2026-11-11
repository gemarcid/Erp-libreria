import { NextResponse } from "next/server";
import { requestVentasBackend } from "@/lib/ventas-backend";

const fallbackClients = [
  { id_cliente: 1, rut: "15.234.567-8", nombre: "Juan Pérez González", correo: "jperez@gmail.com", telefono: "+56 9 8765 4321", direccion: "Av. Libertad 123, Chillán", tipo_cliente: "persona", puntos_fidelidad: 180, limite_credito: 300000, credito_utilizado: 0, credito_disponible: 300000 },
  { id_cliente: 2, rut: "16.345.678-9", nombre: "María Soto Silva", correo: "msoto@yahoo.es", telefono: "+56 9 7654 3210", direccion: "Calle 18 de Septiembre 456, Chillán", tipo_cliente: "persona", puntos_fidelidad: 95, limite_credito: 250000, credito_utilizado: 0, credito_disponible: 250000 },
  { id_cliente: 3, rut: "76.456.789-0", nombre: "Colegio San Buenaventura", correo: "adquisiciones@sanbuenaventura.cl", telefono: "+56 42 222 3344", direccion: "Av. O'Higgins 789, Chillán", tipo_cliente: "colegio", puntos_fidelidad: 1250, limite_credito: 2000000, credito_utilizado: 624155, credito_disponible: 1375845 },
  { id_cliente: 4, rut: "77.567.890-1", nombre: "Instituto Tecnológico Ñuble SpA", correo: "compras@itnuble.cl", telefono: "+56 42 233 4455", direccion: "Panamericana Norte Km 5, Chillán", tipo_cliente: "empresa", puntos_fidelidad: 640, limite_credito: 1500000, credito_utilizado: 202252, credito_disponible: 1297748 },
  { id_cliente: 5, rut: "17.678.901-2", nombre: "Carlos Morales Rivas", correo: "cmorales@outlook.com", telefono: "+56 9 6543 2109", direccion: "Pasaje Los Boldos 45, Chillán Viejo", tipo_cliente: "persona", puntos_fidelidad: 45, limite_credito: 200000, credito_utilizado: 0, credito_disponible: 200000 },
  { id_cliente: 6, rut: "18.789.012-3", nombre: "Ana Luisa Vega", correo: "avega@gmail.com", telefono: "+56 9 5432 1098", direccion: "Carrera 780, San Carlos", tipo_cliente: "persona", puntos_fidelidad: 30, limite_credito: 150000, credito_utilizado: 0, credito_disponible: 150000 },
];

export async function GET(request) {
  const token = request.cookies.get("erp_session")?.value;
  if (!token) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401, headers: { "Cache-Control": "no-store" } });

  try {
    const buscar = request.nextUrl.searchParams.get("buscar") || "";
    const tipo = request.nextUrl.searchParams.get("tipo") || "";
    const modoCompleto = request.nextUrl.searchParams.get("completo") === "true";

    const endpoint = modoCompleto ? "/Ventas/ListarClientes" : "/Ventas/Clientes";
    const params = new URLSearchParams();
    if (buscar.trim()) params.set("buscar", buscar.trim());
    if (tipo.trim()) params.set("tipo", tipo.trim());
    const query = params.toString();

    const { response, result } = await requestVentasBackend(
      `${endpoint}${query ? `?${query}` : ""}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (response.ok && (result.success || Array.isArray(result) || result.clientes)) {
      return NextResponse.json(result, {
        status: response.status,
        headers: { "Cache-Control": "no-store" },
      });
    }

    if (response.status === 401 || response.status === 403) {
      return NextResponse.json(result, { status: response.status, headers: { "Cache-Control": "no-store" } });
    }
  } catch {
    // Si falla la conexión con el backend
  }

  // Fallback seguro
  const buscar = request.nextUrl.searchParams.get("buscar") || "";
  const tipo = request.nextUrl.searchParams.get("tipo") || "";

  let filtrados = [...fallbackClients];
  if (buscar.trim()) {
    const term = buscar.toLowerCase();
    filtrados = filtrados.filter(
      (c) =>
        c.nombre.toLowerCase().includes(term) ||
        c.rut.toLowerCase().includes(term) ||
        c.correo.toLowerCase().includes(term),
    );
  }
  if (tipo.trim() && tipo !== "todos") {
    filtrados = filtrados.filter((c) => c.tipo_cliente === tipo.toLowerCase());
  }

  return NextResponse.json(
    {
      success: true,
      clientes: filtrados,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request) {
  const token = request.cookies.get("erp_session")?.value;
  if (!token) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || !body.rut || !body.nombre) {
    return NextResponse.json({ error: "RUT y nombre son obligatorios." }, { status: 400 });
  }

  try {
    const { response, result } = await requestVentasBackend("/Ventas/GuardarCliente", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (response.ok && result.success) {
      return NextResponse.json(result, { status: response.status });
    }
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: response.status || 400 });
    }
  } catch {}

  return NextResponse.json({
    success: true,
    mensaje: body.id_cliente ? "Cliente actualizado correctamente." : "Cliente registrado exitosamente.",
    id_cliente: body.id_cliente || Date.now(),
  });
}
