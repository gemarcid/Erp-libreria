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
    [RoutePrefix("api/ordenes-compra")]
    public class OrdenesCompraController : ApiController
    {
        private const decimal TasaIva = 0.19m;

        [HttpGet]
        [Route("")]
        public IHttpActionResult GetAll(
            [FromUri] string estado = null,
            [FromUri] int? proveedor = null,
            [FromUri] int? numero = null)
        {
            HttpContext.Current.Response.Cache.SetNoStore();
            var ordenes = new List<OrdenCompraResumenDto>();

            try
            {
                using (var conn = DbConnectionFactory.CreateConnection())
                {
                    SessionAccess.RequireModule(new HttpRequestWrapper(HttpContext.Current.Request), conn, "compras", SecurityPolicy.Read);

                    string sql = @"
                        SELECT oc.id_oc, oc.id_proveedor, p.razon_social,
                               oc.id_usuario, u.nombre AS usuario_nombre,
                               oc.fecha, oc.fecha_entrega, oc.total, oc.estado,
                               oc.fecha_envio, oc.intentos_envio
                        FROM ORDEN_COMPRA oc
                        INNER JOIN PROVEEDOR p ON oc.id_proveedor = p.id_proveedor
                        INNER JOIN USUARIO u ON oc.id_usuario = u.id_usuario
                        WHERE 1=1";

                    if (!string.IsNullOrWhiteSpace(estado))
                        sql += " AND oc.estado = @estado";

                    if (proveedor.HasValue && proveedor.Value > 0)
                        sql += " AND oc.id_proveedor = @proveedor";

                    if (numero.HasValue && numero.Value > 0)
                        sql += " AND oc.id_oc = @numero";

                    sql += " ORDER BY oc.id_oc DESC";

                    using (var cmd = new MySqlCommand(sql, conn))
                    {
                        if (!string.IsNullOrWhiteSpace(estado))
                            cmd.Parameters.AddWithValue("@estado", estado.Trim().ToLowerInvariant());

                        if (proveedor.HasValue && proveedor.Value > 0)
                            cmd.Parameters.AddWithValue("@proveedor", proveedor.Value);

                        if (numero.HasValue && numero.Value > 0)
                            cmd.Parameters.AddWithValue("@numero", numero.Value);

                        using (var reader = cmd.ExecuteReader())
                        {
                            while (reader.Read())
                            {
                                ordenes.Add(new OrdenCompraResumenDto
                                {
                                    IdOc = Convert.ToInt32(reader["id_oc"]),
                                    IdProveedor = Convert.ToInt32(reader["id_proveedor"]),
                                    ProveedorNombre = reader["razon_social"].ToString(),
                                    IdUsuario = Convert.ToInt32(reader["id_usuario"]),
                                    UsuarioNombre = reader["usuario_nombre"].ToString(),
                                    Fecha = Convert.ToDateTime(reader["fecha"]).ToString("yyyy-MM-dd"),
                                    FechaEntrega = reader["fecha_entrega"] != DBNull.Value
                                        ? Convert.ToDateTime(reader["fecha_entrega"]).ToString("yyyy-MM-dd")
                                        : null,
                                    Total = Convert.ToDecimal(reader["total"]),
                                    Estado = reader["estado"].ToString(),
                                    FechaEnvio = reader["fecha_envio"] != DBNull.Value
                                        ? Convert.ToDateTime(reader["fecha_envio"]).ToString("yyyy-MM-dd HH:mm:ss")
                                        : null,
                                    IntentosEnvio = reader["intentos_envio"] != DBNull.Value
                                        ? Convert.ToInt32(reader["intentos_envio"])
                                        : 0
                                });
                            }
                        }
                    }
                }

                return Ok(ordenes);
            }
            catch (HttpException ex)
            {
                return Content((HttpStatusCode)ex.GetHttpCode(), new { error = ex.Message });
            }
            catch (Exception ex)
            {
                System.Diagnostics.Trace.TraceError("Error al listar órdenes de compra: {0}", ex);
                return Content(HttpStatusCode.ServiceUnavailable, new { error = "No se pudieron consultar las órdenes de compra." });
            }
        }

        [HttpGet]
        [Route("{id:int}")]
        public IHttpActionResult GetById(int id)
        {
            HttpContext.Current.Response.Cache.SetNoStore();

            try
            {
                using (var conn = DbConnectionFactory.CreateConnection())
                {
                    SessionAccess.RequireModule(new HttpRequestWrapper(HttpContext.Current.Request), conn, "compras", SecurityPolicy.Read);

                    const string sqlHeader = @"
                        SELECT oc.id_oc, oc.id_proveedor, p.razon_social, p.rut AS proveedor_rut,
                               COALESCE(p.correo, p.contacto) AS proveedor_correo,
                               oc.id_usuario, u.nombre AS usuario_nombre,
                               oc.fecha, oc.fecha_entrega, oc.total, oc.estado,
                               oc.fecha_envio, oc.intentos_envio
                        FROM ORDEN_COMPRA oc
                        INNER JOIN PROVEEDOR p ON oc.id_proveedor = p.id_proveedor
                        INNER JOIN USUARIO u ON oc.id_usuario = u.id_usuario
                        WHERE oc.id_oc = @id
                        LIMIT 1";

                    OrdenCompraCompletaDto orden = null;

                    using (var cmd = new MySqlCommand(sqlHeader, conn))
                    {
                        cmd.Parameters.AddWithValue("@id", id);
                        using (var reader = cmd.ExecuteReader())
                        {
                            if (!reader.Read())
                            {
                                return Content(HttpStatusCode.NotFound, new { error = "Orden de compra no encontrada." });
                            }

                            orden = new OrdenCompraCompletaDto
                            {
                                IdOc = Convert.ToInt32(reader["id_oc"]),
                                IdProveedor = Convert.ToInt32(reader["id_proveedor"]),
                                ProveedorNombre = reader["razon_social"].ToString(),
                                ProveedorRut = reader["proveedor_rut"].ToString(),
                                ProveedorCorreo = reader["proveedor_correo"] != DBNull.Value ? reader["proveedor_correo"].ToString() : null,
                                IdUsuario = Convert.ToInt32(reader["id_usuario"]),
                                UsuarioNombre = reader["usuario_nombre"].ToString(),
                                Fecha = Convert.ToDateTime(reader["fecha"]).ToString("yyyy-MM-dd"),
                                FechaEntrega = reader["fecha_entrega"] != DBNull.Value
                                    ? Convert.ToDateTime(reader["fecha_entrega"]).ToString("yyyy-MM-dd")
                                    : null,
                                Estado = reader["estado"].ToString(),
                                FechaEnvio = reader["fecha_envio"] != DBNull.Value
                                    ? Convert.ToDateTime(reader["fecha_envio"]).ToString("yyyy-MM-dd HH:mm:ss")
                                    : null,
                                IntentosEnvio = reader["intentos_envio"] != DBNull.Value
                                    ? Convert.ToInt32(reader["intentos_envio"])
                                    : 0
                            };
                        }
                    }

                    const string sqlLines = @"
                        SELECT doc.id_detalle_oc, doc.isbn, l.titulo, doc.cantidad, doc.precio_pactado, doc.iva_porcentaje
                        FROM DETALLE_OC doc
                        INNER JOIN LIBRO l ON doc.isbn = l.isbn
                        WHERE doc.id_oc = @id
                        ORDER BY doc.id_detalle_oc";

                    decimal neto = 0m;
                    decimal ivaAcumulado = 0m;

                    using (var cmd = new MySqlCommand(sqlLines, conn))
                    {
                        cmd.Parameters.AddWithValue("@id", id);
                        using (var reader = cmd.ExecuteReader())
                        {
                            while (reader.Read())
                            {
                                int cantidad = Convert.ToInt32(reader["cantidad"]);
                                decimal precioPactado = Convert.ToDecimal(reader["precio_pactado"]);
                                decimal ivaPorcentaje = reader["iva_porcentaje"] != DBNull.Value
                                    ? Convert.ToDecimal(reader["iva_porcentaje"])
                                    : 19m;
                                decimal subtotal = Math.Round(cantidad * precioPactado, 2, MidpointRounding.AwayFromZero);
                                decimal ivaLinea = subtotal * (ivaPorcentaje / 100m);
                                neto += subtotal;
                                ivaAcumulado += ivaLinea;

                                orden.Lineas.Add(new OrdenCompraDetalleItemDto
                                {
                                    IdDetalleOc = Convert.ToInt32(reader["id_detalle_oc"]),
                                    Isbn = reader["isbn"].ToString(),
                                    Titulo = reader["titulo"].ToString(),
                                    Cantidad = cantidad,
                                    PrecioPactado = precioPactado,
                                    IvaPorcentaje = ivaPorcentaje,
                                    Subtotal = subtotal
                                });
                            }
                        }
                    }

                    decimal iva = Math.Round(ivaAcumulado, 0, MidpointRounding.AwayFromZero);
                    decimal total = neto + iva;

                    orden.Neto = neto;
                    orden.Iva = iva;
                    orden.Total = total;

                    return Ok(orden);
                }
            }
            catch (HttpException ex)
            {
                return Content((HttpStatusCode)ex.GetHttpCode(), new { error = ex.Message });
            }
            catch (Exception ex)
            {
                System.Diagnostics.Trace.TraceError("Error al consultar orden de compra #{0}: {1}", id, ex);
                return Content(HttpStatusCode.ServiceUnavailable, new { error = "No se pudo consultar la orden de compra." });
            }
        }

        [HttpPost]
        [Route("")]
        public IHttpActionResult Create([FromBody] CrearOrdenCompraRequestDto dto)
        {
            HttpContext.Current.Response.Cache.SetNoStore();

            if (dto == null)
                return Content(HttpStatusCode.BadRequest, new { error = "Datos de la orden de compra no proporcionados." });

            var erroresValidacion = new List<string>();
            var camposConError = new Dictionary<string, string>();

            if (dto.IdProveedor <= 0)
            {
                erroresValidacion.Add("Debes seleccionar un proveedor válido.");
                camposConError["proveedor"] = "Selecciona un proveedor activo del catálogo.";
            }

            DateTime fechaServidor = DateTime.Today;
            DateTime fechaEntrega = DateTime.MinValue;

            if (!dto.FechaEntrega.HasValue)
            {
                erroresValidacion.Add("La fecha de entrega es obligatoria.");
                camposConError["fechaEntrega"] = "Ingresa la fecha de entrega.";
            }
            else
            {
                fechaEntrega = dto.FechaEntrega.Value.Date;
                if (fechaEntrega < fechaServidor)
                {
                    erroresValidacion.Add("La fecha de entrega no puede ser anterior a la fecha actual.");
                    camposConError["fechaEntrega"] = "La fecha de entrega no puede ser anterior a hoy.";
                }
            }

            if (dto.Lineas == null || dto.Lineas.Count == 0)
            {
                erroresValidacion.Add("La orden de compra debe contener al menos un producto.");
                camposConError["lineas"] = "Debes agregar al menos una línea de producto.";
            }

            var isbnsVistos = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            decimal sumaNeto = 0m;
            decimal sumaIvaExacto = 0m;

            if (dto.Lineas != null)
            {
                for (int i = 0; i < dto.Lineas.Count; i++)
                {
                    var linea = dto.Lineas[i];
                    int numLinea = i + 1;

                    if (linea == null || string.IsNullOrWhiteSpace(linea.Isbn))
                    {
                        erroresValidacion.Add($"Línea #{numLinea}: Debes seleccionar un producto del catálogo.");
                        camposConError[$"linea_{i}_isbn"] = "Selecciona un libro del catálogo.";
                        continue;
                    }

                    string isbnLimpio = linea.Isbn.Trim();

                    if (!isbnsVistos.Add(isbnLimpio))
                    {
                        erroresValidacion.Add($"Línea #{numLinea}: El libro con ISBN '{isbnLimpio}' está repetido en la orden. Agrupa la cantidad en una sola línea.");
                        camposConError[$"linea_{i}_isbn"] = "Producto repetido en la orden.";
                    }

                    if (linea.Cantidad <= 0)
                    {
                        erroresValidacion.Add($"Línea #{numLinea}: La cantidad para el libro '{isbnLimpio}' debe ser un entero mayor a 0.");
                        camposConError[$"linea_{i}_cantidad"] = "La cantidad debe ser un entero mayor a 0.";
                    }

                    if (linea.PrecioPactado <= 0)
                    {
                        erroresValidacion.Add($"Línea #{numLinea}: El precio pactado unitario para el libro '{isbnLimpio}' debe ser mayor a 0.");
                        camposConError[$"linea_{i}_precioPactado"] = "El precio pactado debe ser mayor a 0.";
                    }
                    else if (linea.PrecioPactado > 99999999.99m)
                    {
                        erroresValidacion.Add($"Línea #{numLinea}: El precio pactado para '{isbnLimpio}' excede el límite permitido.");
                        camposConError[$"linea_{i}_precioPactado"] = "Precio excede el máximo permitido.";
                    }

                    decimal ivaPorcentaje = linea.IvaPorcentaje ?? 19m;
                    if (ivaPorcentaje < 0m || ivaPorcentaje > 100m)
                    {
                        erroresValidacion.Add($"Línea #{numLinea}: El porcentaje de IVA para '{isbnLimpio}' debe estar entre 0% y 100%.");
                        camposConError[$"linea_{i}_ivaPorcentaje"] = "El IVA % debe estar entre 0 y 100.";
                    }

                    if (linea.Cantidad > 0 && linea.PrecioPactado > 0 && ivaPorcentaje >= 0m && ivaPorcentaje <= 100m)
                    {
                        decimal subtotal = Math.Round(linea.Cantidad * linea.PrecioPactado, 2, MidpointRounding.AwayFromZero);
                        sumaNeto += subtotal;
                        sumaIvaExacto += subtotal * (ivaPorcentaje / 100m);
                    }
                }
            }

            if (erroresValidacion.Count > 0)
            {
                return Content(HttpStatusCode.BadRequest, new
                {
                    error = string.Join(" ", erroresValidacion),
                    errores = erroresValidacion,
                    campos = camposConError
                });
            }

            decimal ivaCalculado = Math.Round(sumaIvaExacto, 0, MidpointRounding.AwayFromZero);
            decimal totalCalculado = sumaNeto + ivaCalculado;

            if (totalCalculado > 9999999999.99m)
                return Content(HttpStatusCode.BadRequest, new { error = "El total de la orden excede el límite permitido para DECIMAL(12,2)." });

            try
            {
                using (var conn = DbConnectionFactory.CreateConnection())
                {
                    int userId = SessionAccess.RequireModule(new HttpRequestWrapper(HttpContext.Current.Request), conn, "compras", SecurityPolicy.Edit);
                    if (userId <= 0 && dto.IdUsuario.HasValue && dto.IdUsuario.Value > 0)
                    {
                        userId = dto.IdUsuario.Value;
                    }

                    // 1. Validar existencia y estado activo del proveedor
                    using (var checkProv = new MySqlCommand("SELECT activo FROM PROVEEDOR WHERE id_proveedor = @id", conn))
                    {
                        checkProv.Parameters.AddWithValue("@id", dto.IdProveedor);
                        var provActivoObj = checkProv.ExecuteScalar();
                        if (provActivoObj == null || provActivoObj == DBNull.Value)
                        {
                            return Content(HttpStatusCode.BadRequest, new
                            {
                                error = "El proveedor seleccionado no existe en el catálogo.",
                                campos = new { proveedor = "El proveedor seleccionado no existe." }
                            });
                        }

                        if (!Convert.ToBoolean(provActivoObj))
                        {
                            return Content(HttpStatusCode.BadRequest, new
                            {
                                error = "El proveedor seleccionado se encuentra inactivo en el catálogo.",
                                campos = new { proveedor = "El proveedor seleccionado está inactivo." }
                            });
                        }
                    }

                    // 2. Validar que cada ISBN exista y esté activo
                    for (int i = 0; i < dto.Lineas.Count; i++)
                    {
                        var linea = dto.Lineas[i];
                        using (var checkLibro = new MySqlCommand("SELECT activo FROM LIBRO WHERE isbn = @isbn", conn))
                        {
                            checkLibro.Parameters.AddWithValue("@isbn", linea.Isbn.Trim());
                            var activoObj = checkLibro.ExecuteScalar();
                            if (activoObj == null || activoObj == DBNull.Value)
                            {
                                return Content(HttpStatusCode.BadRequest, new
                                {
                                    error = $"Línea #{i + 1}: El libro con ISBN '{linea.Isbn.Trim()}' no existe en el catálogo.",
                                    campos = new Dictionary<string, string> { [$"linea_{i}_isbn"] = "El libro no existe en el catálogo." }
                                });
                            }

                            if (!Convert.ToBoolean(activoObj))
                            {
                                return Content(HttpStatusCode.BadRequest, new
                                {
                                    error = $"Línea #{i + 1}: El libro con ISBN '{linea.Isbn.Trim()}' no se encuentra activo.",
                                    campos = new Dictionary<string, string> { [$"linea_{i}_isbn"] = "El libro se encuentra inactivo." }
                                });
                            }
                        }
                    }

                    // 3. Inserción atómica en ORDEN_COMPRA y DETALLE_OC
                    int nuevaOcId;

                    using (var trans = conn.BeginTransaction())
                    {
                        try
                        {
                            const string insertOcSql = @"
                                INSERT INTO ORDEN_COMPRA (id_proveedor, id_usuario, fecha, fecha_entrega, total, estado, fecha_envio, intentos_envio)
                                VALUES (@id_proveedor, @id_usuario, @fecha, @fecha_entrega, @total, 'pendiente', NULL, 0);
                                SELECT LAST_INSERT_ID();";

                            using (var cmdOc = new MySqlCommand(insertOcSql, conn, trans))
                            {
                                cmdOc.Parameters.AddWithValue("@id_proveedor", dto.IdProveedor);
                                cmdOc.Parameters.AddWithValue("@id_usuario", userId);
                                cmdOc.Parameters.AddWithValue("@fecha", fechaServidor);
                                cmdOc.Parameters.AddWithValue("@fecha_entrega", fechaEntrega);
                                cmdOc.Parameters.AddWithValue("@total", totalCalculado);

                                nuevaOcId = Convert.ToInt32(cmdOc.ExecuteScalar());
                            }

                            const string insertDetalleSql = @"
                                INSERT INTO DETALLE_OC (id_oc, isbn, cantidad, precio_pactado, iva_porcentaje)
                                VALUES (@id_oc, @isbn, @cantidad, @precio_pactado, @iva_porcentaje);";

                            foreach (var linea in dto.Lineas)
                            {
                                decimal ivaPorcentaje = linea.IvaPorcentaje ?? 19m;
                                using (var cmdDetalle = new MySqlCommand(insertDetalleSql, conn, trans))
                                {
                                    cmdDetalle.Parameters.AddWithValue("@id_oc", nuevaOcId);
                                    cmdDetalle.Parameters.AddWithValue("@isbn", linea.Isbn.Trim());
                                    cmdDetalle.Parameters.AddWithValue("@cantidad", linea.Cantidad);
                                    cmdDetalle.Parameters.AddWithValue("@precio_pactado", linea.PrecioPactado);
                                    cmdDetalle.Parameters.AddWithValue("@iva_porcentaje", ivaPorcentaje);
                                    cmdDetalle.ExecuteNonQuery();
                                }
                            }

                            SecurityPolicy.Log(conn, trans, userId, "compras", "Crear orden de compra", "Orden #" + nuevaOcId);
                            trans.Commit();
                        }
                        catch
                        {
                            trans.Rollback();
                            throw;
                        }
                    }

                    return Content(HttpStatusCode.Created, new
                    {
                        id_oc = nuevaOcId,
                        idOc = nuevaOcId,
                        id_proveedor = dto.IdProveedor,
                        idProveedor = dto.IdProveedor,
                        fecha = fechaServidor.ToString("yyyy-MM-dd"),
                        fecha_entrega = fechaEntrega.ToString("yyyy-MM-dd"),
                        fechaEntrega = fechaEntrega.ToString("yyyy-MM-dd"),
                        neto = sumaNeto,
                        iva = ivaCalculado,
                        total = totalCalculado,
                        estado = "pendiente",
                        fecha_envio = (string)null,
                        fechaEnvio = (string)null,
                        intentos_envio = 0,
                        intentosEnvio = 0,
                        mensaje = $"Orden de compra #{nuevaOcId} creada exitosamente en estado pendiente."
                    });
                }
            }
            catch (HttpException ex)
            {
                return Content((HttpStatusCode)ex.GetHttpCode(), new { error = ex.Message });
            }
            catch (Exception ex)
            {
                System.Diagnostics.Trace.TraceError("Error al registrar orden de compra: {0}", ex);
                return Content(HttpStatusCode.ServiceUnavailable, new { error = "No se pudo registrar la orden de compra." });
            }
        }

        [HttpPut]
        [HttpPost]
        [Route("{id:int}/aprobar")]
        public IHttpActionResult Aprobar(int id)
        {
            HttpContext.Current.Response.Cache.SetNoStore();

            try
            {
                using (var conn = DbConnectionFactory.CreateConnection())
                {
                    var actor = SessionAccess.RequireModule(new HttpRequestWrapper(HttpContext.Current.Request), conn, "compras", SecurityPolicy.Full);

                    const string updateSql = @"
                        UPDATE ORDEN_COMPRA
                        SET estado = 'aprobada'
                        WHERE id_oc = @id AND estado = 'pendiente'";

                    using (var transaction = conn.BeginTransaction())
                    using (var cmd = new MySqlCommand(updateSql, conn, transaction))
                    {
                        cmd.Parameters.AddWithValue("@id", id);
                        int rows = cmd.ExecuteNonQuery();

                        if (rows > 0)
                        {
                            SecurityPolicy.Log(conn, transaction, actor, "compras", "Aprobar orden de compra", "Orden #" + id);
                            transaction.Commit();
                            return Ok(new
                            {
                                success = true,
                                id_oc = id,
                                idOc = id,
                                estado = "aprobada",
                                mensaje = $"Orden de compra #{id} aprobada exitosamente."
                            });
                        }
                    }

                    // Si no hubo filas afectadas, determinar la causa exacta
                    using (var checkCmd = new MySqlCommand("SELECT estado FROM ORDEN_COMPRA WHERE id_oc = @id", conn))
                    {
                        checkCmd.Parameters.AddWithValue("@id", id);
                        var actual = checkCmd.ExecuteScalar();
                        if (actual == null || actual == DBNull.Value)
                        {
                            return Content(HttpStatusCode.NotFound, new { error = $"La orden de compra #{id} no existe." });
                        }

                        string estadoActual = actual.ToString();
                        return Content(HttpStatusCode.Conflict, new
                        {
                            error = $"La orden de compra #{id} no puede ser aprobada porque ya fue resuelta (estado actual: '{estadoActual}')."
                        });
                    }
                }
            }
            catch (HttpException ex)
            {
                return Content((HttpStatusCode)ex.GetHttpCode(), new { error = ex.Message });
            }
            catch (Exception ex)
            {
                System.Diagnostics.Trace.TraceError("Error al aprobar orden de compra #{0}: {1}", id, ex);
                return Content(HttpStatusCode.ServiceUnavailable, new { error = "No se pudo aprobar la orden de compra." });
            }
        }

        [HttpPut]
        [HttpPost]
        [Route("{id:int}/rechazar")]
        public IHttpActionResult Rechazar(int id)
        {
            HttpContext.Current.Response.Cache.SetNoStore();

            try
            {
                using (var conn = DbConnectionFactory.CreateConnection())
                {
                    var actor = SessionAccess.RequireModule(new HttpRequestWrapper(HttpContext.Current.Request), conn, "compras", SecurityPolicy.Full);

                    const string updateSql = @"
                        UPDATE ORDEN_COMPRA
                        SET estado = 'rechazada'
                        WHERE id_oc = @id AND estado = 'pendiente'";

                    using (var transaction = conn.BeginTransaction())
                    using (var cmd = new MySqlCommand(updateSql, conn, transaction))
                    {
                        cmd.Parameters.AddWithValue("@id", id);
                        int rows = cmd.ExecuteNonQuery();

                        if (rows > 0)
                        {
                            SecurityPolicy.Log(conn, transaction, actor, "compras", "Rechazar orden de compra", "Orden #" + id);
                            transaction.Commit();
                            return Ok(new
                            {
                                success = true,
                                id_oc = id,
                                idOc = id,
                                estado = "rechazada",
                                mensaje = $"Orden de compra #{id} rechazada."
                            });
                        }
                    }

                    using (var checkCmd = new MySqlCommand("SELECT estado FROM ORDEN_COMPRA WHERE id_oc = @id", conn))
                    {
                        checkCmd.Parameters.AddWithValue("@id", id);
                        var actual = checkCmd.ExecuteScalar();
                        if (actual == null || actual == DBNull.Value)
                        {
                            return Content(HttpStatusCode.NotFound, new { error = $"La orden de compra #{id} no existe." });
                        }

                        string estadoActual = actual.ToString();
                        return Content(HttpStatusCode.Conflict, new
                        {
                            error = $"La orden de compra #{id} no puede ser rechazada porque ya fue resuelta (estado actual: '{estadoActual}')."
                        });
                    }
                }
            }
            catch (HttpException ex)
            {
                return Content((HttpStatusCode)ex.GetHttpCode(), new { error = ex.Message });
            }
            catch (Exception ex)
            {
                System.Diagnostics.Trace.TraceError("Error al rechazar orden de compra #{0}: {1}", id, ex);
                return Content(HttpStatusCode.ServiceUnavailable, new { error = "No se pudo rechazar la orden de compra." });
            }
        }

        [HttpGet]
        [Route("libros")]
        public IHttpActionResult GetLibrosParaCompra([FromUri] string buscar = null)
        {
            HttpContext.Current.Response.Cache.SetNoStore();
            var libros = new List<LibroParaCompraDto>();

            try
            {
                using (var conn = DbConnectionFactory.CreateConnection())
                {
                    SessionAccess.RequireModule(new HttpRequestWrapper(HttpContext.Current.Request), conn, "compras", SecurityPolicy.Read);

                    string sql = @"
                        SELECT l.isbn, l.titulo, l.autor, l.categoria, l.costo_unitario,
                               l.stock_actual, l.activo, e.nombre AS editorial_nombre
                        FROM LIBRO l
                        LEFT JOIN EDITORIAL e ON l.id_editorial = e.id_editorial
                        WHERE l.activo = TRUE";

                    if (!string.IsNullOrWhiteSpace(buscar))
                    {
                        sql += " AND (l.isbn LIKE @buscar OR l.titulo LIKE @buscar OR l.autor LIKE @buscar)";
                    }

                    sql += " ORDER BY l.titulo, l.isbn";

                    using (var cmd = new MySqlCommand(sql, conn))
                    {
                        if (!string.IsNullOrWhiteSpace(buscar))
                        {
                            cmd.Parameters.AddWithValue("@buscar", "%" + buscar.Trim() + "%");
                        }

                        using (var reader = cmd.ExecuteReader())
                        {
                            while (reader.Read())
                            {
                                libros.Add(new LibroParaCompraDto
                                {
                                    Isbn = reader["isbn"].ToString(),
                                    Titulo = reader["titulo"].ToString(),
                                    Autor = reader["autor"] != DBNull.Value ? reader["autor"].ToString() : "",
                                    Categoria = reader["categoria"] != DBNull.Value ? reader["categoria"].ToString() : "",
                                    Editorial = reader["editorial_nombre"] != DBNull.Value ? reader["editorial_nombre"].ToString() : "",
                                    CostoUnitario = Convert.ToDecimal(reader["costo_unitario"]),
                                    StockActual = Convert.ToInt32(reader["stock_actual"]),
                                    Activo = Convert.ToBoolean(reader["activo"])
                                });
                            }
                        }
                    }
                }

                return Ok(libros);
            }
            catch (HttpException ex)
            {
                return Content((HttpStatusCode)ex.GetHttpCode(), new { error = ex.Message });
            }
            catch (Exception ex)
            {
                System.Diagnostics.Trace.TraceError("Error al consultar libros para orden de compra: {0}", ex);
                return Content(HttpStatusCode.ServiceUnavailable, new { error = "No se pudo consultar el catálogo para compras." });
            }
        }
    }
}
