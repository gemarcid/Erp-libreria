using System;
using System.Collections.Generic;
using System.Web;
using System.Web.Mvc;
using backend.Data;
using backend.Models;
using MySql.Data.MySqlClient;

namespace backend.Controllers
{
    public class ClienteController : Controller
    {
        [HttpGet]
        public JsonResult Catalogo()
        {
            return Execute(connection => {
                var user = SessionAccess.RequireModule(Request, connection, "catalogo", SecurityPolicy.Read);
                var books = new List<object>();
                using (var command = new MySqlCommand(@"SELECT isbn, titulo, autor, categoria, precio_venta,
                    stock_actual > 0 AS disponible FROM LIBRO WHERE activo=TRUE ORDER BY titulo,isbn", connection))
                using (var reader = command.ExecuteReader())
                    while (reader.Read()) books.Add(new {
                        isbn = reader["isbn"].ToString(), titulo = reader["titulo"].ToString(),
                        autor = reader["autor"].ToString(), categoria = reader["categoria"].ToString(),
                        precio = Convert.ToDecimal(reader["precio_venta"]), disponible = Convert.ToBoolean(reader["disponible"])
                    });
                SecurityPolicy.Log(connection, null, user, "catalogo", "Consultar catálogo", "Listado de libros");
                return books;
            });
        }

        [HttpGet]
        public JsonResult Perfil()
        {
            return Execute(connection => {
                var id = SessionAccess.RequireUser(Request, connection);
                using (var command = new MySqlCommand(@"SELECT u.nombre,u.correo,c.rut,c.tipo_cliente,c.puntos_fidelidad FROM USUARIO u
                    LEFT JOIN CLIENTE c ON c.id_cliente=u.id_cliente WHERE u.id_usuario=@id", connection)) {
                    command.Parameters.AddWithValue("@id", id);
                    using (var reader = command.ExecuteReader()) {
                        reader.Read();
                        return new { nombre = reader["nombre"].ToString(), correo = reader["correo"].ToString(),
                            rut = reader["rut"].ToString(), tipoCliente = reader["tipo_cliente"].ToString(),
                            puntosFidelidad = reader["puntos_fidelidad"] == DBNull.Value ? 0 : Convert.ToInt32(reader["puntos_fidelidad"]) };
                    }
                }
            });
        }

        [HttpPost]
        public JsonResult GuardarPerfil(string nombre, string correo, string passwordActual, string password)
        {
            return Execute(connection => {
                var id = SessionAccess.RequireUser(Request, connection);
                UserAccounts.Validate(nombre, correo, password, false);
                using (var transaction = connection.BeginTransaction()) {
                    using (var command = new MySqlCommand("SELECT password_hash, estado FROM USUARIO WHERE id_usuario=@id FOR UPDATE", connection, transaction)) {
                        command.Parameters.AddWithValue("@id", id);
                        using (var reader = command.ExecuteReader()) {
                            if (!reader.Read() || reader["estado"].ToString() != "activo") throw new HttpException(401, "La cuenta ya no está activa.");
                            if (string.IsNullOrEmpty(passwordActual) || System.Text.Encoding.UTF8.GetByteCount(passwordActual) > 72 ||
                                !BCrypt.Net.BCrypt.Verify(passwordActual, reader["password_hash"].ToString()))
                                throw new HttpException(400, "La contraseña actual no es correcta.");
                        }
                    }
                    var passwordSql = string.IsNullOrEmpty(password) ? "" : ", password_hash=@hash,fecha_ultimo_cambio_pass=CURRENT_DATE()";
                    using (var command = new MySqlCommand("UPDATE USUARIO SET nombre=@name,correo=@email" + passwordSql + " WHERE id_usuario=@id", connection, transaction)) {
                        command.Parameters.AddWithValue("@id", id);
                        command.Parameters.AddWithValue("@name", nombre.Trim());
                        command.Parameters.AddWithValue("@email", correo.Trim().ToLowerInvariant());
                        if (!string.IsNullOrEmpty(password)) command.Parameters.AddWithValue("@hash", BCrypt.Net.BCrypt.HashPassword(password, 11));
                        command.ExecuteNonQuery();
                    }
                    object linkedId;
                    using (var command = new MySqlCommand("SELECT id_cliente FROM USUARIO WHERE id_usuario=@id", connection, transaction)) {
                        command.Parameters.AddWithValue("@id", id);
                        linkedId = command.ExecuteScalar();
                    }
                    if (linkedId != null && linkedId != DBNull.Value) {
                        using (var command = new MySqlCommand("UPDATE CLIENTE SET nombre=@name WHERE id_cliente=@customer", connection, transaction)) {
                            command.Parameters.AddWithValue("@customer", linkedId);
                            command.Parameters.AddWithValue("@name", nombre.Trim());
                            command.ExecuteNonQuery();
                        }
                    }
                    SecurityPolicy.Log(connection, transaction, id, "perfil", "Actualizar perfil",
                        string.IsNullOrEmpty(password) ? "Datos personales actualizados" : "Datos personales y contraseña actualizados");
                    transaction.Commit();
                    return new { success = true };
                }
            });
        }

        private JsonResult Execute(Func<MySqlConnection, object> action) {
            Response.Cache.SetNoStore();
            try { using (var connection = DbConnectionFactory.CreateConnection()) return Json(action(connection), JsonRequestBehavior.AllowGet); }
            catch (HttpException ex) { return Error(ex.GetHttpCode(), ex.Message); }
            catch (MySqlException ex) when (ex.Number == 1062) { return Error(409, "Ya existe una cuenta con ese correo."); }
            catch (Exception ex) { System.Diagnostics.Trace.TraceError("Cliente: {0}", ex.GetType().Name); return Error(503, "No se pudo completar la solicitud del cliente."); }
        }
        private JsonResult Error(int status, string message) {
            Response.StatusCode = status; Response.TrySkipIisCustomErrors = true;
            return Json(new { error = message }, JsonRequestBehavior.AllowGet);
        }
    }
}
