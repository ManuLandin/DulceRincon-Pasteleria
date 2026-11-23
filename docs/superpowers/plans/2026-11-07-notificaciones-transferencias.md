# Notificaciones y transferencias Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans; los archivos independientes se distribuyen según dispatching-parallel-agents. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Notificaciones reales, aceptación manual de transferencias100/30 %, referencias privadas y recogidas10–20.
**Architecture:** Extender la aplicación Express/MySQL y las transacciones/idempotencia existentes. Separar comunicaciones/configuración, archivos privados y política comercial; root integra el núcleo y las pruebas MySQL. UI consume los mismos endpoints autenticados.
**Tech Stack:** Node24, Express5, MySQL2/InnoDB, Bootstrap local, Sharp, node:test/Supertest.
**Spec:** docs/superpowers/specs/2026-11-07-notificaciones-transferencias-design.md (aprobada).

## Global Constraints

- Sin Git ni commits; no borrar ni inventar datos reales; respaldo antes de migrar.
- Preservar pedidos anteriores mediante politica_pago=0; nuevos usan1. Histórico Tarjeta consultable, ningún cobro nuevo Tarjeta.
- Transferencia declarada no es PAGO. Aceptar referencia crea un PAGO único y asignación sin stock; preparar requiere pago validado.
- Clientes solo sus pedidos/avisos/imágenes; CSRF y rol antes de uploads. Archivos privados fuera de rutas públicas.
- Efectivo en caja inmediata admite100% sin cuenta. Pedido Efectivo exige30% transferido y validado, saldo efectivo. Transferencia pedido100% validado.
- Hora elegible10:00–20:00 inclusive, cualquier día, sin bloquear solicitudes nocturnas. Sin vencimiento automático ni banco automático.

## Review Focus

- Respuesta perdida/reintento no repite pago, aviso, pedido ni imágenes; corregir referencia no sobrescribe intentos.
- Dos trabajadores revisan el mismo intento: una aceptación/PAGO/asignación; revisión obsoleta rechazada.
- Precio/cuenta bancaria cambian tras mostrarse al cliente: comparar importe autorizado y conservar versión inmutable de destino.
- Endpoint alternativo de cobro/entrega o cliente ajeno no puede saltar la política ni ver archivos privados.
- Migración mantiene pagos Tarjeta/anticipos antiguos sin exigir un segundo ingreso y no emite notificaciones históricas.

## Contrato SQL compartido (root crea migración)

- PEDIDO agrega politica_pago INT default0, modalidad_pago VARCHAR20 NULL, aceptacion_estado VARCHAR40 default Aceptado, aceptado_por INT NULL, aceptado_fecha DATETIME NULL.
- CONFIG_BANCARIA: id_config INT AUTO PK, version INT UNIQUE, banco VARCHAR100, titular VARCHAR100, clabe CHAR18, instrucciones VARCHAR255, id_usuario INT FK, fecha DATETIME defaultCURRENT_TIMESTAMP. Filas inmutables; configuración actual=mayor versión.
- INTENTO_TRANSFERENCIA: id_intento BIGINT AUTO PK,id_pedido INT FK,referencia VARCHAR100,referencia_normalizada VARCHAR100,importe DECIMAL10,2,modalidad_pago VARCHAR20,config_version INT FK CONFIG_BANCARIA(version),destino_snapshot JSON,cotizacion_version INT,estado VARCHAR20 default Pendiente,motivo VARCHAR255 NULL,id_revisor INT NULL FK,id_pago BIGINT NULL UNIQUE FK PAGO,fecha DATETIME defaultCURRENT_TIMESTAMP,fecha_revision DATETIME NULL. Índice pedido/id.
- TRANSFERENCIA_VALIDADA: referencia_normalizada VARCHAR100 COLLATE utf8mb4_bin PK,id_pago BIGINT UNIQUE FK PAGO,fecha DATETIME defaultCURRENT_TIMESTAMP. Reutilización global bloqueada; incorporar referencias históricas únicas sin alterar pagos ni fallar por duplicados históricos.
- NOTIFICACION: id_notificacion BIGINT AUTO PK,id_destinatario INT FK USUARIO,id_pedido INT FK PEDIDO,id_evento BIGINT FK HISTORIAL_PEDIDO,tipo VARCHAR50,titulo VARCHAR120,texto VARCHAR500,fecha DATETIME defaultCURRENT_TIMESTAMP,leida BOOLEAN default0,fecha_lectura DATETIME NULL, UNIQUE(id_evento,id_destinatario),INDEX destinatario/leida/fecha.
- REFERENCIA_PEDIDO: id_referencia BIGINT AUTO PK,id_pedido INT FK,archivo VARCHAR100 (solo UUID.webp),hash_original CHAR64,activo BOOLEAN default1,id_usuario INT FK,fecha DATETIME defaultCURRENT_TIMESTAMP. Índice pedido/activo.

## Contratos de módulos y API

API existente GET/POST `/api/operacion` devuelve `{datos}`; POST `{accion,datos,clave}` con CSRF e idempotencia. Se incorpora servicio communications con read/write igual que management/commerce.

Comunicaciones: `createCommunications(pool).read(actor,recurso,query)` recursos notificaciones/configuracionBancaria; write acciones leerNotificacion `{id}`,leerTodasNotificaciones `{}`,guardarConfiguracionBancaria `{version,banco,titular,clabe,instrucciones}`. Listado notificaciones `{items,total,pagina,limite,no_leidas}`; config `{configurada,version,banco,titular,clabe,instrucciones}` o `{configurada:false,version:0}`. Exporta `readBankConfiguration(db,version?) -> row|null` y `notifyHistory(db,idPedido,idEvento,actor,action,detail)` para uso DENTRO de transacción del núcleo.

Política root `server/order-policy.js`: `depositCents(totalCents,modalidad)`, `pickupDate(value,{now?})` valida10..20/futuro enMX; `normalizeReference(text)`, `assertAccepted(order)` para nuevas políticas.

Comercio nuevas acciones:
- prepararPedido (sin mutación): catálogo `{detalles,modalidad_pago}` o personalizado `{id,modalidad_pago}` → `{total,importe_transferir,saldo_posterior,configuracion_bancaria}`. Si falta config lanza409 claro; no incluir existencia como requisito de pedido.
- crearPedido catálogo: datos actuales + `{modalidad_pago,referencia,config_version,total_autorizado}`; crea con política1 y referencia pendiente en la misma transacción. Personalizado sigue sin referencia antes de cotizar.
- enviarReferencia `{id,version,modalidad_pago,referencia,config_version,total_autorizado}` solo titular/personal, personalizado con precio aceptado o intento observado; marca Pendiente de validación.
- revisarTransferencia `{id,version,id_intento,decision:'Aceptar'|'Corregir',motivo?,id_trabajador?}` solo personal, motivo requerido al observar. Admin sin responsable debe elegir trabajador activo; trabajador se asigna a sí mismo si libre. Aceptar crea PAGO Transferencia, registra referencia global, actualiza anticipo/aceptación/autor/fecha/version y notifica sin descontar stock.
- Lectura detalle pedido añade `intentos_transferencia` (historial), `importe_transferir` calculado, `referencias` activas, campos de aceptación/modalidad/política. Lista incluye estos campos en cabecera.
- Núcleo `history()` obtiene insertId y llama notifyHistory transaccional. La creación avisa una vez: referencia inicial no crea aviso adicional idéntico.
- Cobros alternativos de pedido política1: solo Efectivo tras aceptación y modalidad Efectivo; importe positivo hasta saldo. No Transferencia extra ni cobrar antes de validar.
- Venta inmediata Transferencia requiere referencia y `transferencia_verificada:true`; total autorizado bajo bloqueo se conserva.

Archivos privados módulo `server/order-references.js`: exporta `mountReferenceRoutes(app,commerce,guards,referenceDir,limit)`, `persistReferences(db,idPedido,actor,files)` y `referenceList(db,idPedido)`; root commerce expone createWithReferences(actor,datos,clave,files) y replaceReferences(actor,id,version,clave,files). files normalizados `{archivo,hash_original}`. Idempotencia usa hashes originales, nunca UUIDs regenerados. Resultado incluye referencias persistidas para limpiar solo archivos nuevos no usados al recuperar un resultado anterior.
- POST `/api/pedidos-personalizados` multipart: campos datos(JSON),clave y hasta3 archivos referencias. Crea personalizado y metadata de imágenes atómicamente; si falla limpia archivos.
- PUT `/api/pedidos/:id/referencias` multipart: datos(JSON con version),clave y archivos; solo antes de cotizar, conserva metadata previa inactiva e historial. Sin nuevas fotos puede vaciar galería con intención explícita.
- GET `/api/pedidos/:id/referencias/:idReferencia` auth titular/personal; devuelve WebP privado no-store, ruta segura desde metadata; ningún estático expone esa carpeta.
- referenceList devuelve `{id_referencia,url,activo,fecha}` sin path arbitrario. Nombre interno se mantiene en resultado de transacción solo para limpieza de rutas.

## Task 1 — Esquema y política (root)
Files scripts/migrate-notifications.js,server/order-policy.js,tests/order-policy.test.js,tests/notification-mysql.test.js,package.json,server/config.js.
- [x] Escribir testRED de30%/100%,09:59/10/20/20:01/pasado/noche.
- [x] Implementar dinero exacto y horario sin alterar periodos de reportes existentes.
- [x] Migración aditiva/repetible con respaldo y política0 para existentes; probar enBD aislada antes de real.

## Task 2 — Comunicaciones (agente independiente)
Files server/notifications.js,tests/notifications.test.js; no editar otros archivos.
- [x] TDD permisos de conteo/lectura ajena y configuración solo admin.
- [x] Implementar read/write y eventos según spec dentro de transacciones/idempotencia existentes.
- [x] Configuración append-only versionada; no sembrar datos bancarios ficticios.

## Task 3 — Referencias privadas (agente independiente)
Files server/order-references.js,tests/order-references.test.js; no editar otros archivos.
- [x] TDD archivos falsos, tamaño/cantidad, sesión/CSRF/rol antes de procesar y acceso ajeno.
- [x] Normalización Sharp, hashes, rutas protegidas, persistencia/listado y limpieza/reintentos conforme a contrato.
- [x] Coordinar con UI para multipart y galería; sin datos reales.

## Task 4 — Núcleo financiero/HTTP (root)
Files server/commerce.js,operations.js,app.js,index.js,tests/commerce.test.js,tests/notification-mysql.test.js.
- [x] TestsRED política, referencia declarada sin cobro, observar/corregir, dobleaceptación/autor, tarjeta rechazada.
- [x] PrepararPedido con importe y destino versionados; aceptación de cotización separada de dinero verificado.
- [x] Integrar notificaciones en history, versiones y ownership en todos los endpoints; cerrar bypass de pago/entrega/cancelación.
- [x] Integrar uploads privados/createWithReferences/replaceReferences sin duplicados; conservar ventas/stock/idempotencia anteriores.

## Task 5 — Interfaz (agente independiente)
Files assets/js/{notifications.js,order-checkout.js,operation-orders.js,customer-orders.js,workspace.js,operation-core.js,shared.js},admin.html,trabajador.html,cliente.html,assets/css/notifications.css. No tocar backend.
- [x] Campana/listado real con no-leídas, polling15s visible/focus y enlaces; marca, estados de carga/error y accesibilidad.
- [x] Admin Configuración bancaria; mostrar datos vacíos correctamente y formas de pago solo efectivo/transferencia.
- [x] Catálogo muestra100/30% antes de referencia; personalizado subir/previsualizar3imágenes y después cotización pedir transferencia.
- [x] Personal revisa intentos/acepta/observa; responsable explícito; bloquear preparación en UI mientras no validado, sin sustituir permisos servidor.
- [x] Selectores recogida10..20 y errores de hora; mantener menú adaptable corregido.

## Task 6 — Integración y entrega (root)
Files tests/notification-mysql.test.js,tests/operation-preview-server.js,README.md,docs/preview/notificaciones/,ledger.
- [x] MySQL aislado: pruebas ReviewFocus y migración vieja/nueva, avisos única vez y archivos ajenos, pagos no confirmados sin ingreso.
- [x] QA real de navegador con datos temporales: checkout, cotización/imagenes, verificar/observar/corregir, notificaciones leídas, móvil.
- [x] Revisión independiente final, regresiones de hallazgos y suite verde/audit.
- [x] Respaldo y migración real sin cuentas/pedidos/pagos ficticios; reiniciar Express, documentar configuración bancaria personal pendiente y abrir app.

Verificación:119/119; consultar ledger para evidencia y alcance exacto de QA visual frente a pruebas MySQL.
