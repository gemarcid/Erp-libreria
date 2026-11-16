-- =====================================================================
-- Migración aditiva: CU-C01 Gestionar catálogo de proveedores (crédito y categorías)
-- Fecha: 2026-11-12
-- =====================================================================

USE erp_libreria;

-- 1. Agregar columnas aditivas con valores por defecto seguros en PROVEEDOR:
--    - limite_credito: límite de crédito en $ (no negativo, por defecto 0.00)
--    - dias_credito: plazo de crédito en días (no negativo, por defecto 0)
--    - categorias: categorías suministradas separadas por coma (ej. 'Clasicos,Novela'),
--      tomadas de LIBRO.categoria y consultables con FIND_IN_SET.
ALTER TABLE PROVEEDOR
    ADD COLUMN limite_credito DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER condicion_pago,
    ADD COLUMN dias_credito INT NOT NULL DEFAULT 0 AFTER limite_credito,
    ADD COLUMN categorias VARCHAR(255) NULL DEFAULT NULL AFTER dias_credito,
    ADD CONSTRAINT chk_proveedor_credito CHECK (limite_credito >= 0 AND dias_credito >= 0);

-- 2. Inicializar dias_credito y categorias en los proveedores existentes a partir de su condicion_pago
--    y de los libros de sus órdenes históricas, sin alterar sus columnas previas.
UPDATE PROVEEDOR p
SET p.dias_credito = CASE
        WHEN p.condicion_pago REGEXP '^[0-9]+'
        THEN CAST(REGEXP_SUBSTR(p.condicion_pago, '^[0-9]+') AS UNSIGNED)
        ELSE 0
    END,
    p.categorias = (
        SELECT GROUP_CONCAT(DISTINCT TRIM(l.categoria) ORDER BY l.categoria SEPARATOR ',')
        FROM ORDEN_COMPRA oc
        INNER JOIN DETALLE_OC doc ON oc.id_oc = doc.id_oc
        INNER JOIN LIBRO l ON doc.isbn = l.isbn
        WHERE oc.id_proveedor = p.id_proveedor
          AND l.categoria IS NOT NULL
          AND TRIM(l.categoria) <> ''
    )
WHERE p.dias_credito = 0 AND p.categorias IS NULL;

