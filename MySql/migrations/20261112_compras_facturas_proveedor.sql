-- =====================================================================
-- Migración aditiva: CU-C07 Registrar factura de proveedor (y soporte CU-C08 / Cuentas por Pagar)
-- Fecha: 2026-11-12
-- =====================================================================

USE erp_libreria;

-- 1. Agregar columnas faltantes para CU-C07 (fecha_vencimiento, monto_neto, iva)
--    Nota: fecha_pago (DATE NULL) ya existe en FACTURA_PROVEEDOR para fecha de pago programada/efectiva.
ALTER TABLE FACTURA_PROVEEDOR
    ADD COLUMN fecha_vencimiento DATE NULL AFTER fecha_emision,
    ADD COLUMN monto_neto DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER fecha_pago,
    ADD COLUMN iva DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER monto_neto;

-- 2. Poblar valores consistentes en las 3 facturas semilla existentes (#1, #2, #3)
UPDATE FACTURA_PROVEEDOR
SET fecha_vencimiento = COALESCE(fecha_pago, DATE_ADD(fecha_emision, INTERVAL 30 DAY)),
    monto_neto = ROUND(monto_total / 1.19, 2),
    iva = monto_total - ROUND(monto_total / 1.19, 2)
WHERE fecha_vencimiento IS NULL;

-- 3. Eliminar el CHECK actual de estado_pago en un ALTER TABLE separado
ALTER TABLE FACTURA_PROVEEDOR
    DROP CHECK chk_factura_estado;

-- 4. Ampliar estado_pago de VARCHAR(20) a VARCHAR(30) ('pendiente de conciliacion' tiene 25 caracteres)
--    y agregar el nuevo CHECK y la restricción UNIQUE(id_oc) (una factura por orden)
ALTER TABLE FACTURA_PROVEEDOR
    MODIFY COLUMN estado_pago VARCHAR(30) NOT NULL DEFAULT 'pendiente de conciliacion',
    ADD CONSTRAINT chk_factura_estado CHECK (
        estado_pago IN ('pendiente', 'pendiente de conciliacion', 'con discrepancias', 'conciliada', 'pagada')
    ),
    ADD CONSTRAINT uk_factura_oc UNIQUE (id_oc);

