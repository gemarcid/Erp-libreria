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
    [RoutePrefix("api/facturas-proveedor")]
    public class FacturasProveedorController : ApiController
    {
        [HttpGet]
        [Route("ordenes-pendientes")]
        public IHttpActionResult GetOrdenesPendientesFacturar()
        {
            HttpContext.Current.Response.Cache.SetNoStore();
            var resultado = new List<OrdenPendienteFacturarDto>();

            try
            {
                using (var conn = DbConnectionFactory.CreateConnection())
                {
                    SessionAccess.RequireModule(new HttpRequestWrapper(HttpContext.Current.Request), conn, "compras", SecurityPolicy.Read);

                    const string sql = @"
                        SELECT oc.id_oc, oc.id_proveedor, p.razon_social, p.rut, p.condicion_pago,
                               oc.fecha, oc.estado, oc.total AS total_orden,
                               doc.isbn, l.titulo, doc.cantidad, doc.precio_pactado, doc.iva_porcentaje
                        FROM ORDEN_COMPRA oc
                        INNER JOIN PROVEEDOR p ON oc.id_proveedor = p.id_proveedor
                        INNER JOIN DETALLE_OC doc ON oc.id_oc = doc.id_oc
                        INNER JOIN LIBRO l ON doc.isbn = l.isbn
                        LEFT JOIN FACTURA_PROVEEDOR fp ON fp.id_oc = oc.id_oc
                        WHERE oc.estado IN ('recibida parcial', 'recibida')
                          AND fp.id_factura IS NULL
                        ORDER BY oc.id_oc DESC, l.titulo";

                    using (var cmd = new MySqlCommand(sql, conn))
                    using (var reader = cmd.ExecuteReader())
                    {
                        OrdenPendienteFacturarDto actual = null;

                        while (reader.Read())
                        {
                            int idOc = Convert.ToInt32(reader["id_oc"]);

                            if (actual == null || actual.IdOc != idOc)
                            {
                                actual = new OrdenPendienteFacturarDto
                                {
                                    IdOc = idOc,
                                    IdProveedor = Convert.ToInt32(reader["id_proveedor"]),
                                    ProveedorNombre = reader["razon_social"].ToString(),
                                    ProveedorRut = reader["rut"].ToString(),
                                    CondicionPago = reader["condicion_pago"] != DBNull.Value ? reader["condicion_pago"].ToString() : null,
                                    FechaOrden = Convert.ToDateTime(reader["fecha"]).ToString("yyyy-MM-dd"),
                                    Estado = reader["estado"].ToString(),
                                    TotalOrden = Convert.ToDecimal(reader["total_orden"]),
                                    NetoSugerido = 0m,
                                    IvaSugerido = 0m
                                };
                                resultado.Add(actual);
                            }

                            int cantidad = Convert.ToInt32(reader["cantidad"]);
                            decimal precioPactado = Convert.ToDecimal(reader["precio_pactado"]);
                            decimal ivaPorcentaje = Convert.ToDecimal(reader["iva_porcentaje"]);
                            decimal subtotalNeto = Math.Round(cantidad * precioPactado, 2);
                            decimal subtotalIva = Math.Round(subtotalNeto * (ivaPorcentaje / 100m), 2);

                            actual.NetoSugerido = Math.Round(actual.NetoSugerido + subtotalNeto, 2);
                            actual.IvaSugerido = Math.Round(actual.IvaSugerido + subtotalIva, 2);

                            actual.Lineas.Add(new LineaOrdenFacturaDto
                            {
                                Isbn = reader["isbn"].ToString(),
                                Titulo = reader["titulo"].ToString(),
                                Cantidad = cantidad,
                                PrecioPactado = precioPactado,
                                IvaPorcentaje = ivaPorcentaje,
                                SubtotalNeto = subtotalNeto
                            });
                        }
                    }
                }

                return Ok(resultado);
            }
            catch (HttpException ex)
            {
                return Content((HttpStatusCode)ex.GetHttpCode(), new { error = ex.Message });
            }
            catch (Exception ex)
            {
                System.Diagnostics.Trace.TraceError("Error al listar órdenes pendientes de facturar: {0}", ex);
                return Content(HttpStatusCode.ServiceUnavailable, new { error = "No se pudieron consultar las órdenes pendientes de facturación." });
            }
        }

        [HttpGet]
        [Route("")]
        public IHttpActionResult GetFacturas()
        {
            HttpContext.Current.Response.Cache.SetNoStore();
            var lista = new List<FacturaProveedorDto>();

            try
            {
                using (var conn = DbConnectionFactory.CreateConnection())
                {
                    SessionAccess.RequireModule(new HttpRequestWrapper(HttpContext.Current.Request), conn, "compras", SecurityPolicy.Read);

                    const string sql = @"
                        SELECT fp.id_factura, fp.id_oc, oc.id_proveedor, p.razon_social,
                               fp.nro_factura, fp.fecha_emision, fp.fecha_vencimiento, fp.fecha_pago,
                               fp.monto_neto, fp.iva, fp.monto_total, fp.estado_pago
                        FROM FACTURA_PROVEEDOR fp
                        INNER JOIN ORDEN_COMPRA oc ON fp.id_oc = oc.id_oc
                        INNER JOIN PROVEEDOR p ON oc.id_proveedor = p.id_proveedor
                        ORDER BY fp.id_factura DESC";

                    using (var cmd = new MySqlCommand(sql, conn))
                    using (var reader = cmd.ExecuteReader())
                    {
                        while (reader.Read())
                        {
                            lista.Add(MapFactura(reader));
                        }
                    }
                }

                return Ok(lista);
            }
            catch (HttpException ex)
            {
                return Content((HttpStatusCode)ex.GetHttpCode(), new { error = ex.Message });
            }
            catch (Exception ex)
            {
                System.Diagnostics.Trace.TraceError("Error al listar facturas de proveedor: {0}", ex);
                return Content(HttpStatusCode.ServiceUnavailable, new { error = "No se pudieron consultar las facturas de proveedor." });
            }
        }

        [HttpPost]
        [Route("")]
        public IHttpActionResult RegistrarFactura([FromBody] RegistrarFacturaProveedorRequestDto dto)
        {
            HttpContext.Current.Response.Cache.SetNoStore();

            if (dto == null)
                return Content(HttpStatusCode.BadRequest, new { error = "Datos de la factura no proporcionados." });

            if (dto.IdOc <= 0)
                return Content(HttpStatusCode.BadRequest, new { error = "Debes seleccionar una orden de compra válida." });

            if (string.IsNullOrWhiteSpace(dto.NroFactura))
                return Content(HttpStatusCode.BadRequest, new { error = "El número de factura es obligatorio." });

            string nroFactura = dto.NroFactura.Trim();
            if (nroFactura.Length > 50)
                return Content(HttpStatusCode.BadRequest, new { error = "El número de factura no puede superar 50 caracteres." });

            if (string.IsNullOrWhiteSpace(dto.FechaEmision) ||
                !DateTime.TryParseExact(dto.FechaEmision.Trim(), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out DateTime fechaEmision))
            {
                return Content(HttpStatusCode.BadRequest, new { error = "La fecha de emisión es obligatoria y debe tener formato YYYY-MM-DD." });
            }

            if (string.IsNullOrWhiteSpace(dto.FechaVencimiento) ||
                !DateTime.TryParseExact(dto.FechaVencimiento.Trim(), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out DateTime fechaVencimiento))
            {
                return Content(HttpStatusCode.BadRequest, new { error = "La fecha de vencimiento es obligatoria y debe tener formato YYYY-MM-DD." });
            }

            if (fechaEmision.Date > DateTime.Today)
            {
                return Content(HttpStatusCode.BadRequest, new { error = "La fecha de emisión no puede ser futura." });
            }

            if (fechaVencimiento.Date < fechaEmision.Date)
            {
                return Content(HttpStatusCode.BadRequest, new { error = "La fecha de vencimiento no puede ser anterior a la fecha de emisión." });
            }

            if (!dto.MontoNeto.HasValue || !dto.Iva.HasValue)
            {
                return Content(HttpStatusCode.BadRequest, new { error = "El monto neto y el IVA son obligatorios." });
            }

            decimal montoNeto = Math.Round(dto.MontoNeto.Value, 2);
            decimal iva = Math.Round(dto.Iva.Value, 2);

            if (montoNeto <= 0 || iva <= 0)
            {
                return Content(HttpStatusCode.BadRequest, new { error = "Los montos neto e IVA deben ser mayores a 0." });
            }

            decimal montoTotal = Math.Round(montoNeto + iva, 2);

            try
            {
                using (var conn = DbConnectionFactory.CreateConnection())
                {
                    int userId = SessionAccess.RequireModule(new HttpRequestWrapper(HttpContext.Current.Request), conn, "compras", SecurityPolicy.Edit);

                    using (var trans = conn.BeginTransaction())
                    {
                        try
                        {
                            // 1. Bloquear la orden con FOR UPDATE
                            int idProveedor;
                            string estadoOc;
                            string proveedorNombre;

                            const string lockOcSql = @"
                                SELECT oc.id_proveedor, oc.estado, p.razon_social
                                FROM ORDEN_COMPRA oc
                                INNER JOIN PROVEEDOR p ON oc.id_proveedor = p.id_proveedor
                                WHERE oc.id_oc = @id_oc
                                FOR UPDATE";

                            using (var cmdLock = new MySqlCommand(lockOcSql, conn, trans))
                            {
                                cmdLock.Parameters.AddWithValue("@id_oc", dto.IdOc);
                                using (var reader = cmdLock.ExecuteReader())
                                {
                                    if (!reader.Read())
                                    {
                                        trans.Rollback();
                                        return Content(HttpStatusCode.NotFound, new { error = $"La orden de compra #{dto.IdOc} no existe." });
                                    }

                                    idProveedor = Convert.ToInt32(reader["id_proveedor"]);
                                    estadoOc = reader["estado"].ToString();
                                    proveedorNombre = reader["razon_social"].ToString();
                                }
                            }

                            // 2. Verificar si ya existe una factura con el mismo número para ese proveedor
                            const string checkDupNroSql = @"
                                SELECT fp.id_factura, fp.id_oc, oc.id_proveedor, p.razon_social,
                                       fp.nro_factura, fp.fecha_emision, fp.fecha_vencimiento, fp.fecha_pago,
                                       fp.monto_neto, fp.iva, fp.monto_total, fp.estado_pago
                                FROM FACTURA_PROVEEDOR fp
                                INNER JOIN ORDEN_COMPRA oc ON fp.id_oc = oc.id_oc
                                INNER JOIN PROVEEDOR p ON oc.id_proveedor = p.id_proveedor
                                WHERE oc.id_proveedor = @id_proveedor
                                  AND LOWER(TRIM(fp.nro_factura)) = LOWER(@nro_factura)
                                LIMIT 1";

                            using (var cmdDupNro = new MySqlCommand(checkDupNroSql, conn, trans))
                            {
                                cmdDupNro.Parameters.AddWithValue("@id_proveedor", idProveedor);
                                cmdDupNro.Parameters.AddWithValue("@nro_factura", nroFactura);
                                using (var reader = cmdDupNro.ExecuteReader())
                                {
                                    if (reader.Read())
                                    {
                                        var existente = MapFactura(reader);
                                        reader.Close();
                                        trans.Rollback();
                                        return Content(HttpStatusCode.Conflict, new
                                        {
                                            error = "La factura ya está registrada",
                                            facturaExistente = existente,
                                            factura_existente = existente
                                        });
                                    }
                                }
                            }

                            // 3. Verificar si la orden ya tiene otra factura asociada (una factura por orden)
                            const string checkDupOcSql = @"
                                SELECT fp.id_factura, fp.id_oc, oc.id_proveedor, p.razon_social,
                                       fp.nro_factura, fp.fecha_emision, fp.fecha_vencimiento, fp.fecha_pago,
                                       fp.monto_neto, fp.iva, fp.monto_total, fp.estado_pago
                                FROM FACTURA_PROVEEDOR fp
                                INNER JOIN ORDEN_COMPRA oc ON fp.id_oc = oc.id_oc
                                INNER JOIN PROVEEDOR p ON oc.id_proveedor = p.id_proveedor
                                WHERE fp.id_oc = @id_oc
                                LIMIT 1";

                            using (var cmdDupOc = new MySqlCommand(checkDupOcSql, conn, trans))
                            {
                                cmdDupOc.Parameters.AddWithValue("@id_oc", dto.IdOc);
                                using (var reader = cmdDupOc.ExecuteReader())
                                {
                                    if (reader.Read())
                                    {
                                        var existente = MapFactura(reader);
                                        reader.Close();
                                        trans.Rollback();
                                        return Content(HttpStatusCode.Conflict, new
                                        {
                                            error = $"La orden de compra #{dto.IdOc} ya tiene una factura registrada (Factura N° {existente.NroFactura}).",
                                            facturaExistente = existente,
                                            factura_existente = existente
                                        });
                                    }
                                }
                            }

                            // 4. Validar estado de la orden ('recibida parcial' o 'recibida')
                            if (estadoOc != "recibida parcial" && estadoOc != "recibida")
                            {
                                trans.Rollback();
                                return Content(HttpStatusCode.Conflict, new
                                {
                                    error = $"La orden #{dto.IdOc} está en estado '{estadoOc}'. Solo se pueden registrar facturas para órdenes en estado 'recibida parcial' o 'recibida'."
                                });
                            }

                            // 5. Insertar la factura con estado 'pendiente de conciliacion'
                            const string insertSql = @"
                                INSERT INTO FACTURA_PROVEEDOR
                                    (id_oc, nro_factura, fecha_emision, fecha_vencimiento, fecha_pago, monto_neto, iva, monto_total, estado_pago)
                                VALUES
                                    (@id_oc, @nro_factura, @fecha_emision, @fecha_vencimiento, NULL, @monto_neto, @iva, @monto_total, 'pendiente de conciliacion');
                                SELECT LAST_INSERT_ID();";

                            int nuevaFacturaId;
                            using (var cmdIns = new MySqlCommand(insertSql, conn, trans))
                            {
                                cmdIns.Parameters.AddWithValue("@id_oc", dto.IdOc);
                                cmdIns.Parameters.AddWithValue("@nro_factura", nroFactura);
                                cmdIns.Parameters.AddWithValue("@fecha_emision", fechaEmision.Date);
                                cmdIns.Parameters.AddWithValue("@fecha_vencimiento", fechaVencimiento.Date);
                                cmdIns.Parameters.AddWithValue("@monto_neto", montoNeto);
                                cmdIns.Parameters.AddWithValue("@iva", iva);
                                cmdIns.Parameters.AddWithValue("@monto_total", montoTotal);

                                nuevaFacturaId = Convert.ToInt32(cmdIns.ExecuteScalar());
                            }

                            SecurityPolicy.Log(conn, trans, userId, "compras", "Registrar factura de proveedor", $"Factura #{nuevaFacturaId} ({nroFactura}) - OC #{dto.IdOc}");
                            trans.Commit();

                            var creada = new FacturaProveedorDto
                            {
                                IdFactura = nuevaFacturaId,
                                IdOc = dto.IdOc,
                                IdProveedor = idProveedor,
                                ProveedorNombre = proveedorNombre,
                                NroFactura = nroFactura,
                                FechaEmision = fechaEmision.ToString("yyyy-MM-dd"),
                                FechaVencimiento = fechaVencimiento.ToString("yyyy-MM-dd"),
                                FechaPago = null,
                                MontoNeto = montoNeto,
                                Iva = iva,
                                MontoTotal = montoTotal,
                                EstadoPago = "pendiente de conciliacion"
                            };

                            return Content(HttpStatusCode.Created, new
                            {
                                success = true,
                                mensaje = $"Factura N° {nroFactura} registrada correctamente para la orden #{dto.IdOc} con estado 'pendiente de conciliacion'.",
                                factura = creada
                            });
                        }
                        catch (MySqlException ex) when (ex.Number == 1062)
                        {
                            trans.Rollback();
                            return Content(HttpStatusCode.Conflict, new
                            {
                                error = "La factura o la orden seleccionada ya cuenta con un registro de facturación."
                            });
                        }
                        catch
                        {
                            trans.Rollback();
                            throw;
                        }
                    }
                }
            }
            catch (HttpException ex)
            {
                return Content((HttpStatusCode)ex.GetHttpCode(), new { error = ex.Message });
            }
            catch (Exception ex)
            {
                System.Diagnostics.Trace.TraceError("Error al registrar factura de proveedor para OC #{0}: {1}", dto.IdOc, ex);
                return Content(HttpStatusCode.ServiceUnavailable, new { error = "No se pudo registrar la factura del proveedor." });
            }
        }

        private static FacturaProveedorDto MapFactura(MySqlDataReader reader)
        {
            return new FacturaProveedorDto
            {
                IdFactura = Convert.ToInt32(reader["id_factura"]),
                IdOc = Convert.ToInt32(reader["id_oc"]),
                IdProveedor = Convert.ToInt32(reader["id_proveedor"]),
                ProveedorNombre = reader["razon_social"].ToString(),
                NroFactura = reader["nro_factura"].ToString(),
                FechaEmision = Convert.ToDateTime(reader["fecha_emision"]).ToString("yyyy-MM-dd"),
                FechaVencimiento = reader["fecha_vencimiento"] != DBNull.Value
                    ? Convert.ToDateTime(reader["fecha_vencimiento"]).ToString("yyyy-MM-dd")
                    : null,
                FechaPago = reader["fecha_pago"] != DBNull.Value
                    ? Convert.ToDateTime(reader["fecha_pago"]).ToString("yyyy-MM-dd")
                    : null,
                MontoNeto = Convert.ToDecimal(reader["monto_neto"]),
                Iva = Convert.ToDecimal(reader["iva"]),
                MontoTotal = Convert.ToDecimal(reader["monto_total"]),
                EstadoPago = reader["estado_pago"].ToString()
            };
        }
    }
}

