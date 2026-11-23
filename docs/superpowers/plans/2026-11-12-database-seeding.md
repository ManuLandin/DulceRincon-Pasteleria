# Seeder de desarrollo

Autorizado: analizar, presentar plan e implementar; ejecutar solo en entornos de desarrollo/pruebas confirmados. No ejecutar sobre la base actual.

Tecnología: SQL parametrizado mysql2, migraciones existentes, Argon2id. Sin DDL ni nuevas tablas/columnas. ROL y categoría Pasteles se reutilizan. OPERACION registra un manifiesto versionado de filas creadas con sus huellas, aprovechando su JSON y claves existentes.

1. RED: protecciones de entorno, cardinalidades/dinero/fechas; integración temporal: carga/repetición/verificación/reversión, colisiones, modificaciones, dependencias y rollback.
2. Dataset: 9 cuentas ficticias (Ana; Emiliano/Marco/Sofía; Juan Carlos/Diego/Valeria/Mariana/Luis), 25 pasteles, 15 ingredientes, 5 proveedores, 25 recetas. 15 pedidos históricos de demostración con condiciones de importación anteriores (politica_pago=0), anticipos del30%, cinco entregados liquidados. 20 ventas en total: cinco entregas y quince de mostrador. No configurar cuentas bancarias ni generar avisos a usuarios ajenos. Fotografía ilustrativa local compartida, sin descargas.
3. Motor: transacción única, bloqueo nombrado por BD, manifiesto persistido atómicamente; no tocar registros preexistentes. Un reintento devuelve/verifica el lote anterior, sin volver a insertar ni resetear contraseñas. Fechas fijas por lote dentro de los últimos tres meses; cantidades en milésimas y dinero en centavos.
4. Reversión: comprobar huellas y todas las FK entrantes, además de referencias lógicas de avisos/sesiones; si hubo actividad posterior abortar sin borrar nada. Eliminar únicamente IDs del manifiesto en orden inverso, con integridad activa. Fotografía se limpia solo tras commit confirmado y si ya no tiene consumidores.
5. Guardas: NODE_ENV explícito development/test; MySQL local; nombre de BD dedicado terminado _dev/_test o fixture temporal generado; SEED_CONFIRM_DB exacto y SELECT DATABASE coincidente. Contraseña temporal por SEED_PASSWORD, sin valor predeterminado y sin imprimirla. Base actual pasteleria_db bloqueada.
6. Inspección metadata real de solo lectura, revisión independiente, suite y documentación Workbench/reversión. Sin aplicar migraciones ni cargar datos reales.

Entorno de pruebas confirmado por construcción: fixture crea una BD nueva dulcerincon_test_<timestamp>_<pid>, solo allí se ejecuta el seeder; se elimina al terminar. No se consideran los parámetros del .env como autorización para modificar su BD.
