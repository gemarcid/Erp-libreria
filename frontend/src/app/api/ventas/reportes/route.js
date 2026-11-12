import { NextResponse } from "next/server";
import { requestVentasBackend } from "@/lib/ventas-backend";
import { initialSales, initialClients } from "@/lib/ventas-data";

export async function GET(request) {
  const token = request.cookies.get("erp_session")?.value;
  if (!token) {
    return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const tipo = searchParams.get("tipo") || "ranking";
  const desde = searchParams.get("desde") || "";
  const hasta = searchParams.get("hasta") || "";
  const categoria = searchParams.get("categoria") || "";
  const filtro = searchParams.get("filtro") || "todos";
  const cliente = searchParams.get("cliente") || "";

  const params = new URLSearchParams();
  if (desde) params.set("desde", desde);
  if (hasta) params.set("hasta", hasta);
  if (categoria) params.set("categoria", categoria);
  if (filtro) params.set("filtro", filtro);
  if (cliente) params.set("cliente", cliente);
  const query = params.toString();

  // Mapeo al endpoint de ASP.NET
  let backendEndpoint = "/Ventas/ReporteClientes";
  if (tipo === "producto") backendEndpoint = "/Ventas/ReporteVentasProducto";
  if (tipo === "cuentas-cobrar") backendEndpoint = "/Ventas/ReporteCuentasPorCobrar";
  if (tipo === "rotacion") backendEndpoint = "/Ventas/ReporteRotacionVentas";
  if (tipo === "canales") backendEndpoint = "/Ventas/ReporteVentasCanal";

  try {
    const { response, result } = await requestVentasBackend(
      `${backendEndpoint}${query ? `?${query}` : ""}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (response.ok && (result.success || result.reporte)) {
      return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
    }
  } catch {}

  // Fallback estructurado para los 5 reportes
  if (tipo === "ranking") {
    const totalVendido = initialSales.reduce((acc, v) => v.estado === "pagado" ? acc + v.total : acc, 0);
    const clientsMap = {};

    initialSales.filter((v) => v.estado === "pagado").forEach((v) => {
      if (!clientsMap[v.id_cliente]) {
        clientsMap[v.id_cliente] = {
          id_cliente: v.id_cliente,
          rut: v.cliente_rut,
          nombre: v.cliente_nombre,
          tipo_cliente: "persona",
          cantidad_ventas: 0,
          total_vendido: 0,
        };
      }
      clientsMap[v.id_cliente].cantidad_ventas += 1;
      clientsMap[v.id_cliente].total_vendido += v.total;
    });

    const ordenados = Object.values(clientsMap).sort((a, b) => b.total_vendido - a.total_vendido);
    let acumulado = 0;
    const ranking = ordenados.map((item, index) => {
      const porcentaje = totalVendido > 0 ? (item.total_vendido / totalVendido) * 100 : 0;
      acumulado += porcentaje;
      return {
        posicion: index + 1,
        ...item,
        porcentaje: Number(porcentaje.toFixed(2)),
        porcentaje_acumulado: Number(acumulado.toFixed(2)),
        clasificacion: acumulado <= 80 ? "A" : acumulado <= 95 ? "B" : "C",
      };
    });

    return NextResponse.json({
      success: true,
      total_clientes: ranking.length,
      total_ventas: ranking.reduce((a, b) => a + b.cantidad_ventas, 0),
      total_vendido: totalVendido,
      reporte: ranking,
    });
  }

  if (tipo === "producto") {
    const productos = [
      { isbn: "9788439724798", titulo: "El principito", autor: "Antoine de Saint-Exupéry", categoria: "Infantil", editorial: "Anagrama", unidades_vendidas: 26, total_recaudado: 234740, precio_promedio: 9028 },
      { isbn: "9788437604947", titulo: "Cien años de soledad", autor: "Gabriel García Márquez", categoria: "Novela", editorial: "Planeta", unidades_vendidas: 20, total_recaudado: 299800, precio_promedio: 14990 },
      { isbn: "9788423341802", titulo: "La sombra del viento", autor: "Carlos Ruiz Zafón", categoria: "Novela", editorial: "Alfaguara", unidades_vendidas: 11, total_recaudado: 186890, precio_promedio: 16990 },
      { isbn: "9780140449136", titulo: "La Odisea", autor: "Homero", categoria: "Clasicos", editorial: "Penguin Random House", unidades_vendidas: 2, total_recaudado: 25980, precio_promedio: 12990 },
      { isbn: "9789500428037", titulo: "Rayuela", autor: "Julio Cortázar", categoria: "Novela", editorial: "Planeta", unidades_vendidas: 2, total_recaudado: 35980, precio_promedio: 17990 },
      { isbn: "9780132350884", titulo: "Clean Code", autor: "Robert C. Martin", categoria: "Programacion", editorial: "O'Reilly Media", unidades_vendidas: 1, total_recaudado: 39990, precio_promedio: 39990 },
    ];

    let filtrados = productos;
    if (categoria && categoria !== "todos") {
      filtrados = filtrados.filter((p) => p.categoria.toLowerCase() === categoria.toLowerCase());
    }

    return NextResponse.json({
      success: true,
      total_titulos: filtrados.length,
      total_unidades: filtrados.reduce((a, b) => a + b.unidades_vendidas, 0),
      total_recaudado: filtrados.reduce((a, b) => a + b.total_recaudado, 0),
      reporte: filtrados,
    });
  }

  if (tipo === "cuentas-cobrar") {
    let pendientes = [
      {
        id_venta: 2,
        folio: "F-50001",
        fecha_emision: "2026-09-19",
        fecha_vencimiento: "2026-10-19",
        dias_mora: 22,
        tramo: "1 - 30 días mora",
        monto_total: 624155,
        saldo_pendiente: 624155,
        cliente: { id: 3, nombre: "Colegio San Buenaventura", rut: "76.456.789-0", tipo: "colegio" },
      },
      {
        id_venta: 4,
        folio: "F-50002",
        fecha_emision: "2026-09-28",
        fecha_vencimiento: "2026-10-28",
        dias_mora: 13,
        tramo: "1 - 30 días mora",
        monto_total: 202252,
        saldo_pendiente: 202252,
        cliente: { id: 4, nombre: "Instituto Tecnológico Ñuble SpA", rut: "77.567.890-1", tipo: "empresa" },
      },
    ];

    if (cliente.trim()) {
      const q = cliente.trim().toLowerCase();
      pendientes = pendientes.filter(
        (p) =>
          p.cliente?.nombre?.toLowerCase().includes(q) ||
          p.cliente?.rut?.toLowerCase().includes(q) ||
          p.folio?.toLowerCase().includes(q)
      );
    }

    return NextResponse.json({
      success: true,
      total_documentos: pendientes.length,
      saldo_total_pendiente: pendientes.reduce((a, b) => a + b.saldo_pendiente, 0),
      resumen_tramos: {
        vigentes: pendientes.filter((p) => p.dias_mora <= 0).length,
        mora_30: pendientes.filter((p) => p.dias_mora > 0 && p.dias_mora <= 30).length,
        mora_60: pendientes.filter((p) => p.dias_mora > 30 && p.dias_mora <= 60).length,
        mora_90_mas: pendientes.filter((p) => p.dias_mora > 60).length,
      },
      reporte: pendientes,
    });
  }

  if (tipo === "rotacion") {
    const rotacion = [
      { isbn: "9788439724798", titulo: "El principito", autor: "Antoine de Saint-Exupéry", categoria: "Infantil", editorial: "Anagrama", stock_actual: 31, unidades_vendidas: 26, total_ventas: 234740, ultima_venta: "2026-10-02", dias_sin_vender: 39, clasificacion: "Alta rotación" },
      { isbn: "9788437604947", titulo: "Cien años de soledad", autor: "Gabriel García Márquez", categoria: "Novela", editorial: "Planeta", stock_actual: 24, unidades_vendidas: 20, total_ventas: 299800, ultima_venta: "2026-09-19", dias_sin_vender: 52, clasificacion: "Alta rotación" },
      { isbn: "9788423341802", titulo: "La sombra del viento", autor: "Carlos Ruiz Zafón", categoria: "Novela", editorial: "Alfaguara", stock_actual: 16, unidades_vendidas: 11, total_ventas: 186890, ultima_venta: "2026-09-28", dias_sin_vender: 43, clasificacion: "Alta rotación" },
      { isbn: "9789500428037", titulo: "Rayuela", autor: "Julio Cortázar", categoria: "Novela", editorial: "Planeta", stock_actual: 20, unidades_vendidas: 2, total_ventas: 35980, ultima_venta: "2026-09-25", dias_sin_vender: 46, clasificacion: "Rotación media" },
      { isbn: "9780140449136", titulo: "La Odisea", autor: "Homero", categoria: "Clasicos", editorial: "Penguin Random House", stock_actual: 18, unidades_vendidas: 2, total_ventas: 25980, ultima_venta: "2026-09-15", dias_sin_vender: 56, clasificacion: "Rotación media" },
      { isbn: "9788420412146", titulo: "Don Quijote de la Mancha", autor: "Miguel de Cervantes", categoria: "Clasicos", editorial: "Alfaguara", stock_actual: 12, unidades_vendidas: 0, total_ventas: 0, ultima_venta: "Sin ventas", dias_sin_vender: 999, clasificacion: "Stock muerto" },
      { isbn: "9781492055020", titulo: "Learning Python", autor: "Mark Lutz", categoria: "Programacion", editorial: "O'Reilly Media", stock_actual: 9, unidades_vendidas: 0, total_ventas: 0, ultima_venta: "Sin ventas", dias_sin_vender: 999, clasificacion: "Stock muerto" },
      { isbn: "9781491950357", titulo: "Fluent Python", autor: "Luciano Ramalho", categoria: "Programacion", editorial: "O'Reilly Media", stock_actual: 7, unidades_vendidas: 0, total_ventas: 0, ultima_venta: "Sin ventas", dias_sin_vender: 999, clasificacion: "Stock muerto" },
      { isbn: "9780262033848", titulo: "Introduction to Algorithms", autor: "Thomas H. Cormen", categoria: "Computacion", editorial: "O'Reilly Media", stock_actual: 5, unidades_vendidas: 0, total_ventas: 0, ultima_venta: "Sin ventas", dias_sin_vender: 999, clasificacion: "Stock muerto" },
    ];

    let filtrados = rotacion;
    if (filtro === "top") filtrados = filtrados.filter((r) => r.unidades_vendidas > 0);
    if (filtro === "muerto") filtrados = filtrados.filter((r) => r.unidades_vendidas === 0);

    return NextResponse.json({ success: true, reporte: filtrados });
  }

  if (tipo === "canales") {
    const canales = [
      { canal: "tienda fisica", cantidad_operaciones: 2, total_neto: 61560, total_iva: 11696, total_descuento: 0, total_recaudado: 73256, ticket_promedio: 36628 },
      { canal: "tienda digital", cantidad_operaciones: 1, total_neto: 52970, total_iva: 10064, total_descuento: 0, total_recaudado: 63034, ticket_promedio: 63034 },
      { canal: "retiro en tienda", cantidad_operaciones: 0, total_neto: 0, total_iva: 0, total_descuento: 0, total_recaudado: 0, ticket_promedio: 0 },
    ];

    return NextResponse.json({
      success: true,
      total_ventas: canales.reduce((a, b) => a + b.cantidad_operaciones, 0),
      total_general: canales.reduce((a, b) => a + b.total_recaudado, 0),
      reporte: canales,
    });
  }

  return NextResponse.json({ success: true, reporte: [] });
}
