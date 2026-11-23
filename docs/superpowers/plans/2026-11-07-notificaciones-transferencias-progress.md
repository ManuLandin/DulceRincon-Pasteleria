# SDD ledger — plan: docs/superpowers/plans/2026-11-07-notificaciones-transferencias.md

Spec aprobada por usuario «si lo acepto». Sin Git; carpeta original, sin commits/worktree.

Pre-flight: root propietario de SQL/política/commerce/HTTP; comunicaciones y archivos privados tienen contratos transaccionales explícitos; UI consume API y no edita servicios. Compartir solo contratos de este plan y especificación.

Ruling: continuar implementación autorizada sin pedir otro permiso para ejecutar el plan. Configuración bancaria se captura personalmente desde admin, no se inventa ni se pide en chat.

Estado inicial: tareas1–6 pendientes. Se conservan corrección de menú y comprobaciones de importe/idempotencia del avance anterior.


Tareas 1–6 completadas: esquema aditivo, política exacta, comunicaciones, referencias privadas, núcleo financiero/HTTP e interfaz integrados.

Ruling: se conserva la carpeta de trabajo existente sin Git ni commits; no hay rama ni trabajo externo que fusionar. Coste: los cambios se entregan como archivos locales y respaldo, no como PR.
Ruling: el importe, modalidad y versión bancaria consultados se firman para preservarlos durante una transferencia externa; un cambio posterior de precio/cuenta no invalida una intención legítima. Coste: las cotizaciones firmadas previas se siguen respetando.
Ruling: las confirmaciones se muestran en un diálogo de la aplicación; la confirmación bloqueante del navegador interrumpió repetidamente la prueba visual. Mismos mensajes y opción de cancelar; no cambia las reglas del negocio.

Revisión independiente final: 6 hallazgos importantes corregidos en una pasada, sin nueva ronda de revisión.
- COMMIT incierto: marca transaccional y reconciliación duradera de archivos contra metadata bajo lectura bloqueante; si la BD está indisponible conserva archivos. Regresiones de acuse perdido, reintento y recuperación posterior: verdes.
- Cuenta/modalidad manipuladas: cotización firmada catálogo y autorización firmada por pedido/cotización/actor/cuenta/modalidad; reintentos conservan autorización original. Prueba de vinculación RED→GREEN y pruebas MySQL de cambios legítimos/manipulación verdes.
- Referencias históricas devueltas quedan reservadas; migración repetida comprobada con pago devuelto.
- Estado/responsable permite conservar fecha histórica sin exigir cambiarla; fechas editadas/nuevas siguen sujetas a futuro y horario. Regresión UI RED→GREEN.
- Cola global «Revisar transferencias» filtra pendientes; backend valida y mantiene aislamiento de cliente. Prueba MySQL de tres filtros/actores verde.
- Avisos montados se depuran al cambiar sección; consulta estable no recrea controles. Regresión de 8 visitas y una consulta RED→GREEN.
Detalles adicionales corregidos: Tarjeta histórica en resumen de entrega, mensaje de límite de tres fotos y control de error al marcar leído. No quedan hallazgos de revisión pendientes.

Verificación final: 119/119 pruebas, sin omisiones, con RUN_MYSQL_TESTS=1 en bases temporales. Log docs/preview/notificaciones-final-tests.log. npm audit --omit=dev: 0 vulnerabilidades. Sintaxis de servicios y scripts modificados comprobada.

QA de navegador en puerto3002/base temporal: cliente solicita catálogo de450, ve135 de anticipo/315 al recoger; trabajador revisa y acepta, se registra un pago y responsable; cliente recibe aviso y lo marca leído. Personalizado con fotografía: vista previa, envío a20:00 y descarga privada autenticada cargada. Admin ve configuración bancaria. Móvil390: sin desbordamiento, menú1045 sobre fondo y navegación a cola operativa. Confirmación en diálogo de la aplicación aceptada con éxito. Capturas en docs/preview/2026-11-07-notificaciones, únicamente datos ficticios. Flujo Por corregir y reenvío se comprobó con MySQL; no se afirma una prueba visual adicional de ese subflujo.

Declined-to-judge resuelto por root: navegador/QA y documentación comprobados; servidor real respaldado, migración aplicada y Express reiniciado. Respaldo privado antes-operacion-2026-11-07T20-34-50-209Z.sql. No se sembraron datos bancarios, usuarios, pedidos ni pagos de prueba en BD real. Configuración bancaria real pendiente de captura PERSONAL por administrador.

Aplicación real3000: index/login/script de avisos/catálogo200; notificaciones e imágenes privadas sin sesión401. Servidor iniciado. Se conservó la corrección del menú adaptable.

Limpieza final: servidor QA cerrado mediante endpoint interno exclusivo, BD temporal e imágenes de QA eliminadas; capturas conservadas como evidencia sin datos reales. No hay worktree ni carpeta de rama que eliminar.
