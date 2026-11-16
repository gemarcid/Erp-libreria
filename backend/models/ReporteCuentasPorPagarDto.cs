using System;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace backend.Models
{
    public class TramoCuentasPorPagarDto
    {
        public string Codigo { get; set; }
        public string Etiqueta { get; set; }
        public int CantidadFacturas { get; set; }
        public decimal MontoTotal { get; set; }

        [JsonProperty("codigo")]
        public string CodigoSnake => Codigo;

        [JsonProperty("etiqueta")]
        public string EtiquetaSnake => Etiqueta;

        [JsonProperty("cantidad_facturas")]
        public int CantidadFacturasSnake => CantidadFacturas;

        [JsonProperty("monto_total")]
        public decimal MontoTotalSnake => MontoTotal;
    }

    public class FacturaPorPagarDetalleDto
    {
        public int IdFactura { get; set; }
        public int IdOc { get; set; }
        public int IdProveedor { get; set; }
        public string ProveedorNombre { get; set; }
        public string NroFactura { get; set; }
        public string FechaEmision { get; set; }
        public string FechaVencimiento { get; set; }
        public string FechaPagoProgramada { get; set; }
        public int DiasDiferencia { get; set; }
        public int DiasAtraso { get; set; }
        public int DiasParaVencer { get; set; }
        public string TramoCodigo { get; set; }
        public string TramoEtiqueta { get; set; }
        public string NivelAlerta { get; set; }
        public decimal MontoTotal { get; set; }
        public string EstadoFactura { get; set; }

        [JsonProperty("id_factura")]
        public int IdFacturaSnake => IdFactura;

        [JsonProperty("id_oc")]
        public int IdOcSnake => IdOc;

        [JsonProperty("id_proveedor")]
        public int IdProveedorSnake => IdProveedor;

        [JsonProperty("proveedor")]
        public string ProveedorSnake => ProveedorNombre;

        [JsonProperty("nro_factura")]
        public string NroFacturaSnake => NroFactura;

        [JsonProperty("fecha_emision")]
        public string FechaEmisionSnake => FechaEmision;

        [JsonProperty("fecha_vencimiento")]
        public string FechaVencimientoSnake => FechaVencimiento;

        [JsonProperty("fecha_pago_programada")]
        public string FechaPagoProgramadaSnake => FechaPagoProgramada;

        [JsonProperty("dias_diferencia")]
        public int DiasDiferenciaSnake => DiasDiferencia;

        [JsonProperty("dias_atraso")]
        public int DiasAtrasoSnake => DiasAtraso;

        [JsonProperty("dias_para_vencer")]
        public int DiasParaVencerSnake => DiasParaVencer;

        [JsonProperty("tramo_codigo")]
        public string TramoCodigoSnake => TramoCodigo;

        [JsonProperty("tramo_etiqueta")]
        public string TramoEtiquetaSnake => TramoEtiqueta;

        [JsonProperty("nivel_alerta")]
        public string NivelAlertaSnake => NivelAlerta;

        [JsonProperty("monto_total")]
        public decimal MontoTotalSnake => MontoTotal;

        [JsonProperty("estado_factura")]
        public string EstadoFacturaSnake => EstadoFactura;
    }

    public class ReporteCuentasPorPagarRespuestaDto
    {
        public string FechaCorte { get; set; }
        public int? IdProveedor { get; set; }
        public int TotalFacturas { get; set; }
        public decimal TotalPendientePago { get; set; }
        public List<TramoCuentasPorPagarDto> Tramos { get; set; } = new List<TramoCuentasPorPagarDto>();
        public List<FacturaPorPagarDetalleDto> Facturas { get; set; } = new List<FacturaPorPagarDetalleDto>();

        [JsonProperty("fecha_corte")]
        public string FechaCorteSnake => FechaCorte;

        [JsonProperty("id_proveedor")]
        public int? IdProveedorSnake => IdProveedor;

        [JsonProperty("total_facturas")]
        public int TotalFacturasSnake => TotalFacturas;

        [JsonProperty("total_pendiente_pago")]
        public decimal TotalPendientePagoSnake => TotalPendientePago;

        [JsonProperty("tramos")]
        public List<TramoCuentasPorPagarDto> TramosSnake => Tramos;

        [JsonProperty("facturas")]
        public List<FacturaPorPagarDetalleDto> FacturasSnake => Facturas;
    }
}

