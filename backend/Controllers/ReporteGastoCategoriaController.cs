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
    [RoutePrefix("api/compras/reportes/gasto-categoria")]
    public class ReporteGastoCategoriaController : ApiController
    {
        [HttpGet]
        [Route("")]
        public IHttpActionResult GetReporteGastoCategoria(
            [FromUri] string desde = null,
            [FromUri] string hasta = null,
            [FromUri] string categoria = null)
        {
            HttpContext.Current.Response.Cache.SetNoStore();

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

            if (desdeDate.Date > hastaDate.Date)
            {
                return Content(HttpStatusCode.BadRequest, new { error = "La fecha 'desde' no puede ser posterior a la fecha 'hasta'." });
            }

            string filtroCategoria = string.IsNullOrWhiteSpace(categoria) ? null : categoria.Trim();

            try
            {
                using (var conn = DbConnectionFactory.CreateConnection())
                {
                    SessionAccess.RequireModule(new HttpRequestWrapper(HttpContext.Current.Request), conn, "compras", SecurityPolicy.Read);

                    var respuesta = new ReporteGastoCategoriaRespuestaDto
                    {
                        Desde = desdeDate.ToString("yyyy-MM-dd"),
                        Hasta = hastaDate.ToString("yyyy-MM-dd"),
                        CategoriaFiltro = filtroCategoria
                    };

                    // 1. Categorías disponibles en catálogo LIBRO (solo lectura)
                    const string sqlCats = @"
                        SELECT DISTINCT COALESCE(NULLIF(TRIM(l.categoria), ''), 'Sin categoría') AS cat_nombre
                        FROM LIBRO l
                        ORDER BY cat_nombre ASC;";

                    using (var cmdCats = new MySqlCommand(sqlCats, conn))
                    using (var readerCats = cmdCats.ExecuteReader())
                    {
                        while (readerCats.Read())
                        {
                            respuesta.CategoriasDisponibles.Add(readerCats["cat_nombre"].ToString());
                        }
                    }

                    // 2. Consulta principal en SQL con CTE para agrupar por categoría y calcular % de participación y totales
                    string filtroCategoriaSql = filtroCategoria != null
                        ? " AND LOWER(COALESCE(NULLIF(TRIM(l.categoria), ''), 'Sin categoría')) = LOWER(@categoria)"
                        : "";

                    string sqlReporte = @"
                        WITH lineas_filtradas AS (
                            SELECT
                                oc.id_oc,
                                doc.cantidad,
                                COALESCE(NULLIF(TRIM(l.categoria), ''), 'Sin categoría') AS categoria_libro,
                                ROUND(doc.cantidad * doc.precio_pactado, 2) AS neto_linea,
                                ROUND(doc.cantidad * doc.precio_pactado * (1 + doc.iva_porcentaje / 100.0), 2) AS gasto_linea
                            FROM ORDEN_COMPRA oc
                            INNER JOIN DETALLE_OC doc ON oc.id_oc = doc.id_oc
                            INNER JOIN LIBRO l ON doc.isbn = l.isbn
                            WHERE oc.estado IN ('aprobada', 'recibida parcial', 'recibida')
                              AND oc.fecha BETWEEN @desde AND @hasta" + filtroCategoriaSql + @"
                        ),
                        agrupado_categoria AS (
                            SELECT
                                categoria_libro,
                                SUM(cantidad) AS unidades_compradas,
                                COUNT(DISTINCT id_oc) AS numero_ordenes,
                                SUM(neto_linea) AS monto_neto,
                                SUM(gasto_linea) AS monto_gasto
                            FROM lineas_filtradas
                            GROUP BY categoria_libro
                        ),
                        totales AS (
                            SELECT
                                COALESCE(SUM(monto_gasto), 0) AS gasto_total_periodo,
                                COALESCE(SUM(unidades_compradas), 0) AS total_unidades,
                                (SELECT COUNT(DISTINCT id_oc) FROM lineas_filtradas) AS total_ordenes
                            FROM agrupado_categoria
                        )
                        SELECT
                            ac.categoria_libro,
                            ac.unidades_compradas,
                            ac.numero_ordenes,
                            ac.monto_neto,
                            ac.monto_gasto,
                            COALESCE(ROUND((ac.monto_gasto * 100.0) / NULLIF(t.gasto_total_periodo, 0), 2), 0) AS porcentaje_participacion,
                            CASE WHEN ac.categoria_libro = 'Sin categoría' THEN 1 ELSE 0 END AS es_sin_categoria,
                            t.gasto_total_periodo,
                            t.total_unidades,
                            t.total_ordenes
                        FROM agrupado_categoria ac
                        CROSS JOIN totales t
                        ORDER BY ac.monto_gasto DESC, ac.categoria_libro ASC;";

                    using (var cmd = new MySqlCommand(sqlReporte, conn))
                    {
                        cmd.Parameters.AddWithValue("@desde", desdeDate.ToString("yyyy-MM-dd"));
                        cmd.Parameters.AddWithValue("@hasta", hastaDate.ToString("yyyy-MM-dd"));
                        if (filtroCategoria != null)
                        {
                            cmd.Parameters.AddWithValue("@categoria", filtroCategoria);
                        }

                        using (var reader = cmd.ExecuteReader())
                        {
                            bool primero = true;
                            while (reader.Read())
                            {
                                if (primero)
                                {
                                    respuesta.GastoTotalPeriodo = Convert.ToDecimal(reader["gasto_total_periodo"]);
                                    respuesta.TotalUnidades = Convert.ToInt32(reader["total_unidades"]);
                                    respuesta.TotalOrdenes = Convert.ToInt32(reader["total_ordenes"]);
                                    respuesta.CategoriaMayorGasto = reader["categoria_libro"].ToString();
                                    respuesta.MontoMayorGasto = Convert.ToDecimal(reader["monto_gasto"]);
                                    respuesta.PorcentajeMayorGasto = Convert.ToDecimal(reader["porcentaje_participacion"]);
                                    primero = false;
                                }

                                var item = new CategoriaGastoItemDto
                                {
                                    Categoria = reader["categoria_libro"].ToString(),
                                    UnidadesCompradas = Convert.ToInt32(reader["unidades_compradas"]),
                                    NumeroOrdenes = Convert.ToInt32(reader["numero_ordenes"]),
                                    MontoNeto = Convert.ToDecimal(reader["monto_neto"]),
                                    MontoGasto = Convert.ToDecimal(reader["monto_gasto"]),
                                    PorcentajeParticipacion = Convert.ToDecimal(reader["porcentaje_participacion"]),
                                    EsSinCategoria = Convert.ToInt32(reader["es_sin_categoria"]) == 1
                                };

                                if (item.EsSinCategoria)
                                {
                                    respuesta.HaySinCategoria = true;
                                    respuesta.MontoSinCategoria = item.MontoGasto;
                                }

                                respuesta.Categorias.Add(item);
                            }
                        }
                    }

                    return Ok(respuesta);
                }
            }
            catch (HttpException ex)
            {
                return Content((HttpStatusCode)ex.GetHttpCode(), new { error = ex.Message });
            }
            catch (Exception ex)
            {
                System.Diagnostics.Trace.TraceError("Error al generar reporte de gasto por categoría: {0}", ex);
                return Content(HttpStatusCode.ServiceUnavailable, new { error = "No se pudo generar el reporte de gasto por categoría." });
            }
        }
    }
}
