using Newtonsoft.Json;

namespace backend.Models
{
    public class ProveedorDto
    {
        public int IdProveedor { get; set; }
        public string Rut { get; set; }
        public string RazonSocial { get; set; }
        public string Contacto { get; set; }
        public string Correo { get; set; }
        public string CondicionPago { get; set; }
        public bool Activo { get; set; } = true;

        [JsonProperty("id_proveedor")]
        public int? IdProveedorSnake
        {
            get => null;
            set { if (value.HasValue) IdProveedor = value.Value; }
        }

        [JsonProperty("razon_social")]
        public string RazonSocialSnake
        {
            get => null;
            set { if (!string.IsNullOrEmpty(value)) RazonSocial = value; }
        }

        [JsonProperty("condicion_pago")]
        public string CondicionPagoSnake
        {
            get => null;
            set { if (!string.IsNullOrEmpty(value)) CondicionPago = value; }
        }

        public bool ShouldSerializeIdProveedorSnake() => false;
        public bool ShouldSerializeRazonSocialSnake() => false;
        public bool ShouldSerializeCondicionPagoSnake() => false;
    }
}
