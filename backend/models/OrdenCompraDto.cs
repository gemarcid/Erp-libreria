using System;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace backend.Models
{
    public class OrdenCompraResumenDto
    {
        public int IdOc { get; set; }
        public int IdProveedor { get; set; }
        public string ProveedorNombre { get; set; }
        public int IdUsuario { get; set; }
        public string UsuarioNombre { get; set; }
        public string Fecha { get; set; }
        public string FechaEntrega { get; set; }
        public decimal Total { get; set; }
        public string Estado { get; set; }
        public string FechaEnvio { get; set; }
        public int IntentosEnvio { get; set; }

        [JsonProperty("id_oc")]
        public int IdOcSnake => IdOc;

        [JsonProperty("razon_social")]
        public string RazonSocialSnake => ProveedorNombre;

        [JsonProperty("fecha_entrega")]
        public string FechaEntregaSnake => FechaEntrega;

        [JsonProperty("fecha_envio")]
        public string FechaEnvioSnake => FechaEnvio;

        [JsonProperty("intentos_envio")]
        public int IntentosEnvioSnake => IntentosEnvio;

        public bool ShouldSerializeIdOcSnake() => false;
        public bool ShouldSerializeRazonSocialSnake() => false;
        public bool ShouldSerializeFechaEntregaSnake() => false;
        public bool ShouldSerializeFechaEnvioSnake() => false;
        public bool ShouldSerializeIntentosEnvioSnake() => false;
    }

    public class OrdenCompraDetalleItemDto
    {
        public int IdDetalleOc { get; set; }
        public string Isbn { get; set; }
        public string Titulo { get; set; }
        public int Cantidad { get; set; }
        public decimal PrecioPactado { get; set; }
        public decimal IvaPorcentaje { get; set; } = 19m;
        public decimal Subtotal { get; set; }

        [JsonProperty("id_detalle_oc")]
        public int IdDetalleOcSnake => IdDetalleOc;

        [JsonProperty("precio_pactado")]
        public decimal PrecioPactadoSnake => PrecioPactado;

        [JsonProperty("iva_porcentaje")]
        public decimal IvaPorcentajeSnake => IvaPorcentaje;

        public bool ShouldSerializeIdDetalleOcSnake() => false;
        public bool ShouldSerializePrecioPactadoSnake() => false;
        public bool ShouldSerializeIvaPorcentajeSnake() => false;
    }

    public class OrdenCompraCompletaDto
    {
        public int IdOc { get; set; }
        public int IdProveedor { get; set; }
        public string ProveedorNombre { get; set; }
        public string ProveedorRut { get; set; }
        public string ProveedorCorreo { get; set; }
        public int IdUsuario { get; set; }
        public string UsuarioNombre { get; set; }
        public string Fecha { get; set; }
        public string FechaEntrega { get; set; }
        public string Estado { get; set; }
        public string FechaEnvio { get; set; }
        public int IntentosEnvio { get; set; }
        public decimal Neto { get; set; }
        public decimal Iva { get; set; }
        public decimal Total { get; set; }
        public List<OrdenCompraDetalleItemDto> Lineas { get; set; } = new List<OrdenCompraDetalleItemDto>();
    }

    public class CrearOrdenLineaDto
    {
        public string Isbn { get; set; }
        public int Cantidad { get; set; }
        public decimal PrecioPactado { get; set; }
        public decimal? IvaPorcentaje { get; set; }

        [JsonProperty("precio_pactado")]
        private decimal PrecioPactadoSnake { set { if (PrecioPactado == 0) PrecioPactado = value; } }

        [JsonProperty("iva_porcentaje")]
        private decimal? IvaPorcentajeSnake { set { if (!IvaPorcentaje.HasValue) IvaPorcentaje = value; } }
    }

    public class CrearOrdenCompraRequestDto
    {
        public int IdProveedor { get; set; }
        public int? IdUsuario { get; set; }
        public DateTime? FechaEntrega { get; set; }
        public List<CrearOrdenLineaDto> Lineas { get; set; } = new List<CrearOrdenLineaDto>();

        [JsonProperty("id_proveedor")]
        private int IdProveedorSnake { set { if (IdProveedor == 0) IdProveedor = value; } }

        [JsonProperty("id_usuario")]
        private int? IdUsuarioSnake { set { if (!IdUsuario.HasValue) IdUsuario = value; } }

        [JsonProperty("fecha_entrega")]
        private DateTime? FechaEntregaSnake { set { if (!FechaEntrega.HasValue) FechaEntrega = value; } }
    }

    public class LibroParaCompraDto
    {
        public string Isbn { get; set; }
        public string Titulo { get; set; }
        public string Autor { get; set; }
        public string Categoria { get; set; }
        public string Editorial { get; set; }
        public decimal CostoUnitario { get; set; }
        public int StockActual { get; set; }
        public bool Activo { get; set; }
    }
}
