-- El esquema base actual ya incluye la columna y sus dos restricciones.
SET @ddl = IF(EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'USUARIO' AND COLUMN_NAME = 'id_cliente'
), 'DO 0', 'ALTER TABLE USUARIO
  ADD COLUMN id_cliente INT NULL,
  ADD CONSTRAINT uq_usuario_cliente UNIQUE (id_cliente),
  ADD CONSTRAINT fk_usuario_cliente FOREIGN KEY (id_cliente) REFERENCES CLIENTE(id_cliente)');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
