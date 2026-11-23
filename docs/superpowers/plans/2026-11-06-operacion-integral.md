# Operación integral Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Conectar administración, caja y pedidos de clientes con movimientos auditables, cobros y permisos reales.

**Architecture:** Mantener Express y MySQL. Separar administración de maestros, transacciones comerciales y control HTTP; usar un contrato común para conectar las pantallas sin mezclar permisos o SQL en el navegador. Las tareas de archivos independientes pueden ejecutarse en paralelo según dispatching-parallel-agents, conservando revisión integral final.

**Tech Stack:** HTML/CSS/JS/Bootstrap, Node 24, Express 5, MySQL2/InnoDB, Argon2id; pruebas node:test/Supertest y MySQL aislado.

**Spec:** docs/superpowers/specs/2026-11-06-operacion-integral-design.md (aprobada).

## Global Constraints

- No recrear la BD, borrar registros reales, inventar datos ni exponer secretos; respaldar antes de migrar.
- No Git inicializado: sin commits/worktrees; conservar el avance en docs/superpowers/plans/2026-11-06-operacion-integral-progress.md.
- Roles y CSRF del lado servidor. Solo admin crea trabajadores. Cada cliente accede a sus propios datos.
- Dinero en centavos y cantidades en milésimas, operaciones atómicas e idempotentes; sin existencias negativas.
- Personalizados requieren cuenta, cotización aceptada y consumo real al entregar; notificaciones fuera de alcance.
- Todas las propuestas de la especificación fueron aprobadas. No pedir otra autorización por operaciones incluidas y reversibles.

## Review Focus

- Dos cajas venden el último ingrediente: solo una operación puede confirmarse y la otra conserva todo sin cambios.
- Reintento tras perder conexión: recuperar mismo folio y nunca repetir cobro/entrega/recepción.
- Cliente acepta una cotización antigua o ajena: rechazar sin modificar el pedido.
- Anticipos en fechas diferentes de entrega: separar dinero cobrado y ventas completadas sin duplicar métricas.
- Cambiar recetas después de vender: los consumos históricos conservan las cantidades realmente aplicadas.

## Contrato compartido y estructura

Se implementa API autenticada GET/POST `/api/operacion`.

GET `?recurso=...&id=...&buscar=...&pagina=...&desde=...&hasta=...` devuelve `{datos: resultado}`.
POST cuerpo JSON `{accion, datos, clave}` devuelve `{datos: resultado}`; clave UUID persistida para escrituras comerciales; CSRF siempre.

Los servicios exportan `createManagement(pool)` y `createCommerce(pool)` con `read(actor,recurso,query)` y `write(actor,accion,datos,clave)`. actor usa `{id_usuario,rol,nombre,correo,activo}` del acceso actual. Un recurso no propio devuelve `undefined` y HTTP deriva al otro servicio; una acción propia sin permiso arroja AppError403. Los listados retornan `{items,total,pagina,limite}`. Un GET con id retorna detalle completo.

CRUD: acciones `guardarProducto`, `guardarCategoria`, `guardarIngrediente`, `ajustarIngrediente`, `ajustarProducto`, `guardarReceta`, `guardarProveedor`, `guardarTrabajador`, `guardarCliente`; datos.id opcional (crear sin id), version requerida para editar, activo boolean/0/1.
Lecturas de maestros: `productos`, `categorias`, `ingredientes`, `recetas`, `proveedores`, `trabajadores`, `clientes`, `cliente`, `movimientos`.

Comercio: `guardarCompra`, `recibirCompra`, `cancelarCompra`, `vender`, `crearPedido`, `cotizarPedido`, `aceptarCotizacion`, `rechazarCotizacion`, `actualizarPedido`, `cobrarPedido`, `entregarPedido`, `cancelarPedido`.
Lecturas: `compras`, `ventas`, `pedidos`, `resumen`. Detalles usan id y retornan `{...cabecera,detalles,pagos,historial}` según proceda.

Datos de líneas compra/receta/consumo: `{id_ingrediente,cantidad,precio_unitario?}` en `detalles`. Venta/pedido ordinario: `detalles:[{id_producto,cantidad}]`, `id_cliente?`, `metodo_pago`, `referencia?`, `recibido?`. Personalizado: `tipo:'Personalizado',descripcion_personalizada,fecha_solicitada`. crearPedido por cliente toma id de sesión; personal exige id_cliente activo. Los datos monetarios y cantidades se transmiten como strings decimales. Pedido: `id`, `version`, `fecha_entrega`, `motivo_retraso`, `estado`, `id_trabajador?`; cotización `total`, aceptación `cotizacion_version`; cobrar `importe,metodo_pago`; entrega `detalles` consumo personalizado, `pago:{importe,metodo_pago,referencia}?`.

Lectura productos incluye receta/disponibilidad y versión. Recetas incluyen detalles. Catálogo público y upload/fotos conservan rutas API actuales. Buscar cliente para caja no devuelve historial completo ni hashes.

### Task 1: Datos, decimales, transacciones y migración

**Files:** server/amounts.js, server/transactions.js, scripts/migrate-operation.js, scripts/backup.js, tests/amounts.test.js, tests/operation-mysql.test.js, package.json, .gitignore.

**Interfaces:** amounts exporta parseMoney(value), parseQuantity(value) (enteros escalados), money(cents), quantity(mills), lineTotal(mills,cents). transactions exporta transaction(pool,callback) y once(connection,actor,accion,clave,datos,callback). once persiste huella estable y resultado y rechaza clave reutilizada con otro contenido.

- [x] Escribir pruebas de decimales inválidos, redondeo comercial, grandes importes sin pérdida; ejecutar para observar módulo ausente.
- [x] Implementar cantidades exactas con BigInt en multiplicaciones y límites de columnas; ejecutar pruebas.
- [x] Crear migración idempotente con tablas y columnas del contrato de abajo, sin datos de ejemplo, y respaldo SQL consistente local.
- [x] Verificar primero en BD exclusiva de pruebas, incluyendo segunda ejecución, rollback y repetición/concurrencia de once; aplicar a la real después del respaldo.

Contrato SQL nuevo:
- OPERACION(id_operacion,id_usuario,clave VARCHAR64,accion VARCHAR64,huella CHAR64,resultado JSON,fecha), UNIQUE(id_usuario,clave).
- PAGO(id_pago,id_pedido NULL,id_venta NULL,importe DECIMAL10,2,metodo_pago VARCHAR30,id_usuario NULL,referencia VARCHAR100 NULL,devuelto boolean default0,fecha); pertenece a pedido o venta inmediata.
- DEVOLUCION(id_devolucion,id_pedido,importe,metodo_pago VARCHAR30,id_usuario,motivo VARCHAR255,fecha).
- MOVIMIENTO_INGREDIENTE(id_movimiento,id_ingrediente,cantidad DECIMAL12,3,existencia_resultante DECIMAL12,3,unidad VARCHAR20,tipo VARCHAR30,id_compra NULL,id_venta NULL,id_usuario NULL,motivo VARCHAR255,fecha).
- MOVIMIENTO_PRODUCTO(id_movimiento,id_producto,cantidad INT,existencia_resultante INT,tipo VARCHAR30,id_venta NULL,id_usuario NULL,motivo VARCHAR255,fecha).
- HISTORIAL_PEDIDO(id_historial,id_pedido,id_usuario NULL,accion VARCHAR50,detalle JSON,fecha).
- MIGRACION_WEB(nombre VARCHAR100 PRIMARY KEY,fecha).
- version INT default1 en PRODUCTO, INGREDIENTE, PROVEEDOR, RECETA, USUARIO, PEDIDO y COMPRA; categorías también version default1.
- VENTA.id_cliente NULL, enum metodo_pago añade Mixto, UNIQUE(id_pedido).
- PEDIDO.tipo VARCHAR20 default Catalogo; descripcion_personalizada TEXT NULL; fecha_solicitada DATETIME NULL; motivo_retraso VARCHAR255 NULL; cotizacion_estado VARCHAR30 default No aplica; cotizacion_version INT default0; aceptada_version INT NULL; aceptada_fecha DATETIME NULL.
- DETALLE_PEDIDO/DETALLE_VENTA id_producto nullable y nombre VARCHAR100 NULL snapshot; personalizada crea línea sin producto.
- Índices/FKs según referencias; aperturas técnicas una vez, anticipo previo identificado como saldo inicial sin cobro actual.

### Task 2: Maestros y fichas de usuarios

**Files:** server/management.js, tests/management.test.js. No editar archivos de otras tareas.
**Interfaces:** createManagement(pool).read/write del contrato; usa amounts y transactions de tarea1.

- [x] Escribir pruebas que fallen para permisos de trabajadores/clientes, validaciones de unidades/recetas y ficha sin duplicación.
- [x] Implementar consultas paginadas parametrizadas, edición con versión y desactivación conservando históricos.
- [x] Trabajador se crea mediante hashPassword y role por nombre; no permitir escalamiento ni devolver hashes.
- [x] Ingredientes/unidades/ajustes con motivo y movimientos, recetas de una unidad, edición de productos sin sobrescribir existencias, categorías y proveedores.
- [x] Ficha de cliente y movimientos, datos mínimos en caja; saldos y compras agregados sin joins que dupliquen importes.
- [x] Ejecutar pruebas y entregar contrato exacto de respuestas a tarea4.

### Task 3: Transacciones de compras, caja y pedidos

**Files:** server/commerce.js, tests/commerce.test.js. No editar archivos de otras tareas.
**Interfaces:** createCommerce(pool).read/write del contrato; amounts y transactions tarea1; SQL del contrato anterior.

- [x] Escribir pruebas que fallen para estados, roles, titulares, aceptación de versión, cálculos y operaciones repetidas.
- [x] Compras pendientes editables y recepción atómica con locks y movimientos; cancelación sin stock.
- [x] Venta inmediata con cliente nullable, precio servidor, recipe consumption, producto e ingredientes atómicos y pago; folio id devuelto.
- [x] Pedidos ordinarios y personalizados, cotización/aceptación con versiones, estados, asignación, reprogramación, pagos y entrega atómica.
- [x] Cancelación de pendientes sin pago y devolución manual completa solo admin antes de entregar.
- [x] Historial y resumen real, métodos mixtos, saldo exacto, métricas de caja sin doble conteo de anticipos. Periodos en America/Mexico_City.
- [x] Ejecutar pruebas aisladas y MySQL de concurrencia/rollback/receta histórica en tarea5.

### Task 4: HTTP y pantallas completas

**Files root:** server/operations.js, server/app.js, server/index.js, tests/operations-http.test.js.
**Files interfaz:** admin.html, trabajador.html, cliente.html, assets/js/workspace.js, assets/js/customer-orders.js, assets/js/shared.js, assets/js/catalog.js, assets/css/operations.css; conservar api.js/account.js y photo workflow compatibles.
**Interfaces:** API descrita arriba. DR.request devuelve `{datos}`.

- [x] Pruebas HTTP fallan para anónimo, CSRF, roles y aislamiento de cliente; montar rutas con servicios inyectables para pruebas actuales.
- [x] Reutilizar requireUser y CSRF, validar envelope/recurso, errores seguros; nunca exponer raíz/config/copias.
- [x] Listados y formularios reales para cada sección, caja compartida admin/trabajador, ficha de cliente al seleccionar.
- [x] Mantener fotos: alta/upload existente más edición por nueva API; recetas e ingredientes con unidades visibles.
- [x] Cliente crea pedidos ordinarios y personalizados, acepta/rechaza, consulta compras y saldo; público lleva a acceso para pedir.
- [x] Retirar cifras/notificaciones/prototipos de muestra, navegación real, fechas actuales, comprobante imprimible.
- [x] Revisar escritorio/móvil y teclado con datos de QA aislados; corregir errores observados.

### Task 5: Integración, revisión y entrega

**Files:** tests/operation-mysql.test.js, README.md, docs/preview/operacion-integral/, archivo de progreso.

- [x] BD de pruebas exclusiva con esquema original y migraciones: compra corregida/recepción una vez, dos ventas último stock, fallo de entrega con pago, personalizada ajena/obsoleta, recetas históricas, reprogramación y cancelación con devolución.
- [x] npm.cmd test: todas verdes; npm.cmd audit: sin vulnerabilidades nuevas.
- [x] Respaldo y migración real, verificar solo estructura y salud; no crear productos, cuentas ni ventas ficticias en datos reales.
- [x] Revisión independiente final contra especificación. Corregir hallazgos importantes con regresiones y repetir suite.
- [x] Documentar uso y límites, dejar Express disponible y proporcionar enlace al administrador. Informar qué se verificó realmente.
