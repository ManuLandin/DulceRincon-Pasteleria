# Manual técnico de Dulce Rincón

Sistema de punto de venta y administración de pastelería

Versión documental 1.0 • 16 de noviembre de 2026

Este manual permite instalar, mantener y comprender la aplicación. Está dirigido al equipo de desarrollo y a quien administrará el alojamiento. El sistema utiliza HTML, CSS, JavaScript y Bootstrap en el navegador, un backend Node.js con Express y consultas SQL mediante mysql2. Gestiona catálogo, clientes, trabajadores, proveedores, compras, inventarios, recetas, ventas, pedidos y notificaciones.

## Datos que debes completar antes de entregar

| Marca | Qué debes escribir tú |
| --- | --- |
| [COMPLETAR institución] | Nombre oficial de la escuela y carrera. |
| [COMPLETAR asignatura y docente] | Nombre de la materia, grupo y profesor. |
| [COMPLETAR integrantes] | Nombres completos y función real de cada integrante. |
| [COMPLETAR responsable técnico] | Persona que conservará las credenciales, respaldos y acceso al alojamiento. No escribir contraseñas. |
| [COMPLETAR fecha de entrega] | Fecha solicitada por el docente. La fecha de esta versión documental no sustituye la de entrega. |
| [COMPLETAR versión presentada] | Identificador del paquete que sí instalaste y fecha de actualización del servidor. |

Conserva las explicaciones técnicas y sustituye únicamente las marcas. En las capturas oculta correos personales, teléfonos reales, contraseñas, secretos de sesión, hashes y cuentas bancarias. No agregues el archivo .env como anexo.

## Contenido

1. Alcance y arquitectura. 2. Componentes del proyecto. 3. Instalación local. 4. Configuración. 5. Despliegue y actualización. 6. API y permisos. 7. Reglas de negocio. 8. Integridad y seguridad. 9. Operación y mantenimiento. 10. Verificación y diagnóstico. 11. Diccionario de datos y relaciones.

<!-- PAGE -->
# Alcance y arquitectura

## Funcionalidad implementada

El visitante consulta categorías, búsqueda, fotografías y detalle de productos. Puede preparar un carrito, pero para enviar un pedido necesita una cuenta de cliente. El registro público siempre crea clientes. El rol guardado en la base determina si el inicio de sesión redirige a admin.html, trabajador.html o cliente.html.

El administrador mantiene productos, categorías, recetas, ingredientes, proveedores, compras, clientes, trabajadores y datos bancarios. El trabajador opera caja y pedidos, consulta productos e ingredientes y ve sus ventas. El cliente consulta sus pedidos y compras asociadas, acepta cotizaciones, envía referencias y edita sus datos de contacto sin cambiar el correo.

## Recorrido de una solicitud

| Capa | Responsabilidad | Elementos principales |
| --- | --- | --- |
| Navegador | Formularios, catálogo, carrito y solicitudes HTTP del mismo origen. | HTML, Bootstrap y assets/js. |
| Express | Autenticación, autorización, validaciones, coordinación de servicios y archivos autorizados. | server/app.js y server/index.js. |
| Servicios | Reglas comerciales, transacciones, notificaciones e inventarios. | management.js, commerce.js, order-payments.js y notifications.js. |
| Persistencia | Usuarios, sesiones, catálogo, pedidos, ventas e historial. | MySQL local; MariaDB en el alojamiento utilizado. |
| Archivos | Fotografías normalizadas y referencias privadas. | uploads/productos y uploads/referencias. |

La aplicación no utiliza un ORM. mysql2 ejecuta SQL parametrizado. Las migraciones son scripts propios, no un framework externo. Los servicios comparten una conexión cuando una operación debe confirmar varios cambios juntos.

## Límites del alcance

No hay pasarela que realice cargos ni verificación automática del banco. Tampoco facturación fiscal, reparto a domicilio, conversión automática de kg a gramos, producción por lotes, arqueo de turnos, promociones o recuperación automática de contraseña. El comprobante imprimible es interno. Las notificaciones son de la aplicación; no son SMS, correo ni notificaciones del sistema operativo.

## Evidencia que debes agregar

[INSERTAR CAPTURA T01] Captura del catálogo y de cada panel por rol. Identifica el rol bajo cada imagen y usa cuentas de demostración.

[COMPLETAR alcance académico] Escribe en un párrafo qué problema de la pastelería resuelve el proyecto y qué tareas desarrolló realmente el equipo. No atribuyas al sistema funciones futuras.

<!-- PAGE -->
# Componentes y requisitos del proyecto

## Estructura relevante

| Ruta desde la raíz | Uso |
| --- | --- |
| index.html, login.html, registro.html | Catálogo público y acceso compartido. |
| admin.html, trabajador.html, cliente.html | Interfaces protegidas por rol. |
| assets/css y assets/js | Estilos y comportamiento del navegador. |
| assets/vendor | Bibliotecas del frontend incluidas en el proyecto. |
| server/config.js | Variables de entorno, pool SQL y comprobación de esquema. |
| server/auth.js y server/passwords.js | Sesiones de acceso, CSRF y Argon2id. |
| server/repository.js | Consultas de autenticación y catálogo. |
| server/management.js | Usuarios, maestros, recetas y ajustes de inventario. |
| server/commerce.js | Ventas, compras, pedidos y resúmenes. |
| server/order-policy.js y order-payments.js | Horario, importes, confirmación de fecha y transferencias. |
| server/order-references.js y images.js | Fotografías, normalización y archivos privados. |
| server/transactions.js y session-store.js | Idempotencia, transacciones y sesiones SQL. |
| scripts | Preparación, migraciones, respaldos y cargas controladas. |
| tests | Pruebas de módulos, HTTP, interfaz e integración SQL. |
| backups | Respaldos y paquetes privados de despliegue. No es una carpeta pública. |

## Dependencias y entorno

Node.js debe ser versión 24 o superior conforme a package.json. El proyecto usa módulos ES mediante type module. Dependencias: Express, mysql2, express-session, express-rate-limit, helmet, argon2, multer y sharp. Supertest es dependencia de desarrollo. Las versiones instaladas de forma reproducible se fijan en package-lock.json.

Argon2 y Sharp contienen componentes nativos. Las dependencias deben instalarse en el servidor de destino; no copies node_modules de Windows a Linux. El servidor necesita permiso para conectar a SQL y escribir en sus carpetas de imágenes.

## Inventario del equipo que debes registrar

[COMPLETAR equipo] Procesador, RAM, sistema operativo y espacio disponible de la computadora utilizada. Son datos del equipo real, no requisitos mínimos medidos.

[COMPLETAR versiones] Ejecuta node --version, npm --version y SELECT VERSION() en cada entorno. Anota los resultados separados para local y alojamiento. No afirmes que MySQL y MariaDB son exactamente el mismo producto.

[INSERTAR CAPTURA T02] Terminal con versiones y estructura de carpetas, sin abrir .env ni mostrar cuentas personales.

<!-- PAGE -->
# Instalación local desde cero

## Preparación del esquema

1. Trabaja con una copia del proyecto que incluya scripts, tests y el esquema original. Abre una terminal en la raíz de Proy_pasteleria.
2. Inicia el servicio MySQL. En Workbench crea una base vacía para esta instalación y selecciona utf8mb4 con colación utf8mb4_unicode_ci.
3. Importa el SQL original aprobado por el equipo. Para una instalación de prueba vacía, tests/fixtures/original-schema.sql contiene las tablas base y roles. No ejecutarlo sobre una base existente sin revisar su contenido y el respaldo.
4. Si ya restauraste una exportación completa con todas las tablas y migraciones, no vuelvas a importar el esquema base.

```sql
CREATE DATABASE pasteleria_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pasteleria_db;
```

Los nombres anteriores corresponden al entorno local. Si eliges otro nombre, escríbelo en DB_NAME. Antes de crear una base, comprueba que no existe una con información que debas conservar.

## Dependencias y configuración

```powershell
cd "C:\[COMPLETAR ruta del proyecto]\Proy_pasteleria"
npm.cmd ci
npm.cmd run configurar
```

Abre .env localmente y completa los valores descritos en la siguiente sección. configurar genera SESSION_SECRET y conserva un .env existente; no sobrescribe sus credenciales.

```powershell
npm.cmd run db:check
npm.cmd run db:migrate
npm.cmd run db:operacion
npm.cmd run db:notificaciones
npm.cmd run crear-admin
npm.cmd start
```

Ejecuta las migraciones en ese orden. db:check sirve para diagnosticar conexión y esquema; si informa que falta la migración inicial, continúa con db:migrate y después repite la comprobación. Los scripts de operación y notificaciones utilizan marcas de migración y verificaciones para permitir su repetición.

crear-admin solicita nombre, correo, contraseña y confirmación en la terminal. Se utiliza únicamente para el primer administrador de una instalación sin administrador; no es una herramienta para restablecer contraseñas ni para crear administradores adicionales.

Abre http://127.0.0.1:3000/. El acceso se realiza en /login.html. La aplicación debe servirse por Express: abrir el HTML con doble clic o Live Server no inicia la API ni las sesiones.

[COMPLETAR evidencia de instalación] Fecha, persona que instaló, base utilizada y resultado de cada comando. [INSERTAR CAPTURA T03] Mensaje de inicio y catálogo cargado. No mostrar la contraseña elegida.

<!-- PAGE -->
# Variables de configuración

## Valores que debes establecer

| Variable | Entorno local | Alojamiento Alwaysdata |
| --- | --- | --- |
| NODE_ENV | development | production |
| HOST | 127.0.0.1 | :: para el sitio configurado en IPv6. |
| PORT | 3000 o puerto libre. | Utilizar el puerto que proporciona el panel; no fijar 3000 si el sitio exige otro. |
| DB_HOST | Servidor MySQL local. | Host de base de datos mostrado en el panel. |
| DB_PORT | Normalmente 3306. | Puerto indicado por el proveedor. |
| DB_NAME | pasteleria_db o base local elegida. | dulcerincon_pasteleria en la instalación documentada. |
| DB_USER | Usuario SQL con los permisos necesarios. | Usuario SQL autorizado sobre la base. No confundir con cliente de la pastelería. |
| DB_PASSWORD | Contraseña SQL local. | Contraseña SQL del alojamiento, que puede diferir de la de SSH. |
| SESSION_SECRET | Secreto aleatorio de al menos 32 caracteres. | Secreto propio del alojamiento, distinto del local. |
| TRUST_PROXY_HOPS | 0 para conexión directa. | 1 detrás del proxy controlado de Alwaysdata. |

El secreto de sesión no es una contraseña de cliente ni una clave bancaria. Rotarlo invalida sesiones y puede afectar la recuperación de operaciones pendientes que usan huellas ligadas al secreto. Hazlo de forma controlada y pide a los usuarios que vuelvan a iniciar sesión.

```text
NODE_ENV=development
HOST=127.0.0.1
PORT=3000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=pasteleria_db
DB_USER=[COMPLETAR usuario SQL]
DB_PASSWORD="[CONFIGURAR PRIVADAMENTE]"
SESSION_SECRET=[GENERAR PRIVADAMENTE]
TRUST_PROXY_HOPS=0
```

Este bloque es una plantilla documental, no credenciales listas para usar. En producción las cookies son Secure; por eso el sitio debe utilizar HTTPS y reconocer correctamente su proxy. No establezcas confianza universal en cabeceras enviadas por un navegador.

## Tres identidades distintas

La cuenta de Alwaysdata administra el alojamiento; SSH/SFTP permite transferir y ejecutar archivos; MySQL permite conectar la aplicación a las tablas. Las cuentas Administrador, Trabajador y Cliente existen dentro de USUARIO y se usan en login.html. No se intercambian entre sí.

[COMPLETAR ficha de entorno] Dominio público, nombre de base, ruta de trabajo y responsable de acceso. Escribe dónde se conservan las claves de forma privada, nunca sus valores.

<!-- PAGE -->
# Despliegue y actualización del servidor

## Configuración de la instalación utilizada

El dominio previsto es https://dulcerincon.alwaysdata.net. La carpeta de trabajo es /home/dulcerincon/pasteleria. El sitio debe ser de tipo Node.js y arrancar con el comando siguiente.

```bash
node --env-file=.env server/index.js
```

En el campo Environnement del sitio se utilizan HOST=::, TRUST_PROXY_HOPS=1 y NODEJS_VERSION=24. El panel suministra el puerto. La base importada en esta instalación es dulcerincon_pasteleria y el host mostrado fue mysql-dulcerincon.alwaysdata.net. Comprueba estos valores en tu panel antes de reutilizarlos.

## Instalación inicial

1. Crear base vacía y usuario SQL en el proveedor.
2. Exportar la base local y revisar compatibilidad antes de importar. El script scripts/export-alwaysdata.js genera una copia privada con nombres de tablas en mayúsculas y sin sesiones abiertas. Leer sus guardas antes de ejecutarlo.
3. Importar una sola vez en la base vacía. No reimportar sobre una base que ya tiene actividad sin un procedimiento específico de migración.
4. Subir código y fotografías. Ejecutar npm ci --omit=dev en Linux para instalar las dependencias correctas.
5. Crear .env privado en el servidor con sus credenciales y un secreto nuevo. No reutilizar el .env local.
6. Configurar Node.js, HTTPS y proxy; comprobar conexión, catálogo e inicio de sesión de cada rol.

## Actualización de código

Antes de actualizar, crea un respaldo de los archivos que serán reemplazados. Conserva aparte un respaldo SQL y las imágenes. Sube únicamente el paquete revisado, extráelo desde la carpeta de trabajo y reinicia el sitio desde Web > Sites > Restart. Después recarga el navegador con Ctrl + F5.

El paquete completo preparado el 13 de noviembre se llama dulce​rincon-actualizacion-completa-20261113.tar.gz; revisa el nombre exacto en backups antes de copiar un comando. Las actualizaciones de interfaz y reglas ya preparadas no requieren volver a importar la base. Una migración futura sí necesita su revisión y respaldo específico.

## Comprobaciones de publicación

Abre el catálogo por HTTPS; comprueba una imagen y una búsqueda; inicia sesión y verifica la redirección; confirma que /.env, /backups y /server/config.js no son públicos; realiza una prueba de pedido en un entorno de demostración separado. La copia local y la del alojamiento son bases independientes: cambiar existencias o datos bancarios en una no actualiza la otra.

[INSERTAR CAPTURA T04] Sitio Node.js, comando y carpeta del panel. Oculta las variables sensibles. [COMPLETAR despliegue validado] Fecha y versión realmente instalada; nombre y fecha del respaldo previo; pruebas realizadas y responsable.

<!-- PAGE -->
# Contrato de la API y permisos

## Rutas principales

| Método y ruta | Función y acceso |
| --- | --- |
| GET /api/categorias | Categorías activas; público. |
| GET /api/productos | Catálogo con buscar, categoria, pagina y limite; público. |
| GET /api/productos/:id | Producto activo; público. |
| GET /api/auth/csrf | Token para formularios ligado a la sesión. |
| POST /api/auth/registro | Alta de Cliente; validación y CSRF. |
| POST /api/auth/login | Acceso compartido y regeneración de sesión. |
| GET /api/auth/me | Usuario autenticado y destino por rol. |
| POST /api/auth/logout | Cierre de sesión con CSRF. |
| GET o POST /api/operacion | Consultas y acciones comerciales según rol. |
| GET o POST /api/admin/productos | Consulta administrativa o alta con foto; Administrador. |
| PUT /api/admin/productos/:id/imagen | Sustitución de foto; Administrador. |
| POST /api/pedidos-personalizados | Creación con referencias privadas, con sesión y permisos. |
| PUT /api/pedidos/:id/referencias | Sustitución antes de cotizar, según titular o personal. |
| GET /api/pedidos/:id/referencias/:idReferencia | Descarga autorizada de referencia privada. |

La operación compartida recibe {accion, datos, clave}. clave identifica el intento para recuperar el resultado sin duplicar cobros o movimientos. El servidor deriva el actor de la sesión; un id_usuario enviado en el cuerpo no reemplaza a ese actor. Las respuestas de operación contienen {datos: resultado}; los errores públicos contienen un mensaje error.

Recursos de consulta: productos, categorias, ingredientes, recetas, proveedores, trabajadores, clientes, cliente, movimientos, compras, ventas, pedidos, resumen, notificaciones y configuracionBancaria. Cada servicio autoriza su subconjunto; conocer el nombre de un recurso no concede permiso.

Acciones comerciales: prepararVenta, vender, prepararPedido, crearPedido, enviarReferencia, revisarTransferencia, cotizarPedido, aceptarCotizacion, rechazarCotizacion, actualizarPedido, cobrarPedido, entregarPedido, cancelarPedido, guardarCompra, recibirCompra y cancelarCompra. Las acciones guardar de maestros y ajustes se gestionan en management.js.

## Respuestas que ayudan a diagnosticar

400 indica datos inválidos; 401 exige sesión; 403 indica permiso o CSRF; 404 indica un recurso no disponible; 409 señala conflicto de versión, referencia repetida o regla comercial; 429 indica demasiados intentos; 503 indica que la operación no pudo completarse. No debes interpretar una respuesta incompleta o una desconexión como pago confirmado.

[INSERTAR CAPTURA T05] Herramientas del navegador con una petición de catálogo y otra rechazada por permisos. Oculta Cookie, X-CSRF-Token y datos de cuentas.

<!-- PAGE -->
# Reglas de negocio y consistencia

## Registro y contacto

El registro solicita nombre con letras y espacios, correo con formato válido, teléfono, dirección, contraseña de 12 a 25 caracteres y confirmación. Los acentos y la ñ son válidos. El teléfono tiene hasta 20 caracteres y admite formato numérico con separadores; la dirección admite hasta 255. El formato del correo no demuestra propiedad del buzón: no hay confirmación por correo.

El correo de cliente no se modifica mediante guardarCliente. El cliente edita nombre, teléfono y dirección en Editar contacto, con una confirmación explícita. Las cuentas anteriores pueden conservar acceso con contraseñas mayores de 25 caracteres; el límite nuevo corresponde al registro. La creación y edición de contraseñas de trabajadores conserva su validación propia en el código.

## Venta inmediata y pedido

La venta inmediata de Caja puede ser anónima o asociarse al correo de un cliente. Necesita productos activos con recetas y disponibilidad suficiente. Sus precios se recalculan en el servidor. Confirmar una venta descuenta unidades preparadas e ingredientes y genera la venta, sus detalles y los pagos.

El pedido requiere cliente. Puede solicitarse aunque falten existencias, pero no reserva inventario. La entrega comprueba nuevamente disponibilidad. Un pedido pagado y todavía sin entregar no es una venta completada; los resúmenes distinguen cobros recibidos de ventas para evitar duplicar anticipos.

## Pagos y entrega

Para Transferencia el pedido requiere el 100 %. Para Efectivo al recoger exige primero el 30 % por transferencia y el 70 % restante en efectivo al entregar. Los importes se calculan con enteros y redondeo comercial. Ejemplo: total $950.00, anticipo $285.00 y saldo $665.00.

La referencia enviada es una declaración pendiente. El personal consulta el banco fuera de la aplicación y después acepta o pide corrección. Aceptar registra el pago, asigna responsable y confirma por defecto la fecha solicitada. Si el horario ya venció, debe establecerse uno nuevo. Una referencia validada no puede reutilizarse para cobrar otra vez.

Estados visibles: Pendiente, En preparación, Listo y Entregado; internamente En progreso y Despachado representan preparación y entrega. Las transiciones son manuales y ordenadas. Una fecha vencida no entrega automáticamente. Adelantar o retrasar la entrega prevista requiere fecha futura, horario de 10:00 a 20:00 CDMX y motivo; el cliente recibe aviso. Cambiar estado conserva la fecha confirmada.

## Personalizados y compras

El personalizado se solicita con descripción y hasta tres referencias privadas. El personal cotiza, el cliente acepta, paga según modalidad y espera validación. No se prepara antes de aceptar cotización y transferencia. Al entregar se registra el consumo real de ingredientes.

Una compra pendiente admite correcciones. Recibirla completa incrementa ingredientes una sola vez. Después queda cerrada; una compra cancelada no suma existencias. Las unidades base son kg, litro y pieza, sin conversiones automáticas.

<!-- PAGE -->
# Seguridad y mantenimiento

## Controles existentes

Argon2id genera hashes con sal independiente. Las consultas parametrizadas separan los datos del SQL. Las sesiones se conservan en SESION_WEB y su cookie es HttpOnly, SameSite Lax y Secure en producción. El inicio de sesión regenera la sesión; las rutas verifican rol y estado activo en el servidor. CSRF protege las escrituras y los límites de solicitudes reducen intentos repetitivos.

Los importes y cantidades se manejan con precisión fija. Los cambios sensibles utilizan transacciones, bloqueos de filas y columnas version para detectar ediciones simultáneas. OPERACION conserva huella y resultado de cada clave; reintentar el mismo intento no debe duplicar efectos. Un COMMIT con respuesta perdida exige recuperación por la misma clave, no asumir que la operación se deshizo.

Las fotos de productos se normalizan con Sharp a WebP y se sirven bajo nombres UUID. Las referencias de personalizados se descargan mediante una ruta autenticada que comprueba titular o personal autorizado. Se controlan tipo real de archivo, tamaño, número de imágenes y dimensiones. El directorio raíz del proyecto no se publica como carpeta estática.

Estos controles no sustituyen una auditoría externa ni una política de operación. El usuario que confirma una transferencia es responsable de comprobar el banco; el sistema no lo consulta automáticamente.

## Respaldos y restauración

```powershell
npm.cmd run db:backup
```

El comando produce SQL privado en backups. Guarda también uploads/productos, uploads/referencias y la configuración privada de forma separada y protegida. Un SQL sin fotografías no constituye una restauración completa de los archivos.

Antes de restaurar, verifica origen, fecha y entorno. El respaldo SQL generado contiene DROP TABLE y desactiva temporalmente comprobaciones para restaurar el conjunto: nunca lo ejecutes sobre una base con información que debas conservar. Restaura primero en una base vacía de prueba, confirma relaciones, importes y archivos; realiza una restauración operativa solo con procedimiento y respaldo previo aprobados.

[COMPLETAR política de respaldo] Frecuencia elegida, responsable, ubicación privada, periodo de conservación y fecha de la última restauración comprobada. Son decisiones del equipo; el proyecto no ejecuta por sí solo una copia remota diaria.

## Cargas y datos de prueba

El seeder amplio usa una base dedicada de desarrollo o pruebas y rechaza la base original. Sus comandos son db:seed, db:seed:verify y db:seed:undo; las guardas y la reversión están explicadas en docs/database/SEEDING.md. No utilizarlo para repoblar el servidor publicado. Los scripts de catálogo y recetas originales son cargas puntuales auditadas, no tareas que deban ejecutarse en cada arranque.

<!-- PAGE -->
# Verificación y diagnóstico

## Pruebas automáticas

```powershell
npm.cmd test
```

La suite normal omite integración SQL si no se activa RUN_MYSQL_TESTS. Para probar todo en MySQL local con las credenciales privadas de .env:

```powershell
$env:RUN_MYSQL_TESTS='1'
node --env-file-if-exists=.env --test --test-concurrency=1 tests/*.test.js
Remove-Item Env:RUN_MYSQL_TESTS
```

Las pruebas SQL crean bases con nombres temporales controlados y las eliminan al terminar. Necesitan permisos para crear esas bases. No apuntes .env al servidor publicado para ejecutarlas. El registro previo del desarrollo documentó 146 aprobadas, 0 fallidas y 0 omitidas; registra la ejecución que realices antes de presentar, sin copiar ese resultado como si fuera nuevo.

## Diagnóstico operativo

| Síntoma | Comprobación y acción |
| --- | --- |
| No pudimos conectar con el servidor | Abrir mediante Express; comprobar proceso, URL y puerto. En alojamiento revisar estado y logs. |
| Correo o contraseña incorrectos | Usar la cuenta de la pastelería, no la contraseña de MySQL ni SSH. Verificar correo y estado activo. |
| La sesión se pierde en producción | Confirmar HTTPS, NODE_ENV, secreto estable y TRUST_PROXY_HOPS del proxy real. |
| No hay datos bancarios | Administrador debe configurar la cuenta en esa misma base; local y alojamiento son independientes. |
| No permite venta inmediata | Revisar unidades, receta activa e ingredientes del conjunto, no solo de cada artículo por separado. |
| No permite entregar | Revisar estado Listo, aceptación, saldo, receta e ingredientes. En personalizado capturar consumo real. |
| El formulario muestra conflicto | Recargar el registro y revisar version; otra persona pudo cambiarlo. |
| No veo cambios publicados | Verificar extracción en carpeta correcta, reiniciar sitio y recargar sin caché. |
| Fotografía no disponible | Verificar archivo UUID y permisos, no solo la URL guardada en PRODUCTO. |

## Evidencias y pendientes del equipo

[INSERTAR CAPTURA T06] Resumen de la ejecución de pruebas con fecha. [INSERTAR CAPTURA T07] Restauración de respaldo en una base temporal. [COMPLETAR incidencias conocidas] Anota error reproducible, impacto, responsable y solución o pendiente. No escribas “sin errores” si no se ejecutó el caso.

Los archivos de referencia para mantener este manual son package.json, server/config.js, server/auth.js, server/validation.js, server/management.js, server/commerce.js, server/order-policy.js, server/order-payments.js, server/notifications.js y los scripts de migración. El diccionario siguiente se genera a partir de docs/database/schema-inspected.json, que contiene estructura y no registros privados.

<!-- DICTIONARY -->
