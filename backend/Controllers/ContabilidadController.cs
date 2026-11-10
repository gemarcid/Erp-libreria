using System;
using System.Collections.Generic;
using System.Configuration;
using System.Globalization;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using System.Text.RegularExpressions;
using backend.Models;
using MySql.Data.MySqlClient;

namespace backend.Controllers
{
    public class ContabilidadController : Controller
    {
        private static readonly string[] AccountTypes = { "activo", "pasivo", "patrimonio", "ingreso", "gasto", "costo" };

        [HttpGet]
        public JsonResult Diario()
        {
            Response.Cache.SetNoStore();
            try
            {
                using (var connection = new MySqlConnection(ConfigurationManager.ConnectionStrings["ConexionMySQL"].ConnectionString))
                {
                    connection.Open();
                    SessionAccess.RequireModule(Request, connection, "contabilidad", SecurityPolicy.Read);
                    var accounts = new List<object>();
                    var periods = new List<object>();
                    var entries = new List<JournalEntry>();
                    // Las tres lecturas comparten la misma vista de datos confirmados.
                    object[] automatic;
                    using (var transaction = connection.BeginTransaction(System.Data.IsolationLevel.RepeatableRead))
                    {
                        var rules = VentaAccounting.ReadRules(connection, transaction);
                        automatic = VentaAccounting.Rules.Select(rule => new {
                            key = rule.Key, label = rule.Label, account = rules[rule.Key],
                            type = rule.Key == "costo" ? "costo" : rule.Type, defaultAccount = rule.Code
                        }).ToArray();
                        using (var command = new MySqlCommand("SELECT codigo_cuenta, nombre, tipo FROM CUENTA_CONTABLE ORDER BY codigo_cuenta", connection, transaction))
                        using (var reader = command.ExecuteReader())
                            while (reader.Read()) accounts.Add(new {
                                code = reader["codigo_cuenta"].ToString(), name = reader["nombre"].ToString(), type = reader["tipo"].ToString()
                            });
                        using (var command = new MySqlCommand("SELECT anio, mes, estado FROM PERIODO_CONTABLE ORDER BY anio DESC, mes DESC", connection, transaction))
                        using (var reader = command.ExecuteReader())
                            while (reader.Read())
                            {
                                var date = new DateTime(Convert.ToInt32(reader["anio"]), Convert.ToInt32(reader["mes"]), 1);
                                periods.Add(new { value = date.ToString("yyyy-MM"),
                                    label = date.ToString("MMMM yyyy", System.Globalization.CultureInfo.GetCultureInfo("es-CL")),
                                    status = reader["estado"].ToString() });
                            }
                        using (var command = new MySqlCommand(@"SELECT a.id_asiento, a.fecha, a.glosa, a.origen, a.id_documento,
                            p.anio, p.mes, v.folio, v.tipo_documento, d.codigo_cuenta, d.debe, d.haber, d.id_detalle
                            FROM ASIENTO a LEFT JOIN DETALLE_ASIENTO d ON d.id_asiento = a.id_asiento
                            INNER JOIN PERIODO_CONTABLE p ON p.id_periodo = a.id_periodo
                            LEFT JOIN VENTA v ON a.origen = 'ventas' AND v.id_venta = a.id_documento
                            ORDER BY a.fecha DESC, a.id_asiento DESC, d.id_detalle", connection, transaction))
                        using (var reader = command.ExecuteReader())
                        {
                            JournalEntry entry = null;
                            while (reader.Read())
                            {
                                var code = "AS-" + Convert.ToInt32(reader["id_asiento"]).ToString("D6");
                                if (entry == null || entry.code != code)
                                {
                                    var origin = reader["origen"].ToString();
                                    var folio = Convert.ToString(reader["folio"]);
                                    entry = new JournalEntry {
                                        code = code, date = Convert.ToDateTime(reader["fecha"]).ToString("yyyy-MM-dd"),
                                        period = new DateTime(Convert.ToInt32(reader["anio"]), Convert.ToInt32(reader["mes"]), 1).ToString("yyyy-MM"),
                                        description = Convert.ToString(reader["glosa"]),
                                        source = origin == "ventas" ? "Ventas" : origin == "compras" ? "Compras" : "Manual",
                                        document = !string.IsNullOrEmpty(folio) ? folio :
                                            reader["id_documento"] == DBNull.Value ? "" :
                                            origin == "ventas" ? (Convert.ToString(reader["tipo_documento"]).Trim() + " #" + reader["id_documento"]).Trim() :
                                            "Documento #" + reader["id_documento"]
                                    };
                                    entries.Add(entry);
                                }
                                if (reader["codigo_cuenta"] != DBNull.Value)
                                    entry.lines.Add(new { id = Convert.ToInt32(reader["id_detalle"]), account = reader["codigo_cuenta"].ToString(),
                                        debit = Convert.ToDecimal(reader["debe"]), credit = Convert.ToDecimal(reader["haber"]) });
                            }
                        }
                        transaction.Commit();
                    }
                    var result = Json(new { success = true, accounts, periods, entries, automatic }, JsonRequestBehavior.AllowGet);
                    result.MaxJsonLength = int.MaxValue;
                    return result;
                }
            }
            catch (HttpException ex) { return Error(ex.GetHttpCode(), ex.Message); }
            catch (Exception ex)
            {
                System.Diagnostics.Trace.TraceError("Error al consultar contabilidad: {0}", ex.GetType().Name);
                return Error(503, "No se pudo consultar el libro diario.");
            }
        }

        [HttpPost]
        public JsonResult Cuenta(string code, string name, string type, bool edit = false)
        {
            return Write((connection, transaction, user) =>
            {
                code = (code ?? "").Trim();
                name = (name ?? "").Trim();
                if (!Regex.IsMatch(code, @"\A[A-Za-z0-9][A-Za-z0-9._-]{0,19}\z") ||
                    name.Length == 0 || name.Length > 100 || !AccountTypes.Contains(type))
                    throw new HttpException(400, "Ingresa un código, nombre y tipo de cuenta válidos.");
                if (!edit && VentaAccounting.Rules.Any(rule => rule.Code == code && rule.Type != type &&
                    !(rule.Key == "costo" && type == "costo")))
                    throw new HttpException(400, "El código corresponde a una cuenta automática predeterminada de otro tipo.");
                if (edit)
                {
                    var currentType = Convert.ToString(Scalar(connection, transaction,
                        "SELECT tipo FROM CUENTA_CONTABLE WHERE codigo_cuenta = @code FOR UPDATE", code));
                    if (currentType.Length == 0) throw new HttpException(404, "La cuenta no existe.");
                    if (currentType != type &&
                        (VentaAccounting.ReadRules(connection, transaction).Values.Contains(code, StringComparer.OrdinalIgnoreCase) ||
                         VentaAccounting.Rules.Any(rule => rule.Code == code) ||
                         Scalar(connection, transaction, "SELECT 1 FROM DETALLE_ASIENTO WHERE codigo_cuenta = @code LIMIT 1 FOR UPDATE", code) != null))
                        throw new HttpException(409, "El tipo de una cuenta con movimientos o asignación automática no se puede cambiar.");
                }
                using (var command = new MySqlCommand(edit
                    ? "UPDATE CUENTA_CONTABLE SET nombre = @name, tipo = @type WHERE codigo_cuenta = @code"
                    : "INSERT INTO CUENTA_CONTABLE (codigo_cuenta, nombre, tipo) VALUES (@code, @name, @type)",
                    connection, transaction))
                {
                    command.Parameters.AddWithValue("@code", code);
                    command.Parameters.AddWithValue("@name", name);
                    command.Parameters.AddWithValue("@type", type);
                    command.ExecuteNonQuery();
                }
                SecurityPolicy.Log(connection, transaction, user, "contabilidad", edit ? "Editar cuenta" : "Crear cuenta",
                    "Cuenta " + code);
                return new { success = true };
            });
        }

        [HttpPost]
        public JsonResult Automatica(string operation, string account)
        {
            return Write((connection, transaction, user) =>
            {
                var rule = VentaAccounting.Rules.FirstOrDefault(item => item.Key == operation);
                if (rule.Key == null) throw new HttpException(400, "La operación automática no es válida.");
                var type = Convert.ToString(Scalar(connection, transaction,
                    "SELECT tipo FROM CUENTA_CONTABLE WHERE codigo_cuenta = @code FOR UPDATE", account));
                var compatible = rule.Key == "costo" ? type == "costo" || (account == rule.Code && type == "gasto") : type == rule.Type;
                if (!compatible) throw new HttpException(400, "Selecciona una cuenta registrada del tipo requerido.");
                using (var command = new MySqlCommand(@"INSERT INTO CUENTA_AUTOMATICA (operacion, codigo_cuenta)
                    SELECT @operation, codigo_cuenta FROM CUENTA_CONTABLE WHERE codigo_cuenta = @account
                    ON DUPLICATE KEY UPDATE codigo_cuenta = @account", connection, transaction))
                {
                    command.Parameters.AddWithValue("@operation", rule.Key);
                    command.Parameters.AddWithValue("@account", account);
                    command.ExecuteNonQuery();
                }
                SecurityPolicy.Log(connection, transaction, user, "contabilidad", "Configurar cuenta automática",
                    operation + " · Cuenta " + account);
                return new { success = true };
            }, SecurityPolicy.Full);
        }

        [HttpPost]
        public JsonResult Periodo(string period, bool close = false)
        {
            return Write((connection, transaction, user) =>
            {
                var month = ParseDate(period + "-01");
                if (!close)
                {
                    using (var command = new MySqlCommand(
                        "INSERT INTO PERIODO_CONTABLE (anio, mes, estado) VALUES (@year, @month, 'abierto')", connection, transaction))
                    {
                        command.Parameters.AddWithValue("@year", month.Year);
                        command.Parameters.AddWithValue("@month", month.Month);
                        command.ExecuteNonQuery();
                    }
                }
                else
                {
                    var id = FindPeriod(connection, transaction, month, out var status);
                    RequireOpenPeriod(id, status);
                    using (var command = new MySqlCommand(@"SELECT 1 FROM ASIENTO a
                        LEFT JOIN DETALLE_ASIENTO d ON d.id_asiento = a.id_asiento
                        WHERE a.id_periodo = @id GROUP BY a.id_asiento
                        HAVING COUNT(d.id_detalle) < 2 OR SUM(d.debe) <> SUM(d.haber) OR SUM(d.debe) <= 0
                            OR SUM(d.debe < 0 OR d.haber < 0 OR (d.debe > 0 AND d.haber > 0)) > 0
                        LIMIT 1", connection, transaction))
                    {
                        command.Parameters.AddWithValue("@id", id);
                        if (command.ExecuteScalar() != null)
                            throw new HttpException(409, "El período contiene asientos inválidos o descuadrados.");
                        command.CommandText = "UPDATE PERIODO_CONTABLE SET estado = 'cerrado' WHERE id_periodo = @id";
                        command.ExecuteNonQuery();
                    }
                }
                SecurityPolicy.Log(connection, transaction, user, "contabilidad", close ? "Cerrar período" : "Abrir período", period);
                return new { success = true };
            }, close ? SecurityPolicy.Full : SecurityPolicy.Edit);
        }

        [HttpPost]
        public JsonResult Manual(string date, string description, string requestId, ManualLine[] lines)
        {
            return Write((connection, transaction, user) =>
            {
                var postingDate = ParseDate(date);
                description = (description ?? "").Trim();
                if (!Guid.TryParseExact(requestId, "D", out var key) || description.Length == 0 || description.Length > 255 ||
                    lines == null || lines.Length < 2 || lines.Length > 100 ||
                    lines.Any(line => line == null || string.IsNullOrWhiteSpace(line.account) ||
                        line.account.Length > 20 || !ValidAmount(line.debit) || !ValidAmount(line.credit) ||
                        (line.debit == 0) == (line.credit == 0)))
                    throw new HttpException(400, "Ingresa una glosa y entre 2 y 100 líneas, con importe válido solo al Debe o al Haber.");
                if (lines.Sum(line => line.debit) != lines.Sum(line => line.credit))
                    throw new HttpException(400, "El Debe debe ser igual al Haber.");

                var periodId = FindPeriod(connection, transaction, postingDate, out var status);
                int id;
                using (var command = new MySqlCommand(@"SELECT id_asiento FROM ASIENTO
                    WHERE id_usuario = @user AND clave_solicitud = @key", connection, transaction))
                {
                    command.Parameters.AddWithValue("@user", user);
                    command.Parameters.AddWithValue("@key", key.ToString("D"));
                    var previous = command.ExecuteScalar();
                    if (previous != null) return new { success = true, code = EntryCode(Convert.ToInt32(previous)) };
                    RequireOpenPeriod(periodId, status);
                    command.CommandText = @"INSERT INTO ASIENTO (id_periodo, id_usuario, fecha, glosa, origen, clave_solicitud)
                        VALUES (@period, @user, @date, @description, 'manual', @key); SELECT LAST_INSERT_ID();";
                    command.Parameters.AddWithValue("@period", periodId);
                    command.Parameters.AddWithValue("@date", postingDate);
                    command.Parameters.AddWithValue("@description", description);
                    id = Convert.ToInt32(command.ExecuteScalar());
                }
                using (var command = new MySqlCommand(@"INSERT INTO DETALLE_ASIENTO (id_asiento, codigo_cuenta, debe, haber)
                    VALUES (@entry, @account, @debit, @credit)", connection, transaction))
                {
                    command.Parameters.AddWithValue("@entry", id);
                    var account = command.Parameters.Add("@account", MySqlDbType.VarChar);
                    var debit = command.Parameters.Add("@debit", MySqlDbType.Decimal);
                    var credit = command.Parameters.Add("@credit", MySqlDbType.Decimal);
                    foreach (var line in lines)
                    {
                        account.Value = line.account;
                        debit.Value = line.debit;
                        credit.Value = line.credit;
                        command.ExecuteNonQuery();
                    }
                }
                SecurityPolicy.Log(connection, transaction, user, "contabilidad", "Registrar asiento manual", EntryCode(id));
                return new { success = true, code = EntryCode(id) };
            });
        }

        private JsonResult Write(Func<MySqlConnection, MySqlTransaction, int, object> action, int level = SecurityPolicy.Edit)
        {
            Response.Cache.SetNoStore();
            try
            {
                if (!ModelState.IsValid) return Error(400, "Los datos contables no son válidos.");
                using (var connection = new MySqlConnection(ConfigurationManager.ConnectionStrings["ConexionMySQL"].ConnectionString))
                {
                    connection.Open();
                    var user = SessionAccess.RequireModule(Request, connection, "contabilidad", level);
                    using (var transaction = connection.BeginTransaction(System.Data.IsolationLevel.ReadCommitted))
                    {
                        var result = action(connection, transaction, user);
                        transaction.Commit();
                        return Json(result);
                    }
                }
            }
            catch (HttpException ex) { return Error(ex.GetHttpCode(), ex.Message); }
            catch (MySqlException ex) when (ex.Number == 1062) { return Error(409, "El registro ya existe."); }
            catch (MySqlException ex) when (ex.Number == 1452) { return Error(400, "Una cuenta seleccionada no existe."); }
            catch (MySqlException ex) when (ex.Number == 1146 || ex.Number == 1054)
            { return Error(503, "La base de datos requiere la migración de Contabilidad."); }
            catch (Exception ex)
            {
                System.Diagnostics.Trace.TraceError("Error al guardar en contabilidad: {0}", ex.GetType().Name);
                return Error(503, "No se pudo guardar la operación contable.");
            }
        }

        private static object Scalar(MySqlConnection connection, MySqlTransaction transaction, string sql, string code)
        {
            using (var command = new MySqlCommand(sql, connection, transaction))
            {
                command.Parameters.AddWithValue("@code", code);
                return command.ExecuteScalar();
            }
        }

        private static DateTime ParseDate(string value)
        {
            if (!DateTime.TryParseExact(value, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date) ||
                date.Year < 1000) throw new HttpException(400, "Selecciona una fecha o un período válido.");
            return date;
        }

        private static int FindPeriod(MySqlConnection connection, MySqlTransaction transaction, DateTime date, out string status)
        {
            using (var command = new MySqlCommand(@"SELECT id_periodo, estado FROM PERIODO_CONTABLE
                WHERE anio = @year AND mes = @month FOR UPDATE", connection, transaction))
            {
                command.Parameters.AddWithValue("@year", date.Year);
                command.Parameters.AddWithValue("@month", date.Month);
                using (var reader = command.ExecuteReader())
                {
                    if (reader.Read())
                    {
                        status = reader.GetString(1);
                        return reader.GetInt32(0);
                    }
                }
            }
            status = null;
            return 0;
        }

        private static void RequireOpenPeriod(int id, string status)
        {
            if (id == 0) throw new HttpException(409, "Abre el período contable de esa fecha antes de continuar.");
            if (status != "abierto") throw new HttpException(409, "El período contable está cerrado.");
        }

        private static bool ValidAmount(decimal amount) =>
            amount >= 0 && amount <= 9999999999.99m && decimal.Round(amount, 2) == amount;

        private static string EntryCode(int id) => "AS-" + id.ToString("D6");

        public class ManualLine
        {
            public string account { get; set; }
            public decimal debit { get; set; }
            public decimal credit { get; set; }
        }

        private JsonResult Error(int status, string message)
        {
            Response.StatusCode = status;
            Response.TrySkipIisCustomErrors = true;
            return Json(new { error = message }, JsonRequestBehavior.AllowGet);
        }

        private class JournalEntry
        {
            public string code { get; set; }
            public string date { get; set; }
            public string period { get; set; }
            public string description { get; set; }
            public string source { get; set; }
            public string document { get; set; }
            public List<object> lines = new List<object>();
        }
    }
}
