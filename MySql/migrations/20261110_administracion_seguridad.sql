CREATE TABLE IF NOT EXISTS SEGURIDAD_POLITICA (
    id TINYINT PRIMARY KEY,
    activada DATE NOT NULL
) ENGINE=InnoDB;

INSERT IGNORE INTO SEGURIDAD_POLITICA (id, activada) VALUES (1, CURRENT_DATE());

CREATE TABLE IF NOT EXISTS ROL_PERMISO (
    id_rol INT NOT NULL,
    modulo VARCHAR(25) NOT NULL,
    nivel TINYINT NOT NULL,
    PRIMARY KEY (id_rol, modulo),
    CONSTRAINT fk_permiso_rol FOREIGN KEY (id_rol) REFERENCES ROL(id_rol),
    CONSTRAINT chk_permiso_nivel CHECK (nivel BETWEEN 0 AND 3)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS SEGURIDAD_EVENTO (
    id_evento BIGINT AUTO_INCREMENT PRIMARY KEY,
    fecha DATETIME(6) NOT NULL,
    id_usuario INT,
    usuario VARCHAR(100) NOT NULL,
    rol VARCHAR(50),
    modulo VARCHAR(25) NOT NULL,
    accion VARCHAR(70) NOT NULL,
    detalle VARCHAR(255),
    exito BOOLEAN NOT NULL,
    INDEX idx_evento_modulo_fecha (modulo, fecha, id_evento),
    INDEX idx_evento_fecha (fecha, id_evento)
) ENGINE=InnoDB;
