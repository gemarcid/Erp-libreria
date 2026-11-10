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
    [RoutePrefix("api/proveedores")]
    public class ProveedoresController : ApiController
    {
        [HttpGet]
        [Route("")]
        public IHttpActionResult GetAll([FromUri] string buscar = null)
        {
            HttpContext.Current.Response.Cache.SetNoStore();
            var proveedores = new List<ProveedorDto>();
            try
            {
                using (var conn = DbConnectionFactory.CreateConnection())
                {
                    SessionAccess.RequireModule(new HttpRequestWrapper(HttpContext.Current.Request), conn, "compras", SecurityPolicy.Read);

                    string sql = @"
                        SELECT id_proveedor, rut, razon_social, contacto, condicion_pago
                        FROM PROVEEDOR";

                    if (!string.IsNullOrWhiteSpace(buscar))
                    {
                        sql += " WHERE rut LIKE @buscar OR razon_social LIKE @buscar";
                    }

                    sql += " ORDER BY razon_social, rut";

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
                                proveedores.Add(new ProveedorDto
                                {
                                    IdProveedor = Convert.ToInt32(reader["id_proveedor"]),
                                    Rut = reader["rut"].ToString(),
                                    RazonSocial = reader["razon_social"].ToString(),
                                    Contacto = reader["contacto"] != DBNull.Value ? reader["contacto"].ToString() : null,
                                    CondicionPago = reader["condicion_pago"] != DBNull.Value ? reader["condicion_pago"].ToString() : null
                                });
                            }
                        }
                    }
                }
                return Ok(proveedores);
            }
            catch (HttpException ex)
            {
                return Content((HttpStatusCode)ex.GetHttpCode(), new { error = ex.Message });
            }
            catch (Exception ex)
            {
                System.Diagnostics.Trace.TraceError("Error al listar proveedores: {0}", ex);
                return Content(HttpStatusCode.ServiceUnavailable, new { error = "No se pudo consultar los proveedores." });
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

                    const string sql = @"
                        SELECT id_proveedor, rut, razon_social, contacto, condicion_pago
                        FROM PROVEEDOR
                        WHERE id_proveedor = @id
                        LIMIT 1";

                    using (var cmd = new MySqlCommand(sql, conn))
                    {
                        cmd.Parameters.AddWithValue("@id", id);
                        using (var reader = cmd.ExecuteReader())
                        {
                            if (!reader.Read())
                            {
                                return Content(HttpStatusCode.NotFound, new { error = "Proveedor no encontrado." });
                            }

                            var proveedor = new ProveedorDto
                            {
                                IdProveedor = Convert.ToInt32(reader["id_proveedor"]),
                                Rut = reader["rut"].ToString(),
                                RazonSocial = reader["razon_social"].ToString(),
                                Contacto = reader["contacto"] != DBNull.Value ? reader["contacto"].ToString() : null,
                                CondicionPago = reader["condicion_pago"] != DBNull.Value ? reader["condicion_pago"].ToString() : null
                            };
                            return Ok(proveedor);
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
                System.Diagnostics.Trace.TraceError("Error al consultar proveedor {0}: {1}", id, ex);
                return Content(HttpStatusCode.ServiceUnavailable, new { error = "No se pudo consultar el proveedor." });
            }
        }

        [HttpPost]
        [Route("")]
        public IHttpActionResult Create([FromBody] ProveedorDto dto)
        {
            HttpContext.Current.Response.Cache.SetNoStore();
            if (dto == null)
            {
                return Content(HttpStatusCode.BadRequest, new { error = "Datos del proveedor no proporcionados." });
            }

            if (string.IsNullOrWhiteSpace(dto.Rut))
            {
                return Content(HttpStatusCode.BadRequest, new { error = "El RUT es obligatorio." });
            }

            if (string.IsNullOrWhiteSpace(dto.RazonSocial))
            {
                return Content(HttpStatusCode.BadRequest, new { error = "La razón social es obligatoria." });
            }

            if (!TryNormalizeRut(dto.Rut, out string rutFormateado, out string errorRut))
            {
                return Content(HttpStatusCode.BadRequest, new { error = errorRut });
            }

            if (rutFormateado.Length > 15)
            {
                return Content(HttpStatusCode.BadRequest, new { error = "El RUT no puede superar 15 caracteres." });
            }

            string razonSocial = dto.RazonSocial.Trim();
            if (razonSocial.Length > 150)
            {
                return Content(HttpStatusCode.BadRequest, new { error = "La razón social no puede superar 150 caracteres." });
            }

            string contacto = string.IsNullOrWhiteSpace(dto.Contacto) ? null : dto.Contacto.Trim();
            if (contacto != null && contacto.Length > 150)
            {
                return Content(HttpStatusCode.BadRequest, new { error = "El contacto no puede superar 150 caracteres." });
            }

            string condicionPago = string.IsNullOrWhiteSpace(dto.CondicionPago) ? null : dto.CondicionPago.Trim();
            if (condicionPago != null && condicionPago.Length > 80)
            {
                return Content(HttpStatusCode.BadRequest, new { error = "La condición de pago no puede superar 80 caracteres." });
            }

            try
            {
                using (var conn = DbConnectionFactory.CreateConnection())
                {
                    var actor = SessionAccess.RequireModule(new HttpRequestWrapper(HttpContext.Current.Request), conn, "compras", SecurityPolicy.Edit);

                    const string checkSql = "SELECT COUNT(*) FROM PROVEEDOR WHERE rut = @rut";
                    using (var checkCmd = new MySqlCommand(checkSql, conn))
                    {
                        checkCmd.Parameters.AddWithValue("@rut", rutFormateado);
                        if (Convert.ToInt32(checkCmd.ExecuteScalar()) > 0)
                        {
                            return Content(HttpStatusCode.Conflict, new { error = "El RUT ingresado ya está registrado para otro proveedor." });
                        }
                    }

                    const string insertSql = @"
                        INSERT INTO PROVEEDOR (rut, razon_social, contacto, condicion_pago)
                        VALUES (@rut, @razon_social, @contacto, @condicion_pago);
                        SELECT LAST_INSERT_ID();";

                    using (var transaction = conn.BeginTransaction())
                    using (var cmd = new MySqlCommand(insertSql, conn, transaction))
                    {
                        cmd.Parameters.AddWithValue("@rut", rutFormateado);
                        cmd.Parameters.AddWithValue("@razon_social", razonSocial);
                        cmd.Parameters.AddWithValue("@contacto", (object)contacto ?? DBNull.Value);
                        cmd.Parameters.AddWithValue("@condicion_pago", (object)condicionPago ?? DBNull.Value);

                        int newId = Convert.ToInt32(cmd.ExecuteScalar());
                        SecurityPolicy.Log(conn, transaction, actor, "compras", "Crear proveedor", "Proveedor #" + newId);
                        transaction.Commit();

                        var nuevo = new ProveedorDto
                        {
                            IdProveedor = newId,
                            Rut = rutFormateado,
                            RazonSocial = razonSocial,
                            Contacto = contacto,
                            CondicionPago = condicionPago
                        };

                        return Content(HttpStatusCode.Created, nuevo);
                    }
                }
            }
            catch (HttpException ex)
            {
                return Content((HttpStatusCode)ex.GetHttpCode(), new { error = ex.Message });
            }
            catch (MySqlException ex) when (ex.Number == 1062)
            {
                return Content(HttpStatusCode.Conflict, new { error = "El RUT ingresado ya está registrado para otro proveedor." });
            }
            catch (Exception ex)
            {
                System.Diagnostics.Trace.TraceError("Error al crear proveedor: {0}", ex);
                return Content(HttpStatusCode.ServiceUnavailable, new { error = "No se pudo registrar el proveedor." });
            }
        }

        [HttpPut]
        [Route("{id:int}")]
        public IHttpActionResult Update(int id, [FromBody] ProveedorDto dto)
        {
            HttpContext.Current.Response.Cache.SetNoStore();
            if (dto == null)
            {
                return Content(HttpStatusCode.BadRequest, new { error = "Datos del proveedor no proporcionados." });
            }

            if (string.IsNullOrWhiteSpace(dto.Rut))
            {
                return Content(HttpStatusCode.BadRequest, new { error = "El RUT es obligatorio." });
            }

            if (string.IsNullOrWhiteSpace(dto.RazonSocial))
            {
                return Content(HttpStatusCode.BadRequest, new { error = "La razón social es obligatoria." });
            }

            if (!TryNormalizeRut(dto.Rut, out string rutFormateado, out string errorRut))
            {
                return Content(HttpStatusCode.BadRequest, new { error = errorRut });
            }

            if (rutFormateado.Length > 15)
            {
                return Content(HttpStatusCode.BadRequest, new { error = "El RUT no puede superar 15 caracteres." });
            }

            string razonSocial = dto.RazonSocial.Trim();
            if (razonSocial.Length > 150)
            {
                return Content(HttpStatusCode.BadRequest, new { error = "La razón social no puede superar 150 caracteres." });
            }

            string contacto = string.IsNullOrWhiteSpace(dto.Contacto) ? null : dto.Contacto.Trim();
            if (contacto != null && contacto.Length > 150)
            {
                return Content(HttpStatusCode.BadRequest, new { error = "El contacto no puede superar 150 caracteres." });
            }

            string condicionPago = string.IsNullOrWhiteSpace(dto.CondicionPago) ? null : dto.CondicionPago.Trim();
            if (condicionPago != null && condicionPago.Length > 80)
            {
                return Content(HttpStatusCode.BadRequest, new { error = "La condición de pago no puede superar 80 caracteres." });
            }

            try
            {
                using (var conn = DbConnectionFactory.CreateConnection())
                {
                    var actor = SessionAccess.RequireModule(new HttpRequestWrapper(HttpContext.Current.Request), conn, "compras", SecurityPolicy.Edit);

                    const string existsSql = "SELECT COUNT(*) FROM PROVEEDOR WHERE id_proveedor = @id";
                    using (var existsCmd = new MySqlCommand(existsSql, conn))
                    {
                        existsCmd.Parameters.AddWithValue("@id", id);
                        if (Convert.ToInt32(existsCmd.ExecuteScalar()) == 0)
                        {
                            return Content(HttpStatusCode.NotFound, new { error = "Proveedor no encontrado." });
                        }
                    }

                    const string duplicateSql = "SELECT COUNT(*) FROM PROVEEDOR WHERE rut = @rut AND id_proveedor != @id";
                    using (var dupCmd = new MySqlCommand(duplicateSql, conn))
                    {
                        dupCmd.Parameters.AddWithValue("@rut", rutFormateado);
                        dupCmd.Parameters.AddWithValue("@id", id);
                        if (Convert.ToInt32(dupCmd.ExecuteScalar()) > 0)
                        {
                            return Content(HttpStatusCode.Conflict, new { error = "El RUT ingresado ya está registrado para otro proveedor." });
                        }
                    }

                    const string updateSql = @"
                        UPDATE PROVEEDOR
                        SET rut = @rut, razon_social = @razon_social, contacto = @contacto, condicion_pago = @condicion_pago
                        WHERE id_proveedor = @id";

                    using (var transaction = conn.BeginTransaction())
                    using (var cmd = new MySqlCommand(updateSql, conn, transaction))
                    {
                        cmd.Parameters.AddWithValue("@id", id);
                        cmd.Parameters.AddWithValue("@rut", rutFormateado);
                        cmd.Parameters.AddWithValue("@razon_social", razonSocial);
                        cmd.Parameters.AddWithValue("@contacto", (object)contacto ?? DBNull.Value);
                        cmd.Parameters.AddWithValue("@condicion_pago", (object)condicionPago ?? DBNull.Value);

                        cmd.ExecuteNonQuery();
                        SecurityPolicy.Log(conn, transaction, actor, "compras", "Editar proveedor", "Proveedor #" + id);
                        transaction.Commit();

                        var actualizado = new ProveedorDto
                        {
                            IdProveedor = id,
                            Rut = rutFormateado,
                            RazonSocial = razonSocial,
                            Contacto = contacto,
                            CondicionPago = condicionPago
                        };

                        return Ok(actualizado);
                    }
                }
            }
            catch (HttpException ex)
            {
                return Content((HttpStatusCode)ex.GetHttpCode(), new { error = ex.Message });
            }
            catch (MySqlException ex) when (ex.Number == 1062)
            {
                return Content(HttpStatusCode.Conflict, new { error = "El RUT ingresado ya está registrado para otro proveedor." });
            }
            catch (Exception ex)
            {
                System.Diagnostics.Trace.TraceError("Error al editar proveedor {0}: {1}", id, ex);
                return Content(HttpStatusCode.ServiceUnavailable, new { error = "No se pudo actualizar el proveedor." });
            }
        }

        private static bool TryNormalizeRut(string rutInput, out string formattedRut, out string error)
        {
            formattedRut = null;
            if (string.IsNullOrWhiteSpace(rutInput))
            {
                error = "El RUT es obligatorio.";
                return false;
            }

            string clean = rutInput.Trim().Replace(".", "").Replace("-", "").ToUpperInvariant();
            if (clean.Length < 7 || clean.Length > 9)
            {
                error = "El RUT debe contener entre 6 y 8 dígitos más el dígito verificador.";
                return false;
            }

            string cuerpo = clean.Substring(0, clean.Length - 1);
            char dv = clean[clean.Length - 1];

            if (!long.TryParse(cuerpo, out long numero) || numero <= 0)
            {
                error = "El cuerpo del RUT debe ser numérico.";
                return false;
            }

            int suma = 0;
            int multiplicador = 2;
            for (int i = cuerpo.Length - 1; i >= 0; i--)
            {
                suma += (cuerpo[i] - '0') * multiplicador;
                multiplicador = multiplicador == 7 ? 2 : multiplicador + 1;
            }

            int resto = 11 - (suma % 11);
            char dvEsperado;
            if (resto == 11)
                dvEsperado = '0';
            else if (resto == 10)
                dvEsperado = 'K';
            else
                dvEsperado = (char)('0' + resto);

            if (dv != dvEsperado)
            {
                error = "El dígito verificador del RUT no es válido.";
                return false;
            }

            formattedRut = string.Format(CultureInfo.GetCultureInfo("es-CL"), "{0:#,##0}-{1}", numero, dvEsperado);
            error = null;
            return true;
        }
    }
}
