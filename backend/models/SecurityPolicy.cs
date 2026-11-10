using System;
using System.Collections.Generic;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Web;
using MySql.Data.MySqlClient;

namespace backend.Models
{
    internal static class SecurityPolicy
    {
        internal const int Read = 1, Edit = 2, Full = 3;
        internal static readonly string[] Modules = { "compras", "ventas", "inventario", "contabilidad", "catalogo" };
        internal static bool IsAdmin(string role) => Array.IndexOf(UserAccounts.AdminRoles, Normalize(role)) >= 0;
        internal static bool IsStaff(string role) => Array.IndexOf(UserAccounts.StaffRoles, Normalize(role)) >= 0;
        internal static string Normalize(string role) => role.Trim().ToLowerInvariant();
        internal static int Maximum(string module) => module == "catalogo" || module == "inventario" ? Read : Full;

        internal static Dictionary<string, int> Permissions(MySqlConnection connection, int roleId, string role)
        {
            role = Normalize(role);
            var permissions = new Dictionary<string, int>();
            foreach (var module in Modules) permissions[module] = 0;
            permissions["administracion"] = 0;
            permissions["perfil"] = Edit;
            if (IsAdmin(role))
            {
                foreach (var module in Modules) permissions[module] = Full;
                permissions["administracion"] = Full;
                return permissions;
            }
            if (role == "cliente")
            {
                permissions["catalogo"] = Read;
                return permissions;
            }
            if (!IsStaff(role)) return permissions;

            permissions["inventario"] = Read;
            if (role == "comprador" || role == "compradora") permissions["compras"] = Edit;
            if (role == "vendedor" || role == "vendedora") permissions["ventas"] = Edit;
            if (role == "contador" || role == "contadora") permissions["contabilidad"] = Full;
            try
            {
                using (var command = new MySqlCommand("SELECT modulo, nivel FROM ROL_PERMISO WHERE id_rol=@role", connection))
                {
                    command.Parameters.AddWithValue("@role", roleId);
                    using (var reader = command.ExecuteReader())
                        while (reader.Read())
                        {
                            var module = reader.GetString(0);
                            if (Array.IndexOf(Modules, module) >= 0) permissions[module] = reader.GetInt32(1);
                        }
                }
            }
            catch (MySqlException ex) when (ex.Number == 1146) { }
            return permissions;
        }

        internal static bool PasswordExpired(MySqlConnection connection, DateTime? changed)
        {
            try
            {
                using (var command = new MySqlCommand(@"SELECT DATEDIFF(CURRENT_DATE(),
                    GREATEST(activada, COALESCE(@changed, activada))) >= 15 FROM SEGURIDAD_POLITICA WHERE id=1", connection))
                {
                    command.Parameters.AddWithValue("@changed", (object)changed ?? DBNull.Value);
                    return Convert.ToBoolean(command.ExecuteScalar());
                }
            }
            catch (MySqlException ex) when (ex.Number == 1146) { return false; }
        }

        internal static string PasswordStamp(string passwordHash)
        {
            using (var hash = SHA256.Create())
                return Convert.ToBase64String(hash.ComputeHash(Encoding.UTF8.GetBytes(passwordHash)));
        }

        internal static void Log(MySqlConnection connection, MySqlTransaction transaction, int? actor,
            string module, string action, string detail, bool success = true, string attemptedEmail = "")
        {
            try
            {
                using (var command = new MySqlCommand(@"INSERT INTO SEGURIDAD_EVENTO
                    (fecha,id_usuario,usuario,rol,modulo,accion,detalle,exito)
                    SELECT UTC_TIMESTAMP(6), u.id_usuario, COALESCE(u.correo, @email), r.nombre,
                           @module,@action,@detail,@success
                    FROM (SELECT 1) subject LEFT JOIN USUARIO u ON u.id_usuario=@actor
                    LEFT JOIN ROL r ON r.id_rol=u.id_rol", connection, transaction))
                {
                    command.Parameters.AddWithValue("@actor", (object)actor ?? DBNull.Value);
                    command.Parameters.AddWithValue("@email", attemptedEmail);
                    command.Parameters.AddWithValue("@module", module);
                    command.Parameters.AddWithValue("@action", action);
                    command.Parameters.AddWithValue("@detail", detail);
                    command.Parameters.AddWithValue("@success", success);
                    command.ExecuteNonQuery();
                }
            }
            catch (MySqlException ex) when (ex.Number == 1146) { }
        }

        internal static DateTime LocalDayUtc(string day)
        {
            if (!DateTime.TryParseExact(day, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date)
                || date.Year < 1001 || date.Year > 9998)
                throw new HttpException(400, "Ingresa una fecha válida.");
            var zone = TimeZoneInfo.FindSystemTimeZoneById("Pacific SA Standard Time");
            while (zone.IsInvalidTime(date)) date = date.AddMinutes(1);
            return TimeZoneInfo.ConvertTimeToUtc(date, zone);
        }
    }
}
