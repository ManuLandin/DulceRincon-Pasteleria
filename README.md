# Dulce Rincón · Administración, caja y pedidos

Aplicación local con HTML, CSS, JavaScript, Bootstrap, Express y MySQL. Abre la página mediante Express, no con doble clic ni Live Server.

## Abrir

En una terminal dentro de esta carpeta:

    npm.cmd start

Mantén la terminal abierta y MySQL iniciado. Abre http://127.0.0.1:3000/login.html y usa tu cuenta existente. El rol determina el panel. El catálogo público está en http://127.0.0.1:3000/index.html.

## Qué incluye

- Catálogo real con búsqueda, categorías, ficha y fotografías propias.
- Administrador: productos, categorías, recetas, ingredientes y ajustes con motivo, proveedores y compras, clientes y trabajadores separados, caja, pedidos, ventas y resumen real.
- Trabajador: caja, consulta de productos/ingredientes, cotizaciones, cobros, estados, responsables, fechas y entrega de pedidos; consulta de sus ventas. No administra usuarios ni proveedores.
- Cliente: pedidos del catálogo, solicitudes personalizadas, aceptación/rechazo de cotización, fechas y retrasos, pagos/saldo, compras asociadas por correo y contacto propio.
- Movimientos auditables; recepción y entrega atómicas; claves persistidas para evitar repetir efectos al reintentar.
- Registro público siempre Cliente. Solo el administrador crea trabajadores. Contraseñas Argon2id, sesiones MySQL, permisos de servidor, CSRF y consultas parametrizadas.

## Preparar ingredientes y vender

1. Ingredientes: registra cada insumo con su unidad base (kg, litro o pieza), existencia inicial y mínimo. Esa unidad se usa también en compras y recetas.
2. Productos: alta con foto obligatoria, datos y unidades disponibles. Para cambios de existencias utiliza Ajustar unidades con motivo.
3. Recetas: configura ingredientes y cantidades por una unidad vendible de cada producto. Los productos antiguos requieren esta configuración antes de venderse; no se inventan recetas.
4. Caja: añade artículos y cantidades. Para asociar cuenta busca el correo del cliente; la venta ordinaria también admite Público general.
5. Revisa importe, disponibilidad y método. Registrar venta descuenta unidades e ingredientes y genera comprobante interno imprimible.

Los ingredientes se descuentan al vender, según lo acordado. Los ajustes de productos preparados no consumen ingredientes. Un producto sin receta o sin existencias no se cobra como venta inmediata; puede pedirse con cuenta para entrega posterior.

## Proveedores y compras

Registra proveedor y compra con ingredientes, cantidades y precios. Mientras esté Pendiente puedes corregir las líneas. Abre su detalle y confirma Recibir cantidades definitivas: cambia a Entregada (Recibida en MySQL) y suma inventario una sola vez. Después queda cerrada para edición. Una pendiente puede cancelarse; las correcciones posteriores de inventario se registran como ajustes con motivo.

## Pedidos y personalizados

Los pedidos requieren cuenta de cliente. Un pedido de catálogo conserva los precios al crearse y puede entrar aunque falten ingredientes. El personal confirma o reprograma fecha y motivo, visibles en Mis pedidos. No hay reservas automáticas de stock.

Personalizado: el cliente describe el encargo y fecha deseada; el personal cotiza importe y fecha; el cliente acepta desde su cuenta. No puede prepararse antes de aceptar. Al entregar se declaran los ingredientes realmente utilizados, sin agregar un producto ficticio al catálogo.

Flujo: Pendiente → En preparación → Listo → Entregado. Registra anticipos y pagos posteriores con efectivo, tarjeta o transferencia. La aplicación registra el cobro; los cargos bancarios se hacen por fuera. Para entregar se necesita saldo cero y existencias; la misma operación puede cobrar el saldo final. Si falla inventario, el último cobro y la entrega no se guardan parcialmente.

El resumen separa ventas completadas y cobros recibidos para no duplicar anticipos. Pedido pagado sin entregar todavía no es una venta completada.

Cancelación antes de preparar sin pagos: cliente/personal. Con anticipos, solo administrador registra devolución manual completa y cancelación antes de entregar. No hay devoluciones de ventas completadas, reembolsos parciales ni devoluciones a proveedores en este avance.

## Configuración y migraciones

Requiere Node24+ y el esquema original en MySQL. Para una instalación nueva del proyecto:

    npm.cmd install
    npm.cmd run configurar

Completa DB_PASSWORD localmente en .env sin compartirla. Después:

    npm.cmd run db:check
    npm.cmd run db:migrate
    npm.cmd run db:operacion
    npm.cmd run db:notificaciones
    npm.cmd run crear-admin
    npm.cmd start

Tu instalación ya tiene cuenta y migraciones aplicadas: no necesitas crear otro administrador. db:operacion guarda primero un respaldo SQL en backups y amplía las tablas sin borrar registros; es repetible. Las existencias anteriores quedan como saldos de apertura. No reconstruye recetas o compras antiguas inventadas.

    npm.cmd run db:backup

Respalda la BD, uploads/productos y uploads/referencias (imágenes privadas). El SQL contiene datos privados y hashes: no compartir ni publicar backups ni .env. El servidor solo expone páginas/assets/fotos y nunca la raíz del proyecto.

## Pruebas

    npm.cmd test
    npm.cmd audit

Las pruebas HTTP y de módulos están aisladas. Las pruebas de transacciones MySQL crean bases temporales con nombre generado dulcerincon_test_..., usan únicamente fixtures y eliminan exclusivamente esas bases al terminar. Se activan en PowerShell con:

    $env:RUN_MYSQL_TESTS='1'
    npm.cmd run test:mysql
    Remove-Item Env:RUN_MYSQL_TESTS

Incluyen concurrencia de último stock, recepción repetida, entrega con último cobro y rollback, aceptación de cotización ajena/obsoleta, consumos históricos, devoluciones, migración repetible y restauración de respaldo conservando fechas.

Tests/operation-preview-server.js usa otra base temporal para QA de navegador en puerto3002. Sus cuentas @example.test y productos QA NO corresponden a la aplicación real del puerto3000. Las capturas de QA se identifican como datos de prueba.

## Límites acordados

Pasarela bancaria, facturación fiscal, producción por lotes, conversión de unidades, promociones, entrega a domicilio, turnos/arques de efectivo y publicación en Internet quedan para otra etapa. No se muestran botones ficticios para estas funciones.

La portada conserva domicilio/contacto pendientes de confirmar. El sistema escucha localmente en127.0.0.1; no se publicó en Internet.


## Notificaciones, transferencias y recogida

Abre http://127.0.0.1:3000/login.html con Express iniciado. El administrador debe capturar su cuenta real desde «Configuración bancaria»; no se instalaron datos bancarios ficticios en la base real. Guarda banco, titular, CLABE e instrucciones. Sin esa configuración se pueden solicitar personalizados para cotizar, pero no enviar referencias de pago.

Los pedidos nuevos del catálogo requieren referencia de transferencia: 100 % para Transferencia, o anticipo del 30 % para Efectivo al recoger. Se muestra el importe exacto y el saldo. Una referencia declarada todavía no es un pago: el trabajador revisa el ingreso fuera de la aplicación y entra a «Revisar transferencias» para aceptar o pedir corrección con motivo. Al aceptar se registra el pago y se asigna responsable. Las correcciones conservan los intentos anteriores y una referencia confirmada no puede reutilizarse. Un pedido con referencia pendiente de revisión no se cancela hasta resolverla.

Los personalizados permiten hasta tres imágenes JPG/PNG/WebP (5 MiB y 16 millones de píxeles por imagen), privadas para su cliente y el personal. Primero se solicita y cotiza, el cliente acepta el precio y después realiza el pago requerido y envía su referencia. Las imágenes se pueden sustituir antes de cotizar. No se publican en la carpeta de fotografías de productos.

La campana y la sección «Notificaciones» avisan de solicitudes nuevas y cambios de pedidos. Se actualizan cada 15 segundos con la página visible y al volver a ella. Cada persona consulta sus avisos y puede marcarlos como leídos. No se envían correos ni avisos del sistema operativo.

Se pueden enviar solicitudes a cualquier hora, pero las fechas de recogida nuevas deben estar entre las 10:00 y las 20:00 (Ciudad de México). Los pedidos previos conservan sus condiciones y pagos históricos; no se ofrecen pagos nuevos con tarjeta. En mostrador se mantiene la venta inmediata en efectivo sin cuenta obligatoria; una transferencia debe verificarse antes de cobrar. El estado «Entregado» se confirma manualmente, nunca por llegar la fecha.

La migración db:notificaciones crea primero un respaldo SQL privado y añade estructuras sin borrar pedidos. Las referencias privadas cuya confirmación SQL se interrumpa se conservan hasta reconciliar su estado con la BD, al iniciar y cada minuto. Mantén también respaldada su carpeta privada.


## Avisos por rol (12 de noviembre de 2026)

La campana y «Notificaciones» muestran un historial privado por cuenta. El cliente recibe novedades de sus pedidos; el trabajador recibe solicitudes nuevas y avisos operativos de los pedidos que atiende. El administrador recibe pedidos nuevos, cambios a Listo y entregas, ventas completadas, y compras a proveedores creadas, recibidas o canceladas. Incluye sus propias operaciones para reflejar la actividad general.

Los avisos identifican Pedidos, Entregas, Ventas o Compras y abren el registro correspondiente. Pasar a Listo avisa una vez; editar un pedido que ya estaba listo conserva los avisos normales del cliente sin repetir la alerta general de Listo. Una entrega también produce su aviso de venta completada; los anticipos o referencias pendientes no se anuncian como ventas.

Se generan avisos a partir de nuevas operaciones, sin reconstruir eventos antiguos. Se conservan los avisos previos y su estado de lectura. La preparación se instala con db:notificaciones, que respalda antes de ampliar las tablas. Cada aviso se confirma en la misma transacción que su operación y no se duplica por reintentos.


## Carga inicial de desarrollo

Se incorporó un seeder seguro de datos ficticios, sin cambios de esquema ni ejecución sobre la base actual. Consulta [la guía de carga, verificación en Workbench y reversión](docs/database/SEEDING.md). Los comandos son `db:seed`, `db:seed:verify` y `db:seed:undo`. Exigen entorno development/test, MySQL local, una base dedicada con sufijo _dev/_test y confirmación exacta de su nombre. Nunca apuntarlos a producción. La contraseña temporal se obtiene de SEED_PASSWORD y se protege con Argon2id.
