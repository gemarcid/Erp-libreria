using System;
using System.Collections.Generic;
using System.Data;
using MySql.Data.MySqlClient;

namespace backend.Models
{
    public static class DashboardData
    {
        public static object Load(MySqlConnection connection, DateTime today, bool sales = true, bool purchases = true,
            bool inventory = true, bool accounting = true)
        {
            today = today.Date;
            var days = new List<object>();
            var orders = new List<object>();
            var books = new List<object>();
            var activity = new List<object>();
            decimal salesToday = 0, salesYesterday = 0, weekTotal = 0, previousWeekTotal = 0;
            var salesByDate = new Dictionary<DateTime, decimal>();
            int criticalStock, pendingOrders, pendingReceipts;
            decimal payable;
            using (var transaction = connection.BeginTransaction(IsolationLevel.RepeatableRead))
            {
                if (sales)
                using (var command = new MySqlCommand(@"SELECT DATE(fecha) AS dia, SUM(total) AS total FROM VENTA
                    WHERE estado = 'pagado' AND fecha >= @start AND fecha < @end
                    GROUP BY DATE(fecha)", connection, transaction))
                {
                    command.Parameters.AddWithValue("@start", today.AddDays(-13));
                    command.Parameters.AddWithValue("@end", today.AddDays(1));
                    using (var reader = command.ExecuteReader())
                        while (reader.Read()) salesByDate[Convert.ToDateTime(reader["dia"]).Date] = Convert.ToDecimal(reader["total"]);
                }
                salesByDate.TryGetValue(today, out salesToday);
                salesByDate.TryGetValue(today.AddDays(-1), out salesYesterday);
                for (int i = -13; i <= 0; i++)
                {
                    var date = today.AddDays(i);
                    decimal amount;
                    salesByDate.TryGetValue(date, out amount);
                    if (i < -6) previousWeekTotal += amount;
                    else if (sales) { weekTotal += amount; days.Add(new { date = date.ToString("yyyy-MM-dd"), total = amount }); }
                }
                using (var command = new MySqlCommand(@"SELECT
                    (SELECT COUNT(*) FROM LIBRO WHERE activo = TRUE AND stock_actual <= stock_minimo) AS stock,
                    (SELECT COALESCE(SUM(monto_total),0) FROM FACTURA_PROVEEDOR WHERE estado_pago = 'pendiente') AS payable,
                    pending.orders, pending.receipts FROM (
                        SELECT COALESCE(SUM(CASE WHEN oc.estado = 'pendiente' THEN 1 ELSE 0 END),0) AS orders,
                        COALESCE(SUM(CASE WHEN oc.estado = 'aprobada'
                            AND NOT EXISTS (SELECT 1 FROM RECEPCION r WHERE r.id_oc = oc.id_oc)
                            THEN 1 ELSE 0 END),0) AS receipts FROM ORDEN_COMPRA oc
                    ) pending", connection, transaction))
                using (var reader = command.ExecuteReader())
                {
                    reader.Read();
                    criticalStock = inventory ? Convert.ToInt32(reader["stock"]) : 0;
                    payable = purchases ? Convert.ToDecimal(reader["payable"]) : 0;
                    pendingOrders = purchases ? Convert.ToInt32(reader["orders"]) : 0;
                    pendingReceipts = purchases ? Convert.ToInt32(reader["receipts"]) : 0;
                }
                if (purchases)
                using (var command = new MySqlCommand(@"SELECT oc.id_oc, p.razon_social, oc.total FROM ORDEN_COMPRA oc
                    INNER JOIN PROVEEDOR p ON p.id_proveedor = oc.id_proveedor
                    WHERE oc.estado = 'pendiente' ORDER BY oc.fecha DESC, oc.id_oc DESC LIMIT 5", connection, transaction))
                using (var reader = command.ExecuteReader())
                    while (reader.Read()) orders.Add(new { code = "OC-" + Convert.ToInt32(reader["id_oc"]).ToString("D5"),
                        supplier = reader["razon_social"].ToString(), total = Convert.ToDecimal(reader["total"]) });
                if (sales)
                using (var command = new MySqlCommand(@"SELECT l.isbn, l.titulo, l.autor, SUM(d.cantidad) AS units
                    FROM DETALLE_VENTA d INNER JOIN VENTA v ON v.id_venta = d.id_venta
                    INNER JOIN LIBRO l ON l.isbn = d.isbn
                    WHERE v.estado = 'pagado' AND v.fecha >= @month AND v.fecha < @end
                    GROUP BY l.isbn,l.titulo,l.autor ORDER BY units DESC,l.titulo,l.isbn LIMIT 4", connection, transaction))
                {
                    command.Parameters.AddWithValue("@month", new DateTime(today.Year, today.Month, 1));
                    command.Parameters.AddWithValue("@end", today.AddDays(1));
                    using (var reader = command.ExecuteReader())
                        while (reader.Read()) books.Add(new { isbn = reader["isbn"].ToString(), title = reader["titulo"].ToString(),
                            author = Convert.ToString(reader["autor"]), sales = Convert.ToInt32(reader["units"]) });
                }
                using (var command = new MySqlCommand(@"SELECT id, icon, title, detail, fecha, dateOnly FROM (
                    SELECT CONCAT('venta-',id_venta) AS id, 'sales' AS icon, 'Venta registrada' AS title,
                        CONCAT(tipo_documento,' #',COALESCE(NULLIF(folio,''),id_venta)) AS detail, fecha, 0 AS dateOnly
                        FROM VENTA WHERE estado = 'pagado'
                    UNION ALL
                    SELECT CONCAT('stock-',m.id_movimiento), 'inventory', 'Movimiento de stock',
                        CONCAT(l.titulo,' · ',m.tipo_movimiento,' · ',m.cantidad,' unidades'),m.fecha,0
                        FROM MOVIMIENTO_STOCK m INNER JOIN LIBRO l ON l.isbn = m.isbn
                    UNION ALL
                    SELECT CONCAT('recepcion-',r.id_recepcion), 'purchases', 'Recepción registrada',
                        CONCAT(p.razon_social,' · ',r.nro_doc),r.fecha,0 FROM RECEPCION r
                        INNER JOIN ORDEN_COMPRA oc ON oc.id_oc = r.id_oc
                        INNER JOIN PROVEEDOR p ON p.id_proveedor = oc.id_proveedor
                    UNION ALL
                    SELECT CONCAT('asiento-',id_asiento),'accounting','Asiento contable',COALESCE(glosa,''),fecha,1 FROM ASIENTO
                    ) events WHERE fecha < @end AND ((icon='sales' AND @sales) OR (icon='inventory' AND @inventory)
                        OR (icon='purchases' AND @purchases) OR (icon='accounting' AND @accounting))
                    ORDER BY fecha DESC,id DESC LIMIT 6", connection, transaction))
                {
                    command.Parameters.AddWithValue("@end", today.AddDays(1));
                    command.Parameters.AddWithValue("@sales", sales);
                    command.Parameters.AddWithValue("@purchases", purchases);
                    command.Parameters.AddWithValue("@inventory", inventory);
                    command.Parameters.AddWithValue("@accounting", accounting);
                    using (var reader = command.ExecuteReader())
                        while (reader.Read()) activity.Add(new { id = reader["id"].ToString(), icon = reader["icon"].ToString(),
                            title = reader["title"].ToString(), detail = reader["detail"].ToString(),
                            date = Convert.ToDateTime(reader["fecha"]).ToString("yyyy-MM-ddTHH:mm:ss"),
                            dateOnly = Convert.ToInt32(reader["dateOnly"]) == 1 });
                }
                transaction.Commit();
            }
            return new { success = true, date = today.ToString("yyyy-MM-dd"), salesToday, salesYesterday,
                criticalStock, payable, pendingOrders, pendingReceipts, weekTotal, previousWeekTotal, days, orders, books, activity };
        }
    }
}
