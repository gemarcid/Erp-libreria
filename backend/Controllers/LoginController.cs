using System;
using System.Configuration;
using System.Diagnostics;
using System.Globalization;
using System.Web.Security;
using System.Web.Mvc;
using MySql.Data.MySqlClient;
using backend.Models;
using System.Web;

namespace backend.Controllers
{
    public class LoginController : Controller
    {
        private const int DuracionSesionHoras = 8;

        [HttpPost]
        public JsonResult Registrar(string nombre, string email, string password, string rut)
        {
            Response.Cache.SetNoStore();
            try {
                UserAccounts.Validate(nombre, email, password, true);
                UserAccounts.ValidateCustomer(rut, "persona");
                using (var connection = CrearConexion()) {
                    connection.Open();
                    using (var transaction = connection.BeginTransaction()) {
                        int roleId;
                        using (var command = new MySqlCommand("SELECT id_rol FROM ROL WHERE LOWER(nombre)='cliente' ORDER BY id_rol LIMIT 1", connection, transaction)) {
                            var role = command.ExecuteScalar();
                            if (role == null) throw new HttpException(503, "El registro de clientes todavía no está configurado.");
                            roleId = Convert.ToInt32(role);
                        }
                        // Public registration never accepts a role or status from the caller.
                        var userId = UserAccounts.Create(connection, transaction, nombre, email, password, roleId, "activo");
                        UserAccounts.SaveCustomer(connection, transaction, userId, nombre, rut, "persona");
                        SecurityPolicy.Log(connection, transaction, userId, "administracion", "Registrar cuenta cliente",
                            "Usuario #" + userId);
                        transaction.Commit();
                    }
                }
                Response.StatusCode = 201;
                return Json(new { success = true });
            }
            catch (HttpException ex) { return Error(ex.GetHttpCode(), ex.Message); }
            catch (MySqlException ex) when (ex.Number == 1062) { return Error(409, "Ya existe una cuenta con ese correo."); }
            catch (Exception ex) { Trace.TraceError("Registro: {0}", ex.GetType().Name); return Error(503, "No se pudo registrar la cuenta. Intenta nuevamente."); }
        }

        [HttpPost]
        public JsonResult Ingresar(string email, string password)
        {
            return Authenticate(email, password, null);
        }

        [HttpPost]
        public JsonResult CambiarPassword(string email, string password, string newPassword)
        {
            if (string.IsNullOrEmpty(newPassword)) return Error(400, "Ingresa la nueva contraseña.");
            return Authenticate(email, password, newPassword);
        }

        private JsonResult Authenticate(string email, string password, string newPassword)
        {
            Response.Cache.SetNoStore();
            if (string.IsNullOrWhiteSpace(email) || email.Trim().Length > 100 ||
                string.IsNullOrEmpty(password) || System.Text.Encoding.UTF8.GetByteCount(password) > 72)
                return Error(400, "Ingresa el correo y la contraseña.");
            try
            {
                using (var connection = CrearConexion())
                {
                    connection.Open();
                    var user = SessionAccess.FindUser(connection, email.Trim());
                    if (user == null || !user.Active || !BCrypt.Net.BCrypt.Verify(password, user.PasswordHash))
                    {
                        SecurityPolicy.Log(connection, null, user?.Id, "acceso", "Inicio de sesión",
                            "Credenciales no válidas o cuenta inactiva", false, email.Trim());
                        return Error(401, "Correo o contraseña incorrectos.");
                    }

                    if (newPassword != null)
                    {
                        UserAccounts.Validate(user.Name, user.Email, newPassword, true);
                        if (password == newPassword) return Error(400, "La nueva contraseña debe ser distinta de la anterior.");
                        var hash = BCrypt.Net.BCrypt.HashPassword(newPassword, 11);
                        using (var transaction = connection.BeginTransaction())
                        {
                            using (var command = new MySqlCommand(@"UPDATE USUARIO
                                SET password_hash=@hash, fecha_ultimo_cambio_pass=CURRENT_DATE()
                                WHERE id_usuario=@id AND estado='activo' AND BINARY password_hash=BINARY @previous", connection, transaction))
                            {
                                command.Parameters.AddWithValue("@hash", hash);
                                command.Parameters.AddWithValue("@id", user.Id);
                                command.Parameters.AddWithValue("@previous", user.PasswordHash);
                                if (command.ExecuteNonQuery() != 1) return Error(409, "La cuenta cambió. Vuelve a intentar.");
                            }
                            SecurityPolicy.Log(connection, transaction, user.Id, "administracion", "Renovar contraseña",
                                "Contraseña renovada por el usuario");
                            transaction.Commit();
                        }
                        user.PasswordHash = hash;
                    }
                    else if (SecurityPolicy.PasswordExpired(connection, user.PasswordChanged))
                    {
                        SecurityPolicy.Log(connection, null, user.Id, "acceso", "Inicio de sesión",
                            "Renovación de contraseña requerida", false);
                        return Error(428, "Tu contraseña venció. Crea una nueva para ingresar.");
                    }

                    SecurityPolicy.Log(connection, null, user.Id, "acceso", "Inicio de sesión", "Acceso concedido");
                    var now = DateTime.Now;
                    var ticket = new FormsAuthenticationTicket(2, user.Id.ToString(CultureInfo.InvariantCulture),
                        now, now.AddHours(DuracionSesionHoras), false, SecurityPolicy.PasswordStamp(user.PasswordHash));
                    return Json(new { success = true, usuario = user.Public(connection),
                        sessionToken = FormsAuthentication.Encrypt(ticket), expiresIn = DuracionSesionHoras * 3600 });
                }
            }
            catch (HttpException ex) { return Error(ex.GetHttpCode(), ex.Message); }
            catch (Exception ex)
            {
                Trace.TraceError("No se pudo iniciar sesión: {0}", ex.GetType().Name);
                return Error(503, "El servicio de acceso no está disponible. Intenta nuevamente.");
            }
        }

        [HttpGet]
        public JsonResult Sesion()
        {
            Response.Cache.SetNoStore();
            try
            {
                using (var connection = CrearConexion())
                {
                    connection.Open();
                    var user = SessionAccess.ReadSession(Request, connection);
                    return Json(new { success = true, usuario = user.Public(connection) }, JsonRequestBehavior.AllowGet);
                }
            }
            catch (HttpException ex) { return Error(ex.GetHttpCode(), ex.Message); }
            catch (Exception ex)
            {
                Trace.TraceError("No se pudo comprobar la sesión: {0}", ex.GetType().Name);
                return Error(503, "No se pudo comprobar tu sesión. Intenta nuevamente.");
            }
        }

        private static MySqlConnection CrearConexion()
        {
            return new MySqlConnection(
                ConfigurationManager.ConnectionStrings["ConexionMySQL"].ConnectionString);
        }

        private JsonResult Error(int estado, string mensaje)
        {
            Response.AppendHeader("Access-Control-Allow-Origin", "*");
            Response.StatusCode = estado;
            Response.TrySkipIisCustomErrors = true;
            return Json(new { success = false, error = mensaje }, JsonRequestBehavior.AllowGet);
        }

    }
}
