using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Net;
using System.Text.RegularExpressions;
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
        private static readonly Regex CorreoRegex = new Regex(
            @"^[^@\s]+@[^@\s]+\.[^@\s]+$",
            RegexOptions.Compiled | RegexOptions.IgnoreCase);

        [HttpGet]
        [Route("")]
        public IHttpActionResult GetAll(
            [FromUri] string buscar = null,
            [FromUri] bool soloActivos = false,
            [FromUri] string estado = null,
            [FromUri] string categoria = null)
        {
            HttpContext.Current.Response.Cache.SetNoStore();
            var proveedores = new List<ProveedorDto>();
            try
            {
                using (var conn = DbConnectionFactory.CreateConnection())
                {
                    SessionAccess.RequireModule(new HttpRequestWrapper(HttpContext.Current.Request), conn, "compras", SecurityPolicy.Read);

                    string sql = @"
                        SELECT id_proveedor, rut, razon_social, contacto, correo,
                               condicion_pago, limite_credito, dias_credito, categorias, activo
                        FROM PROVEEDOR
                        WHERE 1=1";

                    string estadoNorm = string.IsNullOrWhiteSpace(estado) ? null : estado.Trim().ToLowerInvariant();
                    if (soloActivos || estadoNorm == "activo")
                    {
                        sql += " AND activo = TRUE";
                    }
                    else if (estadoNorm == "inactivo")
                    {
                        sql += " AND activo = FALSE";
                    }

                    if (!string.IsNullOrWhiteSpace(buscar))
                    {
                        sql += " AND (rut LIKE @buscar OR razon_social LIKE @buscar)";
                    }

                    string categoriaNorm = string.IsNullOrWhiteSpace(categoria) ? null : categoria.Trim();
                    if (categoriaNorm != null)
                    {
                        sql += " AND FIND_IN_SET(@categoria, categorias) > 0";
                    }

                    sql += " ORDER BY razon_social, rut";

                    using (var cmd = new MySqlCommand(sql, conn))
                    {
                        if (!string.IsNullOrWhiteSpace(buscar))
                        {
                            cmd.Parameters.AddWithValue("@buscar", "%" + buscar.Trim() + "%");
                        }

                        if (categoriaNorm != null)
                        {
                            cmd.Parameters.AddWithValue("@categoria", categoriaNorm);
                        }

                        using (var reader = cmd.ExecuteReader())
                        {
                            while (reader.Read())
                            {
                                proveedores.Add(MapReaderToDto(reader));
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
        [Route("categorias")]
        public IHttpActionResult GetCategoriasDisponibles()
        {
            HttpContext.Current.Response.Cache.SetNoStore();
            try
            {
                using (var conn = DbConnectionFactory.CreateConnection())
                {
                    SessionAccess.RequireModule(new HttpRequestWrapper(HttpContext.Current.Request), conn, "compras", SecurityPolicy.Read);
                    var categorias = ObtenerCategoriasValidasLibro(conn);
                    return Ok(categorias);
                }
            }
            catch (HttpException ex)
            {
                return Content((HttpStatusCode)ex.GetHttpCode(), new { error = ex.Message });
            }
            catch (Exception ex)
            {
                System.Diagnostics.Trace.TraceError("Error al consultar categorías de libros para proveedores: {0}", ex);
                return Content(HttpStatusCode.ServiceUnavailable, new { error = "No se pudieron obtener las categorías." });
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

                    var proveedor = ObtenerProveedorPorId(conn, id);
                    if (proveedor == null)
                    {
                        return Content(HttpStatusCode.NotFound, new { error = "Proveedor no encontrado." });
                    }

                    return Ok(proveedor);
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
            if (!ValidarCamposBasicos(
                dto,
                out string rutFormateado,
                out string razonSocial,
                out string contacto,
                out string correo,
                out string condicionPago,
                out decimal limiteCredito,
                out int diasCredito,
                out string errorValidacion))
            {
                return Content(HttpStatusCode.BadRequest, new { error = errorValidacion });
            }

            bool activo = dto.Activo;

            try
            {
                using (var conn = DbConnectionFactory.CreateConnection())
                {
                    var actor = SessionAccess.RequireModule(new HttpRequestWrapper(HttpContext.Current.Request), conn, "compras", SecurityPolicy.Edit);

                    if (!ValidarYNormalizarCategorias(conn, dto.Categorias, out string categoriasCsv, out List<string> categoriasLimpias, out string errorCategorias))
                    {
                        return Content(HttpStatusCode.BadRequest, new { error = errorCategorias });
                    }

                    var existente = BuscarProveedorPorRut(conn, rutFormateado, null);
                    if (existente != null)
                    {
                        return Content(HttpStatusCode.Conflict, new
                        {
                            error = "El proveedor ya está registrado.",
                            proveedorExistente = existente
                        });
                    }

                    const string insertSql = @"
                        INSERT INTO PROVEEDOR (
                            rut, razon_social, contacto, correo, condicion_pago,
                            limite_credito, dias_credito, categorias, activo
                        )
                        VALUES (
                            @rut, @razon_social, @contacto, @correo, @condicion_pago,
                            @limite_credito, @dias_credito, @categorias, @activo
                        );
                        SELECT LAST_INSERT_ID();";

                    using (var transaction = conn.BeginTransaction())
                    using (var cmd = new MySqlCommand(insertSql, conn, transaction))
                    {
                        cmd.Parameters.AddWithValue("@rut", rutFormateado);
                        cmd.Parameters.AddWithValue("@razon_social", razonSocial);
                        cmd.Parameters.AddWithValue("@contacto", (object)contacto ?? DBNull.Value);
                        cmd.Parameters.AddWithValue("@correo", (object)correo ?? DBNull.Value);
                        cmd.Parameters.AddWithValue("@condicion_pago", (object)condicionPago ?? DBNull.Value);
                        cmd.Parameters.AddWithValue("@limite_credito", limiteCredito);
                        cmd.Parameters.AddWithValue("@dias_credito", diasCredito);
                        cmd.Parameters.AddWithValue("@categorias", (object)categoriasCsv ?? DBNull.Value);
                        cmd.Parameters.AddWithValue("@activo", activo);

                        int newId = Convert.ToInt32(cmd.ExecuteScalar());
                        SecurityPolicy.Log(conn, transaction, actor, "compras", "Crear proveedor", "Proveedor #" + newId);
                        transaction.Commit();

                        var nuevo = new ProveedorDto
                        {
                            IdProveedor = newId,
                            Rut = rutFormateado,
                            RazonSocial = razonSocial,
                            Contacto = contacto,
                            Correo = correo,
                            CondicionPago = condicionPago,
                            LimiteCredito = limiteCredito,
                            DiasCredito = diasCredito,
                            Categorias = categoriasLimpias,
                            CategoriasTexto = categoriasCsv,
                            Activo = activo
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
                return Content(HttpStatusCode.Conflict, new { error = "El proveedor ya está registrado." });
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
            if (!ValidarCamposBasicos(
                dto,
                out string rutFormateado,
                out string razonSocial,
                out string contacto,
                out string correo,
                out string condicionPago,
                out decimal limiteCredito,
                out int diasCredito,
                out string errorValidacion))
            {
                return Content(HttpStatusCode.BadRequest, new { error = errorValidacion });
            }

            bool activo = dto.Activo;

            try
            {
                using (var conn = DbConnectionFactory.CreateConnection())
                {
                    var actor = SessionAccess.RequireModule(new HttpRequestWrapper(HttpContext.Current.Request), conn, "compras", SecurityPolicy.Edit);

                    var actual = ObtenerProveedorPorId(conn, id);
                    if (actual == null)
                    {
                        return Content(HttpStatusCode.NotFound, new { error = "Proveedor no encontrado." });
                    }

                    if (!ValidarYNormalizarCategorias(conn, dto.Categorias, out string categoriasCsv, out List<string> categoriasLimpias, out string errorCategorias))
                    {
                        return Content(HttpStatusCode.BadRequest, new { error = errorCategorias });
                    }

                    var existente = BuscarProveedorPorRut(conn, rutFormateado, id);
                    if (existente != null)
                    {
                        return Content(HttpStatusCode.Conflict, new
                        {
                            error = "El proveedor ya está registrado.",
                            proveedorExistente = existente
                        });
                    }

                    const string updateSql = @"
                        UPDATE PROVEEDOR
                        SET rut = @rut,
                            razon_social = @razon_social,
                            contacto = @contacto,
                            correo = @correo,
                            condicion_pago = @condicion_pago,
                            limite_credito = @limite_credito,
                            dias_credito = @dias_credito,
                            categorias = @categorias,
                            activo = @activo
                        WHERE id_proveedor = @id";

                    using (var transaction = conn.BeginTransaction())
                    using (var cmd = new MySqlCommand(updateSql, conn, transaction))
                    {
                        cmd.Parameters.AddWithValue("@id", id);
                        cmd.Parameters.AddWithValue("@rut", rutFormateado);
                        cmd.Parameters.AddWithValue("@razon_social", razonSocial);
                        cmd.Parameters.AddWithValue("@contacto", (object)contacto ?? DBNull.Value);
                        cmd.Parameters.AddWithValue("@correo", (object)correo ?? DBNull.Value);
                        cmd.Parameters.AddWithValue("@condicion_pago", (object)condicionPago ?? DBNull.Value);
                        cmd.Parameters.AddWithValue("@limite_credito", limiteCredito);
                        cmd.Parameters.AddWithValue("@dias_credito", diasCredito);
                        cmd.Parameters.AddWithValue("@categorias", (object)categoriasCsv ?? DBNull.Value);
                        cmd.Parameters.AddWithValue("@activo", activo);

                        cmd.ExecuteNonQuery();
                        SecurityPolicy.Log(conn, transaction, actor, "compras", "Editar proveedor", "Proveedor #" + id);
                        transaction.Commit();

                        var actualizado = new ProveedorDto
                        {
                            IdProveedor = id,
                            Rut = rutFormateado,
                            RazonSocial = razonSocial,
                            Contacto = contacto,
                            Correo = correo,
                            CondicionPago = condicionPago,
                            LimiteCredito = limiteCredito,
                            DiasCredito = diasCredito,
                            Categorias = categoriasLimpias,
                            CategoriasTexto = categoriasCsv,
                            Activo = activo
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
                return Content(HttpStatusCode.Conflict, new { error = "El proveedor ya está registrado." });
            }
            catch (Exception ex)
            {
                System.Diagnostics.Trace.TraceError("Error al editar proveedor {0}: {1}", id, ex);
                return Content(HttpStatusCode.ServiceUnavailable, new { error = "No se pudo actualizar el proveedor." });
            }
        }

        private static ProveedorDto MapReaderToDto(MySqlDataReader reader)
        {
            string categoriasRaw = reader["categorias"] != DBNull.Value ? reader["categorias"].ToString() : null;
            var listaCategorias = new List<string>();
            if (!string.IsNullOrWhiteSpace(categoriasRaw))
            {
                foreach (var parte in categoriasRaw.Split(','))
                {
                    string limpia = parte.Trim();
                    if (!string.IsNullOrEmpty(limpia))
                    {
                        listaCategorias.Add(limpia);
                    }
                }
            }

            return new ProveedorDto
            {
                IdProveedor = Convert.ToInt32(reader["id_proveedor"]),
                Rut = reader["rut"].ToString(),
                RazonSocial = reader["razon_social"].ToString(),
                Contacto = reader["contacto"] != DBNull.Value ? reader["contacto"].ToString() : null,
                Correo = reader["correo"] != DBNull.Value ? reader["correo"].ToString() : null,
                CondicionPago = reader["condicion_pago"] != DBNull.Value ? reader["condicion_pago"].ToString() : null,
                LimiteCredito = reader["limite_credito"] != DBNull.Value ? Convert.ToDecimal(reader["limite_credito"]) : 0m,
                DiasCredito = reader["dias_credito"] != DBNull.Value ? Convert.ToInt32(reader["dias_credito"]) : 0,
                Categorias = listaCategorias,
                CategoriasTexto = categoriasRaw,
                Activo = reader["activo"] == DBNull.Value || Convert.ToBoolean(reader["activo"])
            };
        }

        private static ProveedorDto ObtenerProveedorPorId(MySqlConnection conn, int id)
        {
            const string sql = @"
                SELECT id_proveedor, rut, razon_social, contacto, correo,
                       condicion_pago, limite_credito, dias_credito, categorias, activo
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
                        return null;
                    }
                    return MapReaderToDto(reader);
                }
            }
        }

        private static ProveedorDto BuscarProveedorPorRut(MySqlConnection conn, string rut, int? excluirId)
        {
            string sql = @"
                SELECT id_proveedor, rut, razon_social, contacto, correo,
                       condicion_pago, limite_credito, dias_credito, categorias, activo
                FROM PROVEEDOR
                WHERE rut = @rut";

            if (excluirId.HasValue)
            {
                sql += " AND id_proveedor != @excluirId";
            }

            sql += " LIMIT 1";

            using (var cmd = new MySqlCommand(sql, conn))
            {
                cmd.Parameters.AddWithValue("@rut", rut);
                if (excluirId.HasValue)
                {
                    cmd.Parameters.AddWithValue("@excluirId", excluirId.Value);
                }

                using (var reader = cmd.ExecuteReader())
                {
                    if (!reader.Read())
                    {
                        return null;
                    }
                    return MapReaderToDto(reader);
                }
            }
        }

        private static List<string> ObtenerCategoriasValidasLibro(MySqlConnection conn)
        {
            var categorias = new List<string>();
            const string sql = @"
                SELECT DISTINCT TRIM(categoria) AS categoria
                FROM LIBRO
                WHERE categoria IS NOT NULL
                  AND TRIM(categoria) <> ''
                ORDER BY categoria ASC";

            using (var cmd = new MySqlCommand(sql, conn))
            using (var reader = cmd.ExecuteReader())
            {
                while (reader.Read())
                {
                    categorias.Add(reader["categoria"].ToString());
                }
            }
            return categorias;
        }

        private static bool ValidarCamposBasicos(
            ProveedorDto dto,
            out string rutFormateado,
            out string razonSocial,
            out string contacto,
            out string correo,
            out string condicionPago,
            out decimal limiteCredito,
            out int diasCredito,
            out string error)
        {
            rutFormateado = null;
            razonSocial = null;
            contacto = null;
            correo = null;
            condicionPago = null;
            limiteCredito = 0m;
            diasCredito = 0;
            error = null;

            if (dto == null)
            {
                error = "Datos del proveedor no proporcionados.";
                return false;
            }

            if (string.IsNullOrWhiteSpace(dto.Rut))
            {
                error = "El RUT es obligatorio.";
                return false;
            }

            if (string.IsNullOrWhiteSpace(dto.RazonSocial))
            {
                error = "La razón social es obligatoria.";
                return false;
            }

            if (!TryNormalizeRut(dto.Rut, out rutFormateado, out string errorRut))
            {
                error = errorRut;
                return false;
            }

            if (rutFormateado.Length > 15)
            {
                error = "El RUT no puede superar 15 caracteres.";
                return false;
            }

            razonSocial = dto.RazonSocial.Trim();
            if (razonSocial.Length > 150)
            {
                error = "La razón social no puede superar 150 caracteres.";
                return false;
            }

            contacto = string.IsNullOrWhiteSpace(dto.Contacto) ? null : dto.Contacto.Trim();
            if (contacto != null && contacto.Length > 150)
            {
                error = "El contacto no puede superar 150 caracteres.";
                return false;
            }

            correo = string.IsNullOrWhiteSpace(dto.Correo) ? null : dto.Correo.Trim();
            if (correo != null)
            {
                if (correo.Length > 100)
                {
                    error = "El correo no puede superar 100 caracteres.";
                    return false;
                }

                if (!CorreoRegex.IsMatch(correo))
                {
                    error = "El formato del correo electrónico no es válido.";
                    return false;
                }
            }

            condicionPago = string.IsNullOrWhiteSpace(dto.CondicionPago) ? null : dto.CondicionPago.Trim();
            if (condicionPago != null && condicionPago.Length > 80)
            {
                error = "La condición de pago no puede superar 80 caracteres.";
                return false;
            }

            if (dto.LimiteCredito < 0m)
            {
                error = "El límite de crédito no puede ser negativo.";
                return false;
            }

            if (dto.DiasCredito < 0)
            {
                error = "Los días de crédito no pueden ser negativos.";
                return false;
            }

            limiteCredito = Math.Round(dto.LimiteCredito, 2);
            diasCredito = dto.DiasCredito;
            return true;
        }

        private static bool ValidarYNormalizarCategorias(
            MySqlConnection conn,
            List<string> categoriasInput,
            out string categoriasCsv,
            out List<string> categoriasLimpias,
            out string error)
        {
            categoriasCsv = null;
            categoriasLimpias = new List<string>();
            error = null;

            if (categoriasInput == null || categoriasInput.Count == 0)
            {
                return true;
            }

            var catalogoValido = ObtenerCategoriasValidasLibro(conn);
            var mapaCanonico = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (var c in catalogoValido)
            {
                if (!mapaCanonico.ContainsKey(c))
                {
                    mapaCanonico[c] = c;
                }
            }

            var vistos = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            foreach (var item in categoriasInput)
            {
                string normalizada = (item ?? string.Empty).Trim();
                if (string.IsNullOrEmpty(normalizada))
                {
                    error = "Las categorías no pueden contener elementos vacíos o solo espacios.";
                    return false;
                }

                if (normalizada.Contains(","))
                {
                    error = $"La categoría '{normalizada}' no puede contener comas.";
                    return false;
                }

                if (normalizada.Length > 80)
                {
                    error = $"La categoría '{normalizada}' supera el máximo de 80 caracteres.";
                    return false;
                }

                if (!vistos.Add(normalizada))
                {
                    error = $"La categoría '{normalizada}' está duplicada.";
                    return false;
                }

                if (!mapaCanonico.TryGetValue(normalizada, out string canonica))
                {
                    error = $"La categoría '{normalizada}' no existe en el catálogo de libros (LIBRO.categoria).";
                    return false;
                }

                categoriasLimpias.Add(canonica);
            }

            categoriasLimpias = categoriasLimpias.OrderBy(c => c, StringComparer.OrdinalIgnoreCase).ToList();
            categoriasCsv = string.Join(",", categoriasLimpias);

            if (categoriasCsv.Length > 255)
            {
                error = "La lista de categorías seleccionada supera el máximo de 255 caracteres.";
                return false;
            }

            return true;
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
