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
    [RoutePrefix("api/compras/reportes/historico")]
    public class ReporteHistoricoController : ApiController
    {
        [HttpGet]
        [Route("")]
        [Route("~/api/reportes/historico-compras")]
        public IHttpActionResult GetReporteHistorico(
            [FromUri] string desde = null,
            [FromUri] string hasta = null,
            [FromUri(Name = "id_proveedor")] int? idProveedorParam = null,
            [FromUri] int? idProveedor = null)
        {
            HttpContext.Current.Response.Cache.SetNoStore();

            int? filtroProveedor = idProveedorParam ?? idProveedor;
            if (filtroProveedor.HasValue && filtroProveedor.Value <= 0)
            {
                return Content(HttpStatusCode.BadRequest, new { error = "El parámetro id_proveedor debe ser un número entero positivo." });
            }

            DateTime hoy = DateTime.Today;
            DateTime hastaDate;
            DateTime desdeDate;

            if (string.IsNullOrWhiteSpace(hasta))
            {
                hastaDate = hoy;
            }
            else
            {
                if (!DateTime.TryParseExact(hasta.Trim(), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out hastaDate))
                {
                    return Content(HttpStatusCode.BadRequest, new { error = "El parámetro 'hasta' tiene un formato inválido. Debe ser yyyy-MM-dd." });
                }
            }

            if (string.IsNullOrWhiteSpace(desde))
            {
                desdeDate = hastaDate.AddMonths(-12);
            }
            else
            {
                if (!DateTime.TryParseExact(desde.Trim(), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out desdeDate))
                {
                    return Content(HttpStatusCode.BadRequest, new { error = "El parámetro 'desde' tiene un formato inválido. Debe ser yyyy-MM-dd." });
                }
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

                    decimal diasTotales = (decimal)(hastaDate.Date - desdeDate.Date).TotalDays;
                    decimal mesesRango = diasTotales <= 30m ? 1m : Math.Round(diasTotales / 30.4167m, 2);
                    if (mesesRango < 1m)
                    {
                        mesesRango = 1m;
                    }

                    string filtroProveedorSql = filtroProveedor.HasValue ? " AND oc.id_proveedor = @id_proveedor" : "";

                    string sql = @"
                        SELECT 
                            p.id_proveedor,
                            p.razon_social,
                            t_oc.numero_ordenes,
                            COALESCE(t_u.unidades_compradas, 0) AS unidades_compradas,
                            t_oc.monto_acumulado,
                            t_oc.primera_compra,
                            t_oc.ultima_compra
                        FROM (
                            SELECT 
                                oc.id_proveedor,
                                COUNT(oc.id_oc) AS numero_ordenes,
                                SUM(oc.total) AS monto_acumulado,
                                MIN(oc.fecha) AS primera_compra,
                                MAX(oc.fecha) AS ultima_compra
                            FROM ORDEN_COMPRA oc
                            WHERE oc.estado IN ('aprobada', 'recibida')
                              AND oc.fecha >= @desde
                              AND oc.fecha <= @hasta" + filtroProveedorSql + @"
                            GROUP BY oc.id_proveedor
                        ) t_oc
                        INNER JOIN PROVEEDOR p ON p.id_proveedor = t_oc.id_proveedor
                        LEFT JOIN (
                            SELECT 
                                oc.id_proveedor,
                                SUM(doc.cantidad) AS unidades_compradas
                            FROM ORDEN_COMPRA oc
                            INNER JOIN DETALLE_OC doc ON oc.id_oc = doc.id_oc
                            WHERE oc.estado IN ('aprobada', 'recibida')
                              AND oc.fecha >= @desde
                              AND oc.fecha <= @hasta" + filtroProveedorSql + @"
                            GROUP BY oc.id_proveedor
                        ) t_u ON t_u.id_proveedor = t_oc.id_proveedor
                        ORDER BY t_oc.monto_acumulado DESC";

                    var filas = new List<ProveedorHistoricoFilaDto>();
                    int totalOrdenes = 0;
                    int totalUnidades = 0;
                    decimal totalMonto = 0m;

                    using (var cmd = new MySqlCommand(sql, conn))
                    {
                        cmd.Parameters.AddWithValue("@desde", desdeDate.ToString("yyyy-MM-dd"));
                        cmd.Parameters.AddWithValue("@hasta", hastaDate.ToString("yyyy-MM-dd"));
                        if (filtroProveedor.HasValue)
                        {
                            cmd.Parameters.AddWithValue("@id_proveedor", filtroProveedor.Value);
                        }

                        using (var reader = cmd.ExecuteReader())
                        {
                            while (reader.Read())
                            {
                                int idProv = Convert.ToInt32(reader["id_proveedor"]);
                                string razonSocial = Convert.ToString(reader["razon_social"]);
                                int numOrdenes = Convert.ToInt32(reader["numero_ordenes"]);
                                int unidades = Convert.ToInt32(reader["unidades_compradas"]);
                                decimal monto = Convert.ToDecimal(reader["monto_acumulado"]);

                                DateTime dtPrimera = Convert.ToDateTime(reader["primera_compra"]);
                                DateTime dtUltima = Convert.ToDateTime(reader["ultima_compra"]);

                                decimal ticketPromedio = numOrdenes > 0 ? Math.Round(monto / numOrdenes, 2) : 0m;
                                decimal ordenesPorMes = Math.Round(numOrdenes / mesesRango, 2);

                                decimal? diasPromedio = null;
                                if (numOrdenes > 1)
                                {
                                    decimal diasDiff = (decimal)(dtUltima.Date - dtPrimera.Date).TotalDays;
                                    diasPromedio = Math.Round(diasDiff / (numOrdenes - 1), 2);
                                }

                                totalOrdenes += numOrdenes;
                                totalUnidades += unidades;
                                totalMonto += monto;

                                filas.Add(new ProveedorHistoricoFilaDto
                                {
                                    IdProveedor = idProv,
                                    RazonSocial = razonSocial,
                                    NumeroOrdenes = numOrdenes,
                                    UnidadesCompradas = unidades,
                                    MontoAcumulado = monto,
                                    TicketPromedio = ticketPromedio,
                                    PrimeraCompra = dtPrimera.ToString("yyyy-MM-dd"),
                                    UltimaCompra = dtUltima.ToString("yyyy-MM-dd"),
                                    OrdenesPorMes = ordenesPorMes,
                                    DiasPromedioEntreOrdenes = diasPromedio
                                });
                            }
                        }
                    }

                    var respuesta = new ReporteHistoricoResponseDto
                    {
                        Desde = desdeDate.ToString("yyyy-MM-dd"),
                        Hasta = hastaDate.ToString("yyyy-MM-dd"),
                        TotalOrdenes = totalOrdenes,
                        TotalUnidades = totalUnidades,
                        TotalMonto = totalMonto,
                        Proveedores = filas
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
                return Content(HttpStatusCode.InternalServerError, new { error = "Error al generar el reporte histórico: " + ex.Message });
            }
        }
    }
}
