using System;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace backend.Models
{
    public class LineaOrdenFacturaDto
    {
        public string Isbn { get; set; }
        public string Titulo { get; set; }
        public int Cantidad { get; set; }
        public decimal PrecioPactado { get; set; }
        public decimal IvaPorcentaje { get; set; }
        public decimal SubtotalNeto { get; set; }

        [JsonProperty("isbn")]
        public string IsbnSnake => Isbn;

        [JsonProperty("titulo")]
        public string TituloSnake => Titulo;

        [JsonProperty("cantidad")]
        public int CantidadSnake => Cantidad;

        [JsonProperty("precio_pactado")]
        public decimal PrecioPactadoSnake => PrecioPactado;

        [JsonProperty("iva_porcentaje")]
        public decimal IvaPorcentajeSnake => IvaPorcentaje;

        [JsonProperty("subtotal_neto")]
        public decimal SubtotalNetoSnake => SubtotalNeto;
    }

    public class OrdenPendienteFacturarDto
    {
        public int IdOc { get; set; }
        public int IdProveedor { get; set; }
        public string ProveedorNombre { get; set; }
        public string ProveedorRut { get; set; }
        public string CondicionPago { get; set; }
        public string FechaOrden { get; set; }
        public string Estado { get; set; }
        public decimal NetoSugerido { get; set; }
        public decimal IvaSugerido { get; set; }
        public decimal TotalOrden { get; set; }
        public List<LineaOrdenFacturaDto> Lineas { get; set; } = new List<LineaOrdenFacturaDto>();

        [JsonProperty("id_oc")]
        public int IdOcSnake => IdOc;

        [JsonProperty("id_proveedor")]
        public int IdProveedorSnake => IdProveedor;

        [JsonProperty("proveedor")]
        public string ProveedorSnake => ProveedorNombre;

        [JsonProperty("proveedor_rut")]
        public string ProveedorRutSnake => ProveedorRut;

        [JsonProperty("condicion_pago")]
        public string CondicionPagoSnake => CondicionPago;

        [JsonProperty("fecha_orden")]
        public string FechaOrdenSnake => FechaOrden;

        [JsonProperty("estado")]
        public string EstadoSnake => Estado;

        [JsonProperty("neto_sugerido")]
        public decimal NetoSugeridoSnake => NetoSugerido;

        [JsonProperty("iva_sugerido")]
        public decimal IvaSugeridoSnake => IvaSugerido;

        [JsonProperty("total_orden")]
        public decimal TotalOrdenSnake => TotalOrden;
    }

    public class RegistrarFacturaProveedorRequestDto
    {
        public int IdOc { get; set; }
        public string NroFactura { get; set; }
        public string FechaEmision { get; set; }
        public string FechaVencimiento { get; set; }
        public decimal? MontoNeto { get; set; }
        public decimal? Iva { get; set; }

        [JsonProperty("id_oc")]
        private int IdOcSnake { set { if (IdOc == 0) IdOc = value; } }

        [JsonProperty("nro_factura")]
        private string NroFacturaSnake { set { if (string.IsNullOrEmpty(NroFactura)) NroFactura = value; } }

        [JsonProperty("fecha_emision")]
        private string FechaEmisionSnake { set { if (string.IsNullOrEmpty(FechaEmision)) FechaEmision = value; } }

        [JsonProperty("fecha_vencimiento")]
        private string FechaVencimientoSnake { set { if (string.IsNullOrEmpty(FechaVencimiento)) FechaVencimiento = value; } }

        [JsonProperty("monto_neto")]
        private decimal? MontoNetoSnake { set { if (!MontoNeto.HasValue) MontoNeto = value; } }
    }

    public class FacturaProveedorDto
    {
        public int IdFactura { get; set; }
        public int IdOc { get; set; }
        public int IdProveedor { get; set; }
        public string ProveedorNombre { get; set; }
        public string NroFactura { get; set; }
        public string FechaEmision { get; set; }
        public string FechaVencimiento { get; set; }
        public string FechaPago { get; set; }
        public decimal MontoNeto { get; set; }
        public decimal Iva { get; set; }
        public decimal MontoTotal { get; set; }
        public string EstadoPago { get; set; }

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

        [JsonProperty("fecha_pago")]
        public string FechaPagoSnake => FechaPago;

        [JsonProperty("monto_neto")]
        public decimal MontoNetoSnake => MontoNeto;

        [JsonProperty("iva")]
        public decimal IvaSnake => Iva;

        [JsonProperty("monto_total")]
        public decimal MontoTotalSnake => MontoTotal;

        [JsonProperty("estado_pago")]
        public string EstadoPagoSnake => EstadoPago;
    }
}

