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
    [RoutePrefix("api/compras/reportes/cumplimiento-entregas")]
    public class ReporteCumplimientoEntregasController : ApiController
    {
        private const string CteOrdenesConsideradas = @"
            WITH ordenes_base AS (
                SELECT
                    oc.id_oc,
                    oc.id_proveedor,
                    p.razon_social,
                    oc.fecha_entrega,
                    COALESCE((SELECT SUM(d.cantidad) FROM DETALLE_OC d WHERE d.id_oc = oc.id_oc), 0) AS cantidad_pedida,
                    COALESCE((
                        SELECT SUM(m.cantidad)
                        FROM MOVIMIENTO_STOCK m
                        INNER JOIN RECEPCION r ON m.id_recepcion = r.id_recepcion
                        WHERE r.id_oc = oc.id_oc AND m.tipo_movimiento = 'entrada' AND m.motivo = 'compra'
                    ), 0) AS cantidad_recibida,
                    (SELECT DATE(MAX(r.fecha)) FROM RECEPCION r WHERE r.id_oc = oc.id_oc) AS fecha_ultima_recepcion,
                    (SELECT COUNT(*) FROM RECEPCION r WHERE r.id_oc = oc.id_oc) AS num_recepciones
                FROM ORDEN_COMPRA oc
                INNER JOIN PROVEEDOR p ON oc.id_proveedor = p.id_proveedor
                WHERE oc.estado IN ('aprobada', 'recibida parcial', 'recibida')
                  AND oc.fecha_entrega IS NOT NULL
                  AND oc.fecha_entrega BETWEEN @desde AND @hasta
                  AND (@id_proveedor IS NULL OR oc.id_proveedor = @id_proveedor)
            ),
            ordenes_consideradas AS (
                SELECT
                    ob.id_oc,
                    ob.id_proveedor,
                    ob.razon_social,
                    ob.fecha_entrega,
                    ob.fecha_ultima_recepcion,
                    ob.cantidad_pedida,
                    ob.cantidad_recibida,
                    COALESCE(ROUND((ob.cantidad_recibida * 100.0) / NULLIF(ob.cantidad_pedida, 0), 2), 0) AS porcentaje_cantidad,
                    CASE
                        WHEN ob.cantidad_recibida >= ob.cantidad_pedida AND ob.fecha_ultima_recepcion IS NOT NULL AND ob.fecha_ultima_recepcion <= ob.fecha_entrega
                            THEN 'A tiempo'
                        WHEN ob.cantidad_recibida >= ob.cantidad_pedida AND ob.fecha_ultima_recepcion IS NOT NULL AND ob.fecha_ultima_recepcion > ob.fecha_entrega
                            THEN 'Con atraso'
                        WHEN ob.fecha_entrega < @hoy AND ob.cantidad_recibida < ob.cantidad_pedida AND ob.num_recepciones > 0
                            THEN 'Incompleta'
                        ELSE 'No entregada'
                    END AS estado_cumplimiento,
                    CASE
                        WHEN ob.cantidad_recibida >= ob.cantidad_pedida AND ob.fecha_ultima_recepcion IS NOT NULL AND ob.fecha_ultima_recepcion <= ob.fecha_entrega
                            THEN 0
                        WHEN ob.cantidad_recibida >= ob.cantidad_pedida AND ob.fecha_ultima_recepcion IS NOT NULL AND ob.fecha_ultima_recepcion > ob.fecha_entrega
                            THEN DATEDIFF(ob.fecha_ultima_recepcion, ob.fecha_entrega)
                        ELSE GREATEST(0, DATEDIFF(@hoy, ob.fecha_entrega))
                    END AS dias_atraso,
                    CASE
                        WHEN ob.cantidad_recibida >= ob.cantidad_pedida AND ob.fecha_ultima_recepcion IS NOT NULL AND ob.fecha_ultima_recepcion <= ob.fecha_entrega
                            THEN 'verde'
                        WHEN (ob.cantidad_recibida >= ob.cantidad_pedida AND ob.fecha_ultima_recepcion IS NOT NULL AND ob.fecha_ultima_recepcion > ob.fecha_entrega)
                          OR (ob.fecha_entrega < @hoy AND ob.cantidad_recibida < ob.cantidad_pedida AND ob.num_recepciones > 0)
                            THEN 'ambar'
                        ELSE 'rojo'
                    END AS nivel_alerta
                FROM ordenes_base ob
                WHERE ob.cantidad_pedida > 0
                  AND (
                      (ob.cantidad_recibida >= ob.cantidad_pedida AND ob.fecha_ultima_recepcion IS NOT NULL)
                      OR ob.fecha_entrega < @hoy
                  )
            )";

        [HttpGet]
        [Route("")]
        public IHttpActionResult GetReporteCumplimientoEntregas(
            [FromUri] string desde = null,
            [FromUri] string hasta = null,
            [FromUri(Name = "id_proveedor")] int? idProveedorParam = null,
            [FromUri] int? idProveedor = null)
        {
            HttpContext.Current.Response.Cache.SetNoStore();

            int? rawProveedor = idProveedorParam ?? idProveedor;
            if (rawProveedor.HasValue && rawProveedor.Value < 0)
            {
                return Content(HttpStatusCode.BadRequest, new { error = "El parámetro id_proveedor no es válido." });
            }
            int? filtroProveedor = (rawProveedor.HasValue && rawProveedor.Value > 0) ? rawProveedor.Value : (int?)null;

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

            try
            {
                using (var conn = DbConnectionFactory.CreateConnection())
                {
                    SessionAccess.RequireModule(new HttpRequestWrapper(HttpContext.Current.Request), conn, "compras", SecurityPolicy.Read);

                    var respuesta = new ReporteCumplimientoEntregasRespuestaDto
                    {
                        Desde = desdeDate.ToString("yyyy-MM-dd"),
                        Hasta = hastaDate.ToString("yyyy-MM-dd"),
                        IdProveedor = filtroProveedor
                    };

                    // 1. Indicadores generales en SQL
                    string sqlGeneral = CteOrdenesConsideradas + @"
                        SELECT
                            COUNT(*) AS total_consideradas,
                            COALESCE(ROUND((SUM(CASE WHEN estado_cumplimiento = 'A tiempo' THEN 1 ELSE 0 END) * 100.0) / NULLIF(COUNT(*), 0), 2), 0) AS pct_a_tiempo_general,
                            COALESCE(ROUND((SUM(cantidad_recibida) * 100.0) / NULLIF(SUM(cantidad_pedida), 0), 2), 0) AS pct_cantidad_general
                        FROM ordenes_consideradas;";

                    using (var cmdGen = new MySqlCommand(sqlGeneral, conn))
                    {
                        cmdGen.Parameters.AddWithValue("@desde", desdeDate.Date);
                        cmdGen.Parameters.AddWithValue("@hasta", hastaDate.Date);
                        cmdGen.Parameters.AddWithValue("@hoy", hoy.Date);
                        cmdGen.Parameters.AddWithValue("@id_proveedor", (object)filtroProveedor ?? DBNull.Value);

                        using (var reader = cmdGen.ExecuteReader())
                        {
                            if (reader.Read())
                            {
                                respuesta.TotalOrdenesConsideradas = Convert.ToInt32(reader["total_consideradas"]);
                                respuesta.PorcentajeATiempoGeneral = Convert.ToDecimal(reader["pct_a_tiempo_general"]);
                                respuesta.PorcentajeCantidadGeneral = Convert.ToDecimal(reader["pct_cantidad_general"]);
                            }
                        }
                    }

                    if (respuesta.TotalOrdenesConsideradas == 0)
                    {
                        return Ok(respuesta);
                    }

                    // 2. Resumen por proveedor en SQL
                    string sqlProveedores = CteOrdenesConsideradas + @"
                        SELECT
                            id_proveedor,
                            razon_social,
                            COUNT(*) AS ordenes_consideradas,
                            SUM(CASE WHEN estado_cumplimiento = 'A tiempo' THEN 1 ELSE 0 END) AS ordenes_a_tiempo,
                            COALESCE(ROUND((SUM(CASE WHEN estado_cumplimiento = 'A tiempo' THEN 1 ELSE 0 END) * 100.0) / NULLIF(COUNT(*), 0), 2), 0) AS pct_a_tiempo,
                            SUM(cantidad_pedida) AS total_pedida,
                            SUM(cantidad_recibida) AS total_recibida,
                            COALESCE(ROUND((SUM(cantidad_recibida) * 100.0) / NULLIF(SUM(cantidad_pedida), 0), 2), 0) AS pct_cantidad,
                            ROUND(AVG(CASE WHEN estado_cumplimiento = 'Con atraso' THEN dias_atraso ELSE NULL END), 2) AS promedio_dias_atraso
                        FROM ordenes_consideradas
                        GROUP BY id_proveedor, razon_social
                        ORDER BY razon_social ASC;";

                    using (var cmdProv = new MySqlCommand(sqlProveedores, conn))
                    {
                        cmdProv.Parameters.AddWithValue("@desde", desdeDate.Date);
                        cmdProv.Parameters.AddWithValue("@hasta", hastaDate.Date);
                        cmdProv.Parameters.AddWithValue("@hoy", hoy.Date);
                        cmdProv.Parameters.AddWithValue("@id_proveedor", (object)filtroProveedor ?? DBNull.Value);

                        using (var reader = cmdProv.ExecuteReader())
                        {
                            while (reader.Read())
                            {
                                respuesta.Proveedores.Add(new CumplimientoProveedorResumenDto
                                {
                                    IdProveedor = Convert.ToInt32(reader["id_proveedor"]),
                                    ProveedorNombre = reader["razon_social"].ToString(),
                                    OrdenesConsideradas = Convert.ToInt32(reader["ordenes_consideradas"]),
                                    OrdenesATiempo = Convert.ToInt32(reader["ordenes_a_tiempo"]),
                                    PorcentajeATiempo = Convert.ToDecimal(reader["pct_a_tiempo"]),
                                    CantidadPedidaTotal = Convert.ToInt32(reader["total_pedida"]),
                                    CantidadRecibidaTotal = Convert.ToInt32(reader["total_recibida"]),
                                    PorcentajeCantidad = Convert.ToDecimal(reader["pct_cantidad"]),
                                    PromedioDiasAtraso = reader["promedio_dias_atraso"] != DBNull.Value
                                        ? Convert.ToDecimal(reader["promedio_dias_atraso"])
                                        : (decimal?)null
                                });
                            }
                        }
                    }

                    // 3. Detalle por orden en SQL
                    string sqlDetalle = CteOrdenesConsideradas + @"
                        SELECT
                            id_oc,
                            id_proveedor,
                            razon_social,
                            fecha_entrega,
                            fecha_ultima_recepcion,
                            cantidad_pedida,
                            cantidad_recibida,
                            porcentaje_cantidad,
                            estado_cumplimiento,
                            dias_atraso,
                            nivel_alerta
                        FROM ordenes_consideradas
                        ORDER BY fecha_entrega ASC, id_oc ASC;";

                    using (var cmdDet = new MySqlCommand(sqlDetalle, conn))
                    {
                        cmdDet.Parameters.AddWithValue("@desde", desdeDate.Date);
                        cmdDet.Parameters.AddWithValue("@hasta", hastaDate.Date);
                        cmdDet.Parameters.AddWithValue("@hoy", hoy.Date);
                        cmdDet.Parameters.AddWithValue("@id_proveedor", (object)filtroProveedor ?? DBNull.Value);

                        using (var reader = cmdDet.ExecuteReader())
                        {
                            while (reader.Read())
                            {
                                respuesta.Ordenes.Add(new CumplimientoOrdenDetalleDto
                                {
                                    IdOc = Convert.ToInt32(reader["id_oc"]),
                                    IdProveedor = Convert.ToInt32(reader["id_proveedor"]),
                                    ProveedorNombre = reader["razon_social"].ToString(),
                                    FechaPactada = Convert.ToDateTime(reader["fecha_entrega"]).ToString("yyyy-MM-dd"),
                                    FechaUltimaRecepcion = reader["fecha_ultima_recepcion"] != DBNull.Value
                                        ? Convert.ToDateTime(reader["fecha_ultima_recepcion"]).ToString("yyyy-MM-dd")
                                        : null,
                                    CantidadPedida = Convert.ToInt32(reader["cantidad_pedida"]),
                                    CantidadRecibida = Convert.ToInt32(reader["cantidad_recibida"]),
                                    PorcentajeCantidad = Convert.ToDecimal(reader["porcentaje_cantidad"]),
                                    EstadoCumplimiento = reader["estado_cumplimiento"].ToString(),
                                    DiasAtraso = Convert.ToInt32(reader["dias_atraso"]),
                                    NivelAlerta = reader["nivel_alerta"].ToString()
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
                System.Diagnostics.Trace.TraceError("Error al generar reporte de cumplimiento de entregas: {0}", ex);
                return Content(HttpStatusCode.ServiceUnavailable, new { error = "No se pudo generar el reporte de cumplimiento de entregas." });
            }
        }
    }
}

