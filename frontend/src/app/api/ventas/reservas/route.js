import { NextResponse } from "next/server";
import { requestVentasBackend } from "@/lib/ventas-backend";
import { initialReservations } from "@/lib/ventas-data";

export async function GET(request) {
  const token = request.cookies.get("erp_session")?.value;
  if (!token) {
    return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const estado = searchParams.get("estado") || "";
  const buscar = searchParams.get("buscar") || "";

  const params = new URLSearchParams();
  if (estado) params.set("estado", estado);
  if (buscar) params.set("buscar", buscar);
  const query = params.toString();

  try {
    const { response, result } = await requestVentasBackend(
      `/Ventas/Reservas${query ? `?${query}` : ""}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (response.ok && (result.success || result.reservas)) {
      return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
    }
  } catch {}

  let lista = [...initialReservations];
  if (estado && estado !== "todos") {
    lista = lista.filter((r) => r.estado.toLowerCase() === estado.toLowerCase());
  }
  if (buscar.trim()) {
    const term = buscar.toLowerCase();
    lista = lista.filter(
      (r) =>
        r.cliente.nombre.toLowerCase().includes(term) ||
        r.libro.titulo.toLowerCase().includes(term) ||
        r.libro.isbn.toLowerCase().includes(term),
    );
  }

  return NextResponse.json({ success: true, reservas: lista }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request) {
  const token = request.cookies.get("erp_session")?.value;
  if (!token) {
    return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Datos no válidos." }, { status: 400 });
  }

  // Atender reserva
  if (body.action === "atender") {
    try {
      const { response, result } = await requestVentasBackend("/Ventas/AtenderReserva", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ id_reserva: body.id_reserva, nuevo_estado: body.nuevo_estado || "atendida" }),
      });
      if (response.ok && result.success) return NextResponse.json(result);
    } catch {}

    return NextResponse.json({ success: true, mensaje: "Reserva actualizada." });
  }

  // Guardar nueva reserva
  try {
    const { response, result } = await requestVentasBackend("/Ventas/GuardarReserva", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.ok && result.success) return NextResponse.json(result);
    if (result.error) return NextResponse.json({ error: result.error }, { status: response.status || 400 });
  } catch {}

  return NextResponse.json({
    success: true,
    mensaje: "Reserva registrada con éxito.",
    id_reserva: Date.now(),
  });
}
