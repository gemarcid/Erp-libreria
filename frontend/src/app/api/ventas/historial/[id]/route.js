import { NextResponse } from "next/server";
import { requestVentasBackend } from "@/lib/ventas-backend";
import { initialSales } from "@/lib/ventas-data";

export async function GET(request, { params }) {
  const token = request.cookies.get("erp_session")?.value;
  if (!token) {
    return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
  }

  const { id } = await params;

  try {
    const { response, result } = await requestVentasBackend(`/Ventas/DetalleVenta?id=${id}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok && result.success) {
      return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
    }
  } catch {
    // Fallback
  }

  const venta = initialSales.find((v) => String(v.id_venta) === String(id));
  if (!venta) {
    return NextResponse.json({ error: "Venta no encontrada." }, { status: 404 });
  }

  return NextResponse.json(
    {
      success: true,
      venta: {
        id_venta: venta.id_venta,
        folio: venta.folio,
        fecha: venta.fecha,
        canal: venta.canal,
        forma_pago: venta.forma_pago,
        tipo_documento: venta.tipo_documento,
        neto: venta.neto,
        iva: venta.iva,
        descuento: venta.descuento,
        total: venta.total,
        estado: venta.estado,
        cliente: {
          id: venta.id_cliente,
          nombre: venta.cliente_nombre,
          rut: venta.cliente_rut,
        },
        cajero: venta.cajero,
      },
      items: (venta.detalles || []).map((d, index) => ({
        id_detalle: index + 1,
        isbn: d.isbn,
        titulo: d.titulo,
        autor: "Autor de ejemplo",
        categoria: "General",
        cantidad: d.cantidad,
        precio_unitario: d.precio_unitario,
        subtotal: d.subtotal || d.cantidad * d.precio_unitario,
      })),
      nota_credito: venta.nota_credito || null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
