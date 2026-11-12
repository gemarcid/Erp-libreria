using System.Collections.Generic;
using Newtonsoft.Json;

namespace backend.Models
{
    public class VariacionPrecioDestacadoDto
    {
        public string Isbn { get; set; }
        public string LibroTitulo { get; set; }
        public int IdProveedor { get; set; }
        public string ProveedorNombre { get; set; }
        public int IdOc { get; set; }
        public string Fecha { get; set; }
        public decimal PrecioAnterior { get; set; }
        public decimal PrecioActual { get; set; }
        public decimal VariacionMonto { get; set; }
        public decimal VariacionPorcentaje { get; set; }

        [JsonProperty("libro_titulo")]
        public string LibroTituloSnake => LibroTitulo;

        [JsonProperty("id_proveedor")]
        public int IdProveedorSnake => IdProveedor;

        [JsonProperty("proveedor_nombre")]
        public string ProveedorNombreSnake => ProveedorNombre;

        [JsonProperty("id_oc")]
        public int IdOcSnake => IdOc;

        [JsonProperty("precio_anterior")]
        public decimal PrecioAnteriorSnake => PrecioAnterior;

        [JsonProperty("precio_actual")]
        public decimal PrecioActualSnake => PrecioActual;

        [JsonProperty("variacion_monto")]
        public decimal VariacionMontoSnake => VariacionMonto;

        [JsonProperty("variacion_porcentaje")]
        public decimal VariacionPorcentajeSnake => VariacionPorcentaje;
    }

    public class VariacionPrecioFilaDto
    {
        public int IdOc { get; set; }
        public string Fecha { get; set; }
        public string Isbn { get; set; }
        public string LibroTitulo { get; set; }
        public int IdProveedor { get; set; }
        public string ProveedorNombre { get; set; }
        public decimal PrecioPactado { get; set; }
        public decimal? PrecioAnterior { get; set; }
        public decimal? VariacionMonto { get; set; }
        public decimal? VariacionPorcentaje { get; set; }

        [JsonProperty("id_oc")]
        public int IdOcSnake => IdOc;

        [JsonProperty("libro_titulo")]
        public string LibroTituloSnake => LibroTitulo;

        [JsonProperty("id_proveedor")]
        public int IdProveedorSnake => IdProveedor;

        [JsonProperty("proveedor_nombre")]
        public string ProveedorNombreSnake => ProveedorNombre;

        [JsonProperty("precio_pactado")]
        public decimal PrecioPactadoSnake => PrecioPactado;

        [JsonProperty("precio_anterior")]
        public decimal? PrecioAnteriorSnake => PrecioAnterior;

        [JsonProperty("variacion_monto")]
        public decimal? VariacionMontoSnake => VariacionMonto;

        [JsonProperty("variacion_porcentaje")]
        public decimal? VariacionPorcentajeSnake => VariacionPorcentaje;
    }

    public class ReporteVariacionPreciosResponseDto
    {
        public string Desde { get; set; }
        public string Hasta { get; set; }
        public int TotalCompras { get; set; }
        public bool UnicaCompraSinVariacion { get; set; }
        public VariacionPrecioDestacadoDto MayorAlza { get; set; }
        public VariacionPrecioDestacadoDto MayorBaja { get; set; }
        public List<VariacionPrecioFilaDto> Filas { get; set; } = new List<VariacionPrecioFilaDto>();

        [JsonProperty("total_compras")]
        public int TotalComprasSnake => TotalCompras;

        [JsonProperty("unica_compra_sin_variacion")]
        public bool UnicaCompraSinVariacionSnake => UnicaCompraSinVariacion;

        [JsonProperty("mayor_alza")]
        public VariacionPrecioDestacadoDto MayorAlzaSnake => MayorAlza;

        [JsonProperty("mayor_baja")]
        public VariacionPrecioDestacadoDto MayorBajaSnake => MayorBaja;
    }
}

