# Resultado del seeder de desarrollo

Solicitud autorizada: implementar después de analizar y presentar plan; prohibido ejecutar sobre una base sin confirmar desarrollo. La base de la aplicación no recibió datos ni modificaciones de esquema. Solo se inspeccionó metadata en lectura: 27 tablas, 214 campos, PK/UNIQUE/FK/CHECK/reglas referenciales, guardados en docs/database/schema-inspected.json.

Implementación final: SQL mysql2, Argon2id existente, dinero/cantidades exactos existentes, sin DDL ni desactivar restricciones. Manifestación versionada en OPERACION existente, 550 filas/16 tablas; roles y categoría reutilizados. No se modificaron módulos del servidor ni flujos de la aplicación.

Decisiones documentadas: base local dedicada _dev/_test con NODE_ENV y confirmación nominal exacta; pasteleria_db bloqueada. Pedidos históricos usan política previa0 y pagos confirmados, evitando inventar datos bancarios o simular solicitudes pendientes. Tercera trabajadora Sofía y tres clientes adicionales ficticios. Cinco ventas corresponden a cinco pedidos entregados, quince ventas son de mostrador. Fotografías ilustrativas locales compartidas y recetas simplificadas para pruebas. Fechas de cuentas y aperturas anteriores al primer evento.

Pruebas iniciales RED por ausencia de módulos, luego carga, idempotencia y reversión. Detectada y corregida normalización de nombres de tabla en información_schema de MySQL Windows; prueba de dependencia pasó de fallo por FK a bloqueo preventivo explícito.

Revisión independiente /root/review_seed_safety: P2 limpieza de imagen no recuperable al perder acuse COMMIT en undo; corregido con tareas duraderas locales, conciliación tras recuperar BD y reintentos tanto de seed como undo. Regresión verificada RED sin tarea duradera (foto huérfana) y GREEN con recuperación. P3 cronología de altas respecto al primer pedido corregido y cubierto por comparación SQL. Sin hallazgos pendientes.

Root detectó además que un proceso que no adquirió bloqueo no debía reconciliar imágenes de otro proceso: guarda ownsLock y regresión específica. Las FK permanecen activas; dependencias externas, cambios de filas, sesiones y notificaciones lógicas detienen undo sin borrado parcial. Colisión en una cuenta posterior verifica rollback de altas anteriores sin alterar la cuenta existente.

Verificación final: 131/131, sin omisiones, con RUN_MYSQL_TESTS=1 en bases nuevas temporales confirmadas como test por construcción. Log docs/preview/seed-full-tests.log. Diez pruebas específicas del seeder incluidas. Comprobación adicional refinada de consumos contra recetas y cronología:1/1, docs/preview/seed-recipes-check.log. Sin dependencias nuevas. Sintaxis CLI y módulos comprobada.

Toda ejecución de seed/verify/undo ocurrió en fixtures nuevos dulcerincon_test_<timestamp>_<pid> con contraseña ficticia y carpeta temporal; se eliminaron al finalizar. No se inició ni modificó el servidor real, no se cambiaron .env ni credenciales, ni se ejecutó seed sobre la base de uso habitual. No hay Git en esta carpeta: sin commits, ramas o worktrees que integrar/eliminar.

Entrega: comandos npm db:seed, db:seed:verify, db:seed:undo y db:inspect; guía completa docs/database/SEEDING.md con cuentas, cantidades por las27 tablas, preparación de entorno dedicado, contraseña segura, consultas Workbench y reversión protegida. Pendiente únicamente la confirmación del usuario si desea cargar un entorno suyo; no es necesaria para entregar el código ya implementado y probado.


Ejecución posterior autorizada por el usuario «hazlo tu»: comprobada ausencia de pasteleria_dev y creada nueva como development. Preparación de esquema original y migraciones existentes solo en esa base; carga550 filas y verificación valid:true, sin duplicados. Nueva configuración privada .env.seed.local, contraseña ficticia aleatoria y SESSION_SECRET exclusivo, sin mostrarlos en salidas. Se añadió lanzador guardado scripts/start-demo.js y comando npm demo, iniciado puerto3001. Catálogo25 productos y acceso HTTP200. El servidor habitual3000 y su base no se modificaron. Se conservan respaldos previos de la nueva base antes de migraciones.
