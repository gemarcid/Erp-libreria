using System;
using System.Collections.Generic;
using System.Configuration;
using System.Data;
using System.Web;
using System.Web.Mvc;
using backend.Data;
using backend.Models;
using MySql.Data.MySqlClient;

namespace backend.Controllers
{
    public class VentasController : Controller
    {
        // ============================================================
        // GET: /Ventas/Libros?buscar=...
        // Buscar libros disponibles para el POS / Ventas
        // ============================================================
        [HttpGet]
        public JsonResult Libros(string buscar = "")
        {
            try
            {
                var libros = new List<object>();

                using (var conexion = CrearConexion())
                using (var comando = new MySqlCommand(
                    @"SELECT l.isbn,
                             l.titulo,
                             l.autor,
                             l.categoria,
                             l.estante,
                             l.precio_venta,
                             l.costo_unitario,
                             l.stock_actual,
                             l.stock_minimo,
                             e.nombre AS editorial
                      FROM LIBRO l
                      LEFT JOIN EDITORIAL e ON e.id_editorial = l.id_editorial
                      WHERE l.activo = TRUE
                        AND (
                            l.isbn LIKE @buscar
                            OR l.titulo LIKE @buscar
                            OR l.autor LIKE @buscar
                            OR l.categoria LIKE @buscar
                        )
                      ORDER BY l.titulo
                      LIMIT 40", conexion))
                {
                    comando.Parameters.AddWithValue(
                        "@buscar",
                        "%" + (buscar ?? "").Trim() + "%"
                    );

                    conexion.Open();
                    SessionAccess.RequireModule(Request, conexion, "ventas", SecurityPolicy.Read);

                    using (var lector = comando.ExecuteReader())
                    {
                        while (lector.Read())
                        {
                            libros.Add(new
                            {
                                isbn = lector["isbn"].ToString(),
                                titulo = lector["titulo"].ToString(),
                                autor = lector["autor"].ToString(),
                                categoria = lector["categoria"].ToString(),
                                estante = lector["estante"] == DBNull.Value ? "" : lector["estante"].ToString(),
                                editorial = lector["editorial"] == DBNull.Value ? "" : lector["editorial"].ToString(),
                                precio_venta = Convert.ToDecimal(lector["precio_venta"]),
                                costo_unitario = Convert.ToDecimal(lector["costo_unitario"]),
                                stock_actual = Convert.ToInt32(lector["stock_actual"]),
                                stock_minimo = Convert.ToInt32(lector["stock_minimo"])
                            });
                        }
                    }
                }

                return Json(new
                {
                    success = true,
                    libros
                }, JsonRequestBehavior.AllowGet);
            }
            catch (HttpException ex) { return AccessError(ex); }
            catch (Exception ex)
            {
                System.Diagnostics.Trace.TraceError("Error al buscar libros: {0}", ex);
                return ErrorInterno("No se pudieron consultar los libros.");
            }
        }

        // ============================================================
        // GET: /Ventas/Clientes?buscar=...
        // Buscar clientes para asociarlos a la venta
        // ============================================================
        [HttpGet]
        public JsonResult Clientes(string buscar = "")
        {
            try
            {
                var clientes = new List<object>();

                using (var conexion = CrearConexion())
                using (var comando = new MySqlCommand(
                    @"SELECT id_cliente,
                             rut,
                             nombre,
                             tipo_cliente,
                             puntos_fidelidad
                      FROM CLIENTE
                      WHERE rut LIKE @buscar
                         OR nombre LIKE @buscar
                      ORDER BY nombre
                      LIMIT 30", conexion))
                {
                    comando.Parameters.AddWithValue(
                        "@buscar",
                        "%" + (buscar ?? "").Trim() + "%"
                    );

                    conexion.Open();
                    SessionAccess.RequireModule(Request, conexion, "ventas", SecurityPolicy.Read);

                    using (var lector = comando.ExecuteReader())
                    {
                        while (lector.Read())
                        {
                            clientes.Add(new
                            {
                                id_cliente = Convert.ToInt32(lector["id_cliente"]),
                                rut = lector["rut"].ToString(),
                                nombre = lector["nombre"].ToString(),
                                tipo_cliente = lector["tipo_cliente"].ToString(),
                                puntos_fidelidad = Convert.ToInt32(lector["puntos_fidelidad"])
                            });
                        }
                    }
                }

                return Json(new
                {
                    success = true,
                    clientes
                }, JsonRequestBehavior.AllowGet);
            }
            catch (HttpException ex) { return AccessError(ex); }
            catch (Exception ex)
            {
                System.Diagnostics.Trace.TraceError("Error al buscar clientes: {0}", ex);
                return ErrorInterno("No se pudieron consultar los clientes.");
            }
        }

        // ============================================================
        // PANTALLA 1: GESTIÓN DE CLIENTES
        // GET: /Ventas/ListarClientes?buscar=...&tipo=...
        // ============================================================
        [HttpGet]
        public JsonResult ListarClientes(string buscar = "", string tipo = "")
        {
            try
            {
                var lista = new List<object>();

                using (var conexion = CrearConexion())
                {
                    conexion.Open();
                    SessionAccess.RequireModule(Request, conexion, "ventas", SecurityPolicy.Read);

                    string sql = @"
                        SELECT id_cliente, rut, nombre,
                               COALESCE(correo, '') AS correo,
                               COALESCE(telefono, '') AS telefono,
                               COALESCE(direccion, '') AS direccion,
                               tipo_cliente,
                               puntos_fidelidad,
                               COALESCE(limite_credito, 500000) AS limite_credito,
                               COALESCE(credito_utilizado, 0) AS credito_utilizado
                        FROM CLIENTE
                        WHERE (rut LIKE @buscar OR nombre LIKE @buscar OR COALESCE(correo, '') LIKE @buscar)";

                    if (!string.IsNullOrWhiteSpace(tipo) && tipo != "todos")
                    {
                        sql += " AND tipo_cliente = @tipo";
                    }

                    sql += " ORDER BY nombre LIMIT 100";

                    using (var comando = new MySqlCommand(sql, conexion))
                    {
                        comando.Parameters.AddWithValue("@buscar", "%" + (buscar ?? "").Trim() + "%");
                        if (!string.IsNullOrWhiteSpace(tipo) && tipo != "todos")
                        {
                            comando.Parameters.AddWithValue("@tipo", tipo.Trim().ToLowerInvariant());
                        }

                        using (var lector = comando.ExecuteReader())
                        {
                            while (lector.Read())
                            {
                                decimal limite = Convert.ToDecimal(lector["limite_credito"]);
                                decimal utilizado = Convert.ToDecimal(lector["credito_utilizado"]);
                                decimal disponible = Math.Max(0m, limite - utilizado);

                                lista.Add(new
                                {
                                    id_cliente = Convert.ToInt32(lector["id_cliente"]),
                                    rut = lector["rut"].ToString(),
                                    nombre = lector["nombre"].ToString(),
                                    correo = lector["correo"].ToString(),
                                    telefono = lector["telefono"].ToString(),
                                    direccion = lector["direccion"].ToString(),
                                    tipo_cliente = lector["tipo_cliente"].ToString(),
                                    puntos_fidelidad = Convert.ToInt32(lector["puntos_fidelidad"]),
                                    limite_credito = limite,
                                    credito_utilizado = utilizado,
                                    credito_disponible = disponible
                                });
                            }
                        }
                    }
                }

                return Json(new { success = true, clientes = lista }, JsonRequestBehavior.AllowGet);
            }
            catch (HttpException ex) { return AccessError(ex); }
            catch (Exception ex)
            {
                System.Diagnostics.Trace.TraceError("Error al listar clientes: {0}", ex);
                return ErrorInterno("No se pudo obtener la lista de clientes.");
            }
        }

        // ============================================================
        // POST: /Ventas/GuardarCliente
        // ============================================================
        [HttpPost]
        public JsonResult GuardarCliente(ClienteDto datos)
        {
            if (datos == null || string.IsNullOrWhiteSpace(datos.rut) || string.IsNullOrWhiteSpace(datos.nombre))
            {
                Response.StatusCode = 400;
                return Json(new { success = false, error = "El RUT y el nombre del cliente son obligatorios." });
            }

            try
            {
                using (var conexion = CrearConexion())
                {
                    conexion.Open();
                    int idUsuario = SessionAccess.RequireModule(Request, conexion, "ventas", SecurityPolicy.Edit);

                    string rutLimpio = datos.rut.Trim().ToUpperInvariant();
                    string tipo = string.IsNullOrWhiteSpace(datos.tipo_cliente) ? "persona" : datos.tipo_cliente.Trim().ToLowerInvariant();
                    decimal limite = datos.limite_credito.GetValueOrDefault(500000m);

                    if (datos.id_cliente <= 0)
                    {
                        // Validar duplicidad
                        using (var check = new MySqlCommand("SELECT COUNT(*) FROM CLIENTE WHERE rut = @rut", conexion))
                        {
                            check.Parameters.AddWithValue("@rut", rutLimpio);
                            if (Convert.ToInt32(check.ExecuteScalar()) > 0)
                            {
                                Response.StatusCode = 400;
                                return Json(new { success = false, error = "Ya existe un cliente registrado con ese RUT." });
                            }
                        }

                        using (var cmd = new MySqlCommand(
                            @"INSERT INTO CLIENTE (rut, nombre, correo, telefono, direccion, tipo_cliente, puntos_fidelidad, limite_credito, credito_utilizado)
                              VALUES (@rut, @nombre, @correo, @telefono, @direccion, @tipo, 0, @limite, 0);
                              SELECT LAST_INSERT_ID();", conexion))
                        {
                            cmd.Parameters.AddWithValue("@rut", rutLimpio);
                            cmd.Parameters.AddWithValue("@nombre", datos.nombre.Trim());
                            cmd.Parameters.AddWithValue("@correo", (datos.correo ?? "").Trim());
                            cmd.Parameters.AddWithValue("@telefono", (datos.telefono ?? "").Trim());
                            cmd.Parameters.AddWithValue("@direccion", (datos.direccion ?? "").Trim());
                            cmd.Parameters.AddWithValue("@tipo", tipo);
                            cmd.Parameters.AddWithValue("@limite", limite);

                            int idNuevo = Convert.ToInt32(cmd.ExecuteScalar());
                            SecurityPolicy.Log(conexion, null, idUsuario, "ventas", "Crear cliente", "Cliente #" + idNuevo + " " + datos.nombre);

                            return Json(new { success = true, mensaje = "Cliente registrado con éxito.", id_cliente = idNuevo });
                        }
                    }
                    else
                    {
                        // Editar cliente
                        using (var cmd = new MySqlCommand(
                            @"UPDATE CLIENTE
                              SET nombre = @nombre,
                                  correo = @correo,
                                  telefono = @telefono,
                                  direccion = @direccion,
                                  tipo_cliente = @tipo,
                                  limite_credito = @limite
                              WHERE id_cliente = @id", conexion))
                        {
                            cmd.Parameters.AddWithValue("@id", datos.id_cliente);
                            cmd.Parameters.AddWithValue("@nombre", datos.nombre.Trim());
                            cmd.Parameters.AddWithValue("@correo", (datos.correo ?? "").Trim());
                            cmd.Parameters.AddWithValue("@telefono", (datos.telefono ?? "").Trim());
                            cmd.Parameters.AddWithValue("@direccion", (datos.direccion ?? "").Trim());
                            cmd.Parameters.AddWithValue("@tipo", tipo);
                            cmd.Parameters.AddWithValue("@limite", limite);

                            cmd.ExecuteNonQuery();
                            SecurityPolicy.Log(conexion, null, idUsuario, "ventas", "Actualizar cliente", "Cliente #" + datos.id_cliente);

                            return Json(new { success = true, mensaje = "Cliente actualizado correctamente." });
                        }
                    }
                }
            }
            catch (HttpException ex) { return AccessError(ex); }
            catch (Exception ex)
            {
                System.Diagnostics.Trace.TraceError("Error al guardar cliente: {0}", ex);
                return ErrorInterno("No se pudo guardar la información del cliente.");
            }
        }

        // ============================================================
        // PANTALLA 2: PUNTO DE VENTA Y REGISTRO DE VENTA
        // GET: /Ventas/PromocionesActivas
        // ============================================================
        [HttpGet]
        public JsonResult PromocionesActivas()
        {
            try
            {
                var lista = new List<object>();
                using (var conexion = CrearConexion())
                {
                    conexion.Open();
                    SessionAccess.RequireModule(Request, conexion, "ventas", SecurityPolicy.Read);

                    // Verificar si existe la tabla PROMOCION
                    using (var check = new MySqlCommand(
                        @"SELECT COUNT(*) FROM information_schema.tables
                          WHERE table_schema = DATABASE() AND table_name = 'PROMOCION'", conexion))
                    {
                        if (Convert.ToInt32(check.ExecuteScalar()) == 0)
                        {
                            return Json(new { success = true, promociones = lista }, JsonRequestBehavior.AllowGet);
                        }
                    }

                    using (var cmd = new MySqlCommand(
                        @"SELECT id_promocion, nombre, descripcion, tipo, valor, categoria, isbn, fecha_inicio, fecha_fin
                          FROM PROMOCION
                          WHERE activo = TRUE
                            AND CURRENT_DATE() BETWEEN fecha_inicio AND fecha_fin
                          ORDER BY id_promocion DESC", conexion))
                    using (var lector = cmd.ExecuteReader())
                    {
                        while (lector.Read())
                        {
                            lista.Add(new
                            {
                                id_promocion = Convert.ToInt32(lector["id_promocion"]),
                                nombre = lector["nombre"].ToString(),
                                descripcion = lector["descripcion"] == DBNull.Value ? "" : lector["descripcion"].ToString(),
                                tipo = lector["tipo"].ToString(),
                                valor = Convert.ToDecimal(lector["valor"]),
                                categoria = lector["categoria"] == DBNull.Value ? "" : lector["categoria"].ToString(),
                                isbn = lector["isbn"] == DBNull.Value ? "" : lector["isbn"].ToString(),
                                fecha_inicio = Convert.ToDateTime(lector["fecha_inicio"]).ToString("yyyy-MM-dd"),
                                fecha_fin = Convert.ToDateTime(lector["fecha_fin"]).ToString("yyyy-MM-dd")
                            });
                        }
                    }
                }
                return Json(new { success = true, promociones = lista }, JsonRequestBehavior.AllowGet);
            }
            catch (HttpException ex) { return AccessError(ex); }
            catch (Exception ex)
            {
                System.Diagnostics.Trace.TraceError("Error promociones activas: {0}", ex);
                return Json(new { success = true, promociones = new List<object>() }, JsonRequestBehavior.AllowGet);
            }
        }

        // ============================================================
        // POST: /Ventas/Registrar
        // Registrar una nueva venta completa
        // ============================================================
        [HttpPost]
        public JsonResult Registrar(VentaRequest venta)
        {
            if (venta == null)
            {
                Response.StatusCode = 400;
                return Json(new { success = false, error = "No se recibieron los datos de la venta." });
            }

            if (venta.id_cliente <= 0)
            {
                Response.StatusCode = 400;
                return Json(new { success = false, error = "Debes seleccionar un cliente." });
            }

            if (venta.detalles == null || venta.detalles.Count == 0)
            {
                Response.StatusCode = 400;
                return Json(new { success = false, error = "La venta debe contener al menos un producto." });
            }

            var formaPago = string.IsNullOrWhiteSpace(venta.forma_pago)
                ? "efectivo" : venta.forma_pago.Trim().ToLowerInvariant();
            if (formaPago != "efectivo" && formaPago != "tarjeta" && formaPago != "transferencia" && formaPago != "puntos")
            {
                Response.StatusCode = 400;
                return Json(new { success = false, error = "La forma de pago no es válida." });
            }

            var canal = string.IsNullOrWhiteSpace(venta.canal)
                ? "tienda fisica" : venta.canal.Trim().ToLowerInvariant();
            if (canal != "tienda fisica" && canal != "tienda digital" && canal != "retiro en tienda")
            {
                canal = "tienda fisica";
            }

            var tipoDoc = string.IsNullOrWhiteSpace(venta.tipo_documento)
                ? "boleta" : venta.tipo_documento.Trim().ToLowerInvariant();

            try
            {
                using (var conexion = CrearConexion())
                {
                    conexion.Open();
                    venta.id_usuario = SessionAccess.RequireModule(Request, conexion, "ventas", SecurityPolicy.Edit);

                    using (var transaccion = conexion.BeginTransaction())
                    {
                        try
                        {
                            // 1. Validar Cliente
                            int puntosActuales = 0;
                            using (var comandoCliente = new MySqlCommand(
                                @"SELECT puntos_fidelidad, tipo_cliente
                                  FROM CLIENTE
                                  WHERE id_cliente = @id_cliente FOR UPDATE", conexion, transaccion))
                            {
                                comandoCliente.Parameters.AddWithValue("@id_cliente", venta.id_cliente);
                                using (var reader = comandoCliente.ExecuteReader())
                                {
                                    if (!reader.Read())
                                    {
                                        transaccion.Rollback();
                                        Response.StatusCode = 400;
                                        return Json(new { success = false, error = "El cliente seleccionado no existe." });
                                    }
                                    puntosActuales = Convert.ToInt32(reader["puntos_fidelidad"]);
                                }
                            }

                            // 2. Validar Usuario
                            using (var comandoUsuario = new MySqlCommand(
                                @"SELECT COUNT(*) FROM USUARIO WHERE id_usuario = @id_usuario AND estado = 'activo'",
                                conexion, transaccion))
                            {
                                comandoUsuario.Parameters.AddWithValue("@id_usuario", venta.id_usuario);
                                if (Convert.ToInt32(comandoUsuario.ExecuteScalar()) == 0)
                                {
                                    transaccion.Rollback();
                                    Response.StatusCode = 400;
                                    return Json(new { success = false, error = "El usuario no existe o está inactivo." });
                                }
                            }

                            decimal neto = 0m;
                            decimal costo = 0m;
                            var detallesVenta = new List<DetalleCalculado>();

                            // 3. Validar y descontar stock
                            foreach (var detalle in venta.detalles)
                            {
                                if (detalle == null || string.IsNullOrWhiteSpace(detalle.isbn) || detalle.cantidad <= 0)
                                {
                                    transaccion.Rollback();
                                    Response.StatusCode = 400;
                                    return Json(new { success = false, error = "Uno de los productos de la venta no es válido." });
                                }

                                using (var comandoLibro = new MySqlCommand(
                                    @"SELECT titulo, precio_venta, costo_unitario, stock_actual
                                      FROM LIBRO
                                      WHERE isbn = @isbn AND activo = TRUE
                                      FOR UPDATE", conexion, transaccion))
                                {
                                    comandoLibro.Parameters.AddWithValue("@isbn", detalle.isbn.Trim());

                                    using (var lector = comandoLibro.ExecuteReader())
                                    {
                                        if (!lector.Read())
                                        {
                                            transaccion.Rollback();
                                            Response.StatusCode = 400;
                                            return Json(new { success = false, error = "El libro " + detalle.isbn + " no existe o está inactivo." });
                                        }

                                        string titulo = lector["titulo"].ToString();
                                        decimal precio = Convert.ToDecimal(lector["precio_venta"]);
                                        int stock = Convert.ToInt32(lector["stock_actual"]);

                                        if (stock < detalle.cantidad)
                                        {
                                            transaccion.Rollback();
                                            Response.StatusCode = 400;
                                            return Json(new
                                            {
                                                success = false,
                                                error = "Stock insuficiente para el libro: " + titulo + ". Stock disponible: " + stock
                                            });
                                        }

                                        decimal subtotal = precio * detalle.cantidad;
                                        neto += subtotal;
                                        costo += Convert.ToDecimal(lector["costo_unitario"]) * detalle.cantidad;

                                        detallesVenta.Add(new DetalleCalculado
                                        {
                                            isbn = detalle.isbn.Trim(),
                                            cantidad = detalle.cantidad,
                                            precio_unitario = precio
                                        });
                                    }
                                }
                            }

                            // 4. Totales, Descuento y Canje de Puntos
                            decimal descuentoAplicado = venta.descuento.HasValue && venta.descuento.Value >= 0
                                ? venta.descuento.Value : 0m;

                            int puntosCanjeados = venta.puntos_canjeados.GetValueOrDefault(0);
                            if (puntosCanjeados > 0)
                            {
                                if (puntosCanjeados > puntosActuales)
                                {
                                    transaccion.Rollback();
                                    Response.StatusCode = 400;
                                    return Json(new { success = false, error = "El cliente no tiene suficientes puntos para canjear." });
                                }
                                decimal descuentoPuntos = puntosCanjeados * 10m; // 1 punto = $10
                                descuentoAplicado += descuentoPuntos;
                            }

                            decimal iva = Math.Round(neto * 0.19m, 2);
                            decimal totalBruto = neto + iva;
                            decimal total = Math.Max(0m, totalBruto - descuentoAplicado);

                            // 5. Folio
                            string folio = venta.folio;
                            if (string.IsNullOrWhiteSpace(folio))
                            {
                                string prefijo = tipoDoc == "factura" ? "F-" : "B-";
                                folio = prefijo + DateTime.Now.ToString("yyyyMMdd") + "-" + (new Random()).Next(1000, 9999);
                            }

                            string estadoVenta = "pagado";
                            DateTime? fechaVencimiento = null;
                            if (tipoDoc == "factura" && formaPago == "transferencia" && !string.IsNullOrWhiteSpace(venta.fecha_vencimiento))
                            {
                                DateTime parsedFecha;
                                if (DateTime.TryParse(venta.fecha_vencimiento, out parsedFecha))
                                {
                                    fechaVencimiento = parsedFecha;
                                    estadoVenta = "pendiente"; // crédito institucional
                                }
                            }

                            // 6. Insertar VENTA
                            int idVenta;
                            using (var comandoVenta = new MySqlCommand(
                                @"INSERT INTO VENTA
                                  (id_cliente, id_usuario, id_pedido, fecha, canal, forma_pago, tipo_documento, folio, fecha_vencimiento, neto, iva, descuento, total, estado)
                                  VALUES
                                  (@id_cliente, @id_usuario, @id_pedido, NOW(), @canal, @forma_pago, @tipo_documento, @folio, @fecha_vencimiento, @neto, @iva, @descuento, @total, @estado);
                                  SELECT LAST_INSERT_ID();", conexion, transaccion))
                            {
                                comandoVenta.Parameters.AddWithValue("@id_cliente", venta.id_cliente);
                                comandoVenta.Parameters.AddWithValue("@id_usuario", venta.id_usuario);
                                comandoVenta.Parameters.AddWithValue("@id_pedido", (object)venta.id_pedido ?? DBNull.Value);
                                comandoVenta.Parameters.AddWithValue("@canal", canal);
                                comandoVenta.Parameters.AddWithValue("@forma_pago", formaPago);
                                comandoVenta.Parameters.AddWithValue("@tipo_documento", tipoDoc);
                                comandoVenta.Parameters.AddWithValue("@folio", folio);
                                comandoVenta.Parameters.AddWithValue("@fecha_vencimiento", (object)fechaVencimiento ?? DBNull.Value);
                                comandoVenta.Parameters.AddWithValue("@neto", neto);
                                comandoVenta.Parameters.AddWithValue("@iva", iva);
                                comandoVenta.Parameters.AddWithValue("@descuento", descuentoAplicado);
                                comandoVenta.Parameters.AddWithValue("@total", total);
                                comandoVenta.Parameters.AddWithValue("@estado", estadoVenta);

                                idVenta = Convert.ToInt32(comandoVenta.ExecuteScalar());
                            }

                            // 7. Insertar DETALLE_VENTA, descontar stock y registrar movimiento
                            foreach (var detalle in detallesVenta)
                            {
                                using (var comandoDetalle = new MySqlCommand(
                                    @"INSERT INTO DETALLE_VENTA (id_venta, isbn, cantidad, precio_unitario)
                                      VALUES (@id_venta, @isbn, @cantidad, @precio_unitario)",
                                    conexion, transaccion))
                                {
                                    comandoDetalle.Parameters.AddWithValue("@id_venta", idVenta);
                                    comandoDetalle.Parameters.AddWithValue("@isbn", detalle.isbn);
                                    comandoDetalle.Parameters.AddWithValue("@cantidad", detalle.cantidad);
                                    comandoDetalle.Parameters.AddWithValue("@precio_unitario", detalle.precio_unitario);
                                    comandoDetalle.ExecuteNonQuery();
                                }

                                using (var comandoStock = new MySqlCommand(
                                    @"UPDATE LIBRO
                                      SET stock_actual = stock_actual - @cantidad
                                      WHERE isbn = @isbn AND stock_actual >= @cantidad",
                                    conexion, transaccion))
                                {
                                    comandoStock.Parameters.AddWithValue("@cantidad", detalle.cantidad);
                                    comandoStock.Parameters.AddWithValue("@isbn", detalle.isbn);
                                    if (comandoStock.ExecuteNonQuery() != 1)
                                    {
                                        throw new Exception("No se pudo actualizar el stock del libro " + detalle.isbn);
                                    }
                                }

                                using (var comandoMov = new MySqlCommand(
                                    @"INSERT INTO MOVIMIENTO_STOCK (isbn, id_usuario, id_venta, fecha, tipo_movimiento, motivo, cantidad)
                                      VALUES (@isbn, @id_usuario, @id_venta, NOW(), 'salida', 'Venta', @cantidad)",
                                    conexion, transaccion))
                                {
                                    comandoMov.Parameters.AddWithValue("@isbn", detalle.isbn);
                                    comandoMov.Parameters.AddWithValue("@id_usuario", venta.id_usuario);
                                    comandoMov.Parameters.AddWithValue("@id_venta", idVenta);
                                    comandoMov.Parameters.AddWithValue("@cantidad", detalle.cantidad);
                                    comandoMov.ExecuteNonQuery();
                                }
                            }

                            // 8. Actualizar Puntos de Fidelidad
                            int puntosGanados = (estadoVenta == "pagado" && total > 0) ? (int)(total / 1000m) : 0;
                            int cambioPuntos = puntosGanados - puntosCanjeados;
                            if (cambioPuntos != 0)
                            {
                                using (var cmdPuntos = new MySqlCommand(
                                    @"UPDATE CLIENTE
                                      SET puntos_fidelidad = GREATEST(0, puntos_fidelidad + @cambio)
                                      WHERE id_cliente = @id_cliente", conexion, transaccion))
                                {
                                    cmdPuntos.Parameters.AddWithValue("@cambio", cambioPuntos);
                                    cmdPuntos.Parameters.AddWithValue("@id_cliente", venta.id_cliente);
                                    cmdPuntos.ExecuteNonQuery();
                                }
                            }

                            // 9. Si era pedido institucional, marcar como facturado
                            if (venta.id_pedido.HasValue && venta.id_pedido.Value > 0)
                            {
                                using (var cmdPed = new MySqlCommand(
                                    @"UPDATE PEDIDO_VENTA SET estado = 'facturado' WHERE id_pedido = @id_pedido",
                                    conexion, transaccion))
                                {
                                    cmdPed.Parameters.AddWithValue("@id_pedido", venta.id_pedido.Value);
                                    cmdPed.ExecuteNonQuery();
                                }
                            }

                            // 10. Asiento contable
                            int idAsiento = VentaAccounting.Register(conexion, transaccion,
                                idVenta, venta.id_usuario, formaPago, neto, iva, total, costo);

                            SecurityPolicy.Log(conexion, transaccion, venta.id_usuario, "ventas", "Registrar venta", "Venta #" + idVenta + " Folio: " + folio);
                            SecurityPolicy.Log(conexion, transaccion, venta.id_usuario, "contabilidad", "Generar asiento automático",
                                "Asiento #" + idAsiento + " · Venta #" + idVenta);

                            transaccion.Commit();

                            return Json(new
                            {
                                success = true,
                                mensaje = "Venta registrada exitosamente con comprobante " + folio + ".",
                                id_venta = idVenta,
                                folio = folio,
                                id_asiento = idAsiento,
                                neto = neto,
                                iva = iva,
                                descuento = descuentoAplicado,
                                total = total,
                                puntos_ganados = puntosGanados,
                                puntos_canjeados = puntosCanjeados
                            });
                        }
                        catch
                        {
                            transaccion.Rollback();
                            throw;
                        }
                    }
                }
            }
            catch (HttpException ex) { return AccessError(ex); }
            catch (Exception ex)
            {
                System.Diagnostics.Trace.TraceError("Error al registrar venta: {0}", ex);
                return ErrorInterno("No se pudo registrar la venta: " + ex.Message);
            }
        }

        // ============================================================
        // PANTALLA 3: HISTORIAL Y MONITOR DE VENTAS
        // GET: /Ventas/Historial?desde=...&hasta=...&estado=...&tipo_documento=...&canal=...&buscar=...
        // ============================================================
        [HttpGet]
        public JsonResult Historial(string desde = null, string hasta = null, string estado = null, string tipo_documento = null, string canal = null, string buscar = null)
        {
            try
            {
                var ventas = new List<object>();

                using (var conexion = CrearConexion())
                {
                    conexion.Open();
                    SessionAccess.RequireModule(Request, conexion, "ventas", SecurityPolicy.Read);

                    string sql = @"
                        SELECT v.id_venta,
                               COALESCE(v.folio, CONCAT('V-', v.id_venta)) AS folio,
                               v.fecha,
                               v.canal,
                               v.forma_pago,
                               v.tipo_documento,
                               v.neto,
                               v.iva,
                               v.descuento,
                               v.total,
                               v.estado,
                               c.id_cliente,
                               c.nombre AS cliente_nombre,
                               c.rut AS cliente_rut,
                               u.nombre AS cajero,
                               COUNT(dv.id_detalle_venta) AS items_count
                        FROM VENTA v
                        INNER JOIN CLIENTE c ON c.id_cliente = v.id_cliente
                        INNER JOIN USUARIO u ON u.id_usuario = v.id_usuario
                        LEFT JOIN DETALLE_VENTA dv ON dv.id_venta = v.id_venta
                        WHERE 1=1 ";

                    if (!string.IsNullOrWhiteSpace(desde)) sql += " AND v.fecha >= @desde ";
                    if (!string.IsNullOrWhiteSpace(hasta)) sql += " AND v.fecha < DATE_ADD(@hasta, INTERVAL 1 DAY) ";
                    if (!string.IsNullOrWhiteSpace(estado) && estado != "todos") sql += " AND v.estado = @estado ";
                    if (!string.IsNullOrWhiteSpace(tipo_documento) && tipo_documento != "todos") sql += " AND v.tipo_documento = @tipo_doc ";
                    if (!string.IsNullOrWhiteSpace(canal) && canal != "todos") sql += " AND v.canal = @canal ";
                    if (!string.IsNullOrWhiteSpace(buscar)) sql += " AND (v.folio LIKE @buscar OR c.nombre LIKE @buscar OR c.rut LIKE @buscar) ";

                    sql += @" GROUP BY v.id_venta, v.folio, v.fecha, v.canal, v.forma_pago, v.tipo_documento,
                                       v.neto, v.iva, v.descuento, v.total, v.estado, c.id_cliente, c.nombre, c.rut, u.nombre
                              ORDER BY v.fecha DESC LIMIT 150";

                    using (var cmd = new MySqlCommand(sql, conexion))
                    {
                        if (!string.IsNullOrWhiteSpace(desde)) cmd.Parameters.AddWithValue("@desde", DateTime.Parse(desde).Date);
                        if (!string.IsNullOrWhiteSpace(hasta)) cmd.Parameters.AddWithValue("@hasta", DateTime.Parse(hasta).Date);
                        if (!string.IsNullOrWhiteSpace(estado) && estado != "todos") cmd.Parameters.AddWithValue("@estado", estado.Trim().ToLowerInvariant());
                        if (!string.IsNullOrWhiteSpace(tipo_documento) && tipo_documento != "todos") cmd.Parameters.AddWithValue("@tipo_doc", tipo_documento.Trim().ToLowerInvariant());
                        if (!string.IsNullOrWhiteSpace(canal) && canal != "todos") cmd.Parameters.AddWithValue("@canal", canal.Trim().ToLowerInvariant());
                        if (!string.IsNullOrWhiteSpace(buscar)) cmd.Parameters.AddWithValue("@buscar", "%" + buscar.Trim() + "%");

                        using (var lector = cmd.ExecuteReader())
                        {
                            while (lector.Read())
                            {
                                ventas.Add(new
                                {
                                    id_venta = Convert.ToInt32(lector["id_venta"]),
                                    folio = lector["folio"].ToString(),
                                    fecha = Convert.ToDateTime(lector["fecha"]).ToString("yyyy-MM-dd HH:mm"),
                                    canal = lector["canal"].ToString(),
                                    forma_pago = lector["forma_pago"].ToString(),
                                    tipo_documento = lector["tipo_documento"].ToString(),
                                    neto = Convert.ToDecimal(lector["neto"]),
                                    iva = Convert.ToDecimal(lector["iva"]),
                                    descuento = Convert.ToDecimal(lector["descuento"]),
                                    total = Convert.ToDecimal(lector["total"]),
                                    estado = lector["estado"].ToString(),
                                    id_cliente = Convert.ToInt32(lector["id_cliente"]),
                                    cliente_nombre = lector["cliente_nombre"].ToString(),
                                    cliente_rut = lector["cliente_rut"].ToString(),
                                    cajero = lector["cajero"].ToString(),
                                    items_count = Convert.ToInt32(lector["items_count"])
                                });
                            }
                        }
                    }
                }

                return Json(new { success = true, ventas = ventas }, JsonRequestBehavior.AllowGet);
            }
            catch (HttpException ex) { return AccessError(ex); }
            catch (Exception ex)
            {
                System.Diagnostics.Trace.TraceError("Error al consultar historial: {0}", ex);
                return ErrorInterno("No se pudo obtener el historial de ventas.");
            }
        }

        // ============================================================
        // GET: /Ventas/DetalleVenta?id=...
        // ============================================================
        [HttpGet]
        public JsonResult DetalleVenta(int id)
        {
            if (id <= 0)
            {
                Response.StatusCode = 400;
                return Json(new { success = false, error = "Identificador de venta no válido." }, JsonRequestBehavior.AllowGet);
            }

            try
            {
                using (var conexion = CrearConexion())
                {
                    conexion.Open();
                    SessionAccess.RequireModule(Request, conexion, "ventas", SecurityPolicy.Read);

                    object venta = null;
                    var items = new List<object>();

                    using (var cmd = new MySqlCommand(
                        @"SELECT v.id_venta, COALESCE(v.folio, CONCAT('V-', v.id_venta)) AS folio,
                                 v.fecha, v.canal, v.forma_pago, v.tipo_documento, v.neto, v.iva, v.descuento, v.total, v.estado,
                                 c.id_cliente, c.nombre AS cliente_nombre, c.rut AS cliente_rut,
                                 u.nombre AS cajero
                          FROM VENTA v
                          INNER JOIN CLIENTE c ON c.id_cliente = v.id_cliente
                          INNER JOIN USUARIO u ON u.id_usuario = v.id_usuario
                          WHERE v.id_venta = @id", conexion))
                    {
                        cmd.Parameters.AddWithValue("@id", id);
                        using (var lector = cmd.ExecuteReader())
                        {
                            if (lector.Read())
                            {
                                venta = new
                                {
                                    id_venta = Convert.ToInt32(lector["id_venta"]),
                                    folio = lector["folio"].ToString(),
                                    fecha = Convert.ToDateTime(lector["fecha"]).ToString("yyyy-MM-dd HH:mm"),
                                    canal = lector["canal"].ToString(),
                                    forma_pago = lector["forma_pago"].ToString(),
                                    tipo_documento = lector["tipo_documento"].ToString(),
                                    neto = Convert.ToDecimal(lector["neto"]),
                                    iva = Convert.ToDecimal(lector["iva"]),
                                    descuento = Convert.ToDecimal(lector["descuento"]),
                                    total = Convert.ToDecimal(lector["total"]),
                                    estado = lector["estado"].ToString(),
                                    cliente = new
                                    {
                                        id = Convert.ToInt32(lector["id_cliente"]),
                                        nombre = lector["cliente_nombre"].ToString(),
                                        rut = lector["cliente_rut"].ToString()
                                    },
                                    cajero = lector["cajero"].ToString()
                                };
                            }
                        }
                    }

                    if (venta == null)
                    {
                        Response.StatusCode = 404;
                        return Json(new { success = false, error = "Venta no encontrada." }, JsonRequestBehavior.AllowGet);
                    }

                    using (var cmdItems = new MySqlCommand(
                        @"SELECT dv.id_detalle_venta, dv.isbn, dv.cantidad, dv.precio_unitario,
                                 l.titulo, l.autor, l.categoria, (dv.cantidad * dv.precio_unitario) AS subtotal
                          FROM DETALLE_VENTA dv
                          INNER JOIN LIBRO l ON l.isbn = dv.isbn
                          WHERE dv.id_venta = @id", conexion))
                    {
                        cmdItems.Parameters.AddWithValue("@id", id);
                        using (var lector = cmdItems.ExecuteReader())
                        {
                            while (lector.Read())
                            {
                                items.Add(new
                                {
                                    id_detalle = Convert.ToInt32(lector["id_detalle_venta"]),
                                    isbn = lector["isbn"].ToString(),
                                    titulo = lector["titulo"].ToString(),
                                    autor = lector["autor"].ToString(),
                                    categoria = lector["categoria"].ToString(),
                                    cantidad = Convert.ToInt32(lector["cantidad"]),
                                    precio_unitario = Convert.ToDecimal(lector["precio_unitario"]),
                                    subtotal = Convert.ToDecimal(lector["subtotal"])
                                });
                            }
                        }
                    }

                    // Consultar si tiene nota de crédito
                    object notaCredito = null;
                    using (var cmdNC = new MySqlCommand(
                        @"SELECT id_nota_credito, folio, fecha, motivo, monto FROM NOTA_CREDITO WHERE id_venta = @id LIMIT 1", conexion))
                    {
                        cmdNC.Parameters.AddWithValue("@id", id);
                        using (var lector = cmdNC.ExecuteReader())
                        {
                            if (lector.Read())
                            {
                                notaCredito = new
                                {
                                    id_nota_credito = Convert.ToInt32(lector["id_nota_credito"]),
                                    folio = lector["folio"].ToString(),
                                    fecha = Convert.ToDateTime(lector["fecha"]).ToString("yyyy-MM-dd"),
                                    motivo = lector["motivo"].ToString(),
                                    monto = Convert.ToDecimal(lector["monto"])
                                };
                            }
                        }
                    }

                    return Json(new { success = true, venta = venta, items = items, nota_credito = notaCredito }, JsonRequestBehavior.AllowGet);
                }
            }
            catch (HttpException ex) { return AccessError(ex); }
            catch (Exception ex)
            {
                System.Diagnostics.Trace.TraceError("Error al obtener detalle de venta: {0}", ex);
                return ErrorInterno("No se pudo obtener el detalle de la venta.");
            }
        }

        // ============================================================
        // POST: /Ventas/EmitirNotaCredito
        // Anulación / Devolución de venta con Notas de Crédito (RF-V05)
        // ============================================================
        [HttpPost]
        public JsonResult EmitirNotaCredito(NotaCreditoRequest solicitud)
        {
            if (solicitud == null || solicitud.id_venta <= 0 || string.IsNullOrWhiteSpace(solicitud.motivo))
            {
                Response.StatusCode = 400;
                return Json(new { success = false, error = "Debes indicar la venta y el motivo de la devolución." });
            }

            try
            {
                using (var conexion = CrearConexion())
                {
                    conexion.Open();
                    int idUsuario = SessionAccess.RequireModule(Request, conexion, "ventas", SecurityPolicy.Edit);

                    using (var transaccion = conexion.BeginTransaction())
                    {
                        try
                        {
                            decimal montoVenta = 0m;
                            string estadoActual = "";
                            using (var cmd = new MySqlCommand(
                                "SELECT total, estado FROM VENTA WHERE id_venta = @id FOR UPDATE", conexion, transaccion))
                            {
                                cmd.Parameters.AddWithValue("@id", solicitud.id_venta);
                                using (var lector = cmd.ExecuteReader())
                                {
                                    if (!lector.Read())
                                    {
                                        transaccion.Rollback();
                                        Response.StatusCode = 404;
                                        return Json(new { success = false, error = "Venta no encontrada." });
                                    }
                                    montoVenta = Convert.ToDecimal(lector["total"]);
                                    estadoActual = lector["estado"].ToString();
                                }
                            }

                            if (estadoActual == "anulado")
                            {
                                transaccion.Rollback();
                                Response.StatusCode = 400;
                                return Json(new { success = false, error = "La venta ya se encuentra anulada." });
                            }

                            string folioNC = solicitud.folio;
                            if (string.IsNullOrWhiteSpace(folioNC))
                            {
                                folioNC = "NC-" + DateTime.Now.ToString("yyyyMMdd") + "-" + (new Random()).Next(100, 999);
                            }

                            // 1. Insertar NOTA_CREDITO
                            int idNC;
                            using (var cmdNC = new MySqlCommand(
                                @"INSERT INTO NOTA_CREDITO (id_venta, folio, fecha, motivo, monto)
                                  VALUES (@id_venta, @folio, CURRENT_DATE(), @motivo, @monto);
                                  SELECT LAST_INSERT_ID();", conexion, transaccion))
                            {
                                cmdNC.Parameters.AddWithValue("@id_venta", solicitud.id_venta);
                                cmdNC.Parameters.AddWithValue("@folio", folioNC);
                                cmdNC.Parameters.AddWithValue("@motivo", solicitud.motivo.Trim());
                                cmdNC.Parameters.AddWithValue("@monto", montoVenta);
                                idNC = Convert.ToInt32(cmdNC.ExecuteScalar());
                            }

                            // 2. Actualizar estado de VENTA
                            using (var cmdUpd = new MySqlCommand(
                                "UPDATE VENTA SET estado = 'anulado' WHERE id_venta = @id", conexion, transaccion))
                            {
                                cmdUpd.Parameters.AddWithValue("@id", solicitud.id_venta);
                                cmdUpd.ExecuteNonQuery();
                            }

                            // 3. Destino físico de los libros: reingreso a stock o desecho por daño
                            var itemsDevueltos = new List<Tuple<string, int>>();
                            using (var cmdItems = new MySqlCommand(
                                "SELECT isbn, cantidad FROM DETALLE_VENTA WHERE id_venta = @id", conexion, transaccion))
                            {
                                cmdItems.Parameters.AddWithValue("@id", solicitud.id_venta);
                                using (var lector = cmdItems.ExecuteReader())
                                {
                                    while (lector.Read())
                                    {
                                        itemsDevueltos.Add(Tuple.Create(lector["isbn"].ToString(), Convert.ToInt32(lector["cantidad"])));
                                    }
                                }
                            }

                            string destino = (solicitud.destino_fisico ?? "reingreso").Trim().ToLowerInvariant();

                            foreach (var item in itemsDevueltos)
                            {
                                if (destino == "reingreso")
                                {
                                    // Aumenta stock físico en inventario
                                    using (var cmdStock = new MySqlCommand(
                                        "UPDATE LIBRO SET stock_actual = stock_actual + @cant WHERE isbn = @isbn", conexion, transaccion))
                                    {
                                        cmdStock.Parameters.AddWithValue("@cant", item.Item2);
                                        cmdStock.Parameters.AddWithValue("@isbn", item.Item1);
                                        cmdStock.ExecuteNonQuery();
                                    }

                                    using (var cmdMov = new MySqlCommand(
                                        @"INSERT INTO MOVIMIENTO_STOCK (isbn, id_usuario, id_venta, id_nota_credito, fecha, tipo_movimiento, motivo, cantidad)
                                          VALUES (@isbn, @id_usuario, @id_venta, @id_nc, NOW(), 'entrada', 'devolucion', @cant)",
                                        conexion, transaccion))
                                    {
                                        cmdMov.Parameters.AddWithValue("@isbn", item.Item1);
                                        cmdMov.Parameters.AddWithValue("@id_usuario", idUsuario);
                                        cmdMov.Parameters.AddWithValue("@id_venta", solicitud.id_venta);
                                        cmdMov.Parameters.AddWithValue("@id_nc", idNC);
                                        cmdMov.Parameters.AddWithValue("@cant", item.Item2);
                                        cmdMov.ExecuteNonQuery();
                                    }
                                }
                                else
                                {
                                    // Desecho por daño / merma (no se reincorpora al stock activo)
                                    using (var cmdMov = new MySqlCommand(
                                        @"INSERT INTO MOVIMIENTO_STOCK (isbn, id_usuario, id_venta, id_nota_credito, fecha, tipo_movimiento, motivo, cantidad)
                                          VALUES (@isbn, @id_usuario, @id_venta, @id_nc, NOW(), 'ajuste', 'Merma por daño en devolución', @cant)",
                                        conexion, transaccion))
                                    {
                                        cmdMov.Parameters.AddWithValue("@isbn", item.Item1);
                                        cmdMov.Parameters.AddWithValue("@id_usuario", idUsuario);
                                        cmdMov.Parameters.AddWithValue("@id_venta", solicitud.id_venta);
                                        cmdMov.Parameters.AddWithValue("@id_nc", idNC);
                                        cmdMov.Parameters.AddWithValue("@cant", item.Item2);
                                        cmdMov.ExecuteNonQuery();
                                    }
                                }
                            }

                            SecurityPolicy.Log(conexion, transaccion, idUsuario, "ventas", "Emitir Nota de Crédito",
                                "NC #" + idNC + " Folio: " + folioNC + " Venta #" + solicitud.id_venta + " Destino: " + destino);

                            transaccion.Commit();

                            return Json(new
                            {
                                success = true,
                                mensaje = "Nota de crédito emitida con éxito (" + folioNC + ").",
                                id_nota_credito = idNC,
                                folio = folioNC
                            });
                        }
                        catch
                        {
                            transaccion.Rollback();
                            throw;
                        }
                    }
                }
            }
            catch (HttpException ex) { return AccessError(ex); }
            catch (Exception ex)
            {
                System.Diagnostics.Trace.TraceError("Error al emitir nota de crédito: {0}", ex);
                return ErrorInterno("No se pudo emitir la nota de crédito: " + ex.Message);
            }
        }

        // ============================================================
        // PANTALLA 4: GESTIÓN DE COTIZACIONES, PEDIDOS Y RESERVAS
        // GET: /Ventas/Pedidos?tipo=...&estado=...&buscar=...
        // ============================================================
        [HttpGet]
        public JsonResult Pedidos(string tipo = null, string estado = null, string buscar = null)
        {
            try
            {
                var pedidos = new List<object>();

                using (var conexion = CrearConexion())
                {
                    conexion.Open();
                    SessionAccess.RequireModule(Request, conexion, "ventas", SecurityPolicy.Read);

                    string sql = @"
                        SELECT p.id_pedido, p.fecha, p.tipo, p.estado,
                               c.id_cliente, c.nombre AS cliente_nombre, c.rut AS cliente_rut, c.tipo_cliente,
                               u.nombre AS usuario_nombre,
                               COALESCE(SUM(dp.cantidad * dp.precio_unitario), 0) AS total_estimado,
                               COUNT(dp.id_detalle_pedido) AS items_count
                        FROM PEDIDO_VENTA p
                        INNER JOIN CLIENTE c ON c.id_cliente = p.id_cliente
                        INNER JOIN USUARIO u ON u.id_usuario = p.id_usuario
                        LEFT JOIN DETALLE_PEDIDO dp ON dp.id_pedido = p.id_pedido
                        WHERE 1=1 ";

                    if (!string.IsNullOrWhiteSpace(tipo) && tipo != "todos") sql += " AND p.tipo = @tipo ";
                    if (!string.IsNullOrWhiteSpace(estado) && estado != "todos") sql += " AND p.estado = @estado ";
                    if (!string.IsNullOrWhiteSpace(buscar)) sql += " AND (c.nombre LIKE @buscar OR c.rut LIKE @buscar OR CAST(p.id_pedido AS CHAR) LIKE @buscar) ";

                    sql += @" GROUP BY p.id_pedido, p.fecha, p.tipo, p.estado, c.id_cliente, c.nombre, c.rut, c.tipo_cliente, u.nombre
                              ORDER BY p.id_pedido DESC LIMIT 100";

                    using (var cmd = new MySqlCommand(sql, conexion))
                    {
                        if (!string.IsNullOrWhiteSpace(tipo) && tipo != "todos") cmd.Parameters.AddWithValue("@tipo", tipo.Trim().ToLowerInvariant());
                        if (!string.IsNullOrWhiteSpace(estado) && estado != "todos") cmd.Parameters.AddWithValue("@estado", estado.Trim().ToLowerInvariant());
                        if (!string.IsNullOrWhiteSpace(buscar)) cmd.Parameters.AddWithValue("@buscar", "%" + buscar.Trim() + "%");

                        using (var lector = cmd.ExecuteReader())
                        {
                            while (lector.Read())
                            {
                                pedidos.Add(new
                                {
                                    id_pedido = Convert.ToInt32(lector["id_pedido"]),
                                    fecha = Convert.ToDateTime(lector["fecha"]).ToString("yyyy-MM-dd"),
                                    tipo = lector["tipo"].ToString(),
                                    estado = lector["estado"].ToString(),
                                    id_cliente = Convert.ToInt32(lector["id_cliente"]),
                                    cliente_nombre = lector["cliente_nombre"].ToString(),
                                    cliente_rut = lector["cliente_rut"].ToString(),
                                    cliente_tipo = lector["tipo_cliente"].ToString(),
                                    usuario_nombre = lector["usuario_nombre"].ToString(),
                                    total_estimado = Convert.ToDecimal(lector["total_estimado"]),
                                    items_count = Convert.ToInt32(lector["items_count"])
                                });
                            }
                        }
                    }
                }

                return Json(new { success = true, pedidos = pedidos }, JsonRequestBehavior.AllowGet);
            }
            catch (HttpException ex) { return AccessError(ex); }
            catch (Exception ex)
            {
                System.Diagnostics.Trace.TraceError("Error al listar pedidos: {0}", ex);
                return ErrorInterno("No se pudieron consultar los pedidos y cotizaciones.");
            }
        }

        // ============================================================
        // GET: /Ventas/DetallePedido?id=...
        // ============================================================
        [HttpGet]
        public JsonResult DetallePedido(int id)
        {
            if (id <= 0)
            {
                Response.StatusCode = 400;
                return Json(new { success = false, error = "ID no válido." }, JsonRequestBehavior.AllowGet);
            }

            try
            {
                using (var conexion = CrearConexion())
                {
                    conexion.Open();
                    SessionAccess.RequireModule(Request, conexion, "ventas", SecurityPolicy.Read);

                    object pedido = null;
                    var items = new List<object>();

                    using (var cmd = new MySqlCommand(
                        @"SELECT p.id_pedido, p.fecha, p.tipo, p.estado,
                                 c.id_cliente, c.nombre AS cliente_nombre, c.rut AS cliente_rut,
                                 u.nombre AS usuario_nombre
                          FROM PEDIDO_VENTA p
                          INNER JOIN CLIENTE c ON c.id_cliente = p.id_cliente
                          INNER JOIN USUARIO u ON u.id_usuario = p.id_usuario
                          WHERE p.id_pedido = @id", conexion))
                    {
                        cmd.Parameters.AddWithValue("@id", id);
                        using (var lector = cmd.ExecuteReader())
                        {
                            if (lector.Read())
                            {
                                pedido = new
                                {
                                    id_pedido = Convert.ToInt32(lector["id_pedido"]),
                                    fecha = Convert.ToDateTime(lector["fecha"]).ToString("yyyy-MM-dd"),
                                    tipo = lector["tipo"].ToString(),
                                    estado = lector["estado"].ToString(),
                                    cliente = new
                                    {
                                        id = Convert.ToInt32(lector["id_cliente"]),
                                        nombre = lector["cliente_nombre"].ToString(),
                                        rut = lector["cliente_rut"].ToString()
                                    },
                                    usuario = lector["usuario_nombre"].ToString()
                                };
                            }
                        }
                    }

                    if (pedido == null)
                    {
                        Response.StatusCode = 404;
                        return Json(new { success = false, error = "Pedido no encontrado." }, JsonRequestBehavior.AllowGet);
                    }

                    using (var cmdItems = new MySqlCommand(
                        @"SELECT dp.id_detalle_pedido, dp.isbn, dp.cantidad, dp.precio_unitario,
                                 l.titulo, l.autor, l.stock_actual
                          FROM DETALLE_PEDIDO dp
                          INNER JOIN LIBRO l ON l.isbn = dp.isbn
                          WHERE dp.id_pedido = @id", conexion))
                    {
                        cmdItems.Parameters.AddWithValue("@id", id);
                        using (var lector = cmdItems.ExecuteReader())
                        {
                            while (lector.Read())
                            {
                                items.Add(new
                                {
                                    id_detalle = Convert.ToInt32(lector["id_detalle_pedido"]),
                                    isbn = lector["isbn"].ToString(),
                                    titulo = lector["titulo"].ToString(),
                                    autor = lector["autor"].ToString(),
                                    stock_actual = Convert.ToInt32(lector["stock_actual"]),
                                    cantidad = Convert.ToInt32(lector["cantidad"]),
                                    precio_unitario = Convert.ToDecimal(lector["precio_unitario"]),
                                    subtotal = Convert.ToDecimal(lector["precio_unitario"]) * Convert.ToInt32(lector["cantidad"])
                                });
                            }
                        }
                    }

                    return Json(new { success = true, pedido = pedido, items = items }, JsonRequestBehavior.AllowGet);
                }
            }
            catch (HttpException ex) { return AccessError(ex); }
            catch (Exception ex)
            {
                System.Diagnostics.Trace.TraceError("Error detalle pedido: {0}", ex);
                return ErrorInterno("No se pudo obtener el detalle del pedido.");
            }
        }

        // ============================================================
        // POST: /Ventas/GuardarPedido
        // ============================================================
        [HttpPost]
        public JsonResult GuardarPedido(PedidoRequest request)
        {
            if (request == null || request.id_cliente <= 0 || request.detalles == null || request.detalles.Count == 0)
            {
                Response.StatusCode = 400;
                return Json(new { success = false, error = "Debes ingresar el cliente y al menos un producto." });
            }

            try
            {
                using (var conexion = CrearConexion())
                {
                    conexion.Open();
                    int idUsuario = SessionAccess.RequireModule(Request, conexion, "ventas", SecurityPolicy.Edit);

                    using (var transaccion = conexion.BeginTransaction())
                    {
                        try
                        {
                            string tipo = string.IsNullOrWhiteSpace(request.tipo) ? "cotizacion" : request.tipo.Trim().ToLowerInvariant();
                            string estado = string.IsNullOrWhiteSpace(request.estado) ? "pendiente" : request.estado.Trim().ToLowerInvariant();

                            int idPedido;
                            using (var cmd = new MySqlCommand(
                                @"INSERT INTO PEDIDO_VENTA (id_cliente, id_usuario, fecha, tipo, estado)
                                  VALUES (@id_cliente, @id_usuario, CURRENT_DATE(), @tipo, @estado);
                                  SELECT LAST_INSERT_ID();", conexion, transaccion))
                            {
                                cmd.Parameters.AddWithValue("@id_cliente", request.id_cliente);
                                cmd.Parameters.AddWithValue("@id_usuario", idUsuario);
                                cmd.Parameters.AddWithValue("@tipo", tipo);
                                cmd.Parameters.AddWithValue("@estado", estado);
                                idPedido = Convert.ToInt32(cmd.ExecuteScalar());
                            }

                            foreach (var item in request.detalles)
                            {
                                if (item.cantidad <= 0 || string.IsNullOrWhiteSpace(item.isbn)) continue;

                                using (var cmdItem = new MySqlCommand(
                                    @"INSERT INTO DETALLE_PEDIDO (id_pedido, isbn, cantidad, precio_unitario)
                                      VALUES (@id_pedido, @isbn, @cant, @precio)", conexion, transaccion))
                                {
                                    cmdItem.Parameters.AddWithValue("@id_pedido", idPedido);
                                    cmdItem.Parameters.AddWithValue("@isbn", item.isbn.Trim());
                                    cmdItem.Parameters.AddWithValue("@cant", item.cantidad);
                                    cmdItem.Parameters.AddWithValue("@precio", item.precio_unitario);
                                    cmdItem.ExecuteNonQuery();
                                }
                            }

                            SecurityPolicy.Log(conexion, transaccion, idUsuario, "ventas", "Crear pedido / cotización",
                                tipo.ToUpperInvariant() + " #" + idPedido);

                            transaccion.Commit();

                            return Json(new { success = true, mensaje = tipo == "cotizacion" ? "Cotización creada con éxito." : "Pedido institucional registrado.", id_pedido = idPedido });
                        }
                        catch
                        {
                            transaccion.Rollback();
                            throw;
                        }
                    }
                }
            }
            catch (HttpException ex) { return AccessError(ex); }
            catch (Exception ex)
            {
                System.Diagnostics.Trace.TraceError("Error al guardar pedido: {0}", ex);
                return ErrorInterno("No se pudo registrar el pedido.");
            }
        }

        // ============================================================
        // POST: /Ventas/CambiarEstadoPedido
        // ============================================================
        [HttpPost]
        public JsonResult CambiarEstadoPedido(int id_pedido, string nuevo_estado)
        {
            if (id_pedido <= 0 || string.IsNullOrWhiteSpace(nuevo_estado))
            {
                Response.StatusCode = 400;
                return Json(new { success = false, error = "Parámetros no válidos." });
            }

            try
            {
                using (var conexion = CrearConexion())
                {
                    conexion.Open();
                    int idUsuario = SessionAccess.RequireModule(Request, conexion, "ventas", SecurityPolicy.Edit);

                    using (var cmd = new MySqlCommand(
                        "UPDATE PEDIDO_VENTA SET estado = @estado WHERE id_pedido = @id", conexion))
                    {
                        cmd.Parameters.AddWithValue("@estado", nuevo_estado.Trim().ToLowerInvariant());
                        cmd.Parameters.AddWithValue("@id", id_pedido);
                        cmd.ExecuteNonQuery();
                    }

                    SecurityPolicy.Log(conexion, null, idUsuario, "ventas", "Cambiar estado pedido",
                        "Pedido #" + id_pedido + " a " + nuevo_estado);

                    return Json(new { success = true, mensaje = "Estado del pedido actualizado a " + nuevo_estado + "." });
                }
            }
            catch (HttpException ex) { return AccessError(ex); }
            catch (Exception ex)
            {
                System.Diagnostics.Trace.TraceError("Error al cambiar estado pedido: {0}", ex);
                return ErrorInterno("No se pudo actualizar el estado del pedido.");
            }
        }

        // ============================================================
        // GET: /Ventas/Reservas?estado=...&buscar=... (RF-V10)
        // ============================================================
        [HttpGet]
        public JsonResult Reservas(string estado = null, string buscar = null)
        {
            try
            {
                var reservas = new List<object>();

                using (var conexion = CrearConexion())
                {
                    conexion.Open();
                    SessionAccess.RequireModule(Request, conexion, "ventas", SecurityPolicy.Read);

                    string sql = @"
                        SELECT r.id_reserva, r.fecha, r.cantidad, r.estado,
                               c.id_cliente, c.nombre AS cliente_nombre, c.rut AS cliente_rut, COALESCE(c.telefono, '') AS cliente_telefono,
                               l.isbn, l.titulo, l.autor, l.stock_actual
                        FROM RESERVA r
                        INNER JOIN CLIENTE c ON c.id_cliente = r.id_cliente
                        INNER JOIN LIBRO l ON l.isbn = r.isbn
                        WHERE 1=1 ";

                    if (!string.IsNullOrWhiteSpace(estado) && estado != "todos") sql += " AND r.estado = @estado ";
                    if (!string.IsNullOrWhiteSpace(buscar)) sql += " AND (c.nombre LIKE @buscar OR l.titulo LIKE @buscar OR l.isbn LIKE @buscar) ";

                    sql += " ORDER BY r.fecha DESC LIMIT 100";

                    using (var cmd = new MySqlCommand(sql, conexion))
                    {
                        if (!string.IsNullOrWhiteSpace(estado) && estado != "todos") cmd.Parameters.AddWithValue("@estado", estado.Trim().ToLowerInvariant());
                        if (!string.IsNullOrWhiteSpace(buscar)) cmd.Parameters.AddWithValue("@buscar", "%" + buscar.Trim() + "%");

                        using (var lector = cmd.ExecuteReader())
                        {
                            while (lector.Read())
                            {
                                reservas.Add(new
                                {
                                    id_reserva = Convert.ToInt32(lector["id_reserva"]),
                                    fecha = Convert.ToDateTime(lector["fecha"]).ToString("yyyy-MM-dd"),
                                    cantidad = Convert.ToInt32(lector["cantidad"]),
                                    estado = lector["estado"].ToString(),
                                    cliente = new
                                    {
                                        id = Convert.ToInt32(lector["id_cliente"]),
                                        nombre = lector["cliente_nombre"].ToString(),
                                        rut = lector["cliente_rut"].ToString(),
                                        telefono = lector["cliente_telefono"].ToString()
                                    },
                                    libro = new
                                    {
                                        isbn = lector["isbn"].ToString(),
                                        titulo = lector["titulo"].ToString(),
                                        autor = lector["autor"].ToString(),
                                        stock_actual = Convert.ToInt32(lector["stock_actual"])
                                    }
                                });
                            }
                        }
                    }
                }

                return Json(new { success = true, reservas = reservas }, JsonRequestBehavior.AllowGet);
            }
            catch (HttpException ex) { return AccessError(ex); }
            catch (Exception ex)
            {
                System.Diagnostics.Trace.TraceError("Error al consultar reservas: {0}", ex);
                return ErrorInterno("No se pudieron consultar las reservas.");
            }
        }

        // ============================================================
        // POST: /Ventas/GuardarReserva
        // ============================================================
        [HttpPost]
        public JsonResult GuardarReserva(ReservaRequest request)
        {
            if (request == null || request.id_cliente <= 0 || string.IsNullOrWhiteSpace(request.isbn) || request.cantidad <= 0)
            {
                Response.StatusCode = 400;
                return Json(new { success = false, error = "Debes indicar cliente, libro e ingresar una cantidad válida." });
            }

            try
            {
                using (var conexion = CrearConexion())
                {
                    conexion.Open();
                    int idUsuario = SessionAccess.RequireModule(Request, conexion, "ventas", SecurityPolicy.Edit);

                    using (var cmd = new MySqlCommand(
                        @"INSERT INTO RESERVA (id_cliente, isbn, fecha, cantidad, estado)
                          VALUES (@id_cliente, @isbn, CURRENT_DATE(), @cantidad, 'activa');
                          SELECT LAST_INSERT_ID();", conexion))
                    {
                        cmd.Parameters.AddWithValue("@id_cliente", request.id_cliente);
                        cmd.Parameters.AddWithValue("@isbn", request.isbn.Trim());
                        cmd.Parameters.AddWithValue("@cantidad", request.cantidad);
                        int idReserva = Convert.ToInt32(cmd.ExecuteScalar());

                        SecurityPolicy.Log(conexion, null, idUsuario, "ventas", "Crear reserva",
                            "Reserva #" + idReserva + " Libro: " + request.isbn);

                        return Json(new { success = true, mensaje = "Reserva registrada con éxito.", id_reserva = idReserva });
                    }
                }
            }
            catch (HttpException ex) { return AccessError(ex); }
            catch (Exception ex)
            {
                System.Diagnostics.Trace.TraceError("Error al guardar reserva: {0}", ex);
                return ErrorInterno("No se pudo registrar la reserva.");
            }
        }

        // ============================================================
        // POST: /Ventas/AtenderReserva
        // ============================================================
        [HttpPost]
        public JsonResult AtenderReserva(int id_reserva, string nuevo_estado)
        {
            if (id_reserva <= 0 || string.IsNullOrWhiteSpace(nuevo_estado))
            {
                Response.StatusCode = 400;
                return Json(new { success = false, error = "Parámetros no válidos." });
            }

            try
            {
                using (var conexion = CrearConexion())
                {
                    conexion.Open();
                    int idUsuario = SessionAccess.RequireModule(Request, conexion, "ventas", SecurityPolicy.Edit);

                    using (var cmd = new MySqlCommand(
                        "UPDATE RESERVA SET estado = @estado WHERE id_reserva = @id", conexion))
                    {
                        cmd.Parameters.AddWithValue("@estado", nuevo_estado.Trim().ToLowerInvariant());
                        cmd.Parameters.AddWithValue("@id", id_reserva);
                        cmd.ExecuteNonQuery();
                    }

                    SecurityPolicy.Log(conexion, null, idUsuario, "ventas", "Actualizar reserva",
                        "Reserva #" + id_reserva + " marcada como " + nuevo_estado);

                    return Json(new { success = true, mensaje = "Reserva actualizada." });
                }
            }
            catch (HttpException ex) { return AccessError(ex); }
            catch (Exception ex)
            {
                System.Diagnostics.Trace.TraceError("Error al atender reserva: {0}", ex);
                return ErrorInterno("No se pudo actualizar la reserva.");
            }
        }

        // ============================================================
        // PANTALLA 5: GESTIÓN DE PROMOCIONES Y DESCUENTOS (RF-V11)
        // GET: /Ventas/Promociones
        // ============================================================
        [HttpGet]
        public JsonResult Promociones()
        {
            try
            {
                var promociones = new List<object>();

                using (var conexion = CrearConexion())
                {
                    conexion.Open();
                    SessionAccess.RequireModule(Request, conexion, "ventas", SecurityPolicy.Read);

                    // Asegurar que exista la tabla PROMOCION
                    using (var check = new MySqlCommand(
                        @"CREATE TABLE IF NOT EXISTS PROMOCION (
                            id_promocion     INT AUTO_INCREMENT PRIMARY KEY,
                            nombre           VARCHAR(100) NOT NULL,
                            descripcion      VARCHAR(255),
                            tipo             VARCHAR(30) NOT NULL,
                            valor            DECIMAL(10,2) NOT NULL DEFAULT 0,
                            categoria        VARCHAR(80) NULL,
                            isbn             VARCHAR(20) NULL,
                            fecha_inicio     DATE NOT NULL,
                            fecha_fin        DATE NOT NULL,
                            activo           BOOLEAN NOT NULL DEFAULT TRUE
                        ) ENGINE=InnoDB;", conexion))
                    {
                        check.ExecuteNonQuery();
                    }

                    using (var cmd = new MySqlCommand(
                        @"SELECT p.id_promocion, p.nombre, p.descripcion, p.tipo, p.valor,
                                 p.categoria, p.isbn, p.fecha_inicio, p.fecha_fin, p.activo,
                                 l.titulo AS libro_titulo
                          FROM PROMOCION p
                          LEFT JOIN LIBRO l ON l.isbn = p.isbn
                          ORDER BY p.id_promocion DESC", conexion))
                    using (var lector = cmd.ExecuteReader())
                    {
                        while (lector.Read())
                        {
                            promociones.Add(new
                            {
                                id_promocion = Convert.ToInt32(lector["id_promocion"]),
                                nombre = lector["nombre"].ToString(),
                                descripcion = lector["descripcion"] == DBNull.Value ? "" : lector["descripcion"].ToString(),
                                tipo = lector["tipo"].ToString(),
                                valor = Convert.ToDecimal(lector["valor"]),
                                categoria = lector["categoria"] == DBNull.Value ? "" : lector["categoria"].ToString(),
                                isbn = lector["isbn"] == DBNull.Value ? "" : lector["isbn"].ToString(),
                                libro_titulo = lector["libro_titulo"] == DBNull.Value ? "" : lector["libro_titulo"].ToString(),
                                fecha_inicio = Convert.ToDateTime(lector["fecha_inicio"]).ToString("yyyy-MM-dd"),
                                fecha_fin = Convert.ToDateTime(lector["fecha_fin"]).ToString("yyyy-MM-dd"),
                                activo = Convert.ToBoolean(lector["activo"])
                            });
                        }
                    }
                }

                return Json(new { success = true, promociones = promociones }, JsonRequestBehavior.AllowGet);
            }
            catch (HttpException ex) { return AccessError(ex); }
            catch (Exception ex)
            {
                System.Diagnostics.Trace.TraceError("Error promociones: {0}", ex);
                return ErrorInterno("No se pudieron consultar las promociones.");
            }
        }

        // ============================================================
        // POST: /Ventas/GuardarPromocion
        // ============================================================
        [HttpPost]
        public JsonResult GuardarPromocion(PromocionDto promo)
        {
            if (promo == null || string.IsNullOrWhiteSpace(promo.nombre) || string.IsNullOrWhiteSpace(promo.tipo))
            {
                Response.StatusCode = 400;
                return Json(new { success = false, error = "El nombre y el tipo de promoción son obligatorios." });
            }

            try
            {
                using (var conexion = CrearConexion())
                {
                    conexion.Open();
                    int idUsuario = SessionAccess.RequireModule(Request, conexion, "ventas", SecurityPolicy.Edit);

                    DateTime inicio = DateTime.Parse(promo.fecha_inicio);
                    DateTime fin = DateTime.Parse(promo.fecha_fin);

                    if (inicio > fin)
                    {
                        Response.StatusCode = 400;
                        return Json(new { success = false, error = "La fecha de inicio no puede ser posterior a la de término." });
                    }

                    if (promo.id_promocion <= 0)
                    {
                        using (var cmd = new MySqlCommand(
                            @"INSERT INTO PROMOCION (nombre, descripcion, tipo, valor, categoria, isbn, fecha_inicio, fecha_fin, activo)
                              VALUES (@nombre, @descripcion, @tipo, @valor, @categoria, @isbn, @inicio, @fin, @activo);
                              SELECT LAST_INSERT_ID();", conexion))
                        {
                            cmd.Parameters.AddWithValue("@nombre", promo.nombre.Trim());
                            cmd.Parameters.AddWithValue("@descripcion", (promo.descripcion ?? "").Trim());
                            cmd.Parameters.AddWithValue("@tipo", promo.tipo.Trim().ToLowerInvariant());
                            cmd.Parameters.AddWithValue("@valor", promo.valor);
                            cmd.Parameters.AddWithValue("@categoria", string.IsNullOrWhiteSpace(promo.categoria) ? (object)DBNull.Value : promo.categoria.Trim());
                            cmd.Parameters.AddWithValue("@isbn", string.IsNullOrWhiteSpace(promo.isbn) ? (object)DBNull.Value : promo.isbn.Trim());
                            cmd.Parameters.AddWithValue("@inicio", inicio.Date);
                            cmd.Parameters.AddWithValue("@fin", fin.Date);
                            cmd.Parameters.AddWithValue("@activo", promo.activo);

                            int idNueva = Convert.ToInt32(cmd.ExecuteScalar());
                            SecurityPolicy.Log(conexion, null, idUsuario, "ventas", "Crear promoción", "Promo #" + idNueva + " " + promo.nombre);

                            return Json(new { success = true, mensaje = "Promoción guardada exitosamente.", id_promocion = idNueva });
                        }
                    }
                    else
                    {
                        using (var cmd = new MySqlCommand(
                            @"UPDATE PROMOCION
                              SET nombre = @nombre,
                                  descripcion = @descripcion,
                                  tipo = @tipo,
                                  valor = @valor,
                                  categoria = @categoria,
                                  isbn = @isbn,
                                  fecha_inicio = @inicio,
                                  fecha_fin = @fin,
                                  activo = @activo
                              WHERE id_promocion = @id", conexion))
                        {
                            cmd.Parameters.AddWithValue("@id", promo.id_promocion);
                            cmd.Parameters.AddWithValue("@nombre", promo.nombre.Trim());
                            cmd.Parameters.AddWithValue("@descripcion", (promo.descripcion ?? "").Trim());
                            cmd.Parameters.AddWithValue("@tipo", promo.tipo.Trim().ToLowerInvariant());
                            cmd.Parameters.AddWithValue("@valor", promo.valor);
                            cmd.Parameters.AddWithValue("@categoria", string.IsNullOrWhiteSpace(promo.categoria) ? (object)DBNull.Value : promo.categoria.Trim());
                            cmd.Parameters.AddWithValue("@isbn", string.IsNullOrWhiteSpace(promo.isbn) ? (object)DBNull.Value : promo.isbn.Trim());
                            cmd.Parameters.AddWithValue("@inicio", inicio.Date);
                            cmd.Parameters.AddWithValue("@fin", fin.Date);
                            cmd.Parameters.AddWithValue("@activo", promo.activo);

                            cmd.ExecuteNonQuery();
                            SecurityPolicy.Log(conexion, null, idUsuario, "ventas", "Actualizar promoción", "Promo #" + promo.id_promocion);

                            return Json(new { success = true, mensaje = "Promoción actualizada correctamente." });
                        }
                    }
                }
            }
            catch (HttpException ex) { return AccessError(ex); }
            catch (Exception ex)
            {
                System.Diagnostics.Trace.TraceError("Error al guardar promoción: {0}", ex);
                return ErrorInterno("No se pudo guardar la regla de promoción.");
            }
        }

        // ============================================================
        // POST: /Ventas/TogglePromocion
        // ============================================================
        [HttpPost]
        public JsonResult TogglePromocion(int id_promocion, bool activo)
        {
            if (id_promocion <= 0)
            {
                Response.StatusCode = 400;
                return Json(new { success = false, error = "ID no válido." });
            }

            try
            {
                using (var conexion = CrearConexion())
                {
                    conexion.Open();
                    int idUsuario = SessionAccess.RequireModule(Request, conexion, "ventas", SecurityPolicy.Edit);

                    using (var cmd = new MySqlCommand("UPDATE PROMOCION SET activo = @activo WHERE id_promocion = @id", conexion))
                    {
                        cmd.Parameters.AddWithValue("@activo", activo);
                        cmd.Parameters.AddWithValue("@id", id_promocion);
                        cmd.ExecuteNonQuery();
                    }

                    SecurityPolicy.Log(conexion, null, idUsuario, "ventas", "Cambiar estado promoción",
                        "Promo #" + id_promocion + " activo: " + activo);

                    return Json(new { success = true, mensaje = "Estado de promoción actualizado." });
                }
            }
            catch (HttpException ex) { return AccessError(ex); }
            catch (Exception ex)
            {
                System.Diagnostics.Trace.TraceError("Error toggle promoción: {0}", ex);
                return ErrorInterno("No se pudo cambiar el estado de la promoción.");
            }
        }

        // ============================================================
        // REPORTE 1: RANKING DE VENTAS POR CLIENTE (PARETO) (RF-V16)
        // GET: /Ventas/ReporteClientes?desde=2026-10-01&hasta=2026-10-08
        // ============================================================
        [HttpGet]
        public JsonResult ReporteClientes(string desde = null, string hasta = null)
        {
            try
            {
                DateTime? fechaDesde = null;
                DateTime? fechaHasta = null;

                if (!string.IsNullOrWhiteSpace(desde))
                {
                    DateTime fecha;
                    if (!DateTime.TryParse(desde, out fecha))
                    {
                        Response.StatusCode = 400;
                        return Json(new { success = false, error = "La fecha desde no es válida." }, JsonRequestBehavior.AllowGet);
                    }
                    fechaDesde = fecha.Date;
                }

                if (!string.IsNullOrWhiteSpace(hasta))
                {
                    DateTime fecha;
                    if (!DateTime.TryParse(hasta, out fecha))
                    {
                        Response.StatusCode = 400;
                        return Json(new { success = false, error = "La fecha hasta no es válida." }, JsonRequestBehavior.AllowGet);
                    }
                    fechaHasta = fecha.Date;
                }

                if (fechaDesde.HasValue && fechaHasta.HasValue && fechaDesde.Value > fechaHasta.Value)
                {
                    Response.StatusCode = 400;
                    return Json(new { success = false, error = "La fecha desde no puede ser posterior a la fecha hasta." }, JsonRequestBehavior.AllowGet);
                }

                var filas = new List<dynamic>();

                using (var conexion = CrearConexion())
                {
                    conexion.Open();
                    SessionAccess.RequireModule(Request, conexion, "ventas", SecurityPolicy.Read);

                    string sql = @"
                        SELECT c.id_cliente, c.rut, c.nombre, c.tipo_cliente,
                               COUNT(v.id_venta) AS cantidad_ventas,
                               COALESCE(SUM(v.total), 0) AS total_vendido
                        FROM VENTA v
                        INNER JOIN CLIENTE c ON c.id_cliente = v.id_cliente
                        WHERE v.estado = 'pagado' ";

                    if (fechaDesde.HasValue) sql += " AND v.fecha >= @desde ";
                    if (fechaHasta.HasValue) sql += " AND v.fecha < DATE_ADD(@hasta, INTERVAL 1 DAY) ";

                    sql += " GROUP BY c.id_cliente, c.rut, c.nombre, c.tipo_cliente ORDER BY total_vendido DESC";

                    using (var comando = new MySqlCommand(sql, conexion))
                    {
                        if (fechaDesde.HasValue) comando.Parameters.AddWithValue("@desde", fechaDesde.Value);
                        if (fechaHasta.HasValue) comando.Parameters.AddWithValue("@hasta", fechaHasta.Value);

                        using (var lector = comando.ExecuteReader())
                        {
                            while (lector.Read())
                            {
                                filas.Add(new
                                {
                                    id_cliente = Convert.ToInt32(lector["id_cliente"]),
                                    rut = lector["rut"].ToString(),
                                    nombre = lector["nombre"].ToString(),
                                    tipo_cliente = lector["tipo_cliente"].ToString(),
                                    cantidad_ventas = Convert.ToInt32(lector["cantidad_ventas"]),
                                    total_vendido = Convert.ToDecimal(lector["total_vendido"])
                                });
                            }
                        }
                    }
                }

                decimal totalGeneral = 0m;
                int totalVentas = 0;
                foreach (var fila in filas)
                {
                    totalGeneral += fila.total_vendido;
                    totalVentas += (int)fila.cantidad_ventas;
                }

                decimal acumulado = 0m;
                var reporte = new List<object>();
                int posicion = 1;

                foreach (var fila in filas)
                {
                    decimal porcentaje = totalGeneral > 0
                        ? Math.Round((fila.total_vendido / totalGeneral) * 100m, 2)
                        : 0m;

                    acumulado += porcentaje;
                    string clasificacion = acumulado <= 80m ? "A" : (acumulado <= 95m ? "B" : "C");

                    reporte.Add(new
                    {
                        posicion = posicion++,
                        id_cliente = fila.id_cliente,
                        rut = fila.rut,
                        nombre = fila.nombre,
                        tipo_cliente = fila.tipo_cliente,
                        cantidad_ventas = fila.cantidad_ventas,
                        total_vendido = fila.total_vendido,
                        porcentaje = porcentaje,
                        porcentaje_acumulado = Math.Round(acumulado, 2),
                        clasificacion = clasificacion
                    });
                }

                return Json(new
                {
                    success = true,
                    total_clientes = reporte.Count,
                    total_ventas = totalVentas,
                    total_vendido = totalGeneral,
                    reporte = reporte
                }, JsonRequestBehavior.AllowGet);
            }
            catch (HttpException ex) { return AccessError(ex); }
            catch (Exception ex)
            {
                System.Diagnostics.Trace.TraceError("Error reporte Pareto: {0}", ex);
                return ErrorInterno("No se pudo generar el reporte de ventas por cliente.");
            }
        }

        // ============================================================
        // REPORTE 2: VENTAS POR PRODUCTO Y CATEGORÍA (RF-V17)
        // GET: /Ventas/ReporteVentasProducto?desde=...&hasta=...&categoria=...
        // ============================================================
        [HttpGet]
        public JsonResult ReporteVentasProducto(string desde = null, string hasta = null, string categoria = null)
        {
            try
            {
                var filas = new List<object>();
                decimal totalMonto = 0m;
                int totalUnidades = 0;

                using (var conexion = CrearConexion())
                {
                    conexion.Open();
                    SessionAccess.RequireModule(Request, conexion, "ventas", SecurityPolicy.Read);

                    string sql = @"
                        SELECT l.isbn,
                               l.titulo,
                               l.autor,
                               l.categoria,
                               COALESCE(e.nombre, 'Sin Editorial') AS editorial,
                               SUM(dv.cantidad) AS unidades_vendidas,
                               SUM(dv.cantidad * dv.precio_unitario) AS total_recaudado,
                               AVG(dv.precio_unitario) AS precio_promedio
                        FROM DETALLE_VENTA dv
                        INNER JOIN VENTA v ON v.id_venta = dv.id_venta
                        INNER JOIN LIBRO l ON l.isbn = dv.isbn
                        LEFT JOIN EDITORIAL e ON e.id_editorial = l.id_editorial
                        WHERE v.estado = 'pagado' ";

                    if (!string.IsNullOrWhiteSpace(desde)) sql += " AND v.fecha >= @desde ";
                    if (!string.IsNullOrWhiteSpace(hasta)) sql += " AND v.fecha < DATE_ADD(@hasta, INTERVAL 1 DAY) ";
                    if (!string.IsNullOrWhiteSpace(categoria) && categoria != "todos") sql += " AND l.categoria = @categoria ";

                    sql += @" GROUP BY l.isbn, l.titulo, l.autor, l.categoria, e.nombre
                              ORDER BY unidades_vendidas DESC, total_recaudado DESC";

                    using (var cmd = new MySqlCommand(sql, conexion))
                    {
                        if (!string.IsNullOrWhiteSpace(desde)) cmd.Parameters.AddWithValue("@desde", DateTime.Parse(desde).Date);
                        if (!string.IsNullOrWhiteSpace(hasta)) cmd.Parameters.AddWithValue("@hasta", DateTime.Parse(hasta).Date);
                        if (!string.IsNullOrWhiteSpace(categoria) && categoria != "todos") cmd.Parameters.AddWithValue("@categoria", categoria.Trim());

                        using (var lector = cmd.ExecuteReader())
                        {
                            while (lector.Read())
                            {
                                int unidades = Convert.ToInt32(lector["unidades_vendidas"]);
                                decimal recaudado = Convert.ToDecimal(lector["total_recaudado"]);

                                totalUnidades += unidades;
                                totalMonto += recaudado;

                                filas.Add(new
                                {
                                    isbn = lector["isbn"].ToString(),
                                    titulo = lector["titulo"].ToString(),
                                    autor = lector["autor"].ToString(),
                                    categoria = lector["categoria"].ToString(),
                                    editorial = lector["editorial"].ToString(),
                                    unidades_vendidas = unidades,
                                    total_recaudado = recaudado,
                                    precio_promedio = Convert.ToDecimal(lector["precio_promedio"])
                                });
                            }
                        }
                    }
                }

                return Json(new
                {
                    success = true,
                    total_titulos = filas.Count,
                    total_unidades = totalUnidades,
                    total_recaudado = totalMonto,
                    reporte = filas
                }, JsonRequestBehavior.AllowGet);
            }
            catch (HttpException ex) { return AccessError(ex); }
            catch (Exception ex)
            {
                System.Diagnostics.Trace.TraceError("Error reporte producto: {0}", ex);
                return ErrorInterno("No se pudo generar el reporte de ventas por producto.");
            }
        }

        // ============================================================
        // REPORTE 3: CUENTAS POR COBRAR (FACTURAS PENDIENTES) (RF-V18)
        // GET: /Ventas/ReporteCuentasPorCobrar?cliente=...
        // ============================================================
        [HttpGet]
        public JsonResult ReporteCuentasPorCobrar(string cliente = null)
        {
            try
            {
                var documentos = new List<object>();
                decimal saldoTotal = 0m;
                int vigentes = 0;
                int mora30 = 0;
                int mora60 = 0;
                int mora90Mas = 0;

                using (var conexion = CrearConexion())
                {
                    conexion.Open();
                    SessionAccess.RequireModule(Request, conexion, "ventas", SecurityPolicy.Read);

                    string sql = @"
                        SELECT v.id_venta,
                               COALESCE(v.folio, CONCAT('F-', v.id_venta)) AS folio,
                               v.fecha,
                               v.fecha_vencimiento,
                               v.total,
                               v.forma_pago,
                               v.tipo_documento,
                               c.id_cliente,
                               c.nombre AS cliente_nombre,
                               c.rut AS cliente_rut,
                               c.tipo_cliente
                        FROM VENTA v
                        INNER JOIN CLIENTE c ON c.id_cliente = v.id_cliente
                        WHERE v.estado = 'pendiente' ";

                    if (!string.IsNullOrWhiteSpace(cliente))
                    {
                        sql += " AND (c.nombre LIKE @cliente OR c.rut LIKE @cliente) ";
                    }

                    sql += " ORDER BY v.fecha ASC";

                    using (var cmd = new MySqlCommand(sql, conexion))
                    {
                        if (!string.IsNullOrWhiteSpace(cliente))
                        {
                            cmd.Parameters.AddWithValue("@cliente", "%" + cliente.Trim() + "%");
                        }

                        using (var lector = cmd.ExecuteReader())
                        {
                            DateTime hoy = DateTime.Today;

                            while (lector.Read())
                            {
                                decimal monto = Convert.ToDecimal(lector["total"]);
                                saldoTotal += monto;

                                DateTime fechaEmision = Convert.ToDateTime(lector["fecha"]).Date;
                                DateTime fechaVence = lector["fecha_vencimiento"] == DBNull.Value
                                    ? fechaEmision.AddDays(30)
                                    : Convert.ToDateTime(lector["fecha_vencimiento"]).Date;

                                int diasMora = (int)(hoy - fechaVence).TotalDays;
                                string tramo;

                                if (diasMora <= 0)
                                {
                                    tramo = "Vigente (Al día)";
                                    vigentes++;
                                    diasMora = 0;
                                }
                                else if (diasMora <= 30)
                                {
                                    tramo = "1 - 30 días mora";
                                    mora30++;
                                }
                                else if (diasMora <= 60)
                                {
                                    tramo = "31 - 60 días mora";
                                    mora60++;
                                }
                                else
                                {
                                    tramo = "+60 días mora";
                                    mora90Mas++;
                                }

                                documentos.Add(new
                                {
                                    id_venta = Convert.ToInt32(lector["id_venta"]),
                                    folio = lector["folio"].ToString(),
                                    fecha_emision = fechaEmision.ToString("yyyy-MM-dd"),
                                    fecha_vencimiento = fechaVence.ToString("yyyy-MM-dd"),
                                    dias_mora = diasMora,
                                    tramo = tramo,
                                    monto_total = monto,
                                    saldo_pendiente = monto,
                                    cliente = new
                                    {
                                        id = Convert.ToInt32(lector["id_cliente"]),
                                        nombre = lector["cliente_nombre"].ToString(),
                                        rut = lector["cliente_rut"].ToString(),
                                        tipo = lector["tipo_cliente"].ToString()
                                    }
                                });
                            }
                        }
                    }
                }

                return Json(new
                {
                    success = true,
                    total_documentos = documentos.Count,
                    saldo_total_pendiente = saldoTotal,
                    resumen_tramos = new
                    {
                        vigentes = vigentes,
                        mora_30 = mora30,
                        mora_60 = mora60,
                        mora_90_mas = mora90Mas
                    },
                    reporte = documentos
                }, JsonRequestBehavior.AllowGet);
            }
            catch (HttpException ex) { return AccessError(ex); }
            catch (Exception ex)
            {
                System.Diagnostics.Trace.TraceError("Error cuentas por cobrar: {0}", ex);
                return ErrorInterno("No se pudo generar el reporte de cuentas por cobrar.");
            }
        }

        // ============================================================
        // REPORTE 4: ROTACIÓN DE VENTAS (TOP SELLERS VS STOCK MUERTO) (RF-V19, RF-V22)
        // GET: /Ventas/ReporteRotacionVentas?desde=...&hasta=...&filtro=...
        // ============================================================
        [HttpGet]
        public JsonResult ReporteRotacionVentas(string desde = null, string hasta = null, string filtro = "todos")
        {
            try
            {
                var lista = new List<object>();

                using (var conexion = CrearConexion())
                {
                    conexion.Open();
                    SessionAccess.RequireModule(Request, conexion, "ventas", SecurityPolicy.Read);

                    string sql = @"
                        SELECT l.isbn,
                               l.titulo,
                               l.autor,
                               l.categoria,
                               COALESCE(e.nombre, 'Sin Editorial') AS editorial,
                               l.stock_actual,
                               COALESCE(SUM(dv.cantidad), 0) AS unidades_vendidas,
                               COALESCE(SUM(dv.cantidad * dv.precio_unitario), 0) AS total_ventas,
                               MAX(v.fecha) AS ultima_venta
                        FROM LIBRO l
                        LEFT JOIN EDITORIAL e ON e.id_editorial = l.id_editorial
                        LEFT JOIN DETALLE_VENTA dv ON dv.isbn = l.isbn
                        LEFT JOIN VENTA v ON v.id_venta = dv.id_venta AND v.estado = 'pagado'
                                          AND (@desde IS NULL OR v.fecha >= @desde)
                                          AND (@hasta IS NULL OR v.fecha < DATE_ADD(@hasta, INTERVAL 1 DAY))
                        WHERE l.activo = TRUE
                        GROUP BY l.isbn, l.titulo, l.autor, l.categoria, e.nombre, l.stock_actual
                        ORDER BY unidades_vendidas DESC, l.stock_actual DESC";

                    using (var cmd = new MySqlCommand(sql, conexion))
                    {
                        cmd.Parameters.AddWithValue("@desde", string.IsNullOrWhiteSpace(desde) ? (object)DBNull.Value : DateTime.Parse(desde).Date);
                        cmd.Parameters.AddWithValue("@hasta", string.IsNullOrWhiteSpace(hasta) ? (object)DBNull.Value : DateTime.Parse(hasta).Date);

                        DateTime hoy = DateTime.Today;

                        using (var lector = cmd.ExecuteReader())
                        {
                            while (lector.Read())
                            {
                                int stock = Convert.ToInt32(lector["stock_actual"]);
                                int vendidas = Convert.ToInt32(lector["unidades_vendidas"]);
                                decimal totalVentas = Convert.ToDecimal(lector["total_ventas"]);

                                string ultimaVentaStr = "Sin ventas";
                                int diasSinVender = 999;

                                if (lector["ultima_venta"] != DBNull.Value)
                                {
                                    DateTime ultima = Convert.ToDateTime(lector["ultima_venta"]);
                                    ultimaVentaStr = ultima.ToString("yyyy-MM-dd");
                                    diasSinVender = (int)(hoy - ultima.Date).TotalDays;
                                }

                                string clasificacion = vendidas > 10 ? "Alta rotación" : (vendidas > 0 ? "Rotación media" : "Stock muerto");

                                if (filtro == "top" && vendidas == 0) continue;
                                if (filtro == "muerto" && vendidas > 0) continue;

                                lista.Add(new
                                {
                                    isbn = lector["isbn"].ToString(),
                                    titulo = lector["titulo"].ToString(),
                                    autor = lector["autor"].ToString(),
                                    categoria = lector["categoria"].ToString(),
                                    editorial = lector["editorial"].ToString(),
                                    stock_actual = stock,
                                    unidades_vendidas = vendidas,
                                    total_ventas = totalVentas,
                                    ultima_venta = ultimaVentaStr,
                                    dias_sin_vender = diasSinVender,
                                    clasificacion = clasificacion
                                });
                            }
                        }
                    }
                }

                return Json(new { success = true, reporte = lista }, JsonRequestBehavior.AllowGet);
            }
            catch (HttpException ex) { return AccessError(ex); }
            catch (Exception ex)
            {
                System.Diagnostics.Trace.TraceError("Error rotación de ventas: {0}", ex);
                return ErrorInterno("No se pudo generar el reporte de rotación de ventas.");
            }
        }

        // ============================================================
        // REPORTE 5: VENTAS POR CANAL Y SUCURSAL (RF-V20)
        // GET: /Ventas/ReporteVentasCanal?desde=...&hasta=...
        // ============================================================
        [HttpGet]
        public JsonResult ReporteVentasCanal(string desde = null, string hasta = null)
        {
            try
            {
                var canales = new List<object>();
                decimal granTotal = 0m;
                int granCantidad = 0;

                using (var conexion = CrearConexion())
                {
                    conexion.Open();
                    SessionAccess.RequireModule(Request, conexion, "ventas", SecurityPolicy.Read);

                    string sql = @"
                        SELECT v.canal,
                               COUNT(v.id_venta) AS cantidad_operaciones,
                               COALESCE(SUM(v.neto), 0) AS total_neto,
                               COALESCE(SUM(v.iva), 0) AS total_iva,
                               COALESCE(SUM(v.descuento), 0) AS total_descuento,
                               COALESCE(SUM(v.total), 0) AS total_recaudado
                        FROM VENTA v
                        WHERE v.estado = 'pagado' ";

                    if (!string.IsNullOrWhiteSpace(desde)) sql += " AND v.fecha >= @desde ";
                    if (!string.IsNullOrWhiteSpace(hasta)) sql += " AND v.fecha < DATE_ADD(@hasta, INTERVAL 1 DAY) ";

                    sql += " GROUP BY v.canal ORDER BY total_recaudado DESC";

                    using (var cmd = new MySqlCommand(sql, conexion))
                    {
                        if (!string.IsNullOrWhiteSpace(desde)) cmd.Parameters.AddWithValue("@desde", DateTime.Parse(desde).Date);
                        if (!string.IsNullOrWhiteSpace(hasta)) cmd.Parameters.AddWithValue("@hasta", DateTime.Parse(hasta).Date);

                        using (var lector = cmd.ExecuteReader())
                        {
                            while (lector.Read())
                            {
                                int operaciones = Convert.ToInt32(lector["cantidad_operaciones"]);
                                decimal recaudado = Convert.ToDecimal(lector["total_recaudado"]);

                                granCantidad += operaciones;
                                granTotal += recaudado;

                                decimal promedio = operaciones > 0 ? Math.Round(recaudado / operaciones, 0) : 0m;

                                canales.Add(new
                                {
                                    canal = lector["canal"].ToString(),
                                    cantidad_operaciones = operaciones,
                                    total_neto = Convert.ToDecimal(lector["total_neto"]),
                                    total_iva = Convert.ToDecimal(lector["total_iva"]),
                                    total_descuento = Convert.ToDecimal(lector["total_descuento"]),
                                    total_recaudado = recaudado,
                                    ticket_promedio = promedio
                                });
                            }
                        }
                    }
                }

                return Json(new
                {
                    success = true,
                    total_ventas = granCantidad,
                    total_general = granTotal,
                    reporte = canales
                }, JsonRequestBehavior.AllowGet);
            }
            catch (HttpException ex) { return AccessError(ex); }
            catch (Exception ex)
            {
                System.Diagnostics.Trace.TraceError("Error ventas por canal: {0}", ex);
                return ErrorInterno("No se pudo generar el reporte de ventas por canal.");
            }
        }

        // ============================================================
        // DTOs auxiliares
        // ============================================================
        public class ClienteDto
        {
            public int id_cliente { get; set; }
            public string rut { get; set; }
            public string nombre { get; set; }
            public string correo { get; set; }
            public string telefono { get; set; }
            public string direccion { get; set; }
            public string tipo_cliente { get; set; }
            public decimal? limite_credito { get; set; }
        }

        public class NotaCreditoRequest
        {
            public int id_venta { get; set; }
            public string motivo { get; set; }
            public string destino_fisico { get; set; } // 'reingreso' o 'desecho'
            public string folio { get; set; }
        }

        public class PedidoRequest
        {
            public int id_cliente { get; set; }
            public string tipo { get; set; } // 'cotizacion' o 'pedido'
            public string estado { get; set; }
            public List<DetallePedidoItem> detalles { get; set; }
        }

        public class DetallePedidoItem
        {
            public string isbn { get; set; }
            public int cantidad { get; set; }
            public decimal precio_unitario { get; set; }
        }

        public class ReservaRequest
        {
            public int id_cliente { get; set; }
            public string isbn { get; set; }
            public int cantidad { get; set; }
        }

        public class PromocionDto
        {
            public int id_promocion { get; set; }
            public string nombre { get; set; }
            public string descripcion { get; set; }
            public string tipo { get; set; }
            public decimal valor { get; set; }
            public string categoria { get; set; }
            public string isbn { get; set; }
            public string fecha_inicio { get; set; }
            public string fecha_fin { get; set; }
            public bool activo { get; set; }
        }

        private class DetalleCalculado
        {
            public string isbn { get; set; }
            public int cantidad { get; set; }
            public decimal precio_unitario { get; set; }
        }

        // ============================================================
        // Helpers de Conexión y Error
        // ============================================================
        private static MySqlConnection CrearConexion()
        {
            return new MySqlConnection(
                ConfigurationManager
                    .ConnectionStrings["ConexionMySQL"]
                    .ConnectionString
            );
        }

        private JsonResult AccessError(HttpException ex)
        {
            Response.StatusCode = ex.GetHttpCode();
            Response.TrySkipIisCustomErrors = true;
            return Json(new { success = false, error = ex.Message }, JsonRequestBehavior.AllowGet);
        }

        private JsonResult ErrorInterno(string mensaje)
        {
            Response.StatusCode = 503;
            Response.TrySkipIisCustomErrors = true;
            return Json(new { success = false, error = mensaje }, JsonRequestBehavior.AllowGet);
        }
    }
}
