using System;
using System.Collections.Generic;
using System.Globalization;
using System.Web;
using System.Web.Mvc;
using backend.Data;
using backend.Models;
using MySql.Data.MySqlClient;

namespace backend.Controllers
{
    public class AdministracionController : Controller
    {
        [HttpGet]
        public JsonResult Listar()
        {
            return Execute(connection => {
                SessionAccess.RequireUser(Request, connection, UserAccounts.AdminRoles);
                var users = new List<object>();
                var roles = new List<object>();
                using (var command = new MySqlCommand(@"SELECT u.id_usuario, u.nombre, u.correo, u.id_rol,
                    r.nombre AS rol, u.estado, u.fecha_creacion, c.rut, c.tipo_cliente FROM USUARIO u
                    INNER JOIN ROL r ON r.id_rol = u.id_rol LEFT JOIN CLIENTE c ON c.id_cliente=u.id_cliente
                    ORDER BY u.nombre, u.id_usuario", connection))
                using (var reader = command.ExecuteReader())
                    while (reader.Read()) users.Add(new {
                        id = Convert.ToInt32(reader["id_usuario"]), nombre = reader["nombre"].ToString(),
                        correo = reader["correo"].ToString(), idRol = Convert.ToInt32(reader["id_rol"]),
                        rol = reader["rol"].ToString(), estado = reader["estado"].ToString(),
                        fechaCreacion = Convert.ToDateTime(reader["fecha_creacion"]).ToString("yyyy-MM-dd"),
                        rut = reader["rut"].ToString(), tipoCliente = reader["tipo_cliente"].ToString()
                    });
                using (var command = new MySqlCommand("SELECT id_rol, nombre FROM ROL ORDER BY id_rol", connection))
                using (var reader = command.ExecuteReader())
                    while (reader.Read()) {
                        var role = reader["nombre"].ToString();
                        if (Array.IndexOf(UserAccounts.StaffRoles, role.ToLowerInvariant()) >= 0 || role.Equals("cliente", StringComparison.OrdinalIgnoreCase))
                            roles.Add(new { id = Convert.ToInt32(reader["id_rol"]), nombre = role });
                    }
                return new { usuarios = users, perfiles = roles };
            });
        }

        [HttpPost]
        public JsonResult Guardar(int? id, string nombre, string correo, string password, int idRol, string estado, string rut, string tipoCliente)
        {
            return Execute(connection => {
                var actor = SessionAccess.RequireUser(Request, connection, UserAccounts.AdminRoles);
                UserAccounts.Validate(nombre, correo, password, !id.HasValue);
                if (estado != "activo" && estado != "inactivo") throw new HttpException(400, "Estado no válido.");
                if (id.HasValue && id.Value <= 0) throw new HttpException(400, "Usuario no válido.");
                using (var transaction = connection.BeginTransaction())
                {
                    // Serialize changes that could remove the last active administrator.
                    var admins = new List<int>();
                    using (var command = new MySqlCommand(@"SELECT u.id_usuario FROM USUARIO u INNER JOIN ROL r ON r.id_rol=u.id_rol
                        WHERE u.estado='activo' AND LOWER(r.nombre) IN ('administrador','administradora','admin')
                        ORDER BY u.id_usuario FOR UPDATE", connection, transaction))
                    using (var reader = command.ExecuteReader())
                        while (reader.Read()) admins.Add(reader.GetInt32(0));
                    using (var command = new MySqlCommand("SELECT estado, id_rol FROM USUARIO WHERE id_usuario=@id FOR UPDATE", connection, transaction)) {
                        command.Parameters.AddWithValue("@id", actor);
                        using (var reader = command.ExecuteReader()) {
                            if (!reader.Read() || reader.GetString(0) != "activo") throw new HttpException(403, "Tu cuenta ya no tiene permisos.");
                        }
                    }
                    if (!admins.Contains(actor)) throw new HttpException(403, "Tu cuenta ya no tiene permisos.");
                    string role;
                    using (var command = new MySqlCommand("SELECT nombre FROM ROL WHERE id_rol=@role", connection, transaction)) {
                        command.Parameters.AddWithValue("@role", idRol);
                        role = Convert.ToString(command.ExecuteScalar()).ToLowerInvariant();
                    }
                    if (Array.IndexOf(UserAccounts.StaffRoles, role) < 0 && role != "cliente") throw new HttpException(400, "Perfil no válido.");
                    var remainsAdmin = estado == "activo" && Array.IndexOf(UserAccounts.AdminRoles, role) >= 0;
                    if (id == actor && !remainsAdmin) throw new HttpException(400, "No puedes desactivar tu cuenta ni quitarte el perfil de administrador.");
                    if (id.HasValue && admins.Contains(id.Value) && admins.Count <= 1 && !remainsAdmin)
                        throw new HttpException(400, "Debe existir al menos un administrador activo.");
                    int savedId;
                    if (!id.HasValue) savedId = UserAccounts.Create(connection, transaction, nombre, correo, password, idRol, estado);
                    else {
                        using (var command = new MySqlCommand("SELECT id_usuario FROM USUARIO WHERE id_usuario=@id FOR UPDATE", connection, transaction)) {
                            command.Parameters.AddWithValue("@id", id.Value);
                            if (command.ExecuteScalar() == null) throw new HttpException(404, "El usuario no existe.");
                        }
                        var passwordSql = string.IsNullOrEmpty(password) ? "" : ", password_hash=@hash, fecha_ultimo_cambio_pass=CURRENT_DATE()";
                        using (var command = new MySqlCommand("UPDATE USUARIO SET nombre=@name, correo=@email, id_rol=@role, estado=@status" + passwordSql + " WHERE id_usuario=@id", connection, transaction)) {
                            command.Parameters.AddWithValue("@name", nombre.Trim());
                            command.Parameters.AddWithValue("@email", correo.Trim().ToLowerInvariant());
                            command.Parameters.AddWithValue("@role", idRol);
                            command.Parameters.AddWithValue("@status", estado);
                            command.Parameters.AddWithValue("@id", id.Value);
                            if (!string.IsNullOrEmpty(password)) command.Parameters.AddWithValue("@hash", BCrypt.Net.BCrypt.HashPassword(password, 11));
                            command.ExecuteNonQuery();
                        }
                        savedId = id.Value;
                    }
                    if (role == "cliente") UserAccounts.SaveCustomer(connection, transaction, savedId, nombre, rut, tipoCliente);
                    SecurityPolicy.Log(connection, transaction, actor, "administracion",
                        id.HasValue ? "Actualizar usuario" : "Crear usuario",
                        "Usuario #" + savedId + " · Perfil " + role + " · Estado " + estado +
                        (id.HasValue && !string.IsNullOrEmpty(password) ? " · Contraseña restablecida" : ""));
                    transaction.Commit();
                    return new { success = true, id = savedId };
                }
            });
        }

        [HttpGet]
        public JsonResult Roles()
        {
            return Execute(connection => {
                SessionAccess.RequireUser(Request, connection, UserAccounts.AdminRoles);
                var roles = new List<Tuple<int, string, string>>();
                using (var command = new MySqlCommand("SELECT id_rol,nombre,descripcion FROM ROL ORDER BY id_rol", connection))
                using (var reader = command.ExecuteReader())
                    while (reader.Read())
                        roles.Add(Tuple.Create(reader.GetInt32(0), reader.GetString(1), Convert.ToString(reader.GetValue(2))));
                var profiles = new List<object>();
                foreach (var role in roles)
                    profiles.Add(new {
                        id = role.Item1, nombre = role.Item2, descripcion = role.Item3,
                        editable = SecurityPolicy.IsStaff(role.Item2) && !SecurityPolicy.IsAdmin(role.Item2),
                        permisos = SecurityPolicy.Permissions(connection, role.Item1, role.Item2)
                    });
                using (var command = new MySqlCommand("SELECT activada FROM SEGURIDAD_POLITICA WHERE id=1", connection))
                    return new { perfiles = profiles, desde = Convert.ToDateTime(command.ExecuteScalar()).ToString("yyyy-MM-dd") };
            });
        }

        [HttpPost]
        public JsonResult GuardarPermiso(int idRol, string modulo, int nivel = -1)
        {
            return Execute(connection => {
                var actor = SessionAccess.RequireUser(Request, connection, UserAccounts.AdminRoles);
                if (Array.IndexOf(SecurityPolicy.Modules, modulo) < 0 || nivel < 0 || nivel > SecurityPolicy.Maximum(modulo))
                    throw new HttpException(400, "Selecciona un módulo y un nivel de acceso válidos.");
                using (var transaction = connection.BeginTransaction())
                {
                    var role = ReadRole(connection, transaction, idRol);
                    if (!SecurityPolicy.IsStaff(role) || SecurityPolicy.IsAdmin(role))
                        throw new HttpException(400, "Los permisos de ese perfil están protegidos.");
                    using (var command = new MySqlCommand(@"INSERT INTO ROL_PERMISO (id_rol,modulo,nivel)
                        VALUES (@role,@module,@level) ON DUPLICATE KEY UPDATE nivel=@level", connection, transaction))
                    {
                        command.Parameters.AddWithValue("@role", idRol);
                        command.Parameters.AddWithValue("@module", modulo);
                        command.Parameters.AddWithValue("@level", nivel);
                        if (command.ExecuteNonQuery() > 0)
                            SecurityPolicy.Log(connection, transaction, actor, "administracion", "Cambiar permiso",
                                role + " · " + modulo + " · " + new[] { "Sin acceso", "Consulta", "Editar", "Total" }[nivel]);
                    }
                    transaction.Commit();
                }
                return new { success = true };
            });
        }

        [HttpPost]
        public JsonResult GuardarRol(int idRol, string descripcion)
        {
            return Execute(connection => {
                var actor = SessionAccess.RequireUser(Request, connection, UserAccounts.AdminRoles);
                descripcion = (descripcion ?? "").Trim();
                if (descripcion.Length > 255) throw new HttpException(400, "La descripción admite hasta 255 caracteres.");
                using (var transaction = connection.BeginTransaction())
                {
                    var role = ReadRole(connection, transaction, idRol);
                    using (var command = new MySqlCommand("UPDATE ROL SET descripcion=@description WHERE id_rol=@id",
                        connection, transaction))
                    {
                        command.Parameters.AddWithValue("@description", descripcion);
                        command.Parameters.AddWithValue("@id", idRol);
                        command.ExecuteNonQuery();
                    }
                    SecurityPolicy.Log(connection, transaction, actor, "administracion", "Editar perfil", "Perfil " + role);
                    transaction.Commit();
                }
                return new { success = true };
            });
        }

        [HttpGet]
        public JsonResult Eventos(string vista, string desde, string hasta, string modulo, string buscar, string resultado, int pagina = 1)
        {
            return Execute(connection => {
                SessionAccess.RequireUser(Request, connection, UserAccounts.AdminRoles);
                if ((vista != "accesos" && vista != "operaciones" && vista != "actividad") || pagina < 1 || pagina > 10000)
                    throw new HttpException(400, "La consulta no es válida.");
                if (!DateTime.TryParseExact(hasta, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var last)
                    || last.Year >= 9998)
                    throw new HttpException(400, "Selecciona una fecha final válida.");
                var start = SecurityPolicy.LocalDayUtc(desde);
                var end = SecurityPolicy.LocalDayUtc(last.AddDays(1).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
                if (end <= start || end - start > TimeSpan.FromDays(367))
                    throw new HttpException(400, "Selecciona un rango de hasta un año.");
                var activity = vista == "actividad";
                var filter = " WHERE fecha>=@start AND fecha<@end AND modulo" + (vista == "accesos" ? "=" : "<>") + "'acceso'";
                if (!string.IsNullOrWhiteSpace(modulo) && vista != "accesos") filter += " AND modulo=@module";
                if (!string.IsNullOrWhiteSpace(buscar)) filter += " AND LOCATE(@search, usuario)>0";
                if (vista == "accesos" && (resultado == "exito" || resultado == "fallo")) filter += " AND exito=@success";
                if (activity) filter += " AND exito=1";
                const int pageSize = 100;
                var rows = new List<object>();
                using (var command = new MySqlCommand(activity
                    ? "SELECT usuario,rol,modulo,COUNT(*) AS total FROM SEGURIDAD_EVENTO" + filter +
                        " GROUP BY usuario,rol,modulo ORDER BY total DESC,usuario,rol,modulo LIMIT 101 OFFSET @offset"
                    : "SELECT id_evento,fecha,usuario,rol,modulo,accion,detalle,exito FROM SEGURIDAD_EVENTO" + filter +
                        " ORDER BY fecha DESC,id_evento DESC LIMIT 101 OFFSET @offset", connection))
                {
                    command.Parameters.AddWithValue("@start", start);
                    command.Parameters.AddWithValue("@end", end);
                    command.Parameters.AddWithValue("@module", modulo ?? "");
                    command.Parameters.AddWithValue("@search", buscar ?? "");
                    command.Parameters.AddWithValue("@success", resultado == "exito");
                    command.Parameters.AddWithValue("@offset", (pagina - 1) * pageSize);
                    using (var reader = command.ExecuteReader())
                        while (reader.Read())
                        {
                            var user = reader["usuario"].ToString();
                            var role = reader["rol"].ToString();
                            var module = reader["modulo"].ToString();
                            if (activity) rows.Add(new { usuario = user, rol = role, modulo = module, total = Convert.ToInt64(reader["total"]) });
                            else rows.Add(new {
                                id = Convert.ToInt64(reader["id_evento"]),
                                fecha = Convert.ToDateTime(reader["fecha"]).ToString("yyyy-MM-dd'T'HH:mm:ss'Z'"),
                                usuario = user, rol = role, modulo = module, accion = reader["accion"].ToString(),
                                detalle = reader["detalle"].ToString(), exito = Convert.ToBoolean(reader["exito"])
                            });
                        }
                }
                var more = rows.Count > pageSize;
                if (more) rows.RemoveAt(pageSize);
                return new { filas = rows, mas = more };
            });
        }

        private static string ReadRole(MySqlConnection connection, MySqlTransaction transaction, int id)
        {
            using (var command = new MySqlCommand("SELECT nombre FROM ROL WHERE id_rol=@id FOR UPDATE", connection, transaction))
            {
                command.Parameters.AddWithValue("@id", id);
                return Convert.ToString(command.ExecuteScalar() ?? throw new HttpException(404, "El perfil no existe."));
            }
        }

        private JsonResult Execute(Func<MySqlConnection, object> action)
        {
            Response.Cache.SetNoStore();
            try { using (var connection = DbConnectionFactory.CreateConnection()) return Json(action(connection), JsonRequestBehavior.AllowGet); }
            catch (HttpException ex) { return Error(ex.GetHttpCode(), ex.Message); }
            catch (MySqlException ex) when (ex.Number == 1062) { return Error(409, "Ya existe un usuario con ese correo."); }
            catch (MySqlException ex) when (ex.Number == 1146) { return Error(503, "Aplica la migración de Administración y Seguridad."); }
            catch (Exception ex) { System.Diagnostics.Trace.TraceError("Administración: {0}", ex.GetType().Name); return Error(503, "No se pudo completar la operación de usuarios."); }
        }
        private JsonResult Error(int status, string message) {
            Response.StatusCode = status; Response.TrySkipIisCustomErrors = true;
            return Json(new { error = message }, JsonRequestBehavior.AllowGet);
        }
    }
}
