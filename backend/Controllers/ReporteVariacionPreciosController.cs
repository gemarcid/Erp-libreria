using System;
using System.Collections.Generic;
using System.Globalization;
using System.Net;
using System.Web;
using System.Web.Http;
using backend.Data;
using backend.Models;
using MySql.Data.MySqlClient;

namespace backend.Controllers
{
    [RoutePrefix("api/compras/reportes/variacion-precios")]
    public class ReporteVariacionPreciosController : ApiController
    {
        [HttpGet]
        [Route("")]
        [Route("~/api/reportes/variacion-precios")]
        public IHttpActionResult GetReporteVariacionPrecios(
            [FromUri] string desde = null,
            [FromUri] string hasta = null,
            [FromUri] string isbn = null,
            [FromUri] string producto = null,
            [FromUri(Name = "id_proveedor")] int? idProveedorParam = null,
            [FromUri] int? idProveedor = null)
        {
            HttpContext.Current.Response.Cache.SetNoStore();

            int? filtroProveedor = idProveedorParam ?? idProveedor;
            if (filtroProveedor.HasValue && filtroProveedor.Value <= 0)
            {
                return Content(HttpStatusCode.BadRequest, new { error = "El parámetro id_proveedor debe ser un número entero positivo." });
            }

            string filtroIsbn = !string.IsNullOrWhiteSpace(isbn)
                ? isbn.Trim()
                : (!string.IsNullOrWhiteSpace(producto) ? producto.Trim() : null);

            DateTime hoy = DateTime.Today;
            DateTime hastaDate;
            DateTime desdeDate;

            if (string.IsNullOrWhiteSpace(hasta))
            {
                hastaDate = hoy;
            }
            else if (!DateTime.TryParseExact(hasta.Trim(), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out hastaDate))
            {
                return Content(HttpStatusCode.BadRequest, new { error = "El parámetro 'hasta' tiene un formato inválido. Debe ser yyyy-MM-dd." });
            }

            if (string.IsNullOrWhiteSpace(desde))
            {
                desdeDate = hastaDate.AddMonths(-12);
            }
            else if (!DateTime.TryParseExact(desde.Trim(), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out desdeDate))
            {
                return Content(HttpStatusCode.BadRequest, new { error = "El parámetro 'desde' tiene un formato inválido. Debe ser yyyy-MM-dd." });
            }

            if (desdeDate > hastaDate)
            {
                return Content(HttpStatusCode.BadRequest, new { error = "La fecha 'desde' no puede ser posterior a la fecha 'hasta'." });
            }

            if (hastaDate > desdeDate.AddYears(5))
            {
                return Content(HttpStatusCode.BadRequest, new { error = "El rango de fechas consultado no puede superar los 5 años." });
            }

            try
            {
                using (var conn = DbConnectionFactory.CreateConnection())
                {
                    SessionAccess.RequireModule(new HttpRequestWrapper(HttpContext.Current.Request), conn, "compras", SecurityPolicy.Read);

                    string whereExtra = "";
                    if (!string.IsNullOrEmpty(filtroIsbn))
                        whereExtra += " AND doc.isbn = @isbn";
                    if (filtroProveedor.HasValue)
                        whereExtra += " AND oc.id_proveedor = @id_proveedor";

                    string cteBase = @"
                        WITH compras_base AS (
                            SELECT
                                oc.id_oc,
                                oc.fecha,
                                doc.id_detalle_oc,
                                doc.isbn,
                                l.titulo AS libro_titulo,
                                oc.id_proveedor,
                                p.razon_social AS proveedor_nombre,
                                doc.precio_pactado,
                                LAG(doc.precio_pactado) OVER (
                                    PARTITION BY doc.isbn, oc.id_proveedor
                                    ORDER BY oc.fecha ASC, oc.id_oc ASC, doc.id_detalle_oc ASC
                                ) AS precio_anterior
                            FROM DETALLE_OC doc
                            INNER JOIN ORDEN_COMPRA oc ON doc.id_oc = oc.id_oc
                            INNER JOIN LIBRO l ON doc.isbn = l.isbn
                            INNER JOIN PROVEEDOR p ON oc.id_proveedor = p.id_proveedor
                            WHERE oc.estado IN ('aprobada', 'recibida parcial', 'recibida')
                              AND oc.fecha >= @desde
                              AND oc.fecha <= @hasta" + whereExtra + @"
                        ),
                        compras_variacion AS (
                            SELECT
                                id_oc,
                                fecha,
                                id_detalle_oc,
                                isbn,
                                libro_titulo,
                                id_proveedor,
                                proveedor_nombre,
                                precio_pactado,
                                precio_anterior,
                                CASE
                                    WHEN precio_anterior IS NULL THEN NULL
                                    ELSE ROUND(precio_pactado - precio_anterior, 2)
                                END AS variacion_monto,
                                CASE
                                    WHEN precio_anterior IS NULL OR precio_anterior = 0 THEN NULL
                                    ELSE ROUND(((precio_pactado - precio_anterior) / precio_anterior) * 100, 2)
                                END AS variacion_porcentaje
                            FROM compras_base
                        )";

                    string sqlFilas = cteBase + @"
                        SELECT
                            id_oc,
                            fecha,
                            id_detalle_oc,
                            isbn,
                            libro_titulo,
                            id_proveedor,
                            proveedor_nombre,
                            precio_pactado,
                            precio_anterior,
                            variacion_monto,
                            variacion_porcentaje
                        FROM compras_variacion
                        ORDER BY isbn ASC, id_proveedor ASC, fecha ASC, id_oc ASC, id_detalle_oc ASC";

                    var filas = new List<VariacionPrecioFilaDto>();

                    using (var cmd = new MySqlCommand(sqlFilas, conn))
                    {
                        BindFiltros(cmd, desdeDate, hastaDate, filtroIsbn, filtroProveedor);
                        using (var reader = cmd.ExecuteReader())
                        {
                            while (reader.Read())
                            {
                                filas.Add(new VariacionPrecioFilaDto
                                {
                                    IdOc = Convert.ToInt32(reader["id_oc"]),
                                    Fecha = Convert.ToDateTime(reader["fecha"]).ToString("yyyy-MM-dd"),
                                    Isbn = Convert.ToString(reader["isbn"]),
                                    LibroTitulo = Convert.ToString(reader["libro_titulo"]),
                                    IdProveedor = Convert.ToInt32(reader["id_proveedor"]),
                                    ProveedorNombre = Convert.ToString(reader["proveedor_nombre"]),
                                    PrecioPactado = Convert.ToDecimal(reader["precio_pactado"]),
                                    PrecioAnterior = reader["precio_anterior"] != DBNull.Value
                                        ? (decimal?)Convert.ToDecimal(reader["precio_anterior"])
                                        : null,
                                    VariacionMonto = reader["variacion_monto"] != DBNull.Value
                                        ? (decimal?)Convert.ToDecimal(reader["variacion_monto"])
                                        : null,
                                    VariacionPorcentaje = reader["variacion_porcentaje"] != DBNull.Value
                                        ? (decimal?)Convert.ToDecimal(reader["variacion_porcentaje"])
                                        : null
                                });
                            }
                        }
                    }

                    VariacionPrecioDestacadoDto mayorAlza = null;
                    VariacionPrecioDestacadoDto mayorBaja = null;

                    if (filas.Count > 0)
                    {
                        string sqlAlza = cteBase + @"
                            SELECT isbn, libro_titulo, id_proveedor, proveedor_nombre, id_oc, fecha,
                                   precio_anterior, precio_pactado, variacion_monto, variacion_porcentaje
                            FROM compras_variacion
                            WHERE variacion_porcentaje IS NOT NULL AND variacion_porcentaje > 0
                            ORDER BY variacion_porcentaje DESC, variacion_monto DESC, fecha DESC, id_oc DESC
                            LIMIT 1";

                        using (var cmdAlza = new MySqlCommand(sqlAlza, conn))
                        {
                            BindFiltros(cmdAlza, desdeDate, hastaDate, filtroIsbn, filtroProveedor);
                            using (var reader = cmdAlza.ExecuteReader())
                            {
                                if (reader.Read())
                                {
                                    mayorAlza = MapDestacado(reader);
                                }
                            }
                        }

                        string sqlBaja = cteBase + @"
                            SELECT isbn, libro_titulo, id_proveedor, proveedor_nombre, id_oc, fecha,
                                   precio_anterior, precio_pactado, variacion_monto, variacion_porcentaje
                            FROM compras_variacion
                            WHERE variacion_porcentaje IS NOT NULL AND variacion_porcentaje < 0
                            ORDER BY variacion_porcentaje ASC, variacion_monto ASC, fecha DESC, id_oc DESC
                            LIMIT 1";

                        using (var cmdBaja = new MySqlCommand(sqlBaja, conn))
                        {
                            BindFiltros(cmdBaja, desdeDate, hastaDate, filtroIsbn, filtroProveedor);
                            using (var reader = cmdBaja.ExecuteReader())
                            {
                                if (reader.Read())
                                {
                                    mayorBaja = MapDestacado(reader);
                                }
                            }
                        }
                    }

                    var respuesta = new ReporteVariacionPreciosResponseDto
                    {
                        Desde = desdeDate.ToString("yyyy-MM-dd"),
                        Hasta = hastaDate.ToString("yyyy-MM-dd"),
                        TotalCompras = filas.Count,
                        UnicaCompraSinVariacion = filas.Count == 1,
                        MayorAlza = mayorAlza,
                        MayorBaja = mayorBaja,
                        Filas = filas
                    };

                    return Ok(respuesta);
                }
            }
            catch (HttpException ex)
            {
                return Content((HttpStatusCode)ex.GetHttpCode(), new { error = ex.Message });
            }
            catch (Exception ex)
            {
                return Content(HttpStatusCode.InternalServerError, new { error = "Error al generar el reporte de variación de precios: " + ex.Message });
            }
        }

        private static void BindFiltros(
            MySqlCommand cmd,
            DateTime desdeDate,
            DateTime hastaDate,
            string filtroIsbn,
            int? filtroProveedor)
        {
            cmd.Parameters.AddWithValue("@desde", desdeDate.ToString("yyyy-MM-dd"));
            cmd.Parameters.AddWithValue("@hasta", hastaDate.ToString("yyyy-MM-dd"));
            if (!string.IsNullOrEmpty(filtroIsbn))
                cmd.Parameters.AddWithValue("@isbn", filtroIsbn);
            if (filtroProveedor.HasValue)
                cmd.Parameters.AddWithValue("@id_proveedor", filtroProveedor.Value);
        }

        private static VariacionPrecioDestacadoDto MapDestacado(MySqlDataReader reader)
        {
            return new VariacionPrecioDestacadoDto
            {
                Isbn = Convert.ToString(reader["isbn"]),
                LibroTitulo = Convert.ToString(reader["libro_titulo"]),
                IdProveedor = Convert.ToInt32(reader["id_proveedor"]),
                ProveedorNombre = Convert.ToString(reader["proveedor_nombre"]),
                IdOc = Convert.ToInt32(reader["id_oc"]),
                Fecha = Convert.ToDateTime(reader["fecha"]).ToString("yyyy-MM-dd"),
                PrecioAnterior = Convert.ToDecimal(reader["precio_anterior"]),
                PrecioActual = Convert.ToDecimal(reader["precio_pactado"]),
                VariacionMonto = Convert.ToDecimal(reader["variacion_monto"]),
                VariacionPorcentaje = Convert.ToDecimal(reader["variacion_porcentaje"])
            };
        }
    }
}

