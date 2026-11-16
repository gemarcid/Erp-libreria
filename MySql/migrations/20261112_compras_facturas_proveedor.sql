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

-- 2. Poblar fecha_vencimiento, monto_neto e iva en las facturas semilla (solo filas con monto_neto = 0)
--    sin modificar monto_total ni estado_pago.
UPDATE FACTURA_PROVEEDOR fp
INNER JOIN ORDEN_COMPRA oc ON fp.id_oc = oc.id_oc
INNER JOIN PROVEEDOR p ON oc.id_proveedor = p.id_proveedor
SET fp.fecha_vencimiento = DATE_ADD(
        fp.fecha_emision,
        INTERVAL (
            CASE
                WHEN p.condicion_pago REGEXP '^[0-9]+'
                THEN CAST(REGEXP_SUBSTR(p.condicion_pago, '^[0-9]+') AS UNSIGNED)
                ELSE 30
            END
        ) DAY
    ),
    fp.monto_neto = ROUND(fp.monto_total / 1.19, 2),
    fp.iva = fp.monto_total - ROUND(fp.monto_total / 1.19, 2)
WHERE fp.monto_neto = 0;

-- 3. Eliminar el CHECK actual (chk_factura_estado) en un ALTER TABLE separado
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
