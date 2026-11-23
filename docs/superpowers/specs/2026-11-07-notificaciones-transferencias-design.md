# Dulce Rincón: notificaciones, transferencias y referencias de personalizados

Fecha: 2026-11-07. Estado: APROBADO POR EL USUARIO («si lo acepto»).

Revisión independiente de viabilidad completada: no quedaron preguntas importantes sin resolver para preparar el plan. El usuario aprobó las precisiones propuestas abajo.

## Intención

Completar la comunicación entre cliente y personal y exigir la validación del dinero realmente recibido antes de aceptar un nuevo pedido. Agregar imágenes privadas a los encargos personalizados y limitar las horas elegibles de recogida, conservando catálogo, caja, movimientos, sesiones e identidad visual actuales.

## Reglas confirmadas por el usuario

- Notificaciones dentro de las cuentas Cliente y Trabajador sobre cambios de pedidos y pedidos nuevos/asignados.
- Todos los trabajadores reciben el aviso de un pedido nuevo. Quien lo acepte queda como responsable.
- Nuevos cobros únicamente por Efectivo o Transferencia; ya no ofrecer Tarjeta.
- Pedido con pago por transferencia: cubrir el 100 % y proporcionar referencia. El trabajador comprueba el ingreso por fuera de la aplicación y acepta el pedido; el cliente recibe aviso.
- Pedido con saldo a pagar en efectivo: transferir primero 30 %. La página calcula y muestra el anticipo exacto y el saldo restante.
- La regla de anticipo corresponde a pedidos para recogida posterior. Una venta inmediata en mostrador puede pagarse completa en efectivo.
- Personalizado: primero solicitar, cotizar y aceptar el precio; después pagar 100 % por transferencia o 30 % de anticipo. No comenzar a preparar antes de que el personal valide esa transferencia.
- Si la transferencia no se encuentra o la referencia es incorrecta: marcar Por corregir, indicar motivo y notificar al cliente, quien corrige dentro del mismo pedido, sin perder historial.
- El personalizado permite enviar imágenes de referencia.
- Se pueden enviar solicitudes a cualquier hora. Las recogidas se programan entre 10:00 y 20:00.

## Enfoque y alternativas

El usuario eligió expresamente revisión manual por el trabajador, manteniendo las correcciones en el mismo pedido. Se conserva la aplicación única Express/MySQL y se agregan registros de revisión y avisos persistidos en transacciones. No se consulta ni opera la cuenta bancaria desde la aplicación.

Se descartan verificación bancaria automática, mensajes externos y cancelar/recrear el pedido por una referencia equivocada: no corresponden al flujo solicitado. Para las notificaciones se propone consulta periódica al servidor, en vez de introducir un segundo servicio o conexiones permanentes; evita nuevas dependencias y funciona con el servidor local existente.

## Estado actual revisado

- La aplicación ya registra pagos manuales como definitivos, pero no tiene etapa de transferencia enviada/observada/verificada, ni panel de notificaciones.
- PEDIDO conserva cotización/versiones/titular/responsable. HISTORIAL_PEDIDO puede vincular eventos sin duplicarlos. PAGO cuenta únicamente cobros reales en resumen y saldos.
- La caja recalcula precios, inspecciona disponibilidad conjunta y compara importe autorizado bajo bloqueo. OP.write conserva el folio ante respuestas perdidas; no debilitar esa protección.
- Las imágenes actuales de PRODUCTO son públicas. Las referencias del cliente deben guardarse y servirse mediante otra ruta con autorización.
- La fecha se valida sintácticamente, pero actualmente no se restringe a horario comercial. Los métodos actuales incluyen Tarjeta en servidor y selectores.
- El arreglo del menú adaptable, sus capas y su limpieza al ampliar ventana deben conservarse.

## Propuestas para aprobar con este documento

Estas precisiones son propuestas del implementador, no acuerdos previos individuales.

### 1. Datos de transferencia

- Agregar configuración administrativa con banco, titular, CLABE de 18 dígitos y texto opcional de instrucciones. Solo administrador puede guardar cambios; el cliente autenticado ve los datos de destino necesarios para pagar.
- El administrador captura esos datos personalmente en la página. No inventar cuentas, no solicitar acceso al banco ni poner datos privados en archivos de ejemplo/chat.
- Si no están configurados, mostrar la causa y permitir explorar y solicitar cotización personalizada, pero no presentar instrucciones bancarias falsas ni enviar una referencia de pago sin destino configurado.
- Cada envío de referencia conserva una copia de los datos de destino mostrados, importe exigido, modalidad, versión del precio y fecha de envío. Cambiar la cuenta administrativa después no cambia el destino de un intento anterior.
- Registrar referencia o clave de rastreo, obligatoria (texto hasta 100 caracteres), con normalización de espacios y comparación sin distinción de mayúsculas para detectar reutilización.
- Una referencia ya validada para un pago no se contabiliza otra vez en otro pedido. Un intento corregido queda registrado como otro intento; no sobrescribir el anterior ni añadir un segundo anticipo.

### 2. Pedido de catálogo

1. Cliente selecciona productos, fecha/hora de recogida y modalidad: Transferencia total o Efectivo al recoger con anticipo por transferencia.
2. La página muestra el total del servidor, importe de transferencia exigido (100 % o 30 %), saldo y datos bancarios.
3. Cliente transfiere fuera de la aplicación, captura referencia y envía. Se guarda una solicitud Pendiente de validación, todavía no aceptada para preparar.
4. Todos los trabajadores reciben aviso y ven la solicitud en su listado. El detalle muestra artículos, importe esperado, referencia y destino del intento.
5. Trabajador comprueba realmente el ingreso y pulsa Verificar transferencia y aceptar. En una sola transacción se registra el PAGO confirmado, se actualiza saldo, se acepta el pedido, se asigna responsable si no tiene y se crea la notificación del cliente.
6. Si no coincide, el personal pulsa Por corregir con motivo obligatorio. No registrar cobro, no sumar anticipo ni comenzar preparación. Cliente recibe aviso y puede corregir la referencia y reenviarla dentro del mismo pedido.

- Capturas del personal para recogida posterior siguen las mismas reglas: no existe un atajo que acepte una transferencia sin la confirmación explícita de quien revisó.
- El total de productos se conserva en el pedido como precio histórico, como ahora. Un formulario con precios obsoletos debe pedir confirmar el importe actual antes de enviar, no registrar automáticamente un importe superior al que el cliente vio.
- El 30 % se calcula en centavos con redondeo comercial al centavo, mínimo un centavo sin superar el total. Mostrar tanto anticipo como 70 % restante (o el saldo exacto resultante del redondeo).
- No exigir ingredientes disponibles para solicitar; faltantes y reprogramación siguen funcionando. No descontar ingredientes ni productos al enviar/aceptar/verificar anticipo; los descuentos siguen en la venta/entrega final.

### 3. Personalizados e imágenes

1. Solicitud con descripción, fecha solicitada e imágenes opcionales; no exigir referencia bancaria ni pago mientras el precio sea desconocido.
2. Personal cotiza importe y fecha; cliente recibe notificación y acepta/rechaza la versión vigente, como el flujo actual.
3. Una vez aceptado, el cliente elige modalidad y recibe el cálculo e instrucciones para transferir. Enviar referencia deja Pendiente de validación; aceptación de cotización no sustituye aceptación del pago.
4. El trabajador valida el anticipo/total y acepta el pedido. Solo entonces se permite En preparación. Mantener captura de ingredientes reales al entregar.

- Propuesta de imágenes: hasta 3 por solicitud, JPG/PNG/WebP, máximo 5 MiB cada una y 16 millones de píxeles. Son opcionales; no agregar PDF, enlaces remotos ni un editor de diseño.
- Validar contenido real y decodificar como en fotografías actuales; normalizar orientación/tamaño y guardar con nombre aleatorio, sin usar nombre enviado como ruta.
- Cliente puede previsualizar y quitar imágenes antes de enviar. Al abrir el detalle, titular y personal ven galería con ampliación y descripción asociada. El personal recibe aviso de solicitud personalizada nueva con referencias disponibles.
- No editar adjuntos tras aceptar cotización para no cambiar el encargo acordado. Antes de cotizar, una corrección de referencias conserva historial y no provoca un pedido duplicado.
- Servir imágenes por endpoint autenticado y autorización del pedido (titular o personal), nunca desde /uploads/productos ni otra ruta estática pública. El cliente de otro pedido no puede verlas conociendo ID/ruta.
- Guardado de solicitud y adjuntos debe tener compensación de archivos ante error y reutilizar el mismo pedido/archivos ante reintento. No dejar imágenes huérfanas ni pedidos visibles como enviados con una parte de sus adjuntos perdida.

### 4. Revisión, asignación y pagos posteriores

- Estado de aceptación separado del estado de preparación: Por cotizar/Por aceptar precio/Pendiente de referencia/Pendiente de validación/Por corregir/Aceptado, sin sustituir los estados de cotización existentes ni confundir un precio aceptado con un pago recibido.
- La confirmación de referencia crea un único PAGO con método Transferencia y referencia aceptada. Un intento pendiente/observado nunca aparece en ingresos cobrados ni se resta del saldo.
- Bloqueo y versión del pedido impiden que dos trabajadores acepten el mismo ingreso o se asignen simultáneamente. El segundo ve el resultado actual sin otro cobro ni avisos duplicados.
- Si un trabajador acepta, se asigna a sí mismo cuando el pedido no tiene responsable. Si ya tiene otro responsable, no se lo apropia silenciosamente; se muestra la asignación y se mantiene hasta una reasignación explícita con los permisos actuales.
- El administrador también puede validar transferencias y observarlas. Puede elegir trabajador activo al aceptar; no asignar su cuenta de administrador como si fuera trabajador.
- Se conservan los permisos operativos actuales para consultar y atender pedidos. La asignación identifica responsabilidad; no se convierte en un nuevo bloqueo que impida a otra caja entregar/cobrar con los permisos que ya tenía.
- Modalidad Efectivo: una vez confirmado anticipo, el saldo se cobra en efectivo al recoger. La entrega exige saldo cero, ingredientes disponibles y aceptación del pago previo.
- Modalidad Transferencia total: no permitir cobros de efectivo extra; la aceptación del ingreso debe completar el total.
- Venta inmediata en caja: Efectivo completo o Transferencia completa. Transferencia requiere referencia y confirmación explícita del cajero de haberla comprobado; no aplicar el 30 % ni exigir cuenta a una venta ordinaria inmediata.
- Tarjeta desaparece de nuevos cobros, pagos, caja y devoluciones nuevas; servidor rechaza nuevas operaciones con Tarjeta aunque se fabrique una petición. Las ventas y pagos históricos de Tarjeta se conservan consultables.
- Mantener Mixto como resumen de un pedido con anticipo por Transferencia y saldo Efectivo; cada pago conserva su método real. Mixto no es un método seleccionable para cobrar.
- No registrar anticipos arbitrarios por una acción alternativa que evada el 30 %/100 %. Los flujos existentes cobrarPedido/entregarPedido deben distinguir política nueva de registros antiguos y comprobar las mismas reglas en servidor.
- Cancelación de solicitud sin pagos verificados: conservar intentos e imágenes, cerrar solicitud y notificar sin inventar devolución. Con dinero verificado, conservar la cancelación/devolución manual completa por administrador ya acordada. Una referencia Por corregir no constituye dinero confirmado.
- Si hay una transferencia todavía Pendiente de validación, impedir la cancelación directa del cliente hasta que el personal resuelva la revisión. Evita cerrar como impagado un pedido cuyo dinero pudo llegar pero todavía no se comprobó. Tras revisión sin ingreso, se permite cancelación sin devolución; si se confirma ingreso, corresponde devolución manual completa por administrador.
- Sin vencimiento o cancelación automática por falta de validación; el personal reprograma o cancela según el flujo vigente. No prometer aprobación inmediata.

### 5. Notificaciones internas

- Campana con contador de no leídas y sección de notificaciones en Cliente y Trabajador, con enlace al pedido, fecha, texto breve, leído/no leído y acción Marcar todas como leídas.
- El administrador puede consultar sus avisos operativos de la misma manera, además de la lista global de solicitudes pendientes de revisión.
- Propuesta técnica: actualización automática cada 15 segundos mientras la pestaña esté visible, al recuperar el foco y después de acciones relevantes; no sonido ni permiso de notificaciones del sistema. Persistencia al cerrar sesión/cambiar navegador.
- Cliente recibe avisos de cotización, aceptación/observación de transferencia, cambios de estado, fecha/retraso, cancelación y entrega de su propio pedido.
- Todos los trabajadores activos reciben el aviso de nueva solicitud. Al corregir/enviar referencia, notificar al responsable si existe; si todavía no existe, avisar a todos los trabajadores activos para que alguno lo revise.
- Trabajador responsable recibe avisos de aceptación/rechazo de cotización por el cliente, referencia enviada/corregida, asignación/reasignación y cancelaciones relevantes. No generar mensajes por cada consulta o recarga.
- Historial y notificación se confirman junto con la operación. Un reintento, doble clic o dos revisiones simultáneas no producen avisos ni pagos duplicados.
- Titularidad por sesión en listar, contar y marcar leídas. No aceptar id_destinatario arbitrario ni exponer avisos/datos de clientes ajenos. Trabajador mantiene únicamente la información operacional que ya puede consultar.
- Crear avisos nuevos desde este avance; no emitir de golpe notificaciones antiguas al migrar.

### 6. Horarios de recogida

- Usar America/Mexico_City, igual que los pedidos actuales. Propuesta inicial: todos los días de 10:00 a 20:00, incluyendo 20:00 exactas como última hora válida.
- Validar fecha/hora solicitada, fecha propuesta en cotización y fecha comprometida/reprogramada; rechazar anteriores a 10:00, posteriores a 20:00 y fechas pasadas en nuevas solicitudes o cambios de fecha.
- Mostrar claramente el horario junto al selector y un error específico si se escribe una hora inválida. Validar de nuevo en servidor; las restricciones HTML no bastan.
- No limitar el acceso, exploración, envío de solicitudes, envío de referencia o aceptación de precio por la hora actual. Tampoco crear un cierre automático de caja. Esta validación se refiere a la hora elegida para recoger.
- No crear cupos, días cerrados, plazo mínimo de preparación ni entregas automáticas sin que el negocio los defina. El personal sigue confirmando la fecha y los faltantes pueden requerir reprogramación.
- La fecha no marca Entregado automáticamente; mantiene la acción manual y los requisitos actuales.

## Datos y migración

- Preparar respaldo local y migración aditiva/repetible, sin borrar cuentas, pedidos, pagos, fotos o movimientos reales. No volver a ejecutar el SQL original.
- Campos de política/modalidad/aceptación en PEDIDO y versión de regla para distinguir pedidos anteriores. Nuevas solicitudes aplican los nuevos requisitos. Pedidos previos conservan precios, pagos y estado; no exigirles retroactivamente otra transferencia ni transformar pagos históricos de tarjeta.
- Registro separado de intentos de transferencia, importe requerido, referencia normalizada, cuenta de destino snapshot, estado, observación, operador que revisa y fechas. Vincular de forma única el intento aceptado con PAGO.
- Configuración bancaria versionada, historial de cambios administrativo y galería de referencias por pedido. Nunca publicar respaldos o archivos de configuración en rutas estáticas.
- NOTIFICACION con destinatario, pedido/evento, título/texto, fecha y leído; índices por usuario/lectura/fecha y unicidad de evento/destinatario.
- Mantener idempotencia y transacciones existentes; locks estables para aceptación y efecto financiero. No almacenar contraseñas ni tokens del banco.
- Capturar pagos confirmados, no los declarados por cliente. El personal debe comprobar realmente el ingreso fuera del sistema; una referencia por sí sola no valida la transferencia.
- No publicar ni enviar correos, SMS, mensajes externos o datos bancarios a servicios de terceros. Mantener servidor local.

## Qué queda al implementador

Nombres precisos de columnas/endpoints, separación de servicios, UI de campana/listado, polling y paginación, limpieza de archivos, límites de intentos, pruebas y accesibilidad. Mantener componentes, marca y corrección del menú existentes. No cambiar otras reglas comerciales aprobadas salvo lo indicado aquí.

## Verificación necesaria

1. Catálogo: total100 % y anticipo30 %/saldo exactos; manipulación del importe/precio/modalidad se rechaza.
2. Personalizado sin precio/imágenes obligatorias: solicitar, subir referencias, cotizar, aceptar, pagar y validar en orden; preparar antes de validar se rechaza.
3. Transferencia pendiente/Por corregir no cambia ingresos ni saldo pagado. Corregir conserva intentos e identifica la referencia vigente.
4. Dos trabajadores validan/asignan a la vez y un reintento con respuesta perdida: un pago, un responsable y un aviso por evento/destinatario.
5. Referencia aceptada no se reutiliza para contabilizar otro pago. Revisión vieja de un intento reemplazado no acepta la referencia anterior.
6. Venta inmediata efectivo sigue sin cuenta/anticipo; nuevas tarjetas rechazadas en todas las rutas. Histórico Tarjeta intacto.
7. Horas09:59,10:00,20:00,20:01, fecha pasada y operación nocturna para recoger al día siguiente; solicitada/cotizada/reprogramada validadas de forma consistente.
8. Imagen falsa, >5MiB, >3, acceso anónimo/cliente ajeno, fuga por ruta pública, error de BD y respuesta perdida; ninguna pérdida parcial/archivo huérfano.
9. Notificaciones solo titular, sin duplicados al consultar/reintentar, contador/leídas consistente y enlaces al pedido correcto; cliente no puede marcar avisos del trabajador.
10. Migración repetida, política antigua/actual, backup y recuperación; pruebas en bases exclusivamente temporales, nunca ventas/referencias ficticias en la BD real.
11. Navegador escritorio/móvil, carga/error/vacío, foco/teclado, menús sin fondo bloqueante, previsualización de referencias y cuentas sin datos bancarios aún configurados.

## Aprobación

Revisión independiente completada. Aprobado por el usuario: «si lo acepto». Propuestas aprobadas: configuración bancaria local, límite de imágenes privadas, cancelación con transferencia pendiente, tratamiento de pedidos antiguos y alcance del horario como validación de recogida.
