-- 1. PROVEEDOR: estado activo y correo explícito del proveedor
SET @falta_correo = NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PROVEEDOR' AND COLUMN_NAME = 'correo'
);
SET @ddl = IF(@falta_correo, 'ALTER TABLE PROVEEDOR
    ADD COLUMN activo BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN correo VARCHAR(100) NULL', 'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Copiar a 'correo' los valores de 'contacto' que ya son correos en los proveedores actuales
UPDATE PROVEEDOR
SET correo = contacto
WHERE @falta_correo AND correo IS NULL AND contacto LIKE '%@%';

-- 2. DETALLE_OC: porcentaje de IVA por línea (por defecto 19%)
SET @ddl = IF(EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'DETALLE_OC' AND COLUMN_NAME = 'iva_porcentaje'
), 'DO 0', 'ALTER TABLE DETALLE_OC ADD COLUMN iva_porcentaje DECIMAL(5,2) NOT NULL DEFAULT 19.00');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. ORDEN_COMPRA: fecha/hora de envío, intentos de envío y ampliación de longitud de estado
SET @falta_envio = NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ORDEN_COMPRA' AND COLUMN_NAME = 'fecha_envio'
);
SET @tiene_check_oc = EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ORDEN_COMPRA'
        AND CONSTRAINT_NAME = 'chk_oc_estado' AND CONSTRAINT_TYPE = 'CHECK'
);
SET @ddl = IF(NOT @falta_envio AND @tiene_check_oc, 'DO 0', CONCAT('ALTER TABLE ORDEN_COMPRA ',
    IF(@falta_envio, 'ADD COLUMN fecha_envio DATETIME NULL,
                       ADD COLUMN intentos_envio INT NOT NULL DEFAULT 0,
                       MODIFY COLUMN estado VARCHAR(30) NOT NULL DEFAULT ''pendiente'', ', ''),
    IF(@tiene_check_oc, 'DROP CHECK chk_oc_estado, ', ''),
    '
    ADD CONSTRAINT chk_oc_estado CHECK (
        estado IN (
            ''pendiente'',
            ''aprobada'',
            ''rechazada'',
            ''recibida parcial'',
            ''recibida''
        )
    )'));
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

