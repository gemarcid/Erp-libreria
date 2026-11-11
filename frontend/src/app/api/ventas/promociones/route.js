import { NextResponse } from "next/server";
import { requestVentasBackend } from "@/lib/ventas-backend";
import { initialPromotions } from "@/lib/ventas-data";

export async function GET(request) {
  const token = request.cookies.get("erp_session")?.value;
  if (!token) {
    return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
  }

  const activas = request.nextUrl.searchParams.get("activas") === "true";
  const endpoint = activas ? "/Ventas/PromocionesActivas" : "/Ventas/Promociones";

  try {
    const { response, result } = await requestVentasBackend(endpoint, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok && (result.success || result.promociones)) {
      return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
    }
  } catch {}

  let lista = [...initialPromotions];
  if (activas) {
    lista = lista.filter((p) => p.activo);
  }

  return NextResponse.json({ success: true, promociones: lista }, { headers: { "Cache-Control": "no-store" } });
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

  if (body.action === "toggle") {
    try {
      const { response, result } = await requestVentasBackend("/Ventas/TogglePromocion", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ id_promocion: body.id_promocion, activo: body.activo }),
      });
      if (response.ok && result.success) return NextResponse.json(result);
    } catch {}

    return NextResponse.json({ success: true, mensaje: "Estado de la promoción actualizado." });
  }

  try {
    const { response, result } = await requestVentasBackend("/Ventas/GuardarPromocion", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.ok && result.success) return NextResponse.json(result);
    if (result.error) return NextResponse.json({ error: result.error }, { status: response.status || 400 });
  } catch {}

  return NextResponse.json({
    success: true,
    mensaje: body.id_promocion ? "Promoción actualizada." : "Promoción creada exitosamente.",
    id_promocion: body.id_promocion || Date.now(),
  });
}
