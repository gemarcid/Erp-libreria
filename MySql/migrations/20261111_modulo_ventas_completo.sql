-- =====================================================================
-- MIGRACIÓN: Módulo de Ventas Completo (5 Pantallas y 5 Reportes)
-- =====================================================================

-- 1. Ampliar campos comerciales en CLIENTE si no existen
SET @dbname = DATABASE();
SET @tablename = 'CLIENTE';

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'correo');
SET @query = IF(@col_exists = 0, 'ALTER TABLE CLIENTE ADD COLUMN correo VARCHAR(100) NULL AFTER nombre', 'SELECT 1');
PREPARE stmt FROM @query; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'telefono');
SET @query = IF(@col_exists = 0, 'ALTER TABLE CLIENTE ADD COLUMN telefono VARCHAR(30) NULL AFTER correo', 'SELECT 1');
PREPARE stmt FROM @query; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'direccion');
SET @query = IF(@col_exists = 0, 'ALTER TABLE CLIENTE ADD COLUMN direccion VARCHAR(200) NULL AFTER telefono', 'SELECT 1');
PREPARE stmt FROM @query; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'limite_credito');
SET @query = IF(@col_exists = 0, 'ALTER TABLE CLIENTE ADD COLUMN limite_credito DECIMAL(12,2) NOT NULL DEFAULT 500000 AFTER puntos_fidelidad', 'SELECT 1');
PREPARE stmt FROM @query; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'credito_utilizado');
SET @query = IF(@col_exists = 0, 'ALTER TABLE CLIENTE ADD COLUMN credito_utilizado DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER limite_credito', 'SELECT 1');
PREPARE stmt FROM @query; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. Crear tabla PROMOCION si no existe
CREATE TABLE IF NOT EXISTS PROMOCION (
    id_promocion     INT AUTO_INCREMENT PRIMARY KEY,
    nombre           VARCHAR(100) NOT NULL,
    descripcion      VARCHAR(255),
    tipo             VARCHAR(30) NOT NULL, -- 'porcentaje', 'monto_fijo', '2x1'
    valor            DECIMAL(10,2) NOT NULL DEFAULT 0,
    categoria        VARCHAR(80) NULL,
    isbn             VARCHAR(20) NULL,
    fecha_inicio     DATE NOT NULL,
    fecha_fin        DATE NOT NULL,
    activo           BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT fk_promocion_libro FOREIGN KEY (isbn) REFERENCES LIBRO(isbn) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 3. Carga opcional de las promociones de prueba en una tabla vacía.
--    Activar en esta misma sesión con SET @cargar_promociones_prueba = 1;
SET @cargar_ejemplos = COALESCE(@cargar_promociones_prueba, 0) = 1
    AND NOT EXISTS (SELECT 1 FROM PROMOCION);

INSERT INTO PROMOCION (id_promocion, nombre, descripcion, tipo, valor, categoria, isbn, fecha_inicio, fecha_fin, activo)
SELECT ejemplos.*
FROM (
    SELECT 1 AS id, 'Día del Libro - 15% Descuento' AS nombre, '15% de descuento en todos los libros clásicos y novelas' AS descripcion, 'porcentaje' AS tipo, 15.00 AS valor, 'Novela' AS categoria, NULL AS isbn, '2026-01-01' AS fecha_inicio, '2026-12-31' AS fecha_fin, TRUE AS activo
    UNION ALL SELECT 2, 'Convenio Escolar Colegios', '10% de rebaja en categoría Infantil y Textos', 'porcentaje', 10.00, 'Infantil', NULL, '2026-03-01', '2026-11-30', TRUE
    UNION ALL SELECT 3, 'Promo Programadores', 'Bono de $5.000 en libros de Programación', 'monto_fijo', 5000.00, 'Programacion', NULL, '2026-01-01', '2026-12-31', TRUE
    UNION ALL SELECT 4, '2x1 Sagas Juveniles', 'Lleva dos y paga uno en títulos seleccionados', '2x1', 50.00, 'Novela', '9788423341802', '2026-05-01', '2026-12-31', TRUE
) AS ejemplos
WHERE @cargar_ejemplos
    AND (ejemplos.isbn IS NULL OR EXISTS (SELECT 1 FROM LIBRO WHERE isbn = ejemplos.isbn));
