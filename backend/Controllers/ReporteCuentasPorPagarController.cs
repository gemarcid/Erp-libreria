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
    [RoutePrefix("api/compras/reportes/cuentas-por-pagar")]
    public class ReporteCuentasPorPagarController : ApiController
    {
        [HttpGet]
        [Route("")]
        public IHttpActionResult GetReporteCuentasPorPagar(
            [FromUri(Name = "fecha_corte")] string fechaCorte = null,
            [FromUri(Name = "id_proveedor")] int? idProveedor = null)
        {
            HttpContext.Current.Response.Cache.SetNoStore();

            if (string.IsNullOrWhiteSpace(fechaCorte))
            {
                return Content(HttpStatusCode.BadRequest, new
                {
                    error = "La fecha de corte es obligatoria y debe tener formato YYYY-MM-DD."
                });
            }

            if (!DateTime.TryParseExact(fechaCorte.Trim(), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out DateTime fechaCorteDt))
            {
                return Content(HttpStatusCode.BadRequest, new
                {
                    error = "La fecha de corte no es válida. Usa el formato YYYY-MM-DD."
                });
            }

            if (idProveedor.HasValue && idProveedor.Value < 0)
            {
                return Content(HttpStatusCode.BadRequest, new
                {
                    error = "El identificador de proveedor no es válido."
                });
            }

            int? filtroProveedor = (idProveedor.HasValue && idProveedor.Value > 0) ? idProveedor.Value : (int?)null;

            try
            {
                using (var conn = DbConnectionFactory.CreateConnection())
                {
                    SessionAccess.RequireModule(new HttpRequestWrapper(HttpContext.Current.Request), conn, "compras", SecurityPolicy.Read);

                    var respuesta = new ReporteCuentasPorPagarRespuestaDto
                    {
                        FechaCorte = fechaCorteDt.ToString("yyyy-MM-dd"),
                        IdProveedor = filtroProveedor
                    };

                    const string sqlResumen = @"
                        SELECT
                            COUNT(*) AS total_facturas,
                            COALESCE(SUM(fp.monto_total), 0) AS total_pendiente_pago,
                            COALESCE(SUM(CASE WHEN DATEDIFF(fp.fecha_vencimiento, @fecha_corte) > 7 THEN 1 ELSE 0 END), 0) AS cant_vigentes,
                            COALESCE(SUM(CASE WHEN DATEDIFF(fp.fecha_vencimiento, @fecha_corte) > 7 THEN fp.monto_total ELSE 0 END), 0) AS monto_vigentes,
                            COALESCE(SUM(CASE WHEN DATEDIFF(fp.fecha_vencimiento, @fecha_corte) BETWEEN 0 AND 7 THEN 1 ELSE 0 END), 0) AS cant_por_vencer,
                            COALESCE(SUM(CASE WHEN DATEDIFF(fp.fecha_vencimiento, @fecha_corte) BETWEEN 0 AND 7 THEN fp.monto_total ELSE 0 END), 0) AS monto_por_vencer,
                            COALESCE(SUM(CASE WHEN DATEDIFF(@fecha_corte, fp.fecha_vencimiento) BETWEEN 1 AND 30 THEN 1 ELSE 0 END), 0) AS cant_venc_1_30,
                            COALESCE(SUM(CASE WHEN DATEDIFF(@fecha_corte, fp.fecha_vencimiento) BETWEEN 1 AND 30 THEN fp.monto_total ELSE 0 END), 0) AS monto_venc_1_30,
                            COALESCE(SUM(CASE WHEN DATEDIFF(@fecha_corte, fp.fecha_vencimiento) BETWEEN 31 AND 60 THEN 1 ELSE 0 END), 0) AS cant_venc_31_60,
                            COALESCE(SUM(CASE WHEN DATEDIFF(@fecha_corte, fp.fecha_vencimiento) BETWEEN 31 AND 60 THEN fp.monto_total ELSE 0 END), 0) AS monto_venc_31_60,
                            COALESCE(SUM(CASE WHEN DATEDIFF(@fecha_corte, fp.fecha_vencimiento) BETWEEN 61 AND 90 THEN 1 ELSE 0 END), 0) AS cant_venc_61_90,
                            COALESCE(SUM(CASE WHEN DATEDIFF(@fecha_corte, fp.fecha_vencimiento) BETWEEN 61 AND 90 THEN fp.monto_total ELSE 0 END), 0) AS monto_venc_61_90,
                            COALESCE(SUM(CASE WHEN DATEDIFF(@fecha_corte, fp.fecha_vencimiento) > 90 THEN 1 ELSE 0 END), 0) AS cant_venc_mas_90,
                            COALESCE(SUM(CASE WHEN DATEDIFF(@fecha_corte, fp.fecha_vencimiento) > 90 THEN fp.monto_total ELSE 0 END), 0) AS monto_venc_mas_90
                        FROM FACTURA_PROVEEDOR fp
                        INNER JOIN ORDEN_COMPRA oc ON fp.id_oc = oc.id_oc
                        INNER JOIN PROVEEDOR p ON oc.id_proveedor = p.id_proveedor
                        WHERE fp.estado_pago <> 'pagada'
                          AND (@id_proveedor IS NULL OR oc.id_proveedor = @id_proveedor)";

                    using (var cmdResumen = new MySqlCommand(sqlResumen, conn))
                    {
                        cmdResumen.Parameters.AddWithValue("@fecha_corte", fechaCorteDt.Date);
                        cmdResumen.Parameters.AddWithValue("@id_proveedor", (object)filtroProveedor ?? DBNull.Value);

                        using (var reader = cmdResumen.ExecuteReader())
                        {
                            if (reader.Read())
                            {
                                respuesta.TotalFacturas = Convert.ToInt32(reader["total_facturas"]);
                                respuesta.TotalPendientePago = Convert.ToDecimal(reader["total_pendiente_pago"]);

                                respuesta.Tramos.Add(new TramoCuentasPorPagarDto
                                {
                                    Codigo = "vigentes",
                                    Etiqueta = "Vigentes (> 7 días)",
                                    CantidadFacturas = Convert.ToInt32(reader["cant_vigentes"]),
                                    MontoTotal = Convert.ToDecimal(reader["monto_vigentes"])
                                });
                                respuesta.Tramos.Add(new TramoCuentasPorPagarDto
                                {
                                    Codigo = "por_vencer",
                                    Etiqueta = "Por vencer (0 a 7 días)",
                                    CantidadFacturas = Convert.ToInt32(reader["cant_por_vencer"]),
                                    MontoTotal = Convert.ToDecimal(reader["monto_por_vencer"])
                                });
                                respuesta.Tramos.Add(new TramoCuentasPorPagarDto
                                {
                                    Codigo = "vencidas_1_30",
                                    Etiqueta = "Vencidas 1 a 30 días",
                                    CantidadFacturas = Convert.ToInt32(reader["cant_venc_1_30"]),
                                    MontoTotal = Convert.ToDecimal(reader["monto_venc_1_30"])
                                });
                                respuesta.Tramos.Add(new TramoCuentasPorPagarDto
                                {
                                    Codigo = "vencidas_31_60",
                                    Etiqueta = "Vencidas 31 a 60 días",
                                    CantidadFacturas = Convert.ToInt32(reader["cant_venc_31_60"]),
                                    MontoTotal = Convert.ToDecimal(reader["monto_venc_31_60"])
                                });
                                respuesta.Tramos.Add(new TramoCuentasPorPagarDto
                                {
                                    Codigo = "vencidas_61_90",
                                    Etiqueta = "Vencidas 61 a 90 días",
                                    CantidadFacturas = Convert.ToInt32(reader["cant_venc_61_90"]),
                                    MontoTotal = Convert.ToDecimal(reader["monto_venc_61_90"])
                                });
                                respuesta.Tramos.Add(new TramoCuentasPorPagarDto
                                {
                                    Codigo = "vencidas_mas_90",
                                    Etiqueta = "Vencidas más de 90 días",
                                    CantidadFacturas = Convert.ToInt32(reader["cant_venc_mas_90"]),
                                    MontoTotal = Convert.ToDecimal(reader["monto_venc_mas_90"])
                                });
                            }
                        }
                    }

                    const string sqlDetalle = @"
                        SELECT
                            fp.id_factura,
                            fp.id_oc,
                            oc.id_proveedor,
                            p.razon_social,
                            fp.nro_factura,
                            fp.fecha_emision,
                            fp.fecha_vencimiento,
                            fp.fecha_pago,
                            fp.monto_total,
                            fp.estado_pago,
                            DATEDIFF(fp.fecha_vencimiento, @fecha_corte) AS dias_diferencia,
                            GREATEST(0, DATEDIFF(@fecha_corte, fp.fecha_vencimiento)) AS dias_atraso,
                            GREATEST(0, DATEDIFF(fp.fecha_vencimiento, @fecha_corte)) AS dias_para_vencer,
                            CASE
                                WHEN DATEDIFF(fp.fecha_vencimiento, @fecha_corte) > 7 THEN 'vigentes'
                                WHEN DATEDIFF(fp.fecha_vencimiento, @fecha_corte) BETWEEN 0 AND 7 THEN 'por_vencer'
                                WHEN DATEDIFF(@fecha_corte, fp.fecha_vencimiento) BETWEEN 1 AND 30 THEN 'vencidas_1_30'
                                WHEN DATEDIFF(@fecha_corte, fp.fecha_vencimiento) BETWEEN 31 AND 60 THEN 'vencidas_31_60'
                                WHEN DATEDIFF(@fecha_corte, fp.fecha_vencimiento) BETWEEN 61 AND 90 THEN 'vencidas_61_90'
                                ELSE 'vencidas_mas_90'
                            END AS tramo_codigo,
                            CASE
                                WHEN DATEDIFF(fp.fecha_vencimiento, @fecha_corte) > 7 THEN 'Vigentes'
                                WHEN DATEDIFF(fp.fecha_vencimiento, @fecha_corte) BETWEEN 0 AND 7 THEN 'Por vencer'
                                WHEN DATEDIFF(@fecha_corte, fp.fecha_vencimiento) BETWEEN 1 AND 30 THEN 'Vencidas 1 a 30 días'
                                WHEN DATEDIFF(@fecha_corte, fp.fecha_vencimiento) BETWEEN 31 AND 60 THEN 'Vencidas 31 a 60 días'
                                WHEN DATEDIFF(@fecha_corte, fp.fecha_vencimiento) BETWEEN 61 AND 90 THEN 'Vencidas 61 a 90 días'
                                ELSE 'Vencidas más de 90 días'
                            END AS tramo_etiqueta,
                            CASE
                                WHEN DATEDIFF(fp.fecha_vencimiento, @fecha_corte) > 7 THEN 'verde'
                                WHEN DATEDIFF(fp.fecha_vencimiento, @fecha_corte) BETWEEN 0 AND 7 THEN 'ambar'
                                ELSE 'rojo'
                            END AS nivel_alerta
                        FROM FACTURA_PROVEEDOR fp
                        INNER JOIN ORDEN_COMPRA oc ON fp.id_oc = oc.id_oc
                        INNER JOIN PROVEEDOR p ON oc.id_proveedor = p.id_proveedor
                        WHERE fp.estado_pago <> 'pagada'
                          AND (@id_proveedor IS NULL OR oc.id_proveedor = @id_proveedor)
                        ORDER BY fp.fecha_vencimiento ASC, fp.id_factura ASC";

                    using (var cmdDetalle = new MySqlCommand(sqlDetalle, conn))
                    {
                        cmdDetalle.Parameters.AddWithValue("@fecha_corte", fechaCorteDt.Date);
                        cmdDetalle.Parameters.AddWithValue("@id_proveedor", (object)filtroProveedor ?? DBNull.Value);

                        using (var reader = cmdDetalle.ExecuteReader())
                        {
                            while (reader.Read())
                            {
                                respuesta.Facturas.Add(new FacturaPorPagarDetalleDto
                                {
                                    IdFactura = Convert.ToInt32(reader["id_factura"]),
                                    IdOc = Convert.ToInt32(reader["id_oc"]),
                                    IdProveedor = Convert.ToInt32(reader["id_proveedor"]),
                                    ProveedorNombre = reader["razon_social"].ToString(),
                                    NroFactura = reader["nro_factura"].ToString(),
                                    FechaEmision = Convert.ToDateTime(reader["fecha_emision"]).ToString("yyyy-MM-dd"),
                                    FechaVencimiento = Convert.ToDateTime(reader["fecha_vencimiento"]).ToString("yyyy-MM-dd"),
                                    FechaPagoProgramada = reader["fecha_pago"] != DBNull.Value
                                        ? Convert.ToDateTime(reader["fecha_pago"]).ToString("yyyy-MM-dd")
                                        : null,
                                    DiasDiferencia = Convert.ToInt32(reader["dias_diferencia"]),
                                    DiasAtraso = Convert.ToInt32(reader["dias_atraso"]),
                                    DiasParaVencer = Convert.ToInt32(reader["dias_para_vencer"]),
                                    TramoCodigo = reader["tramo_codigo"].ToString(),
                                    TramoEtiqueta = reader["tramo_etiqueta"].ToString(),
                                    NivelAlerta = reader["nivel_alerta"].ToString(),
                                    MontoTotal = Convert.ToDecimal(reader["monto_total"]),
                                    EstadoFactura = reader["estado_pago"].ToString()
                                });
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
                System.Diagnostics.Trace.TraceError("Error al generar reporte de cuentas por pagar: {0}", ex);
                return Content(HttpStatusCode.ServiceUnavailable, new { error = "No se pudo generar el reporte de cuentas por pagar." });
            }
        }
    }
}

