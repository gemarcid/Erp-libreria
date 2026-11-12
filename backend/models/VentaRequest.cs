using System.Collections.Generic;

namespace backend.Models
{
    public partial class VentaRequest
    {
        public int id_cliente { get; set; }

        public int id_usuario { get; set; }

        public string canal { get; set; }

        public string forma_pago { get; set; }

        public string tipo_documento { get; set; }

        public string folio { get; set; }

        public string fecha_vencimiento { get; set; }

        public decimal? descuento { get; set; }

        public int? puntos_canjeados { get; set; }

        public int? id_pedido { get; set; }

        public List<DetalleVentaRequest> detalles { get; set; }
    }
}
