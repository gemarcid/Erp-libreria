import { NextResponse } from "next/server";
import { requestVentasBackend } from "@/lib/ventas-backend";
import { initialSales } from "@/lib/ventas-data";

export async function GET(request) {
  const token = request.cookies.get("erp_session")?.value;
  if (!token) {
    return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const desde = searchParams.get("desde") || "";
  const hasta = searchParams.get("hasta") || "";
  const estado = searchParams.get("estado") || "";
  const tipoDoc = searchParams.get("tipo_documento") || "";
  const canal = searchParams.get("canal") || "";
  const buscar = searchParams.get("buscar") || "";

  const params = new URLSearchParams();
  if (desde) params.set("desde", desde);
  if (hasta) params.set("hasta", hasta);
  if (estado) params.set("estado", estado);
  if (tipoDoc) params.set("tipo_documento", tipoDoc);
  if (canal) params.set("canal", canal);
  if (buscar) params.set("buscar", buscar);

  const query = params.toString();

  try {
    const { response, result } = await requestVentasBackend(
      `/Ventas/Historial${query ? `?${query}` : ""}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (response.ok && (result.success || result.ventas)) {
      return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
    }
  } catch {
    // Backend offline fallback
  }

  let lista = [...initialSales];
  if (estado && estado !== "todos") {
    lista = lista.filter((v) => v.estado.toLowerCase() === estado.toLowerCase());
  }
  if (tipoDoc && tipoDoc !== "todos") {
    lista = lista.filter((v) => v.tipo_documento.toLowerCase() === tipoDoc.toLowerCase());
  }
  if (canal && canal !== "todos") {
    lista = lista.filter((v) => v.canal.toLowerCase() === canal.toLowerCase());
  }
  if (buscar.trim()) {
    const term = buscar.toLowerCase();
    lista = lista.filter(
      (v) =>
        v.folio.toLowerCase().includes(term) ||
        v.cliente_nombre.toLowerCase().includes(term) ||
        v.cliente_rut.toLowerCase().includes(term),
    );
  }

  return NextResponse.json(
    {
      success: true,
      ventas: lista,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
