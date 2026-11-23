# Datos iniciales de desarrollo

Este seeder **no se ejecutó sobre la base actual**. Se verificó exclusivamente en bases temporales creadas como entornos de pruebas. No modifica el esquema, no ejecuta migraciones, no desactiva claves foráneas y no borra ni sobrescribe datos anteriores al lote.

## Análisis del proyecto

Node24+, Express y MySQL mediante consultas SQL parametrizadas con `mysql2`; no hay ORM. Las migraciones propias son `migrate.js`, `migrate-operation.js` y `migrate-notifications.js`. Se reutiliza Argon2id de `server/passwords.js`, dinero en centavos y cantidades en milésimas de `server/amounts.js`.

La inspección real de solo lectura identificó **27 tablas y 214 campos**. `schema-inspected.json` contiene todos los campos, tipos, nulabilidad, valores predeterminados, columnas generadas, PK, índices únicos, FK, restricciones CHECK y reglas de eliminación/actualización. Para repetir solo esta inspección: `npm.cmd run db:inspect`. No lee filas de la aplicación.

Tablas: ROL, USUARIO, CATEGORIA_PRODUCTO, PRODUCTO, PROVEEDOR, INGREDIENTE, RECETA, DETALLE_RECETA, PEDIDO, DETALLE_PEDIDO, VENTA, DETALLE_VENTA, COMPRA, DETALLE_COMPRA; SESION_WEB; MIGRACION_WEB, OPERACION, PAGO, DEVOLUCION, MOVIMIENTO_INGREDIENTE, MOVIMIENTO_PRODUCTO, HISTORIAL_PEDIDO; CONFIG_BANCARIA, INTENTO_TRANSFERENCIA, TRANSFERENCIA_VALIDADA, NOTIFICACION, REFERENCIA_PEDIDO.

Las PK autoincrementales y FK existentes se respetan; nunca se suponen sus valores. ROL y la categoría activa Pasteles se buscan por nombre y se reutilizan. Las columnas `subtotal` de detalles son generadas por MySQL y no se insertan. Los estados se almacenan como `Pendiente` (no iniciado), `En progreso` y `Despachado` (entregado).

## Preparar y confirmar una base dedicada

**No apuntes el comando a producción.** El seeder exige todas estas condiciones:

- NODE_ENV explícito `development` o `test`.
- Servidor MySQL local (`127.0.0.1`, `localhost` o `::1`).
- Nombre de base terminado en `_dev` o `_test`. También acepta únicamente el patrón generado por los fixtures temporales.
- `SEED_CONFIRM_DB` debe coincidir exactamente con DB_NAME y con `SELECT DATABASE()`.
- La base debe tener las migraciones existentes ya aplicadas.

El nombre habitual `pasteleria_db` está bloqueado, incluso con NODE_ENV=development. Esto evita clasificar accidentalmente como desarrollo la base que usas diariamente. Confirmar variables no convierte una base de producción en desarrollo: utiliza una base dedicada y vacía, nunca una copia con datos personales reales.

Si aún no tienes una base de desarrollo, créala tú en Workbench, por ejemplo `pasteleria_dev`. Antes de importar cualquier SQL, confirma que esa base esté seleccionada como esquema predeterminado (`SELECT DATABASE();`). Abre el archivo existente `tests/fixtures/original-schema.sql` y ejecútalo **solo en esa base nueva y vacía**: crea el esquema original con roles y categorías, sin usuarios reales. Luego aplica las migraciones ya existentes con la configuración de desarrollo de abajo. El seeder no crea bases ni tablas por su cuenta.

## Ejecutar desde PowerShell

Abre la terminal en `C:\Users\juanm\Documents\ESCUELA\SEPTIMO\software\Proy_pasteleria`.

```powershell
$env:NODE_ENV = 'development'
$env:DB_NAME = 'pasteleria_dev'
$env:SEED_CONFIRM_DB = 'pasteleria_dev'
```

La conexión usa DB_HOST/DB_PORT/DB_USER/DB_PASSWORD locales ya configurados en `.env`; las variables de esta terminal tienen prioridad sobre DB_NAME de ese archivo. No cambies `.env` para apuntar la aplicación diaria a datos ficticios. No publiques `.env` ni respaldos.

Si la nueva base solo tiene el esquema original, prepara **exclusivamente esa base de desarrollo** con:

```powershell
npm.cmd run db:migrate
npm.cmd run db:operacion
npm.cmd run db:notificaciones
```

Estos tres comandos son migraciones existentes, no parte del seeder. No se necesitan si la base dedicada ya está preparada.

Solicita la contraseña temporal sin escribirla en el historial de comandos:

```powershell
$demoPassword = Read-Host 'Contraseña temporal de 12 a 128 caracteres' -AsSecureString
$env:SEED_PASSWORD = [System.Net.NetworkCredential]::new('', $demoPassword).Password
npm.cmd run db:seed
Remove-Item Env:SEED_PASSWORD
Remove-Variable demoPassword
npm.cmd run db:seed:verify
```

No hay contraseña predeterminada ni credenciales de producción en los archivos. Cada cuenta obtiene un hash Argon2id con sal distinta. La contraseña temporal que introduzcas será la de las nueve cuentas; no se imprime ni se guarda en texto plano en el lote. Vuelve a definir SEED_PASSWORD si repites `db:seed`; la repetición **no cambia** las contraseñas existentes.

Para ver los datos en la aplicación, usa una terminal de desarrollo con estas mismas variables y ejecuta `npm.cmd start`, tras cerrar la instancia anterior si ocupa el puerto. No cambies las variables de una sesión que atienda una base de producción.

## Cuentas ficticias

| Rol | Nombre | Correo de prueba |
|---|---|---|
| Administrador | Ana | ana.seed-v1@example.test |
| Trabajador | Emiliano | emiliano.seed-v1@example.test |
| Trabajador | Marco | marco.seed-v1@example.test |
| Trabajador | Sofía | sofia.seed-v1@example.test |
| Cliente | Juan Carlos | juan.carlos.seed-v1@example.test |
| Cliente | Diego | diego.seed-v1@example.test |
| Cliente | Valeria | valeria.seed-v1@example.test |
| Cliente | Mariana | mariana.seed-v1@example.test |
| Cliente | Luis | luis.seed-v1@example.test |

Son identidades inventadas con dominio reservado `.test`, teléfono de prueba y domicilio ficticio. Una colisión por correo aborta toda la carga; nunca se reutiliza ni modifica una cuenta anterior.

## Registros adicionales por tabla

| Tabla | Primera carga |
|---|---:|
| USUARIO | 9: 1 administrador, 3 trabajadores, 5 clientes |
| PRODUCTO | 25 |
| INGREDIENTE | 15 |
| PROVEEDOR | 5 |
| RECETA | 25 |
| DETALLE_RECETA | 100 |
| PEDIDO | 15: 5 pendientes, 5 en progreso, 5 despachados |
| DETALLE_PEDIDO | 30 |
| VENTA | 20: 5 de pedidos entregados y 15 de mostrador |
| DETALLE_VENTA | 40 |
| PAGO | 35: 15 anticipos, 5 saldos y 15 ventas de mostrador |
| TRANSFERENCIA_VALIDADA | 15 |
| MOVIMIENTO_PRODUCTO | 65: 25 aperturas y 40 salidas |
| MOVIMIENTO_INGREDIENTE | 115: 15 aperturas y 100 consumos agrupados |
| HISTORIAL_PEDIDO | 35 |
| OPERACION | 1 manifiesto del lote |
| ROL, CATEGORIA_PRODUCTO, COMPRA, DETALLE_COMPRA, SESION_WEB, MIGRACION_WEB, DEVOLUCION, CONFIG_BANCARIA, INTENTO_TRANSFERENCIA, NOTIFICACION, REFERENCIA_PEDIDO | 0 |

**550 filas adicionales**, más una fotografía ilustrativa compartida por los pasteles. Una repetición intacta inserta **0** filas y **0** imágenes. Las cantidades corresponden a este lote v1 y se devuelven al ejecutar el comando. No representan los totales de toda la base si ya contenía datos.

Los productos, ingredientes y proveedores llevan `[DEMO v1]` en el nombre. Los tamaños se expresan en nombre/descripción y se venden por pieza: no se inventaron columnas de tamaño. La fotografía procede del asset local existente, se normaliza con el mismo proceso del administrador y se identifica como ilustrativa; no hay descargas externas. Las recetas son simplificadas para probar la operación, no fichas de producción alimentaria.

Las ventas se distribuyen desde hace tres meses calendario hasta antes del día de la primera ejecución, según Ciudad de México. El lote conserva sus fechas al repetirse. Los pedidos históricos usan `politica_pago=0`, compatible con importaciones anteriores ya soportadas por el sistema; se registran transferencias confirmadas del30% y saldos en efectivo al entregar. No se simula una verificación bancaria pendiente, no se inventa una CLABE y no se cambia CONFIG_BANCARIA. Los pedidos nuevos que captures después seguirán las reglas actuales.

## Consultas de verificación en Workbench

Ejecuta primero `USE pasteleria_dev; SELECT DATABASE();` y confirma que es el entorno de desarrollo.

```sql
-- Identifica el lote y sus cantidades, sin mostrar hashes ni contraseñas.
SELECT accion, fecha, JSON_EXTRACT(resultado, '$.counts') AS cantidades
FROM OPERACION
WHERE clave='pasteleria-demo-v1' AND accion='seedDesarrollo';

SELECT u.nombre, u.correo, r.nombre AS rol
FROM USUARIO u JOIN ROL r ON r.id_rol=u.id_rol
WHERE u.correo LIKE '%.seed-v1@example.test'
ORDER BY r.nombre, u.nombre;

SELECT nombre, precio, existencia, unidad
FROM PRODUCTO WHERE nombre LIKE '[DEMO v1] %';

-- MySQL8: limita la consulta a las ventas identificadas en el manifiesto.
SELECT v.id_venta, v.fecha, v.total, SUM(d.subtotal) AS suma_detalles,
       v.total=SUM(d.subtotal) AS coincide
FROM OPERACION o
JOIN JSON_TABLE(o.resultado, '$.entries[*]'
 COLUMNS(tabla VARCHAR(64) PATH '$.table', id INT PATH '$.id' NULL ON ERROR)) m
 ON m.tabla='VENTA'
JOIN VENTA v ON v.id_venta=m.id
JOIN DETALLE_VENTA d ON d.id_venta=v.id_venta
WHERE o.clave='pasteleria-demo-v1' AND o.accion='seedDesarrollo'
GROUP BY v.id_venta,v.fecha,v.total ORDER BY v.fecha;

SELECT p.estado, COUNT(*) AS pedidos
FROM PEDIDO p JOIN USUARIO u ON u.id_usuario=p.id_cliente
WHERE u.correo LIKE '%.seed-v1@example.test'
GROUP BY p.estado;
```

`npm.cmd run db:seed:verify` comprueba cada fila contra su huella del manifiesto, roles, totales de pedidos/ventas, pagos/anticipos y saldos de inventario contra movimientos. Las PK/FK/CHECK permanecen activas. Si falta una fila, se alteró o se usó después, el comando lo informa y no carga ni restablece datos silenciosamente.

## Revertir solo el lote

Con NODE_ENV, DB_NAME y SEED_CONFIRM_DB todavía apuntando a la base dedicada:

```powershell
npm.cmd run db:seed:undo
```

No necesita SEED_PASSWORD. La reversión utiliza los IDs y huellas del manifiesto persistido en OPERACION. Antes de borrar comprueba modificaciones, todas las FK entrantes y dependencias lógicas de sesiones/avisos. Usa «Cerrar sesión» en las cuentas de prueba primero; cerrar solo la pestaña no elimina la sesión guardada. Si se vendió, editó o creó actividad usando las entidades de demostración, **se bloquea toda la reversión** para preservar esa actividad; no uses DELETE por nombre o prefijo ni fuerces el borrado del manifiesto.

Cuando todo está intacto, elimina las 550 filas propias en orden inverso dentro de una transacción, conservando roles, categorías y registros ajenos. Luego elimina la fotografía propia si ya no tiene consumidores. Una cola local `.seed-cleanup-*.json` permite recuperar la limpieza después de perderse el acuse de COMMIT o fallar el sistema de archivos. Se reconcilia al ejecutar de nuevo cualquier comando del seeder sobre la misma base. No borres esos archivos manualmente mientras haya una operación por recuperar. No se revierten ni reajustan contadores AUTO_INCREMENT.

Al terminar, limpia las variables de esta terminal:

```powershell
Remove-Item Env:SEED_CONFIRM_DB, Env:DB_NAME, Env:NODE_ENV
```

## Pruebas

```powershell
npm.cmd test
$env:RUN_MYSQL_TESTS='1'
node --env-file-if-exists=.env --test --test-concurrency=1 tests/seed.test.js tests/seed-mysql.test.js
Remove-Item Env:RUN_MYSQL_TESTS
```

La integración crea únicamente bases nuevas con nombre generado `dulcerincon_test_...`, las confirma expresamente como entorno `test` y las elimina al terminar. No se ejecuta el seeder contra DB_NAME del `.env` ni se usan datos personales reales.


## Instalación local preparada por solicitud del usuario

El usuario autorizó ejecutar los pasos («hazlo tu»). Se comprobó que pasteleria_dev no existía; se creó nueva como entorno development, se prepararon el esquema original y las migraciones existentes, y se cargaron/verificaron550 filas del lote v1. La base habitual y el archivo .env original permanecieron sin modificaciones.

La configuración separada .env.seed.local está excluida por .gitignore. Contiene DB_NAME=pasteleria_dev, puerto3001, secreto de sesión propio y contraseña ficticia aleatoria SEED_PASSWORD; nunca compartir ese archivo. Las cuentas usan esa contraseña temporal, no la contraseña de MySQL.

Para iniciar esta demostración nuevamente: `npm.cmd run demo`. El lanzador scripts/start-demo.js valida el destino y carga la configuración local separada. Abre http://127.0.0.1:3001/index.html#catalogo y usa http://127.0.0.1:3001/login.html para acceder como ana.seed-v1@example.test.

Verificación ejecutada tras la carga: seed devolvió valid:true con550 filas; verify devolvió valid:true; catálogo HTTP200 con25 productos; login HTTP200.
