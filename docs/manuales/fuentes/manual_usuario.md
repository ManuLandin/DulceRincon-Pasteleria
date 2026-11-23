# Manual de usuario de Dulce Rincón

Catálogo pedidos caja e inventario de la pastelería

Versión documental 1.0 • 16 de noviembre de 2026

Este manual explica cómo utilizar la aplicación desde el navegador. Cada procedimiento indica quién puede realizarlo, dónde entrar, qué datos capturar y qué resultado comprobar. El acceso compartido reconoce automáticamente si la cuenta es de cliente, trabajador o administrador.

## Lo que debes completar tú

| Elemento | Instrucción para el equipo |
| --- | --- |
| Portada académica | [COMPLETAR institución, materia, grupo, docente e integrantes]. |
| Dirección de acceso | [COMPLETAR URL que realmente se usará]. En internet se ha configurado dulcerincon.alwaysdata.net; confirma que tenga la actualización presentada. |
| Responsable de atención | [COMPLETAR cargo y medio de contacto autorizado]. No incluir contraseñas ni teléfonos personales sin autorización. |
| Datos de la pastelería | [COMPLETAR domicilio real, horarios confirmados y datos de contacto públicos]. Los textos iniciales de portada pueden ser de ejemplo. |
| Evidencias | Sustituye cada [INSERTAR CAPTURA Uxx] por la pantalla solicitada, con un pie de imagen. Usa datos ficticios o anonimizados. |

No debes agregar tus contraseñas al manual. En capturas de pago oculta números reales de cuenta y referencias bancarias. Las cuentas de prueba deben distinguirse de las utilizadas en operación.

## Cómo leer los procedimientos

Los nombres entre comillas corresponden a botones o secciones. Si la pantalla es estrecha, abre el menú de hamburguesa. Un botón de confirmar puede abrir un segundo cuadro para revisar la operación. No cierres ni repitas un cobro si la respuesta se interrumpe: conserva el mismo intento y consulta el resultado.

## Contenido

1. Entrada y tipos de cuenta. 2. Registro y contacto. 3. Catálogo y carrito. 4. Pedido del catálogo y pago. 5. Pedidos personalizados. 6. Atención de pedidos. 7. Caja y ventas. 8. Productos y recetas. 9. Proveedores e inventario. 10. Usuarios, notificaciones y resolución de problemas.

<!-- PAGE -->
# Entrada y tipos de cuenta

## Abrir la aplicación

1. Para internet abre la dirección pública confirmada por el equipo. Tu computadora no debe funcionar como servidor para acceder a la versión alojada.
2. Para la versión local, inicia MySQL y Express y abre http://127.0.0.1:3000/. El doble clic sobre index.html no activa las funciones del sistema.
3. En pantalla pequeña, utiliza el botón de menú para mostrar las opciones. Para cerrar un panel utiliza su botón Cerrar o el control de cierre correspondiente.

## Iniciar y cerrar sesión

1. Pulsa Iniciar sesión.
2. Escribe el correo de tu cuenta de la pastelería y su contraseña. No utilices la contraseña del alojamiento ni de MySQL.
3. Pulsa Iniciar sesión. El sistema abre el panel de tu rol; no eliges un rol en este formulario.
4. Si muestra Correo o contraseña incorrectos, verifica los datos. No pruebes repetidamente contraseñas al azar.
5. Para salir utiliza Cerrar sesión, especialmente en una caja o computadora compartida.

## Qué puede hacer cada persona

| Rol | Funciones principales |
| --- | --- |
| Visitante | Explorar catálogo, buscar, ver fotos y preparar carrito. Debe iniciar sesión para enviar pedidos. |
| Cliente | Pedir, solicitar personalizados, revisar cotizaciones, referencias, cambios, compras asociadas y contacto propio. |
| Trabajador | Cobrar en caja, revisar transferencias, atender y entregar pedidos, consultar productos e ingredientes y sus ventas. |
| Administrador | Operación general más productos, recetas, inventario, proveedores, compras, clientes, trabajadores y configuración bancaria. |

El cliente no crea trabajadores. El trabajador no administra usuarios ni proveedores. Entrar a una dirección de otro panel no concede acceso: la aplicación comprueba el rol.

[INSERTAR CAPTURA U01] Inicio público y botón Iniciar sesión. [INSERTAR CAPTURA U02] Pantalla de acceso sin correo ni contraseña capturados. [COMPLETAR ayuda de acceso] A quién debe acudir una persona si olvidó su contraseña; no existe una recuperación automática por correo en este avance.

<!-- PAGE -->
# Crear cuenta y editar contacto

## Registro de un cliente

1. Desde Iniciar sesión pulsa Crear mi cuenta.
2. En Nombre escribe tu nombre con letras y espacios. Se aceptan acentos y ñ; no números ni símbolos.
3. Escribe un correo válido y propio. Es obligatorio y será tu identificador de acceso; después no podrás modificarlo desde Editar contacto.
4. Captura tu teléfono de contacto. No uses letras. El campo permite separadores habituales y hasta 20 caracteres.
5. Captura tu dirección, hasta 255 caracteres. Incluye la información necesaria para identificarla. Registrar dirección no habilita reparto a domicilio: los pedidos se recogen en tienda.
6. Crea una contraseña de 12 a 25 caracteres y repítela exactamente. Puedes usar palabras y espacios; no la incluyas en capturas ni la compartas con el personal.
7. Pulsa Crear mi cuenta. El sistema crea una cuenta Cliente y te dirige a iniciar sesión.

Si el correo ya está registrado, intenta acceder con esa cuenta o consulta al responsable. No se crea otra cuenta sobre el mismo correo ni se reemplaza la anterior.

## Editar contacto

1. Entra como Cliente y pulsa Editar contacto en la navegación de tu cuenta o en el pie de página.
2. Se abre un cuadro con el correo registrado solo para consulta y campos de nombre, teléfono y dirección.
3. Corrige los campos permitidos. El correo no tiene control de edición.
4. Pulsa Guardar cambios. Revisa el resumen de los nuevos datos.
5. Pulsa Confirmar para guardar o Cancelar para regresar al formulario sin aplicar el cambio.
6. Comprueba el mensaje de actualización. Si aparece un conflicto de versión, cierra y vuelve a abrir el contacto para revisar los datos más recientes.

Cerrar el cuadro o cancelar la confirmación no sustituye tus datos guardados. Si tu cuenta se creó antes de que teléfono y dirección fueran obligatorios, puedes completarlos desde este mismo formulario.

[INSERTAR CAPTURA U03] Registro con los seis tipos de dato y confirmación de contraseña, sin mostrar claves. [INSERTAR CAPTURA U04] Editar contacto y cuadro de confirmación con datos ficticios. El correo debe verse como texto no editable.

<!-- PAGE -->
# Explorar productos y utilizar el carrito

## Encontrar un producto

1. Abre el catálogo público o el catálogo dentro de la cuenta de cliente.
2. Selecciona Pasteles, Galletas, Repostería o Cup cakes. Las categorías disponibles dependen de los registros activos.
3. Utiliza el buscador por nombre. Para quitar un filtro elige Todos y limpia la búsqueda.
4. Si hay varias páginas usa Anterior y Siguiente.
5. Pulsa la fotografía o Ver detalle para consultar descripción, precio y presentación.

## Agregar y revisar artículos

1. Pulsa Agregar al carrito en cada producto que quieras reunir. Agregar el mismo producto aumenta su cantidad en una sola línea.
2. Abre Carrito en el encabezado. El contador muestra el total de unidades seleccionadas.
3. Utiliza los botones más y menos o el campo numérico para cambiar cantidades enteras. Quitar elimina una línea.
4. Revisa subtotales y total estimado. Si una cantidad supera la existencia, aparece un aviso de entrega por confirmar.
5. Pulsa Seguir explorando para volver al catálogo o Continuar con mi pedido para avanzar.

El carrito conserva identificadores y cantidades en ese navegador; no sincroniza tu selección con otros dispositivos ni reserva productos. No almacena un precio autorizado definitivo. El servidor vuelve a consultar precios antes del pago. Si un artículo fue desactivado, debes quitarlo o actualizar el carrito para continuar.

## Acceso requerido para pedir

Un visitante puede reunir productos, pero al continuar debe iniciar sesión. Después de entrar, abre de nuevo el carrito para revisar la selección. El envío corresponde a una cuenta Cliente. El personal utiliza Caja para ventas de mostrador, no una cuenta de cliente ajena.

Ejemplo de selección: dos pasteles de $450.00 y una galleta de $50.00 dan $950.00. Este ejemplo no modifica los precios reales: comprueba los que muestra tu catálogo.

[INSERTAR CAPTURA U05] Catálogo filtrado y botón Agregar al carrito. [INSERTAR CAPTURA U06] Carrito con dos productos diferentes, cantidades y total. Incluye un aviso de existencia insuficiente si quieres explicar las entregas por confirmar.

<!-- PAGE -->
# Crear un pedido del catálogo

## Seleccionar recogida

1. Entra como Cliente. Desde el carrito pulsa Continuar con mi pedido; también puedes usar Nuevo pedido en Mis pedidos.
2. Revisa productos y cantidades. En el formulario puedes agregar artículos o quitar líneas antes de continuar.
3. Selecciona una fecha futura con el calendario. Usa las listas para elegir hora y minutos, sin escribir la hora manualmente.
4. La recogida solo se permite entre 10:00 y 20:00, hora de Ciudad de México. A las 20 h únicamente se permite el minuto 00.
5. Agrega observaciones si hacen falta. No incluyas contraseñas, datos de tarjetas ni información que no corresponda al pedido.
6. Pulsa Consultar importe e instrucciones de pago.

Puedes enviar la solicitud a cualquier hora; el horario limita la recogida. La fecha solicitada será la entrega prevista al aceptar el pedido, salvo que el personal tenga que modificarla. Un producto sin existencias puede requerir una fecha posterior.

## Elegir forma de pago

En Transferencia debes cubrir el total antes de enviar la referencia. En Efectivo al recoger debes transferir primero el 30 % y pagar el saldo restante en efectivo al entregar. No se aceptan pagos con tarjeta en el flujo actual.

1. Selecciona la modalidad de pago.
2. Revisa el importe exacto a transferir, el saldo, el banco, titular y CLABE mostrados.
3. Realiza la transferencia fuera de la aplicación únicamente a la cuenta real confirmada por la pastelería.
4. Escribe la referencia o clave de rastreo de esa transferencia.
5. Pulsa Enviar referencia para validación y confirma el importe.
6. Comprueba el folio en Mis pedidos. Se mostrará pendiente de validación; enviar una referencia todavía no confirma el ingreso.

Con total de $950.00, Transferencia requiere $950.00; Efectivo al recoger requiere $285.00 por transferencia y deja $665.00 en efectivo. Usa los importes calculados por la aplicación, no cantidades estimadas por memoria.

Si no hay datos bancarios configurados, avisa al administrador. El cliente no debe capturar la cuenta receptora de la pastelería. Si el personal pide corrección, abre el pedido, revisa el motivo y utiliza Corregir y reenviar referencia.

[INSERTAR CAPTURA U07] Selector de recogida y resumen del anticipo, usando cuenta bancaria ficticia en un entorno de prueba. [INSERTAR CAPTURA U08] Pedido pendiente de validación con su folio.

<!-- PAGE -->
# Solicitar un personalizado y consultar novedades

## Solicitud y cotización

1. Pulsa Solicitar personalizado en la cuenta de cliente.
2. Describe tamaño, porciones, sabores, colores, decoración y detalles específicos del encargo. Captura la fecha y hora de recogida solicitadas.
3. Si lo deseas, adjunta hasta tres imágenes de referencia JPG, PNG o WebP. Cada imagen puede pesar como máximo 5 MiB y tener hasta 16 millones de píxeles.
4. Revisa las vistas previas y quita cualquier archivo equivocado.
5. Envía la solicitud. En esta etapa no se exige un pago sin conocer el precio; queda Por cotizar.
6. El personal propone precio y fecha. Abre Mis pedidos y acepta o rechaza la cotización vigente.
7. Después de aceptarla, consulta el pago y envía la referencia con la modalidad elegida. El personal comprobará el ingreso antes de preparar.

Las referencias son privadas para el cliente titular y el personal autorizado. Puedes sustituirlas antes de la primera cotización mediante Corregir imágenes de referencia. Después, consulta al personal si necesitas cambiar el encargo; no se reemplazan silenciosamente las condiciones aceptadas.

## Seguir pedidos y compras

Mis pedidos muestra solicitudes, estado, entrega confirmada, total, saldo y aceptación de transferencia. Pulsa el folio para ver artículos, observaciones, pagos e historial. En personalizados pendientes de cotización el precio aparece por cotizar, no como regalo de $0.00.

Mis compras contiene ventas completadas asociadas a tu cuenta, incluidas las que te vincularon en mostrador. Una venta anónima no aparece allí. Un pedido todavía sin entregar no debe confundirse con una compra completada.

## Notificaciones

La campana y la sección Notificaciones avisan de cotizaciones, correcciones, aceptación y cambios de pedido. Se actualizan periódicamente con la página visible, aproximadamente cada 15 segundos. Puedes actualizar manualmente y marcar avisos como leídos. Son avisos dentro de la aplicación, no mensajes de correo.

Si cambia la entrega prevista, revisa fecha y motivo en el pedido. No asumas que una fecha vencida equivale a entregado: el personal debe confirmar la entrega.

[INSERTAR CAPTURA U09] Personalizado con referencias ficticias. [INSERTAR CAPTURA U10] Cotización pendiente de aceptación y una notificación de cambio de fecha.

<!-- PAGE -->
# Atender pedidos como trabajador

## Verificar la transferencia y aceptar

1. Inicia sesión como Trabajador y abre Revisar transferencias. Selecciona el folio pendiente.
2. Compara importe y referencia con el ingreso real consultado fuera de la aplicación. No aceptes solo porque el cliente escribió una referencia.
3. Pulsa Verificar transferencia y aceptar. Comprueba el importe, referencia y entrega prevista automática.
4. Si la fecha solicitada sigue vigente, no tienes que volver a capturarla. Si ya venció, selecciona una nueva y explica el motivo.
5. Marca la comprobación del ingreso y pulsa Confirmar ingreso y aceptar pedido. Al aceptar como trabajador quedas responsable si todavía no había uno.
6. Si el ingreso no coincide, usa Por corregir y escribe claramente qué debe revisar el cliente. No se registra un pago al pedir corrección.

Si acepta un administrador y el pedido no tiene responsable, debe seleccionar un trabajador activo. El pago y la asignación quedan registrados junto con la aceptación.

## Preparar y dejar listo

1. Abre el pedido aceptado y pulsa Poner en preparación. Confirma la acción.
2. Cuando el producto esté preparado pulsa Marcar listo y confirma.
3. La entrega prevista se conserva al cambiar de estado. No debes volver a elegirla para cada paso.
4. El indicador de progreso ayuda a identificar Aceptado, En preparación, Listo y Entregado. Los pasos no permiten saltar las reglas de pago o aceptación.

## Cambiar la fecha por adelanto o atraso

Pulsa Cambiar entrega prevista, elige la nueva fecha y hora, escribe el motivo del adelanto o retraso y confirma. El horario debe ser futuro y estar entre 10:00 y 20:00. El cambio se guarda en el historial y se notifica al cliente. Cambiar responsable es una acción separada que no requiere volver a capturar la fecha.

## Entregar

Con estado Listo pulsa Marcar entregado. Si queda saldo en efectivo, captura exactamente el pendiente. Si es personalizado, registra los ingredientes realmente utilizados y sus cantidades. Revisa el cuadro y confirma entrega o cobro y entrega. El sistema comprueba existencias, descuenta inventario, registra la venta y muestra comprobante interno. Si falta inventario, corrige el problema antes de reintentar; no debe quedar un cobro final parcial por una entrega fallida.

[INSERTAR CAPTURA U11] Aceptación con fecha automática. [INSERTAR CAPTURA U12] Botones directos y cambio de entrega prevista. [INSERTAR CAPTURA U13] Confirmación de entrega con saldo o consumo real de personalizado.

<!-- PAGE -->
# Vender en caja

## Venta sin cuenta y venta asociada

1. Entra como Trabajador o Administrador y abre Caja. El acceso Abrir caja lleva a la pantalla de venta; no representa un arqueo de turno.
2. Selecciona productos y cantidades. Puedes registrar varios artículos en la misma venta.
3. Si el comprador desea asociar su cuenta, busca su correo exacto y selecciona el cliente correcto. Si no tiene cuenta, conserva Público general.
4. Revisa total y disponibilidad del conjunto. Cada producto necesita receta activa e ingredientes suficientes, además de unidades disponibles.
5. Selecciona Efectivo o Transferencia.
6. En efectivo puedes escribir lo recibido para calcular cambio. En transferencia escribe referencia y marca la comprobación externa del ingreso.
7. Confirma la venta y revisa el comprobante. Puedes imprimirlo como evidencia interna; no es una factura fiscal.

Ejemplo: un pastel de $450.00, con $500.00 recibidos, produce $50.00 de cambio. Si la persona no asocia una cuenta, la venta existe para el personal pero no se atribuye a un cliente ficticio.

## Si no hay disponibilidad

Una venta inmediata no puede cobrar un artículo sin receta o sin inventario suficiente. El sistema revisa también ingredientes compartidos entre artículos. Puedes proponer al cliente un pedido para una fecha posterior, pero ese pedido requiere cuenta y sus reglas de anticipo.

## Consultar ventas

El trabajador consulta Mis ventas; el administrador consulta Ventas y el resumen general. Abre un folio para revisar sus líneas y pagos. El resumen distingue cobros y ventas completadas: recibir un anticipo no equivale a haber entregado el pastel.

## Evitar cobros repetidos

Si la respuesta se interrumpe, no abras otra venta diferente para “probar”. Recupera el mismo intento y consulta el folio. Las operaciones utilizan claves para impedir que un reintento idéntico descuente inventario o cobre otra vez.

[INSERTAR CAPTURA U14] Caja con dos artículos y modalidad de pago. [INSERTAR CAPTURA U15] Comprobante ficticio y venta asociada o de público general. Oculta referencias reales.

<!-- PAGE -->
# Administrar productos recetas y existencias

## Alta y edición de productos

1. Como Administrador abre Productos y el formulario de alta.
2. Captura nombre, categoría, descripción, precio en MXN, unidad, existencia inicial y mínimo correspondiente.
3. Selecciona una foto JPG, PNG o WebP válida de hasta 5 MiB. La fotografía es obligatoria al crear el producto.
4. Guarda y comprueba que aparece en Productos registrados y en el catálogo público si está activo y su categoría también lo está.
5. Para editar un producto existente utiliza Editar; para cambiar su foto usa el control de sustitución de fotografía disponible en la administración.

## Ajustar unidades preparadas

En Productos registrados localiza el artículo y pulsa Ajustar unidades. Escribe la existencia FINAL, el motivo y confirma Registrar ajuste. Si había 5 y agregaste 10, captura 15, no 10. El ajuste queda auditado en Movimientos y no consume ingredientes de una receta.

## Configurar receta

1. Desde el producto pulsa Receta o abre la sección Recetas.
2. Captura un nombre e ingredientes activos con la cantidad utilizada por una unidad vendible del producto.
3. Usa la misma unidad base del ingrediente. Por ejemplo, 500 gramos se registran como 0.500 kg si la unidad es kg; no escribas 500 pensando que el sistema convertirá.
4. No repitas un ingrediente en dos líneas. Reúne la cantidad en una sola.
5. Guarda y comprueba que el producto tiene receta activa. Vender o entregar consultará esa receta y el inventario.

Las recetas cargadas de ejemplo deben validarse con el proceso real de la pastelería. Cambiar una receta no debe reescribir los consumos históricos de ventas ya registradas.

## Ingredientes

Desde Ingredientes agrega nombre, unidad base kg, litro o pieza, existencia inicial y stock mínimo. Para un conteo físico usa Ajustar existencia e indica total final y motivo. Si una unidad ya tiene movimientos o existencias, no la cambies para reinterpretar cantidades anteriores; crea el ingrediente correcto siguiendo el procedimiento del administrador.

[INSERTAR CAPTURA U16] Alta con fotografía, receta por unidad y ajuste de unidades. [INSERTAR CAPTURA U17] Movimiento generado por el ajuste, con cantidades ficticias.

<!-- PAGE -->
# Proveedores compras y usuarios

## Registrar y recibir compras

1. Como Administrador abre Proveedores y da de alta nombre y contacto de la empresa proveedora.
2. Abre Compras y crea una compra para ese proveedor. Agrega ingredientes, cantidades y precios por unidad base.
3. Guarda como pendiente y revisa el total. Crear la compra no aumenta todavía el inventario.
4. Antes de recibir, corrige cantidades o precios si hubo un error. La entrega se maneja completa; no hay recepción parcial en este avance.
5. Cuando llegue todo, abre la compra y confirma Recibir cantidades definitivas.
6. Revisa el estado de recibida o entregada y consulta Ingredientes: las cantidades deben haberse sumado una sola vez. Comprueba también Movimientos.

Si cancelas una compra pendiente no se agrega stock. Una compra recibida no se edita como si siguiera pendiente. Una corrección posterior requiere un ajuste justificado y el procedimiento acordado por el negocio; no se inventa una segunda recepción.

## Clientes y trabajadores separados

El administrador consulta Clientes y Trabajadores en secciones distintas, cada una con su buscador. Abre un cliente para ver contacto, compras, pedidos e importes vinculados a esa cuenta. Las ventas anónimas no se asignan automáticamente a ningún cliente.

Solo el administrador da de alta trabajadores. En Trabajadores captura nombre, correo, contacto, contraseña temporal y confirmación según el formulario; entrega la contraseña personalmente. El registro público no ofrece elegir Trabajador ni Administrador. Desactivar una cuenta conserva su historial; no equivale a borrar sus ventas.

El correo de cliente se conserva durante la edición de contacto. Si se requiere una corrección excepcional de identidad, debe tratarse como un cambio de alcance y procedimiento, no como un campo editable que el cliente pueda alterar.

## Configurar la cuenta receptora

En Configuración bancaria el administrador captura banco, titular, CLABE de 18 dígitos e instrucciones. Revisa y confirma antes de guardar. Los clientes utilizarán esos datos para transferir; no deben ser inventados en una base operativa. Cada cambio genera una versión y los intentos ya enviados conservan el destino que se les mostró.

[INSERTAR CAPTURA U18] Proveedor, compra pendiente y compra recibida con incremento de ingrediente. [INSERTAR CAPTURA U19] Listas separadas de usuarios y ficha de cliente ficticio. [INSERTAR CAPTURA U20] Configuración bancaria exclusivamente de prueba, con la advertencia de no transferir.

<!-- PAGE -->
# Notificaciones errores y cierre de operación

## Avisos por rol

El cliente recibe novedades de sus propios pedidos. El trabajador recibe solicitudes y eventos de pedidos según su asignación y los permisos del sistema. El administrador recibe avisos generales de pedidos nuevos, listos y entregados, ventas completadas y compras creadas, recibidas o canceladas. Cada usuario tiene su lectura individual de notificaciones.

## Qué hacer ante un mensaje

| Mensaje o situación | Acción del usuario |
| --- | --- |
| No hay cuenta bancaria configurada | Solicitar al administrador que complete los datos en la versión que estás utilizando. |
| Fecha u hora inválida | Elegir recogida futura entre 10:00 y 20:00 CDMX. |
| Referencia por corregir | Leer el motivo, comprobar la transferencia y reenviar desde ese pedido. |
| El registro cambió | Recargar el detalle y revisar la información más reciente antes de guardar. |
| Faltan existencias | Consultar receta y stock; el administrador registra compra recibida o ajuste justificado. |
| No pudimos conectar | Comprobar internet o solicitar que se inicie Express en local. No repetir una venta nueva sin revisar la anterior. |
| No aparece una actualización | Recargar con Ctrl + F5 y comprobar que estás en la URL correcta. |

## Cancelaciones

El cliente puede cancelar un pedido pendiente sin pagos cuando no hay una transferencia esperando revisión. Con pagos registrados, la cancelación requiere administrador y devolución manual completa antes de entregar, conforme a las reglas del sistema. El dinero se devuelve fuera de la aplicación; registrar una devolución no hace una transferencia bancaria automática.

No hay devolución automática de ventas ya completadas, reembolso parcial ni devolución de compras a proveedores en este avance. No utilices ajustes de stock para simular una devolución monetaria.

## Recomendaciones de uso

Comprueba folio, cliente, importe y modalidad antes de confirmar. Cierra sesión al terminar en un equipo compartido. No envíes capturas con contraseñas o datos bancarios reales. Usa los casos de prueba del documento de presentación en una base separada para no alterar inventario y ventas del negocio.

[COMPLETAR soporte] Responsable autorizado, horario de atención y medio de contacto. [COMPLETAR versión usada en capacitación] Fecha y dominio o puerto. [INSERTAR CAPTURA U21] Un error controlado y cómo se resolvió, con información ficticia.

## Lista para entregar este manual

Sustituir datos de portada y soporte; confirmar URL y versión; agregar capturas U01 a U21 con pie de imagen; comprobar que se ven los botones descritos; ocultar datos privados; verificar que los ejemplos de precio se identifican como ejemplos; guardar una copia final con fecha.
