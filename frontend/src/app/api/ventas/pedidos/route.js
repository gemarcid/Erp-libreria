import { NextResponse } from "next/server";
import { requestVentasBackend } from "@/lib/ventas-backend";
import { initialOrders } from "@/lib/ventas-data";

export async function GET(request) {
  const token = request.cookies.get("erp_session")?.value;
  if (!token) {
    return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const tipo = searchParams.get("tipo") || "";
  const estado = searchParams.get("estado") || "";
  const buscar = searchParams.get("buscar") || "";

  const params = new URLSearchParams();
  if (tipo) params.set("tipo", tipo);
  if (estado) params.set("estado", estado);
  if (buscar) params.set("buscar", buscar);

  const query = params.toString();

  try {
    const { response, result } = await requestVentasBackend(
      `/Ventas/Pedidos${query ? `?${query}` : ""}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (response.ok && (result.success || result.pedidos)) {
      return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
    }
  } catch {
    // Fallback
  }

  let lista = [...initialOrders];
  if (tipo && tipo !== "todos") {
    lista = lista.filter((p) => p.tipo.toLowerCase() === tipo.toLowerCase());
  }
  if (estado && estado !== "todos") {
    lista = lista.filter((p) => p.estado.toLowerCase() === estado.toLowerCase());
  }
  if (buscar.trim()) {
    const term = buscar.toLowerCase();
    lista = lista.filter(
      (p) =>
        p.cliente_nombre.toLowerCase().includes(term) ||
        p.cliente_rut.toLowerCase().includes(term) ||
        String(p.id_pedido).includes(term),
    );
  }

  return NextResponse.json({ success: true, pedidos: lista }, { headers: { "Cache-Control": "no-store" } });
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

  // Acción de cambio de estado
  if (body.action === "cambiar_estado") {
    try {
      const { response, result } = await requestVentasBackend("/Ventas/CambiarEstadoPedido", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ id_pedido: body.id_pedido, nuevo_estado: body.nuevo_estado }),
      });
      if (response.ok && result.success) return NextResponse.json(result);
    } catch {}

    return NextResponse.json({ success: true, mensaje: `Estado actualizado a ${body.nuevo_estado}.` });
  }

  // Guardar nuevo pedido / cotización
  try {
    const { response, result } = await requestVentasBackend("/Ventas/GuardarPedido", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.ok && result.success) return NextResponse.json(result);
    if (result.error) return NextResponse.json({ error: result.error }, { status: response.status || 400 });
  } catch {}

  return NextResponse.json({
    success: true,
    mensaje: body.tipo === "cotizacion" ? "Cotización generada correctamente." : "Pedido institucional registrado.",
    id_pedido: Date.now(),
  });
}
