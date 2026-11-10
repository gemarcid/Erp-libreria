ALTER TABLE CUENTA_CONTABLE
    DROP CHECK chk_cuenta_tipo,
    ADD CONSTRAINT chk_cuenta_tipo CHECK (tipo IN ('activo','pasivo','patrimonio','ingreso','gasto','costo'));

CREATE TABLE IF NOT EXISTS CUENTA_AUTOMATICA (
    operacion      VARCHAR(30) PRIMARY KEY,
    codigo_cuenta  VARCHAR(20) NOT NULL,
    CONSTRAINT fk_automatica_cuenta FOREIGN KEY (codigo_cuenta) REFERENCES CUENTA_CONTABLE(codigo_cuenta)
) ENGINE=InnoDB;

-- Ejecutar una vez en instalaciones existentes. Los asientos históricos quedan con NULL.
ALTER TABLE ASIENTO
    ADD COLUMN clave_solicitud CHAR(36),
    ADD CONSTRAINT uk_asiento_solicitud UNIQUE (id_usuario, clave_solicitud);
