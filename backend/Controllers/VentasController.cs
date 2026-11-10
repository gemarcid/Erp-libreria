using System;
using System.Collections.Generic;
using System.Configuration;
using System.Web.Mvc;
using MySql.Data.MySqlClient;
using System.Data;
using System.Web;
using backend.Models;

namespace backend.Controllers
{
    public class VentasController : Controller
    {
        // ============================================================
        // GET: /Ventas/Libros?buscar=...
        // Buscar libros disponibles para agregar al carrito
        // ============================================================
        [HttpGet]
        public JsonResult Libros(string buscar = "")
        {
            try
            {
                var libros = new List<object>();

                using (var conexion = CrearConexion())
                using (var comando = new MySqlCommand(
                    @"SELECT isbn,
                             titulo,
                             autor,
                             categoria,
                             precio_venta,
                             stock_actual
                      FROM LIBRO
                      WHERE activo = TRUE
                        AND (
                            isbn LIKE @buscar
                            OR titulo LIKE @buscar
                            OR autor LIKE @buscar
                        )
                      ORDER BY titulo
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
                            libros.Add(new
                            {
                                isbn = lector["isbn"].ToString(),
                                titulo = lector["titulo"].ToString(),
                                autor = lector["autor"].ToString(),
                                categoria = lector["categoria"].ToString(),
                                precio_venta = Convert.ToDecimal(lector["precio_venta"]),
                                stock_actual = Convert.ToInt32(lector["stock_actual"])
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
                System.Diagnostics.Trace.TraceError(
                    "Error al buscar libros: {0}",
                    ex.GetType().Name
                );

                Response.StatusCode = 503;
                Response.TrySkipIisCustomErrors = true;

                return Json(new
                {
                    success = false,
                    error = "No se pudieron consultar los libros."
                }, JsonRequestBehavior.AllowGet);
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
                                puntos_fidelidad = Convert.ToInt32(
                                    lector["puntos_fidelidad"]
                                )
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
                System.Diagnostics.Trace.TraceError(
                    "Error al buscar clientes: {0}",
                    ex.GetType().Name
                );

                Response.StatusCode = 503;
                Response.TrySkipIisCustomErrors = true;

                return Json(new
                {
                    success = false,
                    error = "No se pudieron consultar los clientes."
                }, JsonRequestBehavior.AllowGet);
            }
        }


        // ============================================================
        // POST: /Ventas/Registrar
        // Registrar una nueva venta
        // ============================================================
        [HttpPost]
        public JsonResult Registrar(VentaRequest venta)
        {
            if (venta == null)
            {
                Response.StatusCode = 400;
                Response.TrySkipIisCustomErrors = true;

                return Json(new
                {
                    success = false,
                    error = "No se recibieron los datos de la venta."
                });
            }

            if (venta.id_cliente <= 0)
            {
                Response.StatusCode = 400;
                Response.TrySkipIisCustomErrors = true;

                return Json(new
                {
                    success = false,
                    error = "Debes seleccionar un cliente."
                });
            }

            if (venta.id_usuario <= 0)
            {
                Response.StatusCode = 400;
                Response.TrySkipIisCustomErrors = true;

                return Json(new
                {
                    success = false,
                    error = "No se pudo identificar al usuario."
                });
            }

            if (venta.detalles == null || venta.detalles.Count == 0)
            {
                Response.StatusCode = 400;
                Response.TrySkipIisCustomErrors = true;

                return Json(new
                {
                    success = false,
                    error = "La venta debe contener al menos un producto."
                });
            }

            var formaPago = string.IsNullOrWhiteSpace(venta.forma_pago)
                ? "efectivo" : venta.forma_pago.Trim().ToLowerInvariant();
            if (formaPago != "efectivo" && formaPago != "tarjeta" && formaPago != "transferencia")
            {
                Response.StatusCode = 400;
                Response.TrySkipIisCustomErrors = true;
                return Json(new { success = false, error = "La forma de pago no es válida." });
            }

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
                            // ====================================================
                            // 1. Validar que exista el cliente
                            // ====================================================
                            using (var comandoCliente = new MySqlCommand(
                                @"SELECT COUNT(*)
                          FROM CLIENTE
                          WHERE id_cliente = @id_cliente",
                                conexion,
                                transaccion))
                            {
                                comandoCliente.Parameters.AddWithValue(
                                    "@id_cliente",
                                    venta.id_cliente
                                );

                                int existeCliente = Convert.ToInt32(
                                    comandoCliente.ExecuteScalar()
                                );

                                if (existeCliente == 0)
                                {
                                    transaccion.Rollback();

                                    Response.StatusCode = 400;
                                    Response.TrySkipIisCustomErrors = true;

                                    return Json(new
                                    {
                                        success = false,
                                        error = "El cliente seleccionado no existe."
                                    });
                                }
                            }

                            // ====================================================
                            // 2. Validar usuario
                            // ====================================================
                            using (var comandoUsuario = new MySqlCommand(
                                @"SELECT COUNT(*)
                          FROM USUARIO
                          WHERE id_usuario = @id_usuario
                            AND estado = 'activo'",
                                conexion,
                                transaccion))
                            {
                                comandoUsuario.Parameters.AddWithValue(
                                    "@id_usuario",
                                    venta.id_usuario
                                );

                                int existeUsuario = Convert.ToInt32(
                                    comandoUsuario.ExecuteScalar()
                                );

                                if (existeUsuario == 0)
                                {
                                    transaccion.Rollback();

                                    Response.StatusCode = 400;
                                    Response.TrySkipIisCustomErrors = true;

                                    return Json(new
                                    {
                                        success = false,
                                        error = "El usuario no existe o está inactivo."
                                    });
                                }
                            }

                            decimal neto = 0m;
                            decimal costo = 0m;

                            var detallesVenta = new List<DetalleCalculado>();

                            // ====================================================
                            // 3. Buscar precios y validar stock
                            // ====================================================
                            foreach (var detalle in venta.detalles)
                            {
                                if (detalle == null ||
                                    string.IsNullOrWhiteSpace(detalle.isbn) ||
                                    detalle.cantidad <= 0)
                                {
                                    transaccion.Rollback();

                                    Response.StatusCode = 400;
                                    Response.TrySkipIisCustomErrors = true;

                                    return Json(new
                                    {
                                        success = false,
                                        error = "Uno de los productos de la venta no es válido."
                                    });
                                }

                                using (var comandoLibro = new MySqlCommand(
                                    @"SELECT titulo,
                                     precio_venta,
                                     costo_unitario,
                                     stock_actual
                              FROM LIBRO
                              WHERE isbn = @isbn
                                AND activo = TRUE
                              FOR UPDATE",
                                    conexion,
                                    transaccion))
                                {
                                    comandoLibro.Parameters.AddWithValue(
                                        "@isbn",
                                        detalle.isbn.Trim()
                                    );

                                    using (var lector = comandoLibro.ExecuteReader())
                                    {
                                        if (!lector.Read())
                                        {
                                            transaccion.Rollback();

                                            Response.StatusCode = 400;
                                            Response.TrySkipIisCustomErrors = true;

                                            return Json(new
                                            {
                                                success = false,
                                                error = "El libro " + detalle.isbn +
                                                        " no existe o está inactivo."
                                            });
                                        }

                                        string titulo = lector["titulo"].ToString();

                                        decimal precio = Convert.ToDecimal(
                                            lector["precio_venta"]
                                        );

                                        int stock = Convert.ToInt32(
                                            lector["stock_actual"]
                                        );

                                        if (stock < detalle.cantidad)
                                        {
                                            transaccion.Rollback();

                                            Response.StatusCode = 400;
                                            Response.TrySkipIisCustomErrors = true;

                                            return Json(new
                                            {
                                                success = false,
                                                error = "Stock insuficiente para el libro: " +
                                                        titulo +
                                                        ". Stock disponible: " +
                                                        stock
                                            });
                                        }

                                        decimal subtotal =
                                            precio * detalle.cantidad;

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

                            // ====================================================
                            // 4. Calcular IVA y total
                            // ====================================================
                            decimal descuento = 0m;

                            decimal iva = Math.Round(
                                neto * 0.19m,
                                2
                            );

                            decimal total = neto + iva - descuento;

                            // ====================================================
                            // 5. Insertar VENTA
                            // ====================================================
                            int idVenta;

                            using (var comandoVenta = new MySqlCommand(
                                @"INSERT INTO VENTA
                          (
                              id_cliente,
                              id_usuario,
                              fecha,
                              canal,
                              forma_pago,
                              tipo_documento,
                              neto,
                              iva,
                              descuento,
                              total,
                              estado
                          )
                          VALUES
                          (
                              @id_cliente,
                              @id_usuario,
                              NOW(),
                              @canal,
                              @forma_pago,
                              @tipo_documento,
                              @neto,
                              @iva,
                              @descuento,
                              @total,
                              'pagado'
                          );

                          SELECT LAST_INSERT_ID();",
                                conexion,
                                transaccion))
                            {
                                comandoVenta.Parameters.AddWithValue(
                                    "@id_cliente",
                                    venta.id_cliente
                                );

                                comandoVenta.Parameters.AddWithValue(
                                    "@id_usuario",
                                    venta.id_usuario
                                );

                                comandoVenta.Parameters.AddWithValue(
                                    "@canal",
                                    string.IsNullOrWhiteSpace(venta.canal)
                                        ? "tienda"
                                        : venta.canal.Trim()
                                );

                                comandoVenta.Parameters.AddWithValue(
                                    "@forma_pago",
                                    formaPago
                                );

                                comandoVenta.Parameters.AddWithValue(
                                    "@tipo_documento",
                                    string.IsNullOrWhiteSpace(venta.tipo_documento)
                                        ? "boleta"
                                        : venta.tipo_documento.Trim()
                                );

                                comandoVenta.Parameters.AddWithValue(
                                    "@neto",
                                    neto
                                );

                                comandoVenta.Parameters.AddWithValue(
                                    "@iva",
                                    iva
                                );

                                comandoVenta.Parameters.AddWithValue(
                                    "@descuento",
                                    descuento
                                );

                                comandoVenta.Parameters.AddWithValue(
                                    "@total",
                                    total
                                );

                                idVenta = Convert.ToInt32(
                                    comandoVenta.ExecuteScalar()
                                );
                            }

                            // ====================================================
                            // 6. Insertar DETALLE_VENTA y descontar stock
                            // ====================================================
                            foreach (var detalle in detallesVenta)
                            {
                                using (var comandoDetalle = new MySqlCommand(
                                    @"INSERT INTO DETALLE_VENTA
                              (
                                  id_venta,
                                  isbn,
                                  cantidad,
                                  precio_unitario
                              )
                              VALUES
                              (
                                  @id_venta,
                                  @isbn,
                                  @cantidad,
                                  @precio_unitario
                              )",
                                    conexion,
                                    transaccion))
                                {
                                    comandoDetalle.Parameters.AddWithValue(
                                        "@id_venta",
                                        idVenta
                                    );

                                    comandoDetalle.Parameters.AddWithValue(
                                        "@isbn",
                                        detalle.isbn
                                    );

                                    comandoDetalle.Parameters.AddWithValue(
                                        "@cantidad",
                                        detalle.cantidad
                                    );

                                    comandoDetalle.Parameters.AddWithValue(
                                        "@precio_unitario",
                                        detalle.precio_unitario
                                    );

                                    comandoDetalle.ExecuteNonQuery();
                                }

                                // --------------------------------------------
                                // Descontar stock
                                // --------------------------------------------
                                using (var comandoStock = new MySqlCommand(
                                    @"UPDATE LIBRO
                              SET stock_actual = stock_actual - @cantidad
                              WHERE isbn = @isbn
                                AND stock_actual >= @cantidad",
                                    conexion,
                                    transaccion))
                                {
                                    comandoStock.Parameters.AddWithValue(
                                        "@cantidad",
                                        detalle.cantidad
                                    );

                                    comandoStock.Parameters.AddWithValue(
                                        "@isbn",
                                        detalle.isbn
                                    );

                                    int filas = comandoStock.ExecuteNonQuery();

                                    if (filas != 1)
                                    {
                                        throw new Exception(
                                            "No se pudo actualizar el stock del libro " +
                                            detalle.isbn
                                        );
                                    }
                                }

                                // --------------------------------------------
                                // Registrar movimiento de stock
                                // --------------------------------------------
                                using (var comandoMovimiento = new MySqlCommand(
                                    @"INSERT INTO MOVIMIENTO_STOCK
                              (
                                  isbn,
                                  id_usuario,
                                  id_venta,
                                  fecha,
                                  tipo_movimiento,
                                  motivo,
                                  cantidad
                              )
                              VALUES
                              (
                                  @isbn,
                                  @id_usuario,
                                  @id_venta,
                                  NOW(),
                                  'salida',
                                  'Venta',
                                  @cantidad
                              )",
                                    conexion,
                                    transaccion))
                                {
                                    comandoMovimiento.Parameters.AddWithValue(
                                        "@isbn",
                                        detalle.isbn
                                    );

                                    comandoMovimiento.Parameters.AddWithValue(
                                        "@id_usuario",
                                        venta.id_usuario
                                    );

                                    comandoMovimiento.Parameters.AddWithValue(
                                        "@id_venta",
                                        idVenta
                                    );

                                    comandoMovimiento.Parameters.AddWithValue(
                                        "@cantidad",
                                        detalle.cantidad
                                    );

                                    comandoMovimiento.ExecuteNonQuery();
                                }
                            }

                            // ====================================================
                            // 7. Registrar el asiento antes de confirmar la operación
                            // ====================================================
                            int idAsiento = VentaAccounting.Register(conexion, transaccion,
                                idVenta, venta.id_usuario, formaPago, neto, iva, total, costo);
                            SecurityPolicy.Log(conexion, transaccion, venta.id_usuario, "ventas", "Registrar venta", "Venta #" + idVenta);
                            SecurityPolicy.Log(conexion, transaccion, venta.id_usuario, "contabilidad", "Generar asiento automático",
                                "Asiento #" + idAsiento + " · Venta #" + idVenta);
                            transaccion.Commit();

                            return Json(new
                            {
                                success = true,
                                mensaje = "Venta registrada correctamente en ventas y contabilidad.",
                                id_venta = idVenta,
                                id_asiento = idAsiento,
                                neto,
                                iva,
                                descuento,
                                total
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
            catch (HttpException ex)
            {
                Response.StatusCode = ex.GetHttpCode();
                Response.TrySkipIisCustomErrors = true;
                return Json(new { success = false, error = ex.Message });
            }
            catch (Exception ex)
            {
                System.Diagnostics.Trace.TraceError(
                    "Error al registrar venta: {0}",
                    ex
                );

                Response.StatusCode = 503;
                Response.TrySkipIisCustomErrors = true;

                return Json(new
                {
                    success = false,
                    error = "No se pudo registrar la venta."
                });
            }
        }

        // ============================================================
        // GET: /Ventas/ReporteClientes?desde=2026-10-01&hasta=2026-10-08
        // Ranking Pareto de ventas por cliente
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
                        Response.TrySkipIisCustomErrors = true;

                        return Json(new
                        {
                            success = false,
                            error = "La fecha desde no es válida."
                        }, JsonRequestBehavior.AllowGet);
                    }

                    fechaDesde = fecha.Date;
                }

                if (!string.IsNullOrWhiteSpace(hasta))
                {
                    DateTime fecha;

                    if (!DateTime.TryParse(hasta, out fecha))
                    {
                        Response.StatusCode = 400;
                        Response.TrySkipIisCustomErrors = true;

                        return Json(new
                        {
                            success = false,
                            error = "La fecha hasta no es válida."
                        }, JsonRequestBehavior.AllowGet);
                    }

                    fechaHasta = fecha.Date;
                }

                if (fechaDesde.HasValue &&
                    fechaHasta.HasValue &&
                    fechaDesde.Value > fechaHasta.Value)
                {
                    Response.StatusCode = 400;
                    Response.TrySkipIisCustomErrors = true;

                    return Json(new
                    {
                        success = false,
                        error = "La fecha desde no puede ser posterior a la fecha hasta."
                    }, JsonRequestBehavior.AllowGet);
                }

                var filas = new List<dynamic>();

                using (var conexion = CrearConexion())
                {
                    conexion.Open();
                    SessionAccess.RequireModule(Request, conexion, "ventas", SecurityPolicy.Read);

                    string sql = @"
                SELECT
                    c.id_cliente,
                    c.rut,
                    c.nombre,
                    COUNT(v.id_venta) AS cantidad_ventas,
                    COALESCE(SUM(v.total), 0) AS total_vendido
                FROM VENTA v
                INNER JOIN CLIENTE c
                    ON c.id_cliente = v.id_cliente
                WHERE v.estado = 'pagado'
            ";

                    if (fechaDesde.HasValue)
                    {
                        sql += @"
                    AND v.fecha >= @desde
                ";
                    }

                    if (fechaHasta.HasValue)
                    {
                        sql += @"
                    AND v.fecha < DATE_ADD(@hasta, INTERVAL 1 DAY)
                ";
                    }

                    sql += @"
                GROUP BY
                    c.id_cliente,
                    c.rut,
                    c.nombre
                ORDER BY total_vendido DESC
            ";

                    using (var comando = new MySqlCommand(sql, conexion))
                    {
                        if (fechaDesde.HasValue)
                        {
                            comando.Parameters.AddWithValue(
                                "@desde",
                                fechaDesde.Value
                            );
                        }

                        if (fechaHasta.HasValue)
                        {
                            comando.Parameters.AddWithValue(
                                "@hasta",
                                fechaHasta.Value
                            );
                        }

                        using (var lector = comando.ExecuteReader())
                        {
                            while (lector.Read())
                            {
                                filas.Add(new
                                {
                                    id_cliente = Convert.ToInt32(
                                        lector["id_cliente"]
                                    ),
                                    rut = lector["rut"].ToString(),
                                    nombre = lector["nombre"].ToString(),
                                    cantidad_ventas = Convert.ToInt32(
                                        lector["cantidad_ventas"]
                                    ),
                                    total_vendido = Convert.ToDecimal(
                                        lector["total_vendido"]
                                    )
                                });
                            }
                        }
                    }
                }

                decimal totalGeneral = 0m;

                foreach (var fila in filas)
                {
                    totalGeneral += fila.total_vendido;
                }

                decimal acumulado = 0m;
                var reporte = new List<object>();

                int posicion = 1;

                foreach (var fila in filas)
                {
                    decimal porcentaje = totalGeneral > 0
                        ? Math.Round(
                            (fila.total_vendido / totalGeneral) * 100m,
                            2
                        )
                        : 0m;

                    acumulado += porcentaje;

                    reporte.Add(new
                    {
                        posicion,
                        id_cliente = fila.id_cliente,
                        rut = fila.rut,
                        nombre = fila.nombre,
                        cantidad_ventas = fila.cantidad_ventas,
                        total_vendido = fila.total_vendido,
                        porcentaje = porcentaje,
                        porcentaje_acumulado = Math.Round(acumulado, 2)
                    });

                    posicion++;
                }

                int totalVentas = 0;

                foreach (var fila in filas)
                {
                    totalVentas += fila.cantidad_ventas;
                }

                return Json(new
                {
                    success = true,
                    total_clientes = reporte.Count,
                    total_ventas = totalVentas,
                    total_vendido = totalGeneral,
                    reporte
                }, JsonRequestBehavior.AllowGet);
            }
            catch (HttpException ex) { return AccessError(ex); }
            catch (Exception ex)
            {
                System.Diagnostics.Trace.TraceError(
                    "Error al generar reporte de ventas por cliente: {0}",
                    ex
                );

                Response.StatusCode = 503;
                Response.TrySkipIisCustomErrors = true;

                return Json(new
                {
                    success = false,
                    error = "No se pudo generar el reporte de ventas por cliente."
                }, JsonRequestBehavior.AllowGet);
            }
        }

        private class DetalleCalculado
        {
            public string isbn { get; set; }
            public int cantidad { get; set; }
            public decimal precio_unitario { get; set; }
        }


        // ============================================================
        // Conexión a MySQL
        // ============================================================
        private static MySqlConnection CrearConexion()
        {
            return new MySqlConnection(
                ConfigurationManager
                    .ConnectionStrings["ConexionMySQL"]
                    .ConnectionString
            );
        }

        private JsonResult AccessError(HttpException ex) {
            Response.StatusCode = ex.GetHttpCode();
            Response.TrySkipIisCustomErrors = true;
            return Json(new { error = ex.Message }, JsonRequestBehavior.AllowGet);
        }
    }

    

}
