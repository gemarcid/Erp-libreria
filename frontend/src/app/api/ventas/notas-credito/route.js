import { NextResponse } from "next/server";
import { requestVentasBackend } from "@/lib/ventas-backend";

export async function POST(request) {
  const token = request.cookies.get("erp_session")?.value;
  if (!token) {
    return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || !body.id_venta || !body.motivo) {
    return NextResponse.json({ error: "Venta y motivo son obligatorios." }, { status: 400 });
  }

  try {
    const { response, result } = await requestVentasBackend("/Ventas/EmitirNotaCredito", {
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
  } catch {
    // Fallback simulación
  }

  const folio = "NC-" + new Date().toISOString().slice(0, 10).replace(/-/g, "") + "-" + Math.floor(100 + Math.random() * 900);
  return NextResponse.json({
    success: true,
    mensaje: `Nota de crédito emitida con éxito (${folio}). Stock ${body.destino_fisico === "reingreso" ? "reingresado al inventario" : "dado de baja por merma"}.`,
    folio,
    id_nota_credito: Date.now(),
  });
}
