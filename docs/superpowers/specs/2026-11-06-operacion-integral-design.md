# Dulce Rincón: operación integral de administración y caja

Fecha: 2026-11-06. Estado: APROBADO POR EL USUARIO («si acepto»).

Revisión independiente de viabilidad completada: no se identificaron preguntas importantes sin resolver para elaborar el plan. Las propuestas de negocio señaladas abajo fueron aprobadas por el usuario.

## Propósito

Sustituir los ejemplos del panel administrativo por operaciones reales conectadas a MySQL. El sistema se usará en las cajas de la pastelería y también recibirá pedidos de clientes desde la página. Conservar HTML, CSS, JavaScript, Bootstrap, Node.js, Express, MySQL y la identidad blanca y rosa de Dulce Rincón.

El resultado incluye administración, caja para administrador y trabajador, y los flujos de cliente necesarios para realizar pedidos, aceptar cotizaciones y consultar compras. No basta con sustituir las cifras de ejemplo: los formularios, búsquedas, permisos y cambios de estado deben funcionar de extremo a extremo.

## Reglas confirmadas en conversación

1. El avance incluye resumen, productos, usuarios, proveedores, compras a proveedores, ingredientes, pedidos y ventas.
2. Solo un administrador puede dar de alta trabajadores. Clientes y trabajadores deben mostrarse separados y cada grupo debe tener un buscador.
3. Seleccionar un cliente abre su ficha con cantidad de compras, información relevante e historial.
4. Registrar proveedores y las compras realizadas a cada uno; conservar el registro de compras.
5. Una compra a proveedor se recibe completa. Mientras esté pendiente, se podrán corregir ingredientes, cantidades y precios, incluso si hubo errores en la entrega.
6. Marcar una compra como entregada suma sus cantidades definitivas a los ingredientes una sola vez y bloquea su edición. La UI dice Entregada; el estado existente de la BD es Recibida.
7. Caja admite ventas con cliente asociado o al público general. Buscar al cliente por correo cuando quiera asociar su cuenta. Una cuenta no es obligatoria para una venta ordinaria de mostrador.
8. Registrar siempre al administrador o trabajador que hizo el cobro.
9. Los clientes pueden realizar pedidos desde su cuenta. La página pública conserva la exploración sin sesión y exige acceso para pedir.
10. Descontar ingredientes de productos ordinarios al vender, según receta; no al registrar una preparación.
11. Un personalizado requiere cuenta de cliente. El cliente lo solicita; el personal asigna el precio después.
12. El cliente debe aceptar la cotización antes de pasar el personalizado a preparación.
13. El personalizado no requiere ingredientes al solicitarlo ni al cotizarlo. Al entregarlo se capturan los ingredientes y cantidades efectivamente usados y se descuentan.
14. El panel de notificaciones queda para después. Las solicitudes y cambios estarán disponibles al consultar Pedidos y Mis pedidos.
15. Registrar cobros en caja con efectivo, tarjeta o transferencia, anticipos y saldo pendiente de pedidos. Los cargos bancarios ocurren fuera de la aplicación; aquí se registra el método y el importe.
16. Se puede crear un pedido aunque falten ingredientes. Su entrega puede retrasarse; administrador o trabajador establece la nueva fecha y el cliente la consulta en Mis pedidos.
17. El usuario eligió guardar un historial de movimientos de inventario, además de las existencias actuales.

## Enfoques considerados y elección

- Actualizar únicamente la existencia actual: menor estructura, pero no permite explicar el origen de entradas y salidas ni revisar operaciones con detalle.
- Conservar movimientos vinculados a compras, ventas y ajustes, y actualizar existencias dentro de la misma operación: mayor trabajo, con trazabilidad y control contra duplicados.

El usuario eligió explícitamente el segundo. Se conserva una única aplicación Express y MySQL ya existente. Las reglas se implementan en servicios compartidos; caja del administrador y del trabajador usan las mismas operaciones, con permisos distintos.

## Situación comprobada

- Acceso único por rol, sesiones MySQL, Argon2id, CSRF, catálogo real y altas de productos con fotografía ya funcionan.
- admin.html y trabajador.html aún contienen ventas, pedidos y cifras de ejemplo; cliente.html todavía anuncia pedidos próximos.
- La BD local real contiene las 14 tablas del esquema original más la columna imagen de PRODUCTO y la tabla SESION_WEB (15 tablas en total). Todas usan InnoDB. No hay triggers.
- Existen COMPRA/DETALLE_COMPRA, INGREDIENTE, RECETA/DETALLE_RECETA, PEDIDO/DETALLE_PEDIDO y VENTA/DETALLE_VENTA.
- VENTA.id_usuario identifica al operador. No sirve simultáneamente como cliente asociado; se necesita un campo adicional nullable.
- DETALLE_PEDIDO y DETALLE_VENTA exigen actualmente un producto del catálogo. Los personalizados necesitan detalles propios sin inventar un producto público.
- No hay historial de pagos ni movimientos, ni estado de cotización o aceptación. No se modificaron datos al revisar la estructura.
- No hay Git inicializado. No crear repositorio, ramas ni commits como parte de este avance.

## Propuestas aprobadas con este documento

Las siguientes reglas concretan lo no decidido individualmente. Son propuestas del implementador, no acuerdos previos. El usuario aprobó estas propuestas junto con el documento.

### Roles y permisos

| Operación | Administrador | Trabajador | Cliente |
| --- | --- | --- | --- |
| Gestionar productos, fotos, categorías y recetas | Sí | Consultar catálogo | Consultar catálogo activo |
| Gestionar trabajadores | Sí | No | No |
| Ver clientes y fichas completas | Sí | Búsqueda mínima para asociar venta/pedido | Solo su cuenta e historial |
| Gestionar proveedores y compras a proveedores | Sí | No | No |
| Alta/edición de ingredientes y ajustes de existencias | Sí | Consultar disponibilidad | No |
| Registrar ventas, cobros y entregas | Sí | Sí | No |
| Consultar, cotizar y atender pedidos, cambiar fechas | Sí | Sí | Solo sus pedidos; aceptar/rechazar su cotización |
| Consultar resumen global, movimientos y ventas de todo el negocio | Sí | Resumen propio de caja y pedidos operativos | No |

- El registro público continúa creando exclusivamente clientes.
- Alta de trabajador con nombre, correo, contraseña y confirmación; teléfono y dirección opcionales. Misma protección Argon2id y longitud de contraseña del acceso actual. El administrador entrega personalmente la contraseña; no enviarla por correo ni guardarla en texto legible.
- El administrador puede editar nombre/contacto y activar/desactivar trabajadores y clientes, conservando su historial. No podrá cambiar un cliente a administrador ni crear administradores desde este módulo.
- No borrar físicamente usuarios, productos, ingredientes o proveedores que formen parte de registros. Usar estado activo/inactivo.
- Desactivar una cuenta invalida su acceso en la siguiente operación protegida; no elimina compras ni pedidos.
- No agregar recuperación de contraseña o invitaciones por correo en este avance. Un cambio de contraseña de trabajador por administrador es explícito, con nueva confirmación; nunca mostrar la anterior.

### Clientes y búsquedas

- Listados independientes Clientes y Trabajadores; búsqueda por nombre o correo, con paginación y estados vacío/sin resultados.
- Ficha del cliente: nombre, correo, teléfono, dirección, estado, fecha de registro, compras completadas, importe comprado, última compra, pedidos abiertos y saldo pendiente.
- Compra completada = VENTA pagada vinculada al cliente. Un pedido que termina en venta cuenta una sola vez; anticipos no son compras adicionales. Mostrar pedidos cancelados por separado y no sumar ventas canceladas al total comprado.
- Historial con fecha, folio, artículos/descripción, importe, estado, pagos y saldo. No atribuir ventas al público general a un cliente.
- En caja, buscar por correo devuelve solo coincidencias de clientes y los datos necesarios para confirmar identidad. Si no se encuentra, se puede continuar una venta ordinaria sin cuenta o pedir que se registre para un personalizado/pedido.

### Catálogo y recetas

- Completar edición de datos, activación/desactivación, búsqueda y filtros de productos, conservando creación con foto obligatoria y reemplazo seguro de foto.
- Gestión simple de categorías: nombre, descripción y activo; conservar los alias públicos actuales Postres/Repostería y Cupcakes/Cup cakes.
- Una receta editable por producto ordinario, con ingredientes y cantidades para una unidad vendible. Para recetas nuevas, rendimiento=1; no asumir que cantidades existentes representan una unidad si su rendimiento es distinto.
- Un producto sin receta activa se puede explorar y pedir, pero no cerrar como venta hasta configurar su consumo. Mostrar claramente qué falta.
- Cada ingrediente usa una unidad base fija (kg, litro o pieza), cantidades con hasta 3 decimales y mínimo no negativo. Las compras y recetas se capturan en esa misma unidad, visible junto al campo. No hacer conversiones implícitas entre gramos/kg o ml/litros.
- No cambiar la unidad de un ingrediente que tenga historial, compras, recetas o existencias. Crear otro ingrediente si realmente cambia la unidad.
- Para recetas con rendimiento distinto de 1 ya existentes, mostrar rendimiento y convertir consumo por cantidad/rendimiento con redondeo explícito a 3 decimales por ingrediente y operación. Las recetas nuevas usan cantidades por unidad para evitar ambigüedad.
- La edición de receta no modifica consumos de ventas pasadas. Guardar en movimientos el consumo realmente aplicado a cada venta.

### Ingredientes y movimientos

- Alta de ingrediente con nombre, unidad, existencia inicial y mínimo. Generar movimiento de apertura por la existencia inicial, sin inventar proveedor.
- Edición de nombre/mínimo/activo. La existencia no se sobrescribe desde el formulario general: usar ajuste con cantidad final y motivo obligatorio; calcular y guardar la diferencia.
- Registrar cada movimiento con ingrediente, unidad histórica, cantidad con signo, existencia resultante, fecha, operador, tipo y referencia a compra/venta/ajuste. No permitir modificar ni borrar movimientos desde la UI.
- Para ingredientes ya existentes al migrar, registrar un saldo de apertura técnico sin cambiar sus cantidades. No inventar compras pasadas ni volver a aplicar ventas/compras anteriores.
- Existencias nunca negativas. Operaciones con varios ingredientes se aplican completas o no se aplica ninguna.
- Alertas reales de mínimo y búsqueda/filtros. Un faltante en un pedido se calcula con las recetas actuales o con el consumo capturado para un personalizado; no se inventa consumo de un personalizado aún sin ingredientes.
- PRODUCTO.existencia se conserva como disponibilidad de unidades para mostrador. Se puede ajustar desde administración con motivo y registro de unidades; dichos ajustes no descuentan ingredientes, conforme a la decisión de descontarlos al vender.
- Una venta ordinaria descuenta las unidades disponibles del producto y sus ingredientes. Un pedido puede entrar aunque falten unidades/ingredientes y permanece pendiente hasta reponerlos. Para completar un pedido ordinario se exige disponibilidad final; registrar productos preparados mediante ajuste de unidades, sin un módulo separado de producción.
- Un personalizado no se agrega al catálogo ni usa existencias de un producto genérico: consume únicamente los ingredientes declarados al entregar.

### Proveedores y compras

- Ficha de proveedor con nombre obligatorio y contacto/dirección opcionales; alta, edición, búsqueda y activación/desactivación.
- Dentro de cada proveedor, listado de compras y detalle de ingredientes, cantidades, precios, total, fecha, observaciones y operador.
- Registrar una compra pendiente con una o más líneas, cada ingrediente una sola vez, cantidad positiva, precio unitario no negativo y total calculado por el servidor.
- Editar íntegramente las líneas y observaciones solo mientras siga pendiente. No cambiar su proveedor después de creada; si fue equivocado, cancelar la pendiente y crear otra.
- Recibir una compra exige confirmar las cantidades finales. Cambiar Pendiente a Recibida suma inventario, crea movimientos y deja la compra cerrada, en una transacción.
- Una compra pendiente puede cancelarse sin afectar existencias. No implementar devoluciones a proveedor ni revertir una compra ya recibida; una corrección de inventario posterior requiere ajuste del administrador con motivo y conserva el original.
- El registro se captura en el sistema; no envía automáticamente órdenes a proveedores ni correos.

### Caja y ventas ordinarias

- Pantalla de caja accesible para administrador y trabajador: buscar productos, añadir cantidades, ver precios y total, buscar/asociar cliente opcional, elegir método y registrar cobro completo.
- Precios se consultan en servidor. No se aceptan precios arbitrarios enviados por el navegador, descuentos manuales ni importes negativos.
- Una venta directa registra VENTA con operador y cliente nullable, sus detalles, cobro y salidas de inventario; todo dentro de una sola transacción.
- Mostrar faltantes antes de cobrar. Si faltan ingredientes/unidades o receta, no registrar una venta completada ni cobro exitoso. Ofrecer crear pedido para entrega posterior, asociando una cuenta de cliente.
- Comprobante imprimible desde navegador con folio, fecha, operador, cliente o Público general, artículos, total y método. Es comprobante interno; no es facturación fiscal.
- Para efectivo puede capturarse recibido y mostrar cambio; en los registros financieros se guarda el importe de la compra, no el efectivo entregado incluyendo cambio.
- Historial de ventas con filtros por fechas, operador, folio y cliente; detalle consultable. Trabajador consulta sus ventas; administrador todas.
- Una venta pagada queda inmutable en este avance. No agregar cancelaciones, devoluciones o reembolsos de ventas ya completadas sin definir su tratamiento físico y financiero; no mostrar botones sin funcionamiento.

### Pedidos ordinarios y personalizados

- Se exige cliente asociado para todo pedido con entrega posterior, incluso capturado desde mostrador. La venta inmediata ordinaria sigue admitiendo público general.
- Cliente puede pedir productos del catálogo desde su cuenta, con cantidades, fecha solicitada y observaciones. El servidor fija los precios del catálogo al crear el pedido y conserva ese precio histórico.
- Solicitud personalizada: descripción obligatoria, fecha solicitada, contacto de la cuenta y cantidad de encargos=1 por solicitud; el precio corresponde al encargo completo. No exigir fotografía, archivo ni ingredientes. No agregar un editor visual del pastel.
- Se muestran fecha solicitada y fecha comprometida por personal. Hasta que el personal confirme la fecha, no prometer automáticamente una disponibilidad calculada.
- Flujo ordinario: Pendiente → En preparación → Listo → Entregado. Mantener en BD las equivalencias En progreso y Despachado.
- Flujo personalizado: Por cotizar → Pendiente de aceptación → Aceptado; después usa Pendiente → En preparación → Listo → Entregado. Un precio pendiente no se presenta como gratuito.
- Cotizar exige importe positivo, fecha propuesta y nota opcional. La aceptación del cliente registra usuario, fecha y versión de cotización; una página antigua no puede aceptar otra versión del precio.
- Antes de aceptación, el personal puede corregir la cotización, incrementando su versión. Después de aceptar no cambia el precio de ese pedido. Rechazar una cotización cancela esa solicitud; una nueva negociación se registra como otra solicitud.
- Personal puede asignar trabajador activo, cambiar fecha y motivo de retraso y consultar estado/faltantes. No generar un aviso automático ni prometer un número de días: se muestra la fecha capturada.
- Pedidos sin ingredientes pueden crearse, cotizarse/aceptarse y quedar pendientes. Pasar a preparación no descuenta ingredientes ni garantiza una reserva de inventario. No hay reserva de existencias en este avance.
- La entrega de un ordinario exige receta y existencias en ese momento. La de un personalizado exige capturar una lista no vacía de ingredientes activos y cantidades realmente utilizadas; no se puede entregar sin registrar su consumo.
- Si hay faltantes al intentar entregar, conservar pedido, pagos y cantidades sin aplicar ningún descuento parcial, mostrar los faltantes y permitir reprogramar. No cambiar silenciosamente a entregado ni fijar una fecha automáticamente.
- Mis pedidos permite ver detalle, estado, precio/aceptación, pagos, saldo, fechas y retraso; aceptar o rechazar su propia cotización, actualizar contacto de su propia cuenta y consultar sus compras en mostrador asociadas.
- Cliente puede cancelar pedidos pendientes que no hayan empezado a prepararse y sin pagos. El personal puede cancelarlos con esas mismas condiciones. Pedidos con pagos requieren actuación del administrador según el apartado siguiente.

### Cobros, anticipos y cierre

- Pagos solo registrados por personal. Cada cobro incluye importe positivo, método, fecha, operador, referencia opcional y clave de operación única.
- Se admite cualquier anticipo positivo hasta el total; no imponer porcentaje mínimo no acordado. Un personalizado solo admite cobros una vez aceptado su precio.
- Saldo = total acordado menos pagos registrados no reembolsados. No cobrar de más ni modificar/eliminar cobros registrados.
- Cada anticipo es un registro independiente; mantener PEDIDO.anticipo como suma de cobros válidos por compatibilidad, aunque represente el total acumulado abonado.
- Un pedido se cierra como venta una sola vez al entregarse, con saldo=0 y consumo registrado atómicamente. Pagarlo completo antes de entregarlo no descuenta ingredientes todavía: queda como pedido pagado pendiente de entrega. Esta precisión es una propuesta para evitar descuentos anticipados o dobles.
- Para entregar con saldo, la misma pantalla permite registrar el último pago y entregar de forma atómica. Si falla inventario, no se crea ese último pago ni la venta.
- Registrar varias formas de pago de un pedido. Ampliar el valor técnico VENTA.metodo_pago con Mixto para resumir pedidos con más de un método; cada pago conserva su método Efectivo/Tarjeta/Transferencia.
- Pedidos cancelados con anticipos: propuesta de permitir solo al administrador registrar devolución manual completa con motivo antes de entrega. Es un registro del dinero devuelto por fuera del sistema, no una devolución bancaria automática. Conservar pagos y registro de devolución, cancelar pedido y no devolver ingredientes que aún no se descontaron. No incluir reembolsos parciales o devoluciones después de entrega en este avance.
- El resumen diferencia ventas completadas de cobros recibidos: anticipos aparecen en cobros del día y saldo pendiente; no se suman otra vez como ingresos cuando se entrega el pedido.

### Resumen real e interfaz

- Administrador: ventas completadas del día, cobros y devoluciones del día, pedidos abiertos/para entregar, productos activos, ingredientes bajo mínimo; serie de ventas por día y productos más vendidos con cifras reales.
- Trabajador: sus ventas/cobros del día y lista de pedidos operativos, estados y entregas. No acceso a trabajadores/clientes completos, márgenes ni configuración global.
- Eliminar gráficos, fechas fijas, nombres, contadores, notificaciones de muestra y mensajes de prototipo. Presentar ceros y estados vacíos si no hay datos.
- Mantener diseño blanco/rosa, logo y tipografía actuales. Navegación por secciones reales; caja y gestión sin formularios enormes apilados permanentemente: listado, detalle y formularios específicos. La decisión exacta de rutas/modal/drawer queda al implementador.
- Listados con paginación, búsqueda sin recarga completa, filtros relevantes y enlaces al detalle. Estados de carga, error, guardado, sin datos y sin coincidencias.
- Errores junto al formulario; desactivar envíos en curso y evitar duplicados también en servidor. Confirmaciones concretas para recibir compra, cobrar, entregar, cancelar y ajustar existencias.
- Accesibilidad por teclado, etiquetas, foco al abrir/cerrar diálogos y mensajes anunciables; escritorio de caja y móvil sin desplazamiento horizontal de la página.

## Datos y ampliaciones propuestas

Preparar migración idempotente, aditiva, con comprobación previa del esquema y respaldo local antes de aplicarla. No recrear tablas, limpiar registros, reinsertar roles, inventar usuarios/productos o modificar precios reales.

- VENTA: agregar id_cliente nullable con FK, clave de operación única, y admitir Mixto como método resumido. id_usuario sigue siendo cajero.
- PEDIDO: agregar tipo ordinario/personalizado, descripción personalizada, fecha solicitada/fecha comprometida (conservar fecha_entrega para la comprometida), motivo de retraso, estado/versión de cotización y registro de aceptación, más clave de operación única. Conservar estados existentes con mapeo explícito a la UI.
- Detalles de pedidos/ventas: permitir id_producto nullable únicamente para un detalle personalizado identificado, y conservar descripción/nombre y precios históricos. Un personalizado no produce una fila PRODUCTO ni receta ficticia.
- Tabla de PAGOS y registro de DEVOLUCIONES manuales con importe, método, autor, fecha y referencia. Un pago pertenece a venta inmediata o pedido; no duplicarlo cuando el pedido se convierte en venta. La venta final enlaza al pedido y consulta sus pagos.
- Tabla de MOVIMIENTOS para ingredientes con referencia operativa, cantidades exactas, saldos, operador y motivo; soporte separado o equivalente para movimientos de unidades de producto. Índices para historial y restricciones únicas contra aplicar dos veces el mismo efecto.
- Historial de estados/cotizaciones/fechas de pedidos y claves de operaciones para evitar doble cobro, doble entrega o aceptación obsoleta.
- Recetas y compras reutilizan tablas originales. No cambiar unidad de históricos ni reconstruir consumos pasados desde recetas actuales.
- Las filas anteriores a la migración se conservan. Sus saldos de pago desconocidos no se inventan: conservar anticipo previo como saldo inicial identificado en la migración, sin atribuir un método que no se conoce ni sumarlo como cobro del día. Ventas antiguas sin cliente permanecen al público general.
- Validar la posible existencia de pedidos/ventas/compras previos antes de migrar; si hay inconsistencias que impiden una conversión fiel, informar los registros afectados y detener esa parte en vez de fabricar pagos o movimientos.
- El esquema técnico exacto, nombres de columnas, índices y límites de datos quedan al implementador, manteniendo las reglas y la compatibilidad aquí descritas.

## Integridad y seguridad

- Mantener sesiones MySQL, cookies actuales, Argon2id, CSRF y consultas parametrizadas. Roles y titularidad se comprueban en servidor en cada acción; ocultar botones no es autorización.
- El cliente solo consulta/acepta/cancela sus propios pedidos y datos. No exponer hashes, contraseñas, secretos, datos de otros clientes o listas completas a caja.
- Totales y consumos calculados en servidor con aritmética decimal exacta, dinero en centavos y cantidades en milésimas. Redondeo comercial explícito por línea de compra; validar máximos de columnas y sumas antes de escribir. No usar floats sin control para dinero/inventario.
- Operaciones que tocan varias tablas usan transacciones InnoDB y bloqueos de filas con orden estable; inventario y saldos se validan de nuevo bajo bloqueo. No basarse únicamente en un GET anterior.
- Cobro, alta de pedido, recepción y entrega tienen clave de operación única persistida. La repetición idéntica devuelve el resultado ya registrado; una clave repetida con distinto contenido se rechaza. Estados, restricciones y transacciones evitan dobles efectos incluso entre cajas simultáneas.
- Consumos repetidos de un mismo ingrediente entre productos se agregan antes de validar/descontar. No permitir inventario negativo, cobros superiores al saldo o entrega sin aceptación/pago.
- Ediciones pendientes usan versión/estado esperado para evitar sobrescribir correcciones ajenas o recibir con datos obsoletos.
- Mantener el aislamiento del servidor estático; no servir configuración, copias de BD, scripts o documentos internos. Fotos siguen la validación actual.
- No ejecutar pruebas destructivas sobre la BD del usuario. Pruebas reales de transacciones y concurrencia usan una BD exclusiva de pruebas; si no se puede disponer de ella, informar el límite en la entrega.

## Fuera de este avance

Confirmado: panel de notificaciones y procesamiento bancario de pagos. Propuesto para aprobación: facturación fiscal, envío a domicilio/rutas, conversiones de unidades, producción por lotes, reservas automáticas de inventario, descuentos/promociones, devolución de ventas entregadas, reembolsos parciales, devoluciones a proveedores, adjuntos del personalizado, recuperación por correo, apertura/cierre de turno o control de efectivo físico por caja y despliegue en Internet. Estas funciones no se representarán con botones ficticios.

## Verificación y entrega

1. Conservar las pruebas actuales del catálogo/acceso/fotos y agregar pruebas de permisos reales para cada rol y de titularidad de pedidos.
2. Venta pública general y vinculada por correo; total real, recibo, descuentos correctos, sin exponer información innecesaria.
3. Recibir compra editada suma cantidades finales una sola vez; doble clic, dos cajas simultáneas, intento de editar recibida y fallo a mitad de operación.
4. Recetas, ingredientes compartidos, decimales, faltantes y límites: sin stock negativo ni aplicación parcial.
5. Pedido ordinario aunque no haya ingredientes; reprogramación visible al cliente; cobros parciales y cierre sin duplicar ventas/ingresos.
6. Personalizado sin receta al solicitar, cotizar/aceptar precio y versión, bloquear preparación sin aceptar y entrega sin consumo/pago; consumo real exacto al entregar.
7. Cliente no puede aceptar pedido ajeno ni fijar precios, trabajador no crea trabajadores ni modifica proveedores/recetas, administrador gestiona altas y consulta fichas.
8. Métricas y fichas sin duplicados entre pedidos, pagos y ventas; movimientos enlazados con operador y registros originales.
9. Migración repetible preserva datos; pruebas aisladas MySQL de rollback/concurrencia/idempotencia además de HTTP con repositorio simulado.
10. Revisión visual de administración/caja/cliente en escritorio y móvil, teclado y estados de error/vacío; ningún contador o botón de muestra.
11. Documentación de arranque, configuración de recetas/ingredientes, flujo de caja, personalizados, recepción de compras y respaldo. Distinguir pruebas aisladas de comprobaciones con datos reales del usuario.

## Aprobación

El usuario eligió el enfoque con movimientos y aprobó explícitamente el documento y las propuestas adicionales, incluidos permisos, cierre de pedidos, unidades, recetas y cancelaciones. La implementación está autorizada.
