using System.Collections.Generic;
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
        public decimal LimiteCredito { get; set; }
        public int DiasCredito { get; set; }
        public List<string> Categorias { get; set; } = new List<string>();
        public string CategoriasTexto { get; set; }
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

        [JsonProperty("limite_credito")]
        public decimal? LimiteCreditoSnake
        {
            get => null;
            set { if (value.HasValue) LimiteCredito = value.Value; }
        }

        [JsonProperty("dias_credito")]
        public int? DiasCreditoSnake
        {
            get => null;
            set { if (value.HasValue) DiasCredito = value.Value; }
        }

        public bool ShouldSerializeIdProveedorSnake() => false;
        public bool ShouldSerializeRazonSocialSnake() => false;
        public bool ShouldSerializeCondicionPagoSnake() => false;
        public bool ShouldSerializeLimiteCreditoSnake() => false;
        public bool ShouldSerializeDiasCreditoSnake() => false;
    }
}
