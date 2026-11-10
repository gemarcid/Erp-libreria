using System;
using System.Globalization;
using System.Web;
using System.Web.Security;
using MySql.Data.MySqlClient;

namespace backend.Models
{
    public static class SessionAccess
    {
        public static int RequireUser(HttpRequestBase request, MySqlConnection connection, params string[] roles)
        {
            var user = ReadSession(request, connection);
            if (roles.Length > 0 && Array.IndexOf(roles, SecurityPolicy.Normalize(user.Role)) < 0)
                throw new HttpException(403, "Tu perfil no tiene acceso a este módulo.");
            return user.Id;
        }

        internal static int RequireModule(HttpRequestBase request, MySqlConnection connection, string module, int level)
        {
            var user = ReadSession(request, connection);
            if (SecurityPolicy.Permissions(connection, user.RoleId, user.Role)[module] < level)
                throw new HttpException(403, "Tu perfil no tiene el permiso requerido para esta operación.");
            return user.Id;
        }

        internal static SessionUser ReadSession(HttpRequestBase request, MySqlConnection connection)
        {
            var header = request.Headers["Authorization"];
            FormsAuthenticationTicket ticket = null;
            try
            {
                if (header != null && header.StartsWith("Bearer ", StringComparison.Ordinal))
                    ticket = FormsAuthentication.Decrypt(header.Substring(7));
            }
            catch { }
            int userId;
            if (ticket == null || ticket.Expired || !int.TryParse(ticket.Name, out userId) || userId <= 0)
                throw new HttpException(401, "Debes iniciar sesión nuevamente.");

            var user = FindUser(connection, "u.id_usuario", userId);
            if (user == null || !user.Active || (ticket.Version >= 2 &&
                !String.Equals(ticket.UserData, SecurityPolicy.PasswordStamp(user.PasswordHash), StringComparison.Ordinal)) ||
                SecurityPolicy.PasswordExpired(connection, user.PasswordChanged))
                throw new HttpException(401, "La sesión venció. Inicia sesión nuevamente.");
            return user;
        }

        internal static SessionUser FindUser(MySqlConnection connection, string email) =>
            FindUser(connection, "u.correo", email);

        private static SessionUser FindUser(MySqlConnection connection, string column, object value)
        {
            using (var command = new MySqlCommand(@"SELECT u.id_usuario,u.id_rol,u.nombre,u.correo,r.nombre,
                u.password_hash,u.fecha_ultimo_cambio_pass,u.estado
                FROM USUARIO u INNER JOIN ROL r ON r.id_rol=u.id_rol WHERE " + column + "=@value LIMIT 1", connection))
            {
                command.Parameters.AddWithValue("@value", value);
                using (var reader = command.ExecuteReader())
                    return reader.Read() ? new SessionUser {
                        Id = reader.GetInt32(0), RoleId = reader.GetInt32(1), Name = reader.GetString(2),
                        Email = reader.GetString(3), Role = reader.GetString(4), PasswordHash = reader.GetString(5).Trim(),
                        PasswordChanged = reader.IsDBNull(6) ? (DateTime?)null : reader.GetDateTime(6),
                        Active = reader.GetString(7) == "activo"
                    } : null;
            }
        }

        internal sealed class SessionUser
        {
            internal int Id, RoleId;
            internal string Name, Email, Role, PasswordHash;
            internal DateTime? PasswordChanged;
            internal bool Active;

            internal object Public(MySqlConnection connection) => new {
                id_usuario = Id.ToString(CultureInfo.InvariantCulture), id_rol = RoleId.ToString(CultureInfo.InvariantCulture),
                nombre = Name, correo = Email, rol = Role, permisos = SecurityPolicy.Permissions(connection, RoleId, Role)
            };
        }
    }
}
