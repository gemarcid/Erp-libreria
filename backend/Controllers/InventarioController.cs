using System;
using System.Collections.Generic;
using System.Configuration;
using System.Web.Mvc;
using System.Web;
using backend.Models;
using MySql.Data.MySqlClient;

namespace backend.Controllers
{
    public class InventarioController : Controller
    {
        [HttpGet]
        public JsonResult ListarInventario()
        {
            Response.Cache.SetNoStore();

            var inventario = new List<object>();

            try
            {
                using (var conexion = new MySqlConnection(ConfigurationManager.ConnectionStrings["ConexionMySQL"].ConnectionString))
                using (var comando = new MySqlCommand(
                    "SELECT isbn, titulo, autor, categoria, estante, stock_actual AS stock, stock_minimo AS minimo, precio_venta AS precio FROM LIBRO WHERE activo = TRUE ORDER BY titulo, isbn", conexion))
                {
                    conexion.Open();
                    var user = SessionAccess.RequireModule(Request, conexion, "inventario", SecurityPolicy.Read);
                    using (var lector = comando.ExecuteReader())
                    {
                        while (lector.Read())
                        {
                            inventario.Add(new
                            {
                                isbn = lector["isbn"].ToString(),
                                titulo = lector["titulo"].ToString(),
                                autor = lector["autor"].ToString(),
                                categoria = lector["categoria"].ToString(),
                                estante = lector["estante"].ToString(),
                                stock = Convert.ToInt32(lector["stock"]),
                                minimo = Convert.ToInt32(lector["minimo"]),
                                precio = Convert.ToDecimal(lector["precio"])
                            });
                        }
                    }
                    SecurityPolicy.Log(conexion, null, user, "inventario", "Consultar inventario", "Listado de libros y stock");
                }

                // Retornamos los datos en formato JSON para el frontend
                return Json(inventario, JsonRequestBehavior.AllowGet);
            }
            catch (HttpException ex)
            {
                Response.StatusCode = ex.GetHttpCode();
                Response.TrySkipIisCustomErrors = true;
                return Json(new { success = false, error = ex.Message }, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Trace.TraceError("Error al consultar inventario: {0}", ex.GetType().Name);
                Response.StatusCode = 503;
                Response.TrySkipIisCustomErrors = true;
                return Json(new { error = "No se pudo consultar el inventario." }, JsonRequestBehavior.AllowGet);
            }
        }
    }
}
