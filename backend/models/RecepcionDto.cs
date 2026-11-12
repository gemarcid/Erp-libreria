using System;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace backend.Models
{
    public class LineaPendienteDto
    {
        public string Isbn { get; set; }
        public string Titulo { get; set; }
        public int CantidadPedida { get; set; }
        public int CantidadRecibida { get; set; }
        public int CantidadPendiente { get; set; }

        [JsonProperty("cantidad_pedida")]
        public int CantidadPedidaSnake => CantidadPedida;

        [JsonProperty("cantidad_recibida")]
        public int CantidadRecibidaSnake => CantidadRecibida;

        [JsonProperty("cantidad_pendiente")]
        public int CantidadPendienteSnake => CantidadPendiente;

        public bool ShouldSerializeCantidadPedidaSnake() => false;
        public bool ShouldSerializeCantidadRecibidaSnake() => false;
        public bool ShouldSerializeCantidadPendienteSnake() => false;
    }

    public class OrdenPendienteRecepcionDto
    {
        public int IdOc { get; set; }
        public int IdProveedor { get; set; }
        public string ProveedorNombre { get; set; }
        public string Estado { get; set; }
        public string Fecha { get; set; }
        public string FechaEntrega { get; set; }
        public List<LineaPendienteDto> Lineas { get; set; } = new List<LineaPendienteDto>();

        [JsonProperty("id_oc")]
        public int IdOcSnake => IdOc;

        [JsonProperty("proveedor")]
        public string ProveedorSnake => ProveedorNombre;

        [JsonProperty("estado")]
        public string EstadoSnake => Estado;

        [JsonProperty("fecha_entrega")]
        public string FechaEntregaSnake => FechaEntrega;

        public bool ShouldSerializeIdOcSnake() => false;
        public bool ShouldSerializeProveedorSnake() => false;
        public bool ShouldSerializeEstadoSnake() => false;
        public bool ShouldSerializeFechaEntregaSnake() => false;
    }

    public class LineaRecepcionInputDto
    {
        public string Isbn { get; set; }
        public int Cantidad { get; set; }
    }

    public class RegistrarRecepcionRequestDto
    {
        public int IdOc { get; set; }
        public string TipoDoc { get; set; }
        public string NroDoc { get; set; }
        public int? IdUsuario { get; set; }
        public List<LineaRecepcionInputDto> Lineas { get; set; } = new List<LineaRecepcionInputDto>();

        [JsonProperty("id_oc")]
        private int IdOcSnake { set { if (IdOc == 0) IdOc = value; } }

        [JsonProperty("tipo_doc")]
        private string TipoDocSnake { set { if (string.IsNullOrEmpty(TipoDoc)) TipoDoc = value; } }

        [JsonProperty("nro_doc")]
        private string NroDocSnake { set { if (string.IsNullOrEmpty(NroDoc)) NroDoc = value; } }

        [JsonProperty("id_usuario")]
        private int? IdUsuarioSnake { set { if (!IdUsuario.HasValue) IdUsuario = value; } }
    }

    public class LineaRecepcionHistorialDto
    {
        public string Isbn { get; set; }
        public string Titulo { get; set; }
        public int Cantidad { get; set; }
    }

    public class RecepcionHistorialDto
    {
        public int IdRecepcion { get; set; }
        public int IdOc { get; set; }
        public string ProveedorNombre { get; set; }
        public string TipoDoc { get; set; }
        public string NroDoc { get; set; }
        public string Fecha { get; set; }
        public string UsuarioNombre { get; set; }
        public List<LineaRecepcionHistorialDto> Lineas { get; set; } = new List<LineaRecepcionHistorialDto>();

        [JsonProperty("id_recepcion")]
        public int IdRecepcionSnake => IdRecepcion;

        [JsonProperty("id_oc")]
        public int IdOcSnake => IdOc;

        [JsonProperty("proveedor")]
        public string ProveedorSnake => ProveedorNombre;

        [JsonProperty("tipo_doc")]
        public string TipoDocSnake => TipoDoc;

        [JsonProperty("nro_doc")]
        public string NroDocSnake => NroDoc;

        [JsonProperty("usuario")]
        public string UsuarioSnake => UsuarioNombre;

        public bool ShouldSerializeIdRecepcionSnake() => false;
        public bool ShouldSerializeIdOcSnake() => false;
        public bool ShouldSerializeProveedorSnake() => false;
        public bool ShouldSerializeTipoDocSnake() => false;
        public bool ShouldSerializeNroDocSnake() => false;
        public bool ShouldSerializeUsuarioSnake() => false;
    }
}
