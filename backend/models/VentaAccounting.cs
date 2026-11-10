using System;
using System.Collections.Generic;
using System.Web;
using MySql.Data.MySqlClient;

namespace backend.Models
{
    public static class VentaAccounting
    {
        internal static readonly (string Key, string Label, string Code, string Name, string Type)[] Rules = {
            ("efectivo", "Cobro en efectivo", "1.1.01", "Caja", "activo"),
            ("banco", "Cobro con tarjeta o transferencia", "1.1.02", "Banco", "activo"),
            ("inventario", "Salida del inventario", "1.1.04", "Inventario de libros", "activo"),
            ("iva", "IVA débito fiscal", "2.1.02", "IVA débito fiscal", "pasivo"),
            ("ingreso", "Ingreso neto por ventas", "4.1.01", "Ingresos por ventas", "ingreso"),
            ("costo", "Costo de libros vendidos", "5.1.01", "Costo de ventas", "gasto"),
        };

        internal static Dictionary<string, string> ReadRules(MySqlConnection connection, MySqlTransaction transaction)
        {
            var accounts = new Dictionary<string, string>(StringComparer.Ordinal);
            foreach (var rule in Rules) accounts.Add(rule.Key, rule.Code);
            try
            {
                using (var command = new MySqlCommand("SELECT operacion, codigo_cuenta FROM CUENTA_AUTOMATICA", connection, transaction))
                using (var reader = command.ExecuteReader())
                    while (reader.Read())
                    {
                        var key = reader.GetString(0);
                        if (accounts.ContainsKey(key)) accounts[key] = reader.GetString(1);
                    }
            }
            catch (MySqlException ex) when (ex.Number == 1146)
            {
                // Instalaciones anteriores a la migración mantienen sus cuentas originales.
            }
            return accounts;
        }

        // Todo se ejecuta en la misma transacción que VENTA y MOVIMIENTO_STOCK.
        public static int Register(MySqlConnection connection, MySqlTransaction transaction,
            int saleId, int userId, string payment, decimal net, decimal tax, decimal total, decimal cost)
        {
            using (var command = new MySqlCommand(@"INSERT IGNORE INTO PERIODO_CONTABLE (anio, mes, estado)
                SELECT YEAR(fecha), MONTH(fecha), 'abierto' FROM VENTA WHERE id_venta = @sale", connection, transaction))
            {
                command.Parameters.AddWithValue("@sale", saleId);
                command.ExecuteNonQuery();
            }
            int periodId;
            using (var command = new MySqlCommand(@"SELECT p.id_periodo, p.estado FROM PERIODO_CONTABLE p
                INNER JOIN VENTA v ON p.anio = YEAR(v.fecha) AND p.mes = MONTH(v.fecha)
                WHERE v.id_venta = @sale FOR UPDATE", connection, transaction))
            {
                command.Parameters.AddWithValue("@sale", saleId);
                using (var reader = command.ExecuteReader())
                {
                    if (!reader.Read()) throw new InvalidOperationException("Período contable no disponible.");
                    if (reader["estado"].ToString() != "abierto")
                        throw new HttpException(409, "El período contable está cerrado. No se puede registrar la venta.");
                    periodId = Convert.ToInt32(reader["id_periodo"]);
                }
            }
            var accounts = ReadRules(connection, transaction);
            using (var command = new MySqlCommand(@"INSERT IGNORE INTO CUENTA_CONTABLE
                (codigo_cuenta, nombre, tipo) VALUES (@code, @name, @type)", connection, transaction))
            {
                var code = command.Parameters.Add("@code", MySqlDbType.VarChar);
                var name = command.Parameters.Add("@name", MySqlDbType.VarChar);
                var type = command.Parameters.Add("@type", MySqlDbType.VarChar);
                foreach (var rule in Rules)
                {
                    if (accounts[rule.Key] != rule.Code) continue;
                    code.Value = rule.Code;
                    name.Value = rule.Name;
                    type.Value = rule.Type;
                command.ExecuteNonQuery();
                }
            }

            int entryId;
            using (var command = new MySqlCommand(@"INSERT INTO ASIENTO
                (id_periodo, id_usuario, fecha, glosa, origen, id_documento)
                SELECT @period, @user, DATE(fecha), CONCAT('Venta #', id_venta), 'ventas', id_venta
                FROM VENTA WHERE id_venta = @sale; SELECT LAST_INSERT_ID();", connection, transaction))
            {
                command.Parameters.AddWithValue("@period", periodId);
                command.Parameters.AddWithValue("@user", userId);
                command.Parameters.AddWithValue("@sale", saleId);
                entryId = Convert.ToInt32(command.ExecuteScalar());
            }
            using (var command = new MySqlCommand(@"INSERT INTO DETALLE_ASIENTO (id_asiento, codigo_cuenta, debe, haber) VALUES
                (@entry, @payment, @total, 0), (@entry, @incomeAccount, 0, @net),
                (@entry, @taxAccount, 0, @tax), (@entry, @costAccount, @cost, 0),
                (@entry, @inventoryAccount, 0, @cost)", connection, transaction))
            {
                command.Parameters.AddWithValue("@entry", entryId);
                command.Parameters.AddWithValue("@payment", accounts[payment == "efectivo" ? "efectivo" : "banco"]);
                command.Parameters.AddWithValue("@incomeAccount", accounts["ingreso"]);
                command.Parameters.AddWithValue("@taxAccount", accounts["iva"]);
                command.Parameters.AddWithValue("@costAccount", accounts["costo"]);
                command.Parameters.AddWithValue("@inventoryAccount", accounts["inventario"]);
                command.Parameters.AddWithValue("@total", total);
                command.Parameters.AddWithValue("@net", net);
                command.Parameters.AddWithValue("@tax", tax);
                command.Parameters.AddWithValue("@cost", cost);
                command.ExecuteNonQuery();
            }
            return entryId;
        }
    }
}
