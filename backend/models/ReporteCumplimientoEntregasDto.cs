using System;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace backend.Models
{
    public class CumplimientoProveedorResumenDto
    {
        public int IdProveedor { get; set; }
        public string ProveedorNombre { get; set; }
        public int OrdenesConsideradas { get; set; }
        public int OrdenesATiempo { get; set; }
        public decimal PorcentajeATiempo { get; set; }
        public int CantidadPedidaTotal { get; set; }
        public int CantidadRecibidaTotal { get; set; }
        public decimal PorcentajeCantidad { get; set; }
        public decimal? PromedioDiasAtraso { get; set; }

        [JsonProperty("id_proveedor")]
        public int IdProveedorSnake => IdProveedor;

        [JsonProperty("proveedor")]
        public string ProveedorSnake => ProveedorNombre;

        [JsonProperty("ordenes_consideradas")]
        public int OrdenesConsideradasSnake => OrdenesConsideradas;

        [JsonProperty("ordenes_a_tiempo")]
        public int OrdenesATiempoSnake => OrdenesATiempo;

        [JsonProperty("porcentaje_a_tiempo")]
        public decimal PorcentajeATiempoSnake => PorcentajeATiempo;

        [JsonProperty("cantidad_pedida_total")]
        public int CantidadPedidaTotalSnake => CantidadPedidaTotal;

        [JsonProperty("cantidad_recibida_total")]
        public int CantidadRecibidaTotalSnake => CantidadRecibidaTotal;

        [JsonProperty("porcentaje_cantidad")]
        public decimal PorcentajeCantidadSnake => PorcentajeCantidad;

        [JsonProperty("promedio_dias_atraso")]
        public decimal? PromedioDiasAtrasoSnake => PromedioDiasAtraso;
    }

    public class CumplimientoOrdenDetalleDto
    {
        public int IdOc { get; set; }
        public int IdProveedor { get; set; }
        public string ProveedorNombre { get; set; }
        public string FechaPactada { get; set; }
        public string FechaUltimaRecepcion { get; set; }
        public int CantidadPedida { get; set; }
        public int CantidadRecibida { get; set; }
        public decimal PorcentajeCantidad { get; set; }
        public string EstadoCumplimiento { get; set; }
        public int DiasAtraso { get; set; }
        public string NivelAlerta { get; set; }

        [JsonProperty("id_oc")]
        public int IdOcSnake => IdOc;

        [JsonProperty("id_proveedor")]
        public int IdProveedorSnake => IdProveedor;

        [JsonProperty("proveedor")]
        public string ProveedorSnake => ProveedorNombre;

        [JsonProperty("fecha_pactada")]
        public string FechaPactadaSnake => FechaPactada;

        [JsonProperty("fecha_ultima_recepcion")]
        public string FechaUltimaRecepcionSnake => FechaUltimaRecepcion;

        [JsonProperty("cantidad_pedida")]
        public int CantidadPedidaSnake => CantidadPedida;

        [JsonProperty("cantidad_recibida")]
        public int CantidadRecibidaSnake => CantidadRecibida;

        [JsonProperty("porcentaje_cantidad")]
        public decimal PorcentajeCantidadSnake => PorcentajeCantidad;

        [JsonProperty("estado_cumplimiento")]
        public string EstadoCumplimientoSnake => EstadoCumplimiento;

        [JsonProperty("dias_atraso")]
        public int DiasAtrasoSnake => DiasAtraso;

        [JsonProperty("nivel_alerta")]
        public string NivelAlertaSnake => NivelAlerta;
    }

    public class ReporteCumplimientoEntregasRespuestaDto
    {
        public string Desde { get; set; }
        public string Hasta { get; set; }
        public int? IdProveedor { get; set; }
        public int TotalOrdenesConsideradas { get; set; }
        public decimal PorcentajeATiempoGeneral { get; set; }
        public decimal PorcentajeCantidadGeneral { get; set; }
        public List<CumplimientoProveedorResumenDto> Proveedores { get; set; } = new List<CumplimientoProveedorResumenDto>();
        public List<CumplimientoOrdenDetalleDto> Ordenes { get; set; } = new List<CumplimientoOrdenDetalleDto>();

        [JsonProperty("desde")]
        public string DesdeSnake => Desde;

        [JsonProperty("hasta")]
        public string HastaSnake => Hasta;

        [JsonProperty("id_proveedor")]
        public int? IdProveedorSnake => IdProveedor;

        [JsonProperty("total_ordenes_consideradas")]
        public int TotalOrdenesConsideradasSnake => TotalOrdenesConsideradas;

        [JsonProperty("porcentaje_a_tiempo_general")]
        public decimal PorcentajeATiempoGeneralSnake => PorcentajeATiempoGeneral;

        [JsonProperty("porcentaje_cantidad_general")]
        public decimal PorcentajeCantidadGeneralSnake => PorcentajeCantidadGeneral;

        [JsonProperty("proveedores")]
        public List<CumplimientoProveedorResumenDto> ProveedoresSnake => Proveedores;

        [JsonProperty("ordenes")]
        public List<CumplimientoOrdenDetalleDto> OrdenesSnake => Ordenes;
    }
}

