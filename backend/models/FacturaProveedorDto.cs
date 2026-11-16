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

    public class LineaConciliacionFacturaDto
    {
        public string Isbn { get; set; }
        public string Titulo { get; set; }
        public int CantidadPedida { get; set; }
        public int CantidadRecibida { get; set; }
        public int DiferenciaCantidad { get; set; }
        public decimal PrecioPactado { get; set; }
        public decimal IvaPorcentaje { get; set; }
        public decimal SubtotalNetoEsperado { get; set; }
        public decimal IvaEsperado { get; set; }
        public decimal TotalEsperadoLinea { get; set; }

        [JsonProperty("isbn")]
        public string IsbnSnake => Isbn;

        [JsonProperty("titulo")]
        public string TituloSnake => Titulo;

        [JsonProperty("cantidad_pedida")]
        public int CantidadPedidaSnake => CantidadPedida;

        [JsonProperty("cantidad_recibida")]
        public int CantidadRecibidaSnake => CantidadRecibida;

        [JsonProperty("diferencia_cantidad")]
        public int DiferenciaCantidadSnake => DiferenciaCantidad;

        [JsonProperty("precio_pactado")]
        public decimal PrecioPactadoSnake => PrecioPactado;

        [JsonProperty("iva_porcentaje")]
        public decimal IvaPorcentajeSnake => IvaPorcentaje;

        [JsonProperty("subtotal_neto_esperado")]
        public decimal SubtotalNetoEsperadoSnake => SubtotalNetoEsperado;

        [JsonProperty("iva_esperado")]
        public decimal IvaEsperadoSnake => IvaEsperado;

        [JsonProperty("total_esperado_linea")]
        public decimal TotalEsperadoLineaSnake => TotalEsperadoLinea;
    }

    public class EvaluacionConciliacionFacturaDto
    {
        public FacturaProveedorDto Factura { get; set; }
        public string EstadoOrden { get; set; }
        public decimal NetoFactura { get; set; }
        public decimal IvaFactura { get; set; }
        public decimal TotalFactura { get; set; }
        public decimal NetoEsperado { get; set; }
        public decimal IvaEsperado { get; set; }
        public decimal TotalEsperado { get; set; }
        public decimal DiferenciaNeto { get; set; }
        public decimal DiferenciaIva { get; set; }
        public decimal DiferenciaTotal { get; set; }
        public decimal ToleranciaRedondeo { get; set; } = 1.00m;
        public bool HayDiferenciaCantidad { get; set; }
        public bool HayDiferenciaMonto { get; set; }
        public bool Cuadra { get; set; }
        public string EstadoActualizado { get; set; }
        public List<LineaConciliacionFacturaDto> Lineas { get; set; } = new List<LineaConciliacionFacturaDto>();

        [JsonProperty("factura")]
        public FacturaProveedorDto FacturaSnake => Factura;

        [JsonProperty("estado_orden")]
        public string EstadoOrdenSnake => EstadoOrden;

        [JsonProperty("neto_factura")]
        public decimal NetoFacturaSnake => NetoFactura;

        [JsonProperty("iva_factura")]
        public decimal IvaFacturaSnake => IvaFactura;

        [JsonProperty("total_factura")]
        public decimal TotalFacturaSnake => TotalFactura;

        [JsonProperty("neto_esperado")]
        public decimal NetoEsperadoSnake => NetoEsperado;

        [JsonProperty("iva_esperado")]
        public decimal IvaEsperadoSnake => IvaEsperado;

        [JsonProperty("total_esperado")]
        public decimal TotalEsperadoSnake => TotalEsperado;

        [JsonProperty("diferencia_neto")]
        public decimal DiferenciaNetoSnake => DiferenciaNeto;

        [JsonProperty("diferencia_iva")]
        public decimal DiferenciaIvaSnake => DiferenciaIva;

        [JsonProperty("diferencia_total")]
        public decimal DiferenciaTotalSnake => DiferenciaTotal;

        [JsonProperty("tolerancia_redondeo")]
        public decimal ToleranciaRedondeoSnake => ToleranciaRedondeo;

        [JsonProperty("hay_diferencia_cantidad")]
        public bool HayDiferenciaCantidadSnake => HayDiferenciaCantidad;

        [JsonProperty("hay_diferencia_monto")]
        public bool HayDiferenciaMontoSnake => HayDiferenciaMonto;

        [JsonProperty("cuadra")]
        public bool CuadraSnake => Cuadra;

        [JsonProperty("estado_actualizado")]
        public string EstadoActualizadoSnake => EstadoActualizado;

        [JsonProperty("lineas")]
        public List<LineaConciliacionFacturaDto> LineasSnake => Lineas;
    }

    public class ProgramarPagoFacturaRequestDto
    {
        public string FechaPago { get; set; }

        [JsonProperty("fecha_pago")]
        private string FechaPagoSnake { set { if (string.IsNullOrEmpty(FechaPago)) FechaPago = value; } }
    }
}

