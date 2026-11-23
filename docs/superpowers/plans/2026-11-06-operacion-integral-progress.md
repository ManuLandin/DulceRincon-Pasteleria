# SDD ledger — plan: docs/superpowers/plans/2026-11-06-operacion-integral.md

Especificación aprobada por el usuario el 2026-11-06. Trabajo en carpeta original sin Git.

Pre-flight: maestros y comercio comparten únicamente amounts.js, transactions.js y el contrato SQL; root es propietario de esas interfaces y migraciones. Interfaz consume /api/operacion sin editar servicios. Operaciones HTTP solo se montan cuando servicios están inyectados; las pruebas existentes no requieren estos servicios.

Ruling: continuar con la implementación ya autorizada sin pedir otro permiso para el plan — el usuario aprobó el alcance y quiere terminarlo; la revisión técnica del plan no altera las reglas aprobadas.

Ruling: separar archivos de implementación de maestros, comercio e interfaz para trabajo concurrente con dispatching-parallel-agents; root integra y verifica contratos — evita que dos agentes editen el mismo archivo.

Estado inicial: plan revisado contra cada apartado de la especificación; tareas 1 a 5 pendientes.

Task 1: complete — decimales3/3, migración repetible, respaldo restaurado en dos BD temporales, idempotencia concurrente e HMAC (RED→GREEN). Migración real aplicada tras respaldo backups/antes-operacion-2026-11-07T01-31-10-231Z.sql. Sin registros ficticios en la BD real.
Task 2: complete — management15/15; hash real Argon2, maestros, ajuste stock, fichas, receta histórica y directorio mínimo de responsables.
Task 3: complete — commerce13/13 y pruebas MySQL aisladas compras/caja/pedidos/personalizados/devolución7/7.
Task 4: en verificación — HTTP2/2 verde; UI completa; CUA comprobó venta vinculada por correo y recibo con cambio correcto.
Ruling: historial de reintentos usa HMAC privado en servidor; contraseñas de trabajadores no generan fingerprints persistidos en navegador — evita crear un verificador rápido adicional.
Ruling: trabajador puede leer únicamente nombres e IDs de trabajadores activos para asignar responsables, sin contacto ni permisos de gestión — cumple asignación compartida sin exponer fichas.
Ruling: pedido de catálogo con importe cero se rechaza igual que venta inmediata; los productos se conservan explorables, pero para vender requieren precio positivo — evita eludir reglas de cobro.

Final review: revisión independiente gpt-6-astra high completada. Sin acceso a datos reales. Crítico: respuesta HTTP200 truncada eliminaba idempotencia. Importantes: importe cambiado, listado parcial de clientes a trabajador, faltantes conjuntos/pedido, saldos históricos sin conciliar. Todos reproducidos RED y corregidos en una pasada con regresiones.
Final: fixed reintentos — browser-network pruebas HTTP200 truncado +401/403/429/503 conservan una venta y el importe original; fingerprints por actor, eliminación solo éxito íntegro y entrada fresca.
Final: fixed precio autorizado — preventa server con consumo conjunto, comparación bajo bloqueo, nueva confirmación de importe y rechazo atómico409 si cambia.
Final: fixed directorio cliente — correo exacto normalizado para trabajador, sin LIKE ni búsqueda por nombre; listado administrativo conserva búsqueda parcial.
Final: fixed disponibilidad — preventa del carrito y disponibilidad en detalle de pedido, manteniendo validación final atómica; personalizados muestran consumo pendiente.
Final: fixed migración — preflight antes de DDL detiene cancelados con anticipos y pedidos abiertos ya vendidos, reportando folios.
Final: Ruling: comprobación de migración operativa al arrancar se eleva a Important — evita anunciar cajas disponibles sin tablas; test configuración RED→GREEN.
Final: Ruling: prueba de anticipos en fechas distintas se incluye por ser criterio explícito del plan — MySQL11/11 incluyendo díaA/díaB y respaldo restaurado.
Final: detalle menor corregido como ajuste de presentación autorizado: Historial de ventas incluye estado en ficha y Mis compras. Las métricas ya excluyen canceladas. No se añadieron pruebas de texto para esta etiqueta reversible.
Final: Ruling: las funciones excluidas por la especificación se mantienen excluidas; QA de navegador y README se verifican por root. No se usó revisión como sustituto de pruebas reales.

Task 4: complete — QA de navegador en MySQL temporal: venta vinculada/recibo/cambio, alta ingrediente, formulario trabajador, compra editable, cotización por trabajador, aceptación por cliente, nueva solicitud personalizada sin ingredientes y teclado Escape. Caja y personalizado sin overflow global a320px. Capturas identificadas QA en docs/preview/operacion-integral.
Task 5: complete — suite general63/63 con11 MySQL omitidas por defecto; suite MySQL11/11 ejecutada explícitamente; npm audit0 vulnerabilidades. Aplicación real reiniciada y comprobada200 portada/login/catálogo y401 operación sin sesión. Entrada real abierta y conservada en navegador. Sin datos ficticios en la base real.
Final: revisión independiente completada, hallazgos críticos/importantes corregidos, sin pendientes funcionales conocidos del alcance aprobado.

Final gate: node --env-file-if-exists=.env --test --test-concurrency=1 tests/*.test.js con RUN_MYSQL_TESTS=1:74/74 PASS,0 FAIL,0 SKIP. Salida completa docs/preview/operacion-integral/tests-final.log. Carpeta original preservada, sin Git ni integración remota.
