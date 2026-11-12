using System;
using System.Collections.Generic;
using System.Net;
using System.Web;
using System.Web.Http;
using backend.Data;
using backend.Models;
using MySql.Data.MySqlClient;

namespace backend.Controllers
{
    [RoutePrefix("api/recepciones")]
    public class RecepcionesController : ApiController
    {
        [HttpGet]
        [Route("pendientes")]
        public IHttpActionResult GetOrdenesPendientes()
        {
            HttpContext.Current.Response.Cache.SetNoStore();
            var resultado = new List<OrdenPendienteRecepcionDto>();

            try
            {
                using (var conn = DbConnectionFactory.CreateConnection())
                {
                    SessionAccess.RequireModule(new HttpRequestWrapper(HttpContext.Current.Request), conn, "compras", SecurityPolicy.Read);

                    const string sql = @"
                        SELECT oc.id_oc, oc.id_proveedor, p.razon_social, oc.estado,
                               oc.fecha, oc.fecha_entrega,
                               doc.isbn, l.titulo, doc.cantidad AS cantidad_pedida,
                               COALESCE((
                                   SELECT SUM(m.cantidad)
                                   FROM MOVIMIENTO_STOCK m
                                   INNER JOIN RECEPCION r ON m.id_recepcion = r.id_recepcion
                                   WHERE r.id_oc = oc.id_oc AND m.isbn = doc.isbn
                                     AND m.tipo_movimiento = 'entrada' AND m.motivo = 'compra'
                               ), 0) AS cantidad_recibida
                        FROM ORDEN_COMPRA oc
                        INNER JOIN PROVEEDOR p ON oc.id_proveedor = p.id_proveedor
                        INNER JOIN DETALLE_OC doc ON oc.id_oc = doc.id_oc
                        INNER JOIN LIBRO l ON doc.isbn = l.isbn
                        WHERE oc.estado IN ('aprobada', 'recibida parcial')
                        ORDER BY oc.id_oc DESC, l.titulo";

                    using (var cmd = new MySqlCommand(sql, conn))
                    using (var reader = cmd.ExecuteReader())
                    {
                        OrdenPendienteRecepcionDto ordenActual = null;

                        while (reader.Read())
                        {
                            int idOc = Convert.ToInt32(reader["id_oc"]);

                            if (ordenActual == null || ordenActual.IdOc != idOc)
                            {
                                ordenActual = new OrdenPendienteRecepcionDto
                                {
                                    IdOc = idOc,
                                    IdProveedor = Convert.ToInt32(reader["id_proveedor"]),
                                    ProveedorNombre = reader["razon_social"].ToString(),
                                    Estado = reader["estado"].ToString(),
                                    Fecha = Convert.ToDateTime(reader["fecha"]).ToString("yyyy-MM-dd"),
                                    FechaEntrega = reader["fecha_entrega"] != DBNull.Value
                                        ? Convert.ToDateTime(reader["fecha_entrega"]).ToString("yyyy-MM-dd")
                                        : null
                                };
                                resultado.Add(ordenActual);
                            }

                            int pedida = Convert.ToInt32(reader["cantidad_pedida"]);
                            int recibida = Convert.ToInt32(reader["cantidad_recibida"]);
                            int pendiente = Math.Max(0, pedida - recibida);

                            ordenActual.Lineas.Add(new LineaPendienteDto
                            {
                                Isbn = reader["isbn"].ToString(),
                                Titulo = reader["titulo"].ToString(),
                                CantidadPedida = pedida,
                                CantidadRecibida = recibida,
                                CantidadPendiente = pendiente
                            });
                        }
                    }

                    resultado.RemoveAll(o => !o.Lineas.Exists(l => l.CantidadPendiente > 0));
                }

                return Ok(resultado);
            }
            catch (HttpException ex)
            {
                return Content((HttpStatusCode)ex.GetHttpCode(), new { error = ex.Message });
            }
            catch (Exception ex)
            {
                System.Diagnostics.Trace.TraceError("Error al listar órdenes pendientes de recepción: {0}", ex);
                return Content(HttpStatusCode.ServiceUnavailable, new { error = "No se pudieron consultar las órdenes pendientes de recepción." });
            }
        }

        [HttpGet]
        [Route("orden/{id:int}")]
        [Route("{id:int}")]
        public IHttpActionResult GetDetalleParaRecepcion(int id)
        {
            HttpContext.Current.Response.Cache.SetNoStore();

            try
            {
                using (var conn = DbConnectionFactory.CreateConnection())
                {
                    SessionAccess.RequireModule(new HttpRequestWrapper(HttpContext.Current.Request), conn, "compras", SecurityPolicy.Read);

                    const string sql = @"
                        SELECT oc.id_oc, oc.id_proveedor, p.razon_social, oc.estado,
                               oc.fecha, oc.fecha_entrega,
                               doc.isbn, l.titulo, doc.cantidad AS cantidad_pedida,
                               COALESCE((
                                   SELECT SUM(m.cantidad)
                                   FROM MOVIMIENTO_STOCK m
                                   INNER JOIN RECEPCION r ON m.id_recepcion = r.id_recepcion
                                   WHERE r.id_oc = oc.id_oc AND m.isbn = doc.isbn
                                     AND m.tipo_movimiento = 'entrada' AND m.motivo = 'compra'
                               ), 0) AS cantidad_recibida
                        FROM ORDEN_COMPRA oc
                        INNER JOIN PROVEEDOR p ON oc.id_proveedor = p.id_proveedor
                        INNER JOIN DETALLE_OC doc ON oc.id_oc = doc.id_oc
                        INNER JOIN LIBRO l ON doc.isbn = l.isbn
                        WHERE oc.id_oc = @id
                        ORDER BY l.titulo";

                    OrdenPendienteRecepcionDto orden = null;

                    using (var cmd = new MySqlCommand(sql, conn))
                    {
                        cmd.Parameters.AddWithValue("@id", id);

                        using (var reader = cmd.ExecuteReader())
                        {
                            while (reader.Read())
                            {
                                if (orden == null)
                                {
                                    string estado = reader["estado"].ToString();
                                    if (estado != "aprobada" && estado != "recibida parcial")
                                    {
                                        return Content(HttpStatusCode.Conflict, new
                                        {
                                            error = $"La orden #{id} no está disponible para recepción (estado actual: '{estado}'). Solo se pueden recibir órdenes en estado 'aprobada' o 'recibida parcial'."
                                        });
                                    }

                                    orden = new OrdenPendienteRecepcionDto
                                    {
                                        IdOc = id,
                                        IdProveedor = Convert.ToInt32(reader["id_proveedor"]),
                                        ProveedorNombre = reader["razon_social"].ToString(),
                                        Estado = estado,
                                        Fecha = Convert.ToDateTime(reader["fecha"]).ToString("yyyy-MM-dd"),
                                        FechaEntrega = reader["fecha_entrega"] != DBNull.Value
                                            ? Convert.ToDateTime(reader["fecha_entrega"]).ToString("yyyy-MM-dd")
                                            : null
                                    };
                                }

                                int pedida = Convert.ToInt32(reader["cantidad_pedida"]);
                                int recibida = Convert.ToInt32(reader["cantidad_recibida"]);
                                int pendiente = Math.Max(0, pedida - recibida);

                                orden.Lineas.Add(new LineaPendienteDto
                                {
                                    Isbn = reader["isbn"].ToString(),
                                    Titulo = reader["titulo"].ToString(),
                                    CantidadPedida = pedida,
                                    CantidadRecibida = recibida,
                                    CantidadPendiente = pendiente
                                });
                            }
                        }
                    }

                    if (orden == null)
                    {
                        return Content(HttpStatusCode.NotFound, new { error = $"La orden de compra #{id} no existe." });
                    }

                    return Ok(orden);
                }
            }
            catch (HttpException ex)
            {
                return Content((HttpStatusCode)ex.GetHttpCode(), new { error = ex.Message });
            }
            catch (Exception ex)
            {
                System.Diagnostics.Trace.TraceError("Error al consultar orden #{0} para recepción: {1}", id, ex);
                return Content(HttpStatusCode.ServiceUnavailable, new { error = "No se pudo consultar el detalle de la orden para recepción." });
            }
        }

        [HttpPost]
        [Route("")]
        public IHttpActionResult RegistrarRecepcion([FromBody] RegistrarRecepcionRequestDto dto)
        {
            HttpContext.Current.Response.Cache.SetNoStore();

            if (dto == null)
                return Content(HttpStatusCode.BadRequest, new { error = "Datos de la recepción no proporcionados." });

            if (dto.IdOc <= 0)
                return Content(HttpStatusCode.BadRequest, new { error = "Debes indicar el número de orden de compra a recibir." });

            if (string.IsNullOrWhiteSpace(dto.TipoDoc))
                return Content(HttpStatusCode.BadRequest, new { error = "El tipo de documento es obligatorio ('guia de despacho' o 'factura')." });

            string tipoDoc = dto.TipoDoc.Trim().ToLowerInvariant();
            if (tipoDoc != "guia de despacho" && tipoDoc != "factura")
            {
                return Content(HttpStatusCode.BadRequest, new
                {
                    error = "El tipo de documento debe ser 'guia de despacho' o 'factura'."
                });
            }

            if (string.IsNullOrWhiteSpace(dto.NroDoc))
                return Content(HttpStatusCode.BadRequest, new { error = "El número de documento es obligatorio." });

            string nroDoc = dto.NroDoc.Trim();
            if (nroDoc.Length > 50)
                return Content(HttpStatusCode.BadRequest, new { error = "El número de documento no puede superar 50 caracteres." });

            if (dto.Lineas == null || dto.Lineas.Count == 0)
                return Content(HttpStatusCode.BadRequest, new { error = "Debes indicar las cantidades de los libros recibidos." });

            var isbnsEnviados = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            int totalUnidadesRecibidas = 0;

            foreach (var l in dto.Lineas)
            {
                if (string.IsNullOrWhiteSpace(l.Isbn))
                    return Content(HttpStatusCode.BadRequest, new { error = "Cada línea debe incluir el ISBN del libro." });

                string isbnLimpio = l.Isbn.Trim();
                if (!isbnsEnviados.Add(isbnLimpio))
                {
                    return Content(HttpStatusCode.BadRequest, new
                    {
                        error = $"El libro con ISBN '{isbnLimpio}' está repetido en la recepción."
                    });
                }

                if (l.Cantidad < 0)
                {
                    return Content(HttpStatusCode.BadRequest, new
                    {
                        error = $"La cantidad para el libro '{isbnLimpio}' no puede ser negativa."
                    });
                }

                totalUnidadesRecibidas += l.Cantidad;
            }

            if (totalUnidadesRecibidas <= 0)
            {
                return Content(HttpStatusCode.BadRequest, new
                {
                    error = "Debes recibir al menos 1 unidad en alguna de las líneas de la orden."
                });
            }

            try
            {
                using (var conn = DbConnectionFactory.CreateConnection())
                {
                    int userId = SessionAccess.RequireModule(new HttpRequestWrapper(HttpContext.Current.Request), conn, "compras", SecurityPolicy.Edit);
                    if (userId <= 0 && dto.IdUsuario.HasValue && dto.IdUsuario.Value > 0)
                    {
                        userId = dto.IdUsuario.Value;
                    }

                    using (var trans = conn.BeginTransaction())
                    {
                        try
                        {
                            // 1. Bloquear la orden y verificar estado 'aprobada'
                            int idProveedor;
                            string estadoActual;

                            using (var cmdBloqueo = new MySqlCommand(
                                "SELECT id_proveedor, estado FROM ORDEN_COMPRA WHERE id_oc = @id FOR UPDATE", conn, trans))
                            {
                                cmdBloqueo.Parameters.AddWithValue("@id", dto.IdOc);
                                using (var reader = cmdBloqueo.ExecuteReader())
                                {
                                    if (!reader.Read())
                                    {
                                        trans.Rollback();
                                        return Content(HttpStatusCode.NotFound, new { error = $"La orden de compra #{dto.IdOc} no existe." });
                                    }

                                    idProveedor = Convert.ToInt32(reader["id_proveedor"]);
                                    estadoActual = reader["estado"].ToString();
                                }
                            }

                            if (estadoActual != "aprobada" && estadoActual != "recibida parcial")
                            {
                                trans.Rollback();
                                return Content(HttpStatusCode.Conflict, new
                                {
                                    error = $"La orden de compra #{dto.IdOc} no está disponible para recepción (estado actual: '{estadoActual}'). Solo se aceptan órdenes en estado 'aprobada' o 'recibida parcial'."
                                });
                            }

                            // 2. Verificar que no exista ya una recepción con el mismo tipo_doc y nro_doc para el mismo proveedor
                            const string checkDocSql = @"
                                SELECT COUNT(*)
                                FROM RECEPCION r
                                INNER JOIN ORDEN_COMPRA oc ON r.id_oc = oc.id_oc
                                WHERE oc.id_proveedor = @id_proveedor
                                  AND LOWER(r.tipo_doc) = @tipo_doc
                                  AND LOWER(TRIM(r.nro_doc)) = @nro_doc";

                            using (var checkDocCmd = new MySqlCommand(checkDocSql, conn, trans))
                            {
                                checkDocCmd.Parameters.AddWithValue("@id_proveedor", idProveedor);
                                checkDocCmd.Parameters.AddWithValue("@tipo_doc", tipoDoc);
                                checkDocCmd.Parameters.AddWithValue("@nro_doc", nroDoc.ToLowerInvariant());

                                if (Convert.ToInt32(checkDocCmd.ExecuteScalar()) > 0)
                                {
                                    trans.Rollback();
                                    return Content(HttpStatusCode.Conflict, new
                                    {
                                        error = $"Ya existe una recepción registrada con el documento '{tipoDoc} {nroDoc}' para este proveedor."
                                    });
                                }
                            }

                            // 3. Recalcular en el servidor cantidades pedidas y ya recibidas por línea
                            var lineasOC = new Dictionary<string, (int pedida, int recibida)>(StringComparer.OrdinalIgnoreCase);

                            const string queryLineasSql = @"
                                SELECT doc.isbn, doc.cantidad AS pedida,
                                       COALESCE((
                                           SELECT SUM(m.cantidad)
                                           FROM MOVIMIENTO_STOCK m
                                           INNER JOIN RECEPCION r ON m.id_recepcion = r.id_recepcion
                                           WHERE r.id_oc = doc.id_oc AND m.isbn = doc.isbn
                                             AND m.tipo_movimiento = 'entrada' AND m.motivo = 'compra'
                                       ), 0) AS recibida
                                FROM DETALLE_OC doc
                                WHERE doc.id_oc = @id";

                            using (var cmdLineas = new MySqlCommand(queryLineasSql, conn, trans))
                            {
                                cmdLineas.Parameters.AddWithValue("@id", dto.IdOc);
                                using (var reader = cmdLineas.ExecuteReader())
                                {
                                    while (reader.Read())
                                    {
                                        string isbn = reader["isbn"].ToString();
                                        int pedida = Convert.ToInt32(reader["pedida"]);
                                        int recibida = Convert.ToInt32(reader["recibida"]);
                                        lineasOC[isbn] = (pedida, recibida);
                                    }
                                }
                            }

                            // 4. Validar que cada ISBN pertenezca a la orden y no supere lo pendiente
                            foreach (var l in dto.Lineas)
                            {
                                string isbn = l.Isbn.Trim();

                                if (!lineasOC.TryGetValue(isbn, out var datosLinea))
                                {
                                    trans.Rollback();
                                    return Content(HttpStatusCode.BadRequest, new
                                    {
                                        error = $"El libro con ISBN '{isbn}' no pertenece a la orden de compra #{dto.IdOc}."
                                    });
                                }

                                int pendiente = Math.Max(0, datosLinea.pedida - datosLinea.recibida);
                                if (l.Cantidad > pendiente)
                                {
                                    trans.Rollback();
                                    return Content(HttpStatusCode.BadRequest, new
                                    {
                                        error = $"No se puede recibir una cantidad mayor a la pendiente para el ISBN '{isbn}'. Cantidad enviada: {l.Cantidad}, pendiente: {pendiente}."
                                    });
                                }
                            }

                            // 5. Insertar en RECEPCION
                            int nuevaRecepcionId;
                            DateTime ahora = DateTime.Now;

                            const string insertRecepcionSql = @"
                                INSERT INTO RECEPCION (id_oc, id_usuario, fecha, tipo_doc, nro_doc)
                                VALUES (@id_oc, @id_usuario, @fecha, @tipo_doc, @nro_doc);
                                SELECT LAST_INSERT_ID();";

                            using (var cmdRec = new MySqlCommand(insertRecepcionSql, conn, trans))
                            {
                                cmdRec.Parameters.AddWithValue("@id_oc", dto.IdOc);
                                cmdRec.Parameters.AddWithValue("@id_usuario", userId);
                                cmdRec.Parameters.AddWithValue("@fecha", ahora);
                                cmdRec.Parameters.AddWithValue("@tipo_doc", tipoDoc);
                                cmdRec.Parameters.AddWithValue("@nro_doc", nroDoc);

                                nuevaRecepcionId = Convert.ToInt32(cmdRec.ExecuteScalar());
                            }

                            // 6. Por cada línea con cantidad > 0: insertar en MOVIMIENTO_STOCK y sumar a LIBRO.stock_actual
                            const string insertMovSql = @"
                                INSERT INTO MOVIMIENTO_STOCK (isbn, id_usuario, id_recepcion, fecha, tipo_movimiento, motivo, cantidad)
                                VALUES (@isbn, @id_usuario, @id_recepcion, @fecha, 'entrada', 'compra', @cantidad);";

                            const string updateStockSql = @"
                                UPDATE LIBRO
                                SET stock_actual = stock_actual + @cantidad
                                WHERE isbn = @isbn;";

                            var cantidadesRecibidasEnEstaSesion = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

                            foreach (var l in dto.Lineas)
                            {
                                if (l.Cantidad <= 0) continue;

                                string isbn = l.Isbn.Trim();
                                cantidadesRecibidasEnEstaSesion[isbn] = l.Cantidad;

                                using (var cmdMov = new MySqlCommand(insertMovSql, conn, trans))
                                {
                                    cmdMov.Parameters.AddWithValue("@isbn", isbn);
                                    cmdMov.Parameters.AddWithValue("@id_usuario", userId);
                                    cmdMov.Parameters.AddWithValue("@id_recepcion", nuevaRecepcionId);
                                    cmdMov.Parameters.AddWithValue("@fecha", ahora);
                                    cmdMov.Parameters.AddWithValue("@cantidad", l.Cantidad);
                                    cmdMov.ExecuteNonQuery();
                                }

                                using (var cmdStock = new MySqlCommand(updateStockSql, conn, trans))
                                {
                                    cmdStock.Parameters.AddWithValue("@isbn", isbn);
                                    cmdStock.Parameters.AddWithValue("@cantidad", l.Cantidad);
                                    cmdStock.ExecuteNonQuery();
                                }
                            }

                            // 7. Comprobar si TODAS las líneas de la orden quedan completas
                            bool ordenCompleta = true;

                            foreach (var kvp in lineasOC)
                            {
                                string isbn = kvp.Key;
                                int pedida = kvp.Value.pedida;
                                int yaRecibidaAntes = kvp.Value.recibida;
                                int recibidaAhora = cantidadesRecibidasEnEstaSesion.ContainsKey(isbn)
                                    ? cantidadesRecibidasEnEstaSesion[isbn]
                                    : 0;

                                int totalAcumulado = yaRecibidaAntes + recibidaAhora;
                                if (totalAcumulado < pedida)
                                {
                                    ordenCompleta = false;
                                    break;
                                }
                            }

                            string nuevoEstadoOc = ordenCompleta ? "recibida" : "recibida parcial";

                            const string updateOcSql = @"
                                UPDATE ORDEN_COMPRA
                                SET estado = @nuevo_estado
                                WHERE id_oc = @id AND estado IN ('aprobada', 'recibida parcial');";

                            using (var cmdOc = new MySqlCommand(updateOcSql, conn, trans))
                            {
                                cmdOc.Parameters.AddWithValue("@nuevo_estado", nuevoEstadoOc);
                                cmdOc.Parameters.AddWithValue("@id", dto.IdOc);
                                cmdOc.ExecuteNonQuery();
                            }

                            SecurityPolicy.Log(conn, trans, userId, "compras", "Registrar recepción", "Recepción #" + nuevaRecepcionId);
                            trans.Commit();

                            return Content(HttpStatusCode.Created, new
                            {
                                success = true,
                                id_recepcion = nuevaRecepcionId,
                                idRecepcion = nuevaRecepcionId,
                                id_oc = dto.IdOc,
                                idOc = dto.IdOc,
                                completa = ordenCompleta,
                                estado_orden = nuevoEstadoOc,
                                estadoOrden = nuevoEstadoOc,
                                mensaje = ordenCompleta
                                    ? $"Recepción #{nuevaRecepcionId} registrada. La orden de compra #{dto.IdOc} ha sido completada en su totalidad."
                                    : $"Recepción parcial #{nuevaRecepcionId} registrada exitosamente para la orden #{dto.IdOc}."
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
                System.Diagnostics.Trace.TraceError("Error al registrar recepción de OC #{0}: {1}", dto.IdOc, ex);
                return Content(HttpStatusCode.ServiceUnavailable, new { error = "No se pudo registrar la recepción de mercancía." });
            }
        }

        [HttpGet]
        [Route("historial")]
        public IHttpActionResult GetHistorial(
            [FromUri] int? oc = null,
            [FromUri] int? proveedor = null)
        {
            HttpContext.Current.Response.Cache.SetNoStore();
            var historial = new List<RecepcionHistorialDto>();

            try
            {
                using (var conn = DbConnectionFactory.CreateConnection())
                {
                    SessionAccess.RequireModule(new HttpRequestWrapper(HttpContext.Current.Request), conn, "compras", SecurityPolicy.Read);

                    string sql = @"
                        SELECT r.id_recepcion, r.id_oc, p.razon_social AS proveedor_nombre,
                               r.tipo_doc, r.nro_doc, r.fecha, u.nombre AS usuario_nombre,
                               m.isbn, l.titulo, m.cantidad
                        FROM RECEPCION r
                        INNER JOIN ORDEN_COMPRA oc ON r.id_oc = oc.id_oc
                        INNER JOIN PROVEEDOR p ON oc.id_proveedor = p.id_proveedor
                        INNER JOIN USUARIO u ON r.id_usuario = u.id_usuario
                        INNER JOIN MOVIMIENTO_STOCK m ON m.id_recepcion = r.id_recepcion
                        INNER JOIN LIBRO l ON m.isbn = l.isbn
                        WHERE 1=1";

                    if (oc.HasValue && oc.Value > 0)
                        sql += " AND r.id_oc = @oc";

                    if (proveedor.HasValue && proveedor.Value > 0)
                        sql += " AND oc.id_proveedor = @proveedor";

                    sql += " ORDER BY r.id_recepcion DESC, l.titulo";

                    using (var cmd = new MySqlCommand(sql, conn))
                    {
                        if (oc.HasValue && oc.Value > 0)
                            cmd.Parameters.AddWithValue("@oc", oc.Value);

                        if (proveedor.HasValue && proveedor.Value > 0)
                            cmd.Parameters.AddWithValue("@proveedor", proveedor.Value);

                        using (var reader = cmd.ExecuteReader())
                        {
                            RecepcionHistorialDto recActual = null;

                            while (reader.Read())
                            {
                                int idRec = Convert.ToInt32(reader["id_recepcion"]);

                                if (recActual == null || recActual.IdRecepcion != idRec)
                                {
                                    recActual = new RecepcionHistorialDto
                                    {
                                        IdRecepcion = idRec,
                                        IdOc = Convert.ToInt32(reader["id_oc"]),
                                        ProveedorNombre = reader["proveedor_nombre"].ToString(),
                                        TipoDoc = reader["tipo_doc"].ToString(),
                                        NroDoc = reader["nro_doc"].ToString(),
                                        Fecha = Convert.ToDateTime(reader["fecha"]).ToString("yyyy-MM-dd HH:mm"),
                                        UsuarioNombre = reader["usuario_nombre"].ToString()
                                    };
                                    historial.Add(recActual);
                                }

                                recActual.Lineas.Add(new LineaRecepcionHistorialDto
                                {
                                    Isbn = reader["isbn"].ToString(),
                                    Titulo = reader["titulo"].ToString(),
                                    Cantidad = Convert.ToInt32(reader["cantidad"])
                                });
                            }
                        }
                    }
                }

                return Ok(historial);
            }
            catch (HttpException ex)
            {
                return Content((HttpStatusCode)ex.GetHttpCode(), new { error = ex.Message });
            }
            catch (Exception ex)
            {
                System.Diagnostics.Trace.TraceError("Error al listar historial de recepciones: {0}", ex);
                return Content(HttpStatusCode.ServiceUnavailable, new { error = "No se pudo consultar el historial de recepciones." });
            }
        }
    }
}
