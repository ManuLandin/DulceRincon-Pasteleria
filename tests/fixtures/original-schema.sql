-- 1. ROLES
CREATE TABLE ROL (
    id_rol INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion VARCHAR(255)
);

-- 2. USUARIOS
CREATE TABLE USUARIO (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    id_rol INT NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    correo VARCHAR(100) NOT NULL UNIQUE,
    contrasena_hash VARCHAR(255) NOT NULL,
    telefono VARCHAR(20),
    direccion VARCHAR(255),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_rol) REFERENCES ROL(id_rol)
);

-- 3. CATEGORIAS
CREATE TABLE CATEGORIA_PRODUCTO (
    id_categoria INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion VARCHAR(255),
    activo BOOLEAN NOT NULL DEFAULT TRUE
);

-- 4. PRODUCTOS
CREATE TABLE PRODUCTO (
    id_producto INT AUTO_INCREMENT PRIMARY KEY,
    id_categoria INT NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion VARCHAR(255),
    precio DECIMAL(10,2) NOT NULL,
    existencia INT NOT NULL DEFAULT 0,
    stock_minimo INT NOT NULL DEFAULT 0,
    unidad VARCHAR(20) DEFAULT 'pieza',
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    FOREIGN KEY (id_categoria)
        REFERENCES CATEGORIA_PRODUCTO(id_categoria),
    CHECK (precio >= 0),
    CHECK (existencia >= 0),
    CHECK (stock_minimo >= 0)
);

-- 5. PROVEEDORES
CREATE TABLE PROVEEDOR (
    id_proveedor INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    telefono VARCHAR(20),
    correo VARCHAR(100),
    direccion VARCHAR(255),
    activo BOOLEAN NOT NULL DEFAULT TRUE
);

-- 6. INGREDIENTES
CREATE TABLE INGREDIENTE (
    id_ingrediente INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    unidad VARCHAR(20) NOT NULL,
    existencia DECIMAL(12,3) NOT NULL DEFAULT 0,
    stock_minimo DECIMAL(12,3) NOT NULL DEFAULT 0,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    CHECK (existencia >= 0),
    CHECK (stock_minimo >= 0)
);

-- 7. RECETAS
CREATE TABLE RECETA (
    id_receta INT AUTO_INCREMENT PRIMARY KEY,
    id_producto INT NOT NULL UNIQUE,
    nombre VARCHAR(100) NOT NULL,
    descripcion VARCHAR(255),
    rendimiento INT NOT NULL DEFAULT 1,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    FOREIGN KEY (id_producto)
        REFERENCES PRODUCTO(id_producto),
    CHECK (rendimiento > 0)
);

-- 8. DETALLE DE RECETAS
CREATE TABLE DETALLE_RECETA (
    id_detalle_receta INT AUTO_INCREMENT PRIMARY KEY,
    id_receta INT NOT NULL,
    id_ingrediente INT NOT NULL,
    cantidad DECIMAL(12,3) NOT NULL,
    FOREIGN KEY (id_receta)
        REFERENCES RECETA(id_receta),
    FOREIGN KEY (id_ingrediente)
        REFERENCES INGREDIENTE(id_ingrediente),
    UNIQUE (id_receta, id_ingrediente),
    CHECK (cantidad > 0)
);

-- 9. PEDIDOS
CREATE TABLE PEDIDO (
    id_pedido INT AUTO_INCREMENT PRIMARY KEY,
    id_cliente INT NOT NULL,
    id_trabajador INT NULL,
    fecha_pedido DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_entrega DATETIME NULL,
    estado ENUM(
        'Pendiente',
        'En progreso',
        'Listo',
        'Despachado',
        'Cancelado'
    ) NOT NULL DEFAULT 'Pendiente',
    total DECIMAL(10,2) NOT NULL DEFAULT 0,
    anticipo DECIMAL(10,2) NOT NULL DEFAULT 0,
    observaciones VARCHAR(255),
    FOREIGN KEY (id_cliente)
        REFERENCES USUARIO(id_usuario),
    FOREIGN KEY (id_trabajador)
        REFERENCES USUARIO(id_usuario),
    CHECK (total >= 0),
    CHECK (anticipo >= 0),
    CHECK (anticipo <= total)
);

-- 10. DETALLE DE PEDIDOS
CREATE TABLE DETALLE_PEDIDO (
    id_detalle_pedido INT AUTO_INCREMENT PRIMARY KEY,
    id_pedido INT NOT NULL,
    id_producto INT NOT NULL,
    cantidad INT NOT NULL,
    precio_unitario DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2)
        GENERATED ALWAYS AS (cantidad * precio_unitario) STORED,
    FOREIGN KEY (id_pedido)
        REFERENCES PEDIDO(id_pedido),
    FOREIGN KEY (id_producto)
        REFERENCES PRODUCTO(id_producto),
    CHECK (cantidad > 0),
    CHECK (precio_unitario >= 0)
);

-- 11. VENTAS
CREATE TABLE VENTA (
    id_venta INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL,
    id_pedido INT NULL,
    fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    total DECIMAL(10,2) NOT NULL,
    metodo_pago ENUM(
        'Efectivo',
        'Tarjeta',
        'Transferencia'
    ) NOT NULL,
    estado ENUM(
        'Pagada',
        'Cancelada'
    ) NOT NULL DEFAULT 'Pagada',
    FOREIGN KEY (id_usuario)
        REFERENCES USUARIO(id_usuario),
    FOREIGN KEY (id_pedido)
        REFERENCES PEDIDO(id_pedido),
    CHECK (total >= 0)
);

-- 12. DETALLE DE VENTAS
CREATE TABLE DETALLE_VENTA (
    id_detalle_venta INT AUTO_INCREMENT PRIMARY KEY,
    id_venta INT NOT NULL,
    id_producto INT NOT NULL,
    cantidad INT NOT NULL,
    precio_unitario DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2)
        GENERATED ALWAYS AS (cantidad * precio_unitario) STORED,
    FOREIGN KEY (id_venta)
        REFERENCES VENTA(id_venta),
    FOREIGN KEY (id_producto)
        REFERENCES PRODUCTO(id_producto),
    CHECK (cantidad > 0),
    CHECK (precio_unitario >= 0)
);

-- 13. COMPRAS A PROVEEDORES
CREATE TABLE COMPRA (
    id_compra INT AUTO_INCREMENT PRIMARY KEY,
    id_proveedor INT NOT NULL,
    id_usuario INT NOT NULL,
    fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    total DECIMAL(10,2) NOT NULL DEFAULT 0,
    estado ENUM(
        'Pendiente',
        'Recibida',
        'Cancelada'
    ) NOT NULL DEFAULT 'Pendiente',
    observaciones VARCHAR(255),
    FOREIGN KEY (id_proveedor)
        REFERENCES PROVEEDOR(id_proveedor),
    FOREIGN KEY (id_usuario)
        REFERENCES USUARIO(id_usuario),
    CHECK (total >= 0)
);

-- 14. DETALLE DE COMPRAS
CREATE TABLE DETALLE_COMPRA (
    id_detalle_compra INT AUTO_INCREMENT PRIMARY KEY,
    id_compra INT NOT NULL,
    id_ingrediente INT NOT NULL,
    cantidad DECIMAL(12,3) NOT NULL,
    precio_unitario DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(12,2)
        GENERATED ALWAYS AS (cantidad * precio_unitario) STORED,
    FOREIGN KEY (id_compra)
        REFERENCES COMPRA(id_compra),
    FOREIGN KEY (id_ingrediente)
        REFERENCES INGREDIENTE(id_ingrediente),
    CHECK (cantidad > 0),
    CHECK (precio_unitario >= 0)
);

-- ROLES INICIALES
INSERT INTO ROL (nombre, descripcion) VALUES
('Administrador', 'Acceso completo al sistema'),
('Trabajador', 'Gestiona ventas, pedidos e inventario'),
('Cliente', 'Consulta productos y realiza pedidos');

-- CATEGORIAS DE EJEMPLO
INSERT INTO CATEGORIA_PRODUCTO (nombre, descripcion) VALUES
('Pasteles', 'Pasteles completos'),
('Cupcakes', 'Cupcakes individuales'),
('Galletas', 'Galletas y reposteria'),
('Postres', 'Otros postres');

