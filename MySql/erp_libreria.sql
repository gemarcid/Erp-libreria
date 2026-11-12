-- =====================================================================
-- ERP LIBRERÍA - Script de creación de base de datos
-- Motor: MySQL 8.x
-- =====================================================================

CREATE DATABASE IF NOT EXISTS erp_libreria
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE erp_libreria;

-- =====================================================================
-- MÓDULO: SEGURIDAD
-- =====================================================================

CREATE TABLE ROL (
    id_rol        INT AUTO_INCREMENT PRIMARY KEY,
    nombre        VARCHAR(50)  NOT NULL,   -- Administrador, Comprador, Vendedor, Contador
    descripcion   VARCHAR(255)
) ENGINE=InnoDB;

CREATE TABLE USUARIO (
    id_usuario              INT AUTO_INCREMENT PRIMARY KEY,
    id_rol                  INT NOT NULL,
    nombre                  VARCHAR(100) NOT NULL,
    correo                  VARCHAR(100) NOT NULL UNIQUE,
    password_hash           VARCHAR(255) NOT NULL,
    fecha_ultimo_cambio_pass DATE,          -- RNF-02: renovación cada 15 días
    estado                  VARCHAR(20) NOT NULL DEFAULT 'activo', -- activo, inactivo
    fecha_creacion          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_usuario_rol FOREIGN KEY (id_rol) REFERENCES ROL(id_rol),
    CONSTRAINT chk_usuario_estado CHECK (estado IN ('activo', 'inactivo'))
) ENGINE=InnoDB;

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

-- =====================================================================
-- MÓDULO: CATÁLOGO E INVENTARIO
-- =====================================================================

CREATE TABLE EDITORIAL (
    id_editorial  INT AUTO_INCREMENT PRIMARY KEY,
    nombre        VARCHAR(100) NOT NULL,
    pais          VARCHAR(60)
) ENGINE=InnoDB;

CREATE TABLE LIBRO (
    isbn            VARCHAR(20) PRIMARY KEY,
    id_editorial    INT NOT NULL,
    titulo          VARCHAR(200) NOT NULL,
    autor           VARCHAR(150),
    categoria       VARCHAR(80),
    estante         VARCHAR(30),
    precio_venta    DECIMAL(10,2) NOT NULL DEFAULT 0,
    costo_unitario  DECIMAL(10,2) NOT NULL DEFAULT 0,
    stock_actual    INT NOT NULL DEFAULT 0,
    stock_minimo    INT NOT NULL DEFAULT 0,
    activo          BOOLEAN NOT NULL DEFAULT TRUE, -- desactivar sin borrar historial
    CONSTRAINT fk_libro_editorial FOREIGN KEY (id_editorial) REFERENCES EDITORIAL(id_editorial)
) ENGINE=InnoDB;

-- =====================================================================
-- MÓDULO: COMPRAS
-- =====================================================================

CREATE TABLE PROVEEDOR (
    id_proveedor    INT AUTO_INCREMENT PRIMARY KEY,
    rut             VARCHAR(15) NOT NULL UNIQUE,
    razon_social    VARCHAR(150) NOT NULL,
    contacto        VARCHAR(150),
    condicion_pago  VARCHAR(80)
) ENGINE=InnoDB;

CREATE TABLE ORDEN_COMPRA (
    id_oc           INT AUTO_INCREMENT PRIMARY KEY,
    id_proveedor    INT NOT NULL,
    id_usuario      INT NOT NULL,
    fecha           DATE NOT NULL,
    fecha_entrega   DATE,
    total           DECIMAL(12,2) NOT NULL DEFAULT 0,
    estado          VARCHAR(20) NOT NULL DEFAULT 'pendiente', -- pendiente, aprobada, rechazada, recibida
    CONSTRAINT fk_oc_proveedor FOREIGN KEY (id_proveedor) REFERENCES PROVEEDOR(id_proveedor),
    CONSTRAINT fk_oc_usuario FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario),
    CONSTRAINT chk_oc_estado CHECK (estado IN ('pendiente','aprobada','rechazada','recibida'))
) ENGINE=InnoDB;

CREATE TABLE DETALLE_OC (
    id_detalle_oc   INT AUTO_INCREMENT PRIMARY KEY,
    id_oc           INT NOT NULL,
    isbn            VARCHAR(20) NOT NULL,
    cantidad        INT NOT NULL,
    precio_pactado  DECIMAL(10,2) NOT NULL,
    CONSTRAINT fk_detalleoc_oc FOREIGN KEY (id_oc) REFERENCES ORDEN_COMPRA(id_oc),
    CONSTRAINT fk_detalleoc_libro FOREIGN KEY (isbn) REFERENCES LIBRO(isbn)
) ENGINE=InnoDB;

CREATE TABLE RECEPCION (
    id_recepcion    INT AUTO_INCREMENT PRIMARY KEY,
    id_oc           INT NOT NULL,
    id_usuario      INT NOT NULL,
    fecha           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    tipo_doc        VARCHAR(30) NOT NULL, -- guia de despacho, factura
    nro_doc         VARCHAR(50) NOT NULL, -- obligatorio
    CONSTRAINT fk_recepcion_oc FOREIGN KEY (id_oc) REFERENCES ORDEN_COMPRA(id_oc),
    CONSTRAINT fk_recepcion_usuario FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario)
) ENGINE=InnoDB;

CREATE TABLE FACTURA_PROVEEDOR (
    id_factura      INT AUTO_INCREMENT PRIMARY KEY,
    id_oc           INT NOT NULL,
    nro_factura     VARCHAR(50) NOT NULL,
    fecha_emision   DATE NOT NULL,
    fecha_pago      DATE, -- programada o efectiva
    monto_total     DECIMAL(12,2) NOT NULL,
    estado_pago     VARCHAR(20) NOT NULL DEFAULT 'pendiente', -- pendiente, pagada
    CONSTRAINT fk_factura_oc FOREIGN KEY (id_oc) REFERENCES ORDEN_COMPRA(id_oc),
    CONSTRAINT chk_factura_estado CHECK (estado_pago IN ('pendiente','pagada'))
) ENGINE=InnoDB;

-- =====================================================================
-- MÓDULO: VENTAS
-- =====================================================================

CREATE TABLE CLIENTE (
    id_cliente        INT AUTO_INCREMENT PRIMARY KEY,
    rut               VARCHAR(15) NOT NULL UNIQUE,
    nombre            VARCHAR(150) NOT NULL,
    correo            VARCHAR(100) NULL,
    telefono          VARCHAR(30) NULL,
    direccion         VARCHAR(200) NULL,
    tipo_cliente      VARCHAR(20) NOT NULL DEFAULT 'persona', -- persona, colegio, empresa
    puntos_fidelidad  INT NOT NULL DEFAULT 0,
    limite_credito    DECIMAL(12,2) NOT NULL DEFAULT 500000,
    credito_utilizado DECIMAL(12,2) NOT NULL DEFAULT 0
) ENGINE=InnoDB;

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

ALTER TABLE USUARIO
  ADD COLUMN id_cliente INT NULL,
  ADD CONSTRAINT uq_usuario_cliente UNIQUE (id_cliente),
  ADD CONSTRAINT fk_usuario_cliente FOREIGN KEY (id_cliente) REFERENCES CLIENTE(id_cliente);

CREATE TABLE PEDIDO_VENTA (
    id_pedido       INT AUTO_INCREMENT PRIMARY KEY,
    id_cliente      INT NOT NULL,
    id_usuario      INT NOT NULL,
    fecha           DATE NOT NULL,
    tipo            VARCHAR(20) NOT NULL, -- cotizacion, pedido
    estado          VARCHAR(20) NOT NULL DEFAULT 'pendiente', -- pendiente, aceptado, facturado, vencido
    CONSTRAINT fk_pedido_cliente FOREIGN KEY (id_cliente) REFERENCES CLIENTE(id_cliente),
    CONSTRAINT fk_pedido_usuario FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario),
    CONSTRAINT chk_pedido_tipo CHECK (tipo IN ('cotizacion','pedido')),
    CONSTRAINT chk_pedido_estado CHECK (estado IN ('pendiente','aceptado','facturado','vencido'))
) ENGINE=InnoDB;

CREATE TABLE DETALLE_PEDIDO (
    id_detalle_pedido  INT AUTO_INCREMENT PRIMARY KEY,
    id_pedido          INT NOT NULL,
    isbn               VARCHAR(20) NOT NULL,
    cantidad           INT NOT NULL,
    precio_unitario    DECIMAL(10,2) NOT NULL,
    CONSTRAINT fk_detallepedido_pedido FOREIGN KEY (id_pedido) REFERENCES PEDIDO_VENTA(id_pedido),
    CONSTRAINT fk_detallepedido_libro FOREIGN KEY (isbn) REFERENCES LIBRO(isbn)
) ENGINE=InnoDB;

CREATE TABLE RESERVA (
    id_reserva   INT AUTO_INCREMENT PRIMARY KEY,
    id_cliente   INT NOT NULL,
    isbn         VARCHAR(20) NOT NULL,
    fecha        DATE NOT NULL,
    cantidad     INT NOT NULL,
    estado       VARCHAR(20) NOT NULL DEFAULT 'activa', -- activa, atendida, cancelada
    CONSTRAINT fk_reserva_cliente FOREIGN KEY (id_cliente) REFERENCES CLIENTE(id_cliente),
    CONSTRAINT fk_reserva_libro FOREIGN KEY (isbn) REFERENCES LIBRO(isbn),
    CONSTRAINT chk_reserva_estado CHECK (estado IN ('activa','atendida','cancelada'))
) ENGINE=InnoDB;

CREATE TABLE VENTA (
    id_venta          INT AUTO_INCREMENT PRIMARY KEY,
    id_cliente        INT NOT NULL,
    id_usuario        INT NOT NULL,
    id_pedido         INT NULL,
    fecha             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    canal             VARCHAR(30) NOT NULL, -- tienda fisica, tienda digital, retiro en tienda
    forma_pago        VARCHAR(30) NOT NULL,
    tipo_documento    VARCHAR(20) NOT NULL, -- boleta, factura
    folio             VARCHAR(30),
    fecha_vencimiento DATE,
    neto              DECIMAL(12,2) NOT NULL DEFAULT 0,
    iva               DECIMAL(12,2) NOT NULL DEFAULT 0,
    descuento         DECIMAL(12,2) NOT NULL DEFAULT 0,
    total             DECIMAL(12,2) NOT NULL DEFAULT 0,
    estado            VARCHAR(20) NOT NULL DEFAULT 'pendiente', -- pagado, pendiente, anulado
    CONSTRAINT fk_venta_cliente FOREIGN KEY (id_cliente) REFERENCES CLIENTE(id_cliente),
    CONSTRAINT fk_venta_usuario FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario),
    CONSTRAINT fk_venta_pedido FOREIGN KEY (id_pedido) REFERENCES PEDIDO_VENTA(id_pedido),
    CONSTRAINT chk_venta_estado CHECK (estado IN ('pagado','pendiente','anulado'))
) ENGINE=InnoDB;

CREATE TABLE DETALLE_VENTA (
    id_detalle_venta  INT AUTO_INCREMENT PRIMARY KEY,
    id_venta          INT NOT NULL,
    isbn              VARCHAR(20) NOT NULL,
    cantidad          INT NOT NULL,
    precio_unitario   DECIMAL(10,2) NOT NULL,
    CONSTRAINT fk_detalleventa_venta FOREIGN KEY (id_venta) REFERENCES VENTA(id_venta),
    CONSTRAINT fk_detalleventa_libro FOREIGN KEY (isbn) REFERENCES LIBRO(isbn)
) ENGINE=InnoDB;

CREATE TABLE NOTA_CREDITO (
    id_nota_credito  INT AUTO_INCREMENT PRIMARY KEY,
    id_venta         INT NOT NULL,
    folio            VARCHAR(30),
    fecha            DATE NOT NULL,
    motivo           VARCHAR(255),
    monto            DECIMAL(12,2) NOT NULL,
    CONSTRAINT fk_notacredito_venta FOREIGN KEY (id_venta) REFERENCES VENTA(id_venta)
) ENGINE=InnoDB;

-- =====================================================================
-- MOVIMIENTO_STOCK (Inventario) - depende de RECEPCION, VENTA y NOTA_CREDITO
-- =====================================================================

CREATE TABLE MOVIMIENTO_STOCK (
    id_movimiento     INT AUTO_INCREMENT PRIMARY KEY,
    isbn              VARCHAR(20) NOT NULL,
    id_usuario        INT NOT NULL,
    id_recepcion      INT NULL, -- si es ingreso por compra
    id_venta          INT NULL, -- si es salida por venta
    id_nota_credito   INT NULL, -- si es devolucion
    fecha             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    tipo_movimiento   VARCHAR(20) NOT NULL, -- entrada, salida, ajuste
    motivo            VARCHAR(50) NOT NULL, -- compra, venta, devolucion, merma, robo, paginas rotas, humedad
    cantidad          INT NOT NULL,
    CONSTRAINT fk_movstock_libro FOREIGN KEY (isbn) REFERENCES LIBRO(isbn),
    CONSTRAINT fk_movstock_usuario FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario),
    CONSTRAINT fk_movstock_recepcion FOREIGN KEY (id_recepcion) REFERENCES RECEPCION(id_recepcion),
    CONSTRAINT fk_movstock_venta FOREIGN KEY (id_venta) REFERENCES VENTA(id_venta),
    CONSTRAINT fk_movstock_notacredito FOREIGN KEY (id_nota_credito) REFERENCES NOTA_CREDITO(id_nota_credito),
    CONSTRAINT chk_movstock_tipo CHECK (tipo_movimiento IN ('entrada','salida','ajuste'))
) ENGINE=InnoDB;

-- =====================================================================
-- MÓDULO: CONTABILIDAD
-- =====================================================================

CREATE TABLE CUENTA_CONTABLE (
    codigo_cuenta  VARCHAR(20) PRIMARY KEY,
    nombre         VARCHAR(100) NOT NULL,
    tipo           VARCHAR(20) NOT NULL,
    CONSTRAINT chk_cuenta_tipo CHECK (tipo IN ('activo','pasivo','patrimonio','ingreso','gasto','costo'))
) ENGINE=InnoDB;

CREATE TABLE CUENTA_AUTOMATICA (
    operacion      VARCHAR(30) PRIMARY KEY,
    codigo_cuenta  VARCHAR(20) NOT NULL,
    CONSTRAINT fk_automatica_cuenta FOREIGN KEY (codigo_cuenta) REFERENCES CUENTA_CONTABLE(codigo_cuenta)
) ENGINE=InnoDB;

CREATE TABLE PERIODO_CONTABLE (
    id_periodo  INT AUTO_INCREMENT PRIMARY KEY,
    anio        INT NOT NULL,
    mes         INT NOT NULL,
    estado      VARCHAR(20) NOT NULL DEFAULT 'abierto', -- abierto, cerrado
    CONSTRAINT chk_periodo_mes CHECK (mes BETWEEN 1 AND 12),
    CONSTRAINT chk_periodo_estado CHECK (estado IN ('abierto','cerrado')),
    CONSTRAINT uk_periodo UNIQUE (anio, mes)
) ENGINE=InnoDB;

CREATE TABLE ASIENTO (
    id_asiento     INT AUTO_INCREMENT PRIMARY KEY,
    id_periodo     INT NOT NULL,
    id_usuario     INT NOT NULL,
    fecha          DATE NOT NULL,
    glosa          VARCHAR(255),
    origen         VARCHAR(20) NOT NULL, -- compras, ventas, manual
    id_documento   INT, -- referencia logica al documento de origen
    clave_solicitud CHAR(36), -- identificador de reintentos del asiento manual
    CONSTRAINT uk_asiento_solicitud UNIQUE (id_usuario, clave_solicitud),
    CONSTRAINT fk_asiento_periodo FOREIGN KEY (id_periodo) REFERENCES PERIODO_CONTABLE(id_periodo),
    CONSTRAINT fk_asiento_usuario FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario),
    CONSTRAINT chk_asiento_origen CHECK (origen IN ('compras','ventas','manual'))
) ENGINE=InnoDB;

CREATE TABLE DETALLE_ASIENTO (
    id_detalle     INT AUTO_INCREMENT PRIMARY KEY,
    id_asiento     INT NOT NULL,
    codigo_cuenta  VARCHAR(20) NOT NULL,
    debe           DECIMAL(12,2) NOT NULL DEFAULT 0,
    haber          DECIMAL(12,2) NOT NULL DEFAULT 0,
    CONSTRAINT fk_detalleasiento_asiento FOREIGN KEY (id_asiento) REFERENCES ASIENTO(id_asiento),
    CONSTRAINT fk_detalleasiento_cuenta FOREIGN KEY (codigo_cuenta) REFERENCES CUENTA_CONTABLE(codigo_cuenta)
) ENGINE=InnoDB;
