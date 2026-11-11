-- ================================================================
-- ERP LIBRERIA - DATOS DE PRUEBA
-- Compatible con la estructura de erp_libreria.sql
-- Ejecutar DESPUES de crear las 21 tablas.
-- ================================================================

USE erp_libreria;

-- ================================================================
-- SEGURIDAD
-- ================================================================

INSERT INTO ROL (id_rol, nombre, descripcion) VALUES
(1, 'Administrador', 'Acceso completo al sistema'),
(2, 'Comprador', 'Gestion de proveedores y compras'),
(3, 'Vendedor', 'Gestion de clientes y ventas'),
(4, 'Contador', 'Gestion de contabilidad y reportes'),
(5, 'Cliente', 'Consulta del catálogo y administración de su propia cuenta');

-- Hash BCrypt de ejemplo. Para desarrollo, la contraseña de prueba es:
-- Password123!
INSERT INTO USUARIO
(id_usuario, id_rol, nombre, correo, password_hash, fecha_ultimo_cambio_pass, estado, fecha_creacion)
VALUES
(1, 1, 'Administrador General', 'admin@libreria.cl',
 '$2a$11$3tKDnehoRfJGsPcn/uyfIOpQH56dGrr.1DgIr4xdotv4t9c3Z6Ubq',
 '2026-09-20', 'activo', '2026-09-01 09:00:00'),
(2, 2, 'Camila Compras', 'compras@libreria.cl',
 '$2a$11$3tKDnehoRfJGsPcn/uyfIOpQH56dGrr.1DgIr4xdotv4t9c3Z6Ubq',
 '2026-09-20', 'activo', '2026-09-01 09:10:00'),
(3, 3, 'Diego Ventas', 'ventas@libreria.cl',
 '$2a$11$3tKDnehoRfJGsPcn/uyfIOpQH56dGrr.1DgIr4xdotv4t9c3Z6Ubq',
 '2026-09-20', 'activo', '2026-09-01 09:20:00'),
(4, 4, 'Valentina Contabilidad', 'contabilidad@libreria.cl',
 '$2a$11$3tKDnehoRfJGsPcn/uyfIOpQH56dGrr.1DgIr4xdotv4t9c3Z6Ubq',
 '2026-09-20', 'activo', '2026-09-01 09:30:00');

-- ================================================================
-- CATALOGO
-- ================================================================

INSERT INTO EDITORIAL (id_editorial, nombre, pais) VALUES
(1, 'Penguin Random House', 'Chile'),
(2, 'Planeta', 'España'),
(3, 'Anagrama', 'España'),
(4, 'Alfaguara', 'España'),
(5, 'OReilly Media', 'Estados Unidos');

INSERT INTO LIBRO
(isbn, id_editorial, titulo, autor, categoria, estante, precio_venta, costo_unitario, stock_actual, stock_minimo, activo)
VALUES
('9780140449136', 1, 'La Odisea', 'Homero', 'Clasicos', 'A-01', 12990, 7000, 18, 5, TRUE),
('9788437604947', 2, 'Cien años de soledad', 'Gabriel Garcia Marquez', 'Novela', 'A-02', 15990, 8500, 24, 6, TRUE),
('9788439724798', 3, 'El principito', 'Antoine de Saint-Exupery', 'Infantil', 'B-01', 9990, 5200, 31, 8, TRUE),
('9788420412146', 4, 'Don Quijote de la Mancha', 'Miguel de Cervantes', 'Clasicos', 'A-03', 18990, 10500, 12, 4, TRUE),
('9781492055020', 5, 'Learning Python', 'Mark Lutz', 'Programacion', 'C-01', 42990, 25000, 9, 3, TRUE),
('9781491950357', 5, 'Fluent Python', 'Luciano Ramalho', 'Programacion', 'C-02', 45990, 27000, 7, 3, TRUE),
('9780132350884', 5, 'Clean Code', 'Robert C. Martin', 'Programacion', 'C-03', 39990, 22000, 14, 4, TRUE),
('9780262033848', 5, 'Introduction to Algorithms', 'Thomas H. Cormen', 'Computacion', 'C-04', 69990, 42000, 5, 2, TRUE),
('9789500428037', 2, 'Rayuela', 'Julio Cortazar', 'Novela', 'A-04', 17990, 9500, 20, 5, TRUE),
('9788423341802', 4, 'La sombra del viento', 'Carlos Ruiz Zafon', 'Novela', 'A-05', 16990, 9000, 16, 5, TRUE);

-- ================================================================
-- PROVEEDORES
-- ================================================================

INSERT INTO PROVEEDOR
(id_proveedor, rut, razon_social, contacto, condicion_pago)
VALUES
(1, '76.111.111-1', 'Distribuidora Libros Chile SpA', 'contacto@dlchile.cl', '30 dias'),
(2, '76.222.222-2', 'Editorial Andina Ltda.', 'ventas@andina.cl', '30 dias'),
(3, '76.333.333-3', 'Importadora Literaria SpA', 'pedidos@literaria.cl', '60 dias'),
(4, '76.444.444-4', 'TechBooks Chile SpA', 'ventas@techbooks.cl', '30 dias');

-- ================================================================
-- COMPRAS
-- ================================================================

INSERT INTO ORDEN_COMPRA
(id_oc, id_proveedor, id_usuario, fecha, fecha_entrega, total, estado)
VALUES
(1, 1, 2, '2026-09-01', '2026-09-05', 850000, 'recibida'),
(2, 4, 2, '2026-09-08', '2026-09-12', 950000, 'recibida'),
(3, 2, 2, '2026-09-20', '2026-09-27', 420000, 'aprobada'),
(4, 3, 2, '2026-09-28', NULL, 610000, 'pendiente');

INSERT INTO DETALLE_OC
(id_detalle_oc, id_oc, isbn, cantidad, precio_pactado)
VALUES
(1, 1, '9780140449136', 40, 7000),
(2, 1, '9788437604947', 30, 8500),
(3, 1, '9788439724798', 20, 5200),
(4, 2, '9781492055020', 20, 25000),
(5, 2, '9781491950357', 15, 27000),
(6, 2, '9780132350884', 10, 22000),
(7, 3, '9788420412146', 20, 10500),
(8, 3, '9789500428037', 20, 9500),
(9, 4, '9788423341802', 25, 9000),
(10, 4, '9780262033848', 8, 42000);

INSERT INTO RECEPCION
(id_recepcion, id_oc, id_usuario, fecha, tipo_doc, nro_doc)
VALUES
(1, 1, 2, '2026-09-05 11:30:00', 'factura', 'F-10001'),
(2, 2, 2, '2026-09-12 15:00:00', 'guia de despacho', 'GD-2045');

INSERT INTO FACTURA_PROVEEDOR
(id_factura, id_oc, nro_factura, fecha_emision, fecha_pago, monto_total, estado_pago)
VALUES
(1, 1, 'F-10001', '2026-09-05', '2026-09-25', 850000, 'pagada'),
(2, 2, 'F-20015', '2026-09-12', NULL, 950000, 'pendiente'),
(3, 3, 'F-30120', '2026-09-27', NULL, 420000, 'pendiente');

-- ================================================================
-- CLIENTES
-- ================================================================

INSERT INTO CLIENTE
(id_cliente, rut, nombre, correo, telefono, direccion, tipo_cliente, puntos_fidelidad, limite_credito, credito_utilizado)
VALUES
(1, '12.345.678-5', 'Juan Perez', 'jperez@gmail.com', '+56 9 8765 4321', 'Av. Libertad 123, Chillan', 'persona', 125, 300000, 0),
(2, '15.234.567-8', 'Maria Gonzalez', 'mgonzalez@yahoo.es', '+56 9 7654 3210', 'Calle 18 de Septiembre 456, Chillan', 'persona', 80, 250000, 0),
(3, '76.555.555-5', 'Colegio Adventista de Chillan', 'adquisiciones@colegioadventista.cl', '+56 42 222 3344', 'Av. O''Higgins 789, Chillan', 'colegio', 420, 2000000, 624155),
(4, '76.666.666-6', 'Empresa Educativa del Sur SpA', 'compras@educativasur.cl', '+56 42 233 4455', 'Panamericana Norte Km 5, Chillan', 'empresa', 260, 1500000, 202252),
(5, '18.765.432-1', 'Sofia Ramirez', 'sramirez@outlook.com', '+56 9 6543 2109', 'Pasaje Los Boldos 45, Chillan Viejo', 'persona', 45, 200000, 0),
(6, '14.111.222-3', 'Felipe Contreras', 'fcontreras@gmail.com', '+56 9 5432 1098', 'Carrera 780, San Carlos', 'persona', 15, 150000, 0);

-- ================================================================
-- PROMOCIONES Y DESCUENTOS
-- ================================================================

INSERT INTO PROMOCION
(id_promocion, nombre, descripcion, tipo, valor, categoria, isbn, fecha_inicio, fecha_fin, activo)
VALUES
(1, 'Día del Libro - 15% Descuento', '15% de rebaja en novelas y clásicos universales', 'porcentaje', 15.00, 'Novela', NULL, '2026-01-01', '2026-12-31', TRUE),
(2, 'Convenio Escolar Colegios', '10% de rebaja directa en literatura Infantil', 'porcentaje', 10.00, 'Infantil', NULL, '2026-03-01', '2026-11-30', TRUE),
(3, 'Promo Programadores Tech', 'Bono de $5.000 en libros de informática y programación', 'monto_fijo', 5000.00, 'Programacion', NULL, '2026-01-01', '2026-12-31', TRUE),
(4, '2x1 Sagas Juveniles', 'Lleva dos y paga uno en ejemplares de La Sombra del Viento', '2x1', 50.00, 'Novela', '9788423341802', '2026-05-01', '2026-12-31', TRUE);

-- ================================================================
-- PEDIDOS Y COTIZACIONES
-- ================================================================

INSERT INTO PEDIDO_VENTA
(id_pedido, id_cliente, id_usuario, fecha, tipo, estado)
VALUES
(1, 1, 3, '2026-09-15', 'pedido', 'facturado'),
(2, 3, 3, '2026-09-18', 'pedido', 'aceptado'),
(3, 4, 3, '2026-09-22', 'cotizacion', 'pendiente'),
(4, 2, 3, '2026-09-25', 'pedido', 'facturado'),
(5, 5, 3, '2026-10-01', 'pedido', 'pendiente');

INSERT INTO DETALLE_PEDIDO
(id_detalle_pedido, id_pedido, isbn, cantidad, precio_unitario)
VALUES
(1, 1, '9780140449136', 2, 12990),
(2, 1, '9780132350884', 1, 39990),
(3, 2, '9788439724798', 25, 8990),
(4, 2, '9788437604947', 20, 14990),
(5, 3, '9781492055020', 5, 41990),
(6, 3, '9781491950357', 5, 44990),
(7, 4, '9789500428037', 2, 17990),
(8, 4, '9788423341802', 1, 16990),
(9, 5, '9780262033848', 1, 69990);

-- ================================================================
-- RESERVAS
-- ================================================================

INSERT INTO RESERVA
(id_reserva, id_cliente, isbn, fecha, cantidad, estado)
VALUES
(1, 1, '9781492055020', '2026-10-02', 1, 'activa'),
(2, 3, '9788439724798', '2026-09-19', 10, 'atendida'),
(3, 5, '9780262033848', '2026-10-01', 1, 'activa'),
(4, 2, '9788423341802', '2026-09-20', 1, 'cancelada');

-- ================================================================
-- VENTAS
-- ================================================================

INSERT INTO VENTA
(id_venta, id_cliente, id_usuario, id_pedido, fecha, canal, forma_pago, tipo_documento, folio,
 fecha_vencimiento, neto, iva, descuento, total, estado)
VALUES
(1, 1, 3, 1, '2026-09-15 16:20:00', 'tienda fisica', 'tarjeta', 'boleta', 'B-10001',
 NULL, 51570, 9798, 0, 61368, 'pagado'),
(2, 3, 3, 2, '2026-09-19 10:15:00', 'retiro en tienda', 'transferencia', 'factura', 'F-50001',
 '2026-10-19', 524500, 99655, 0, 624155, 'pendiente'),
(3, 2, 3, NULL, '2026-09-25 18:40:00', 'tienda digital', 'tarjeta', 'boleta', 'B-10002',
 NULL, 52970, 10064, 0, 63034, 'pagado'),
(4, 4, 3, NULL, '2026-09-28 12:10:00', 'tienda digital', 'transferencia', 'factura', 'F-50002',
 '2026-10-28', 169960, 32292, 0, 202252, 'pendiente'),
(5, 5, 3, NULL, '2026-10-02 17:30:00', 'tienda fisica', 'efectivo', 'boleta', 'B-10003',
 NULL, 9990, 1898, 0, 11888, 'pagado'),
(6, 6, 3, NULL, '2026-10-03 13:05:00', 'tienda fisica', 'tarjeta', 'boleta', 'B-10004',
 NULL, 39990, 7598, 0, 47588, 'anulado');

INSERT INTO DETALLE_VENTA
(id_detalle_venta, id_venta, isbn, cantidad, precio_unitario)
VALUES
(1, 1, '9780140449136', 2, 12990),
(2, 1, '9780132350884', 1, 39990),
(3, 2, '9788439724798', 25, 8990),
(4, 2, '9788437604947', 20, 14990),
(5, 3, '9789500428037', 2, 17990),
(6, 3, '9788423341802', 1, 16990),
(7, 4, '9788423341802', 10, 16990),
(8, 5, '9788439724798', 1, 9990),
(9, 6, '9780132350884', 1, 39990);

-- ================================================================
-- NOTAS DE CREDITO
-- ================================================================

INSERT INTO NOTA_CREDITO
(id_nota_credito, id_venta, folio, fecha, motivo, monto)
VALUES
(1, 6, 'NC-10001', '2026-10-03', 'Venta anulada por error de cobro', 47588);

-- ================================================================
-- MOVIMIENTOS DE STOCK
-- Los movimientos reflejan compras, ventas y una devolucion.
-- ================================================================

INSERT INTO MOVIMIENTO_STOCK
(id_movimiento, isbn, id_usuario, id_recepcion, id_venta, id_nota_credito, fecha, tipo_movimiento, motivo, cantidad)
VALUES
(1, '9780140449136', 2, 1, NULL, NULL, '2026-09-05 11:35:00', 'entrada', 'compra', 40),
(2, '9788437604947', 2, 1, NULL, NULL, '2026-09-05 11:35:00', 'entrada', 'compra', 30),
(3, '9788439724798', 2, 1, NULL, NULL, '2026-09-05 11:35:00', 'entrada', 'compra', 20),
(4, '9781492055020', 2, 2, NULL, NULL, '2026-09-12 15:05:00', 'entrada', 'compra', 20),
(5, '9781491950357', 2, 2, NULL, NULL, '2026-09-12 15:05:00', 'entrada', 'compra', 15),
(6, '9780132350884', 2, 2, NULL, NULL, '2026-09-12 15:05:00', 'entrada', 'compra', 10),
(7, '9780140449136', 3, NULL, 1, NULL, '2026-09-15 16:20:00', 'salida', 'venta', 2),
(8, '9780132350884', 3, NULL, 1, NULL, '2026-09-15 16:20:00', 'salida', 'venta', 1),
(9, '9788439724798', 3, NULL, 2, NULL, '2026-09-19 10:15:00', 'salida', 'venta', 25),
(10, '9788437604947', 3, NULL, 2, NULL, '2026-09-19 10:15:00', 'salida', 'venta', 20),
(11, '9789500428037', 3, NULL, 3, NULL, '2026-09-25 18:40:00', 'salida', 'venta', 2),
(12, '9788423341802', 3, NULL, 3, NULL, '2026-09-25 18:40:00', 'salida', 'venta', 1),
(13, '9788423341802', 3, NULL, 4, NULL, '2026-09-28 12:10:00', 'salida', 'venta', 10),
(14, '9788439724798', 3, NULL, 5, NULL, '2026-10-02 17:30:00', 'salida', 'venta', 1),
(15, '9780132350884', 3, NULL, 6, 1, '2026-10-03 13:05:00', 'entrada', 'devolucion', 1);

-- ================================================================
-- CONTABILIDAD
-- ================================================================

INSERT INTO CUENTA_CONTABLE (codigo_cuenta, nombre, tipo) VALUES
('1.1.01', 'Caja', 'activo'),
('1.1.02', 'Banco', 'activo'),
('1.1.03', 'Clientes por cobrar', 'activo'),
('1.1.04', 'Inventario de libros', 'activo'),
('2.1.01', 'Proveedores por pagar', 'pasivo'),
('2.1.02', 'IVA débito fiscal', 'pasivo'),
('3.1.01', 'Capital', 'patrimonio'),
('4.1.01', 'Ingresos por ventas', 'ingreso'),
('5.1.01', 'Costo de ventas', 'gasto'),
('5.1.02', 'Gastos generales', 'gasto');

INSERT INTO PERIODO_CONTABLE (id_periodo, anio, mes, estado) VALUES
(1, 2026, 8, 'cerrado'),
(2, 2026, 9, 'cerrado'),
(3, 2026, 10, 'abierto');

-- Asiento de capital inicial
INSERT INTO ASIENTO
(id_asiento, id_periodo, id_usuario, fecha, glosa, origen, id_documento)
VALUES
(1, 1, 4, '2026-08-01', 'Capital inicial de la libreria', 'manual', NULL),
(2, 2, 4, '2026-09-05', 'Compra de libros OC-1', 'compras', 1),
(3, 2, 4, '2026-09-12', 'Compra de libros OC-2', 'compras', 2),
(4, 2, 4, '2026-09-15', 'Venta B-10001', 'ventas', 1),
(5, 2, 4, '2026-09-19', 'Venta F-50001', 'ventas', 2),
(6, 2, 4, '2026-09-25', 'Venta B-10002', 'ventas', 3);

INSERT INTO DETALLE_ASIENTO
(id_detalle, id_asiento, codigo_cuenta, debe, haber)
VALUES
-- Capital inicial
(1, 1, '1.1.02', 5000000, 0),
(2, 1, '3.1.01', 0, 5000000),

-- Compra OC-1
(3, 2, '1.1.04', 850000, 0),
(4, 2, '2.1.01', 0, 850000),

-- Compra OC-2
(5, 3, '1.1.04', 950000, 0),
(6, 3, '2.1.01', 0, 950000),

-- Venta 1
(7, 4, '1.1.01', 61368, 0),
(8, 4, '4.1.01', 0, 51570),
(9, 4, '2.1.02', 0, 9798),

-- Venta 2 a credito
(10, 5, '1.1.03', 624155, 0),
(11, 5, '4.1.01', 0, 524500),
(12, 5, '2.1.02', 0, 99655),

-- Venta 3
(13, 6, '1.1.02', 63034, 0),
(14, 6, '4.1.01', 0, 52970),
(15, 6, '2.1.02', 0, 10064);

-- ================================================================
-- CONSULTAS RAPIDAS PARA COMPROBAR EL SEED
-- ================================================================

-- SELECT COUNT(*) AS roles FROM ROL;
-- SELECT COUNT(*) AS usuarios FROM USUARIO;
-- SELECT COUNT(*) AS libros FROM LIBRO;
-- SELECT COUNT(*) AS proveedores FROM PROVEEDOR;
-- SELECT COUNT(*) AS clientes FROM CLIENTE;
-- SELECT COUNT(*) AS ventas FROM VENTA;
-- SELECT COUNT(*) AS movimientos_stock FROM MOVIMIENTO_STOCK;
-- SELECT COUNT(*) AS asientos FROM ASIENTO;
