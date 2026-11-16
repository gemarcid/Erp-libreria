ALTER TABLE CUENTA_CONTABLE
    DROP CHECK chk_cuenta_tipo,
    ADD CONSTRAINT chk_cuenta_tipo CHECK (tipo IN ('activo','pasivo','patrimonio','ingreso','gasto','costo'));

CREATE TABLE IF NOT EXISTS CUENTA_AUTOMATICA (
    operacion      VARCHAR(30) PRIMARY KEY,
    codigo_cuenta  VARCHAR(20) NOT NULL,
    CONSTRAINT fk_automatica_cuenta FOREIGN KEY (codigo_cuenta) REFERENCES CUENTA_CONTABLE(codigo_cuenta)
) ENGINE=InnoDB;

-- Los asientos históricos quedan con NULL; el esquema base actual ya incluye el cambio.
SET @ddl = IF(EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ASIENTO' AND COLUMN_NAME = 'clave_solicitud'
), 'DO 0', 'ALTER TABLE ASIENTO
    ADD COLUMN clave_solicitud CHAR(36),
    ADD CONSTRAINT uk_asiento_solicitud UNIQUE (id_usuario, clave_solicitud)');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
