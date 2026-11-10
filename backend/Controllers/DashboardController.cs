using System;
using System.Configuration;
using System.Web;
using System.Web.Mvc;
using backend.Models;
using MySql.Data.MySqlClient;

namespace backend.Controllers
{
    public class DashboardController : Controller
    {
        [HttpGet]
        public JsonResult Resumen()
        {
            Response.Cache.SetNoStore();
            try
            {
                using (var connection = new MySqlConnection(ConfigurationManager.ConnectionStrings["ConexionMySQL"].ConnectionString))
                {
                    connection.Open();
                    var user = SessionAccess.ReadSession(Request, connection);
                    if (!SecurityPolicy.IsStaff(user.Role)) return Error(403, "Tu perfil no tiene acceso al inicio interno.");
                    var permissions = SecurityPolicy.Permissions(connection, user.RoleId, user.Role);
                    var today = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow,
                        TimeZoneInfo.FindSystemTimeZoneById("Pacific SA Standard Time")).Date;
                    return Json(DashboardData.Load(connection, today,
                        permissions["ventas"] > 0, permissions["compras"] > 0,
                        permissions["inventario"] > 0, permissions["contabilidad"] > 0), JsonRequestBehavior.AllowGet);
                }
            }
            catch (HttpException ex) { return Error(ex.GetHttpCode(), ex.Message); }
            catch (Exception ex)
            {
                System.Diagnostics.Trace.TraceError("Error al consultar inicio: {0}", ex.GetType().Name);
                return Error(503, "No se pudieron consultar los datos del inicio.");
            }
        }
        private JsonResult Error(int status, string message)
        {
            Response.StatusCode = status;
            Response.TrySkipIisCustomErrors = true;
            return Json(new { error = message }, JsonRequestBehavior.AllowGet);
        }
    }
}
