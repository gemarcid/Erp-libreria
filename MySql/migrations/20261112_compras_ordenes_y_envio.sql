USE erp_libreria;

-- 1. PROVEEDOR: estado activo y correo explícito del proveedor
ALTER TABLE PROVEEDOR
    ADD COLUMN activo BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN correo VARCHAR(100) NULL;

-- Copiar a 'correo' los valores de 'contacto' que ya son correos en los proveedores actuales
UPDATE PROVEEDOR
SET correo = contacto
WHERE correo IS NULL AND contacto LIKE '%@%';

-- 2. DETALLE_OC: porcentaje de IVA por línea (por defecto 19%)
ALTER TABLE DETALLE_OC
    ADD COLUMN iva_porcentaje DECIMAL(5,2) NOT NULL DEFAULT 19.00;

-- 3. ORDEN_COMPRA: fecha/hora de envío, intentos de envío y ampliación de longitud de estado
ALTER TABLE ORDEN_COMPRA
    ADD COLUMN fecha_envio DATETIME NULL,
    ADD COLUMN intentos_envio INT NOT NULL DEFAULT 0,
    MODIFY COLUMN estado VARCHAR(30) NOT NULL DEFAULT 'pendiente',
    DROP CHECK chk_oc_estado;

-- 4. ORDEN_COMPRA: agregar el nuevo CHECK de estado en un ALTER TABLE separado
ALTER TABLE ORDEN_COMPRA
    ADD CONSTRAINT chk_oc_estado CHECK (
        estado IN (
            'pendiente',
            'aprobada',
            'rechazada',
            'recibida parcial',
            'recibida'
        )
    );

