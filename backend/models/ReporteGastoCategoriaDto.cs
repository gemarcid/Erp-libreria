using System;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace backend.Models
{
    public class CategoriaGastoItemDto
    {
        public string Categoria { get; set; }
        public int UnidadesCompradas { get; set; }
        public int NumeroOrdenes { get; set; }
        public decimal MontoNeto { get; set; }
        public decimal MontoGasto { get; set; }
        public decimal PorcentajeParticipacion { get; set; }
        public bool EsSinCategoria { get; set; }

        [JsonProperty("categoria")]
        public string CategoriaSnake => Categoria;

        [JsonProperty("unidades_compradas")]
        public int UnidadesCompradasSnake => UnidadesCompradas;

        [JsonProperty("numero_ordenes")]
        public int NumeroOrdenesSnake => NumeroOrdenes;

        [JsonProperty("monto_neto")]
        public decimal MontoNetoSnake => MontoNeto;

        [JsonProperty("monto_gasto")]
        public decimal MontoGastoSnake => MontoGasto;

        [JsonProperty("porcentaje_participacion")]
        public decimal PorcentajeParticipacionSnake => PorcentajeParticipacion;

        [JsonProperty("es_sin_categoria")]
        public bool EsSinCategoriaSnake => EsSinCategoria;
    }

    public class ReporteGastoCategoriaRespuestaDto
    {
        public string Desde { get; set; }
        public string Hasta { get; set; }
        public string CategoriaFiltro { get; set; }
        public decimal GastoTotalPeriodo { get; set; }
        public int TotalUnidades { get; set; }
        public int TotalOrdenes { get; set; }
        public string CategoriaMayorGasto { get; set; }
        public decimal MontoMayorGasto { get; set; }
        public decimal PorcentajeMayorGasto { get; set; }
        public bool HaySinCategoria { get; set; }
        public decimal MontoSinCategoria { get; set; }
        public List<string> CategoriasDisponibles { get; set; } = new List<string>();
        public List<CategoriaGastoItemDto> Categorias { get; set; } = new List<CategoriaGastoItemDto>();

        [JsonProperty("desde")]
        public string DesdeSnake => Desde;

        [JsonProperty("hasta")]
        public string HastaSnake => Hasta;

        [JsonProperty("categoria_filtro")]
        public string CategoriaFiltroSnake => CategoriaFiltro;

        [JsonProperty("gasto_total_periodo")]
        public decimal GastoTotalPeriodoSnake => GastoTotalPeriodo;

        [JsonProperty("total_unidades")]
        public int TotalUnidadesSnake => TotalUnidades;

        [JsonProperty("total_ordenes")]
        public int TotalOrdenesSnake => TotalOrdenes;

        [JsonProperty("categoria_mayor_gasto")]
        public string CategoriaMayorGastoSnake => CategoriaMayorGasto;

        [JsonProperty("monto_mayor_gasto")]
        public decimal MontoMayorGastoSnake => MontoMayorGasto;

        [JsonProperty("porcentaje_mayor_gasto")]
        public decimal PorcentajeMayorGastoSnake => PorcentajeMayorGasto;

        [JsonProperty("hay_sin_categoria")]
        public bool HaySinCategoriaSnake => HaySinCategoria;

        [JsonProperty("monto_sin_categoria")]
        public decimal MontoSinCategoriaSnake => MontoSinCategoria;

        [JsonProperty("categorias_disponibles")]
        public List<string> CategoriasDisponiblesSnake => CategoriasDisponibles;

        [JsonProperty("categorias")]
        public List<CategoriaGastoItemDto> CategoriasSnake => Categorias;
    }
}

