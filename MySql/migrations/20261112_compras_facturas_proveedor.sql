-- =====================================================================
-- Migración aditiva: CU-C07 Registrar factura de proveedor (y soporte CU-C08 / Cuentas por Pagar)
-- Fecha: 2026-11-12
-- =====================================================================

-- 1. Cambiar el esquema en un solo ALTER. Si hay facturas duplicadas por orden,
--    la restricción UNIQUE detiene la operación y conserva el esquema anterior.
--    Las comprobaciones también permiten continuar si la versión anterior quedó a medias.
SET @columnas_factura = IF(EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'FACTURA_PROVEEDOR' AND COLUMN_NAME = 'fecha_vencimiento'
), NULL, 'ADD COLUMN fecha_vencimiento DATE NULL AFTER fecha_emision,
          ADD COLUMN monto_neto DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER fecha_pago,
          ADD COLUMN iva DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER monto_neto');

SET @falta_factura_unica = NOT EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'FACTURA_PROVEEDOR'
        AND CONSTRAINT_NAME = 'uk_factura_oc' AND CONSTRAINT_TYPE = 'UNIQUE'
);
SET @tiene_check_factura = EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'FACTURA_PROVEEDOR'
        AND CONSTRAINT_NAME = 'chk_factura_estado' AND CONSTRAINT_TYPE = 'CHECK'
);
SET @cambios = CONCAT_WS(', ',
    @columnas_factura,
    IF(@falta_factura_unica AND @tiene_check_factura, 'DROP CHECK chk_factura_estado', NULL),
    IF(@falta_factura_unica OR NOT @tiene_check_factura,
       'MODIFY COLUMN estado_pago VARCHAR(30) NOT NULL DEFAULT ''pendiente de conciliacion'',
        ADD CONSTRAINT chk_factura_estado CHECK (
            estado_pago IN (''pendiente'', ''pendiente de conciliacion'', ''con discrepancias'', ''conciliada'', ''pagada'')
        )', NULL),
    IF(@falta_factura_unica, 'ADD CONSTRAINT uk_factura_oc UNIQUE (id_oc)', NULL)
);
SET @ddl = IF(@cambios = '', 'DO 0', CONCAT('ALTER TABLE FACTURA_PROVEEDOR ', @cambios));
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. Inicializar valores faltantes en las facturas anteriores al cambio,
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
WHERE fp.fecha_vencimiento IS NULL AND fp.monto_neto = 0 AND fp.iva = 0;
