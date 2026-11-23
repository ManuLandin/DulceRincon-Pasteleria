# Casos de prueba y guion de presentación

Dulce Rincón sistema de punto de venta y administración

Versión documental 1.0 • 16 de noviembre de 2026

Este documento sirve para ensayar, mostrar funciones y registrar evidencias. Los casos indican preparación, pasos y resultado esperado. El resultado esperado no es una prueba ejecutada: completa el resultado real después de realizar cada caso.

## Lo que debes preparar y escribir tú

| Campo | Qué debes poner |
| --- | --- |
| [COMPLETAR presentación] | Escuela, materia, docente, equipo y fecha. |
| [COMPLETAR entorno de prueba] | URL y base de DEMOSTRACIÓN. No escribir contraseñas. |
| [COMPLETAR ejecutor] | Integrante responsable de realizar cada caso. |
| [COMPLETAR versión] | Paquete instalado y fecha de actualización del sistema presentado. |
| [COMPLETAR resultado real] | Qué ocurrió al ejecutar; Aprobado, Fallido o Bloqueado, con evidencia. |
| [INSERTAR EVIDENCIA CPxx] | Captura o video donde se vea el folio, estado o resultado. Ocultar datos privados. |

## Reglas para la demostración

Usa una copia aislada o una base temporal. Las ventas, recepciones y entregas alteran existencias e informes. Una referencia ficticia solo puede aceptarse dentro de ese entorno de prueba; nunca declares una transferencia ficticia como ingreso en la base real ni cambies la cuenta bancaria operativa para la presentación.

En local existe un servidor de QA con base temporal:

```powershell
node --env-file-if-exists=.env tests/operation-preview-server.js
```

Abre http://localhost:3002/. El script prepara cuentas y datos ficticios, no la base del negocio. Las cuentas son admin@example.test, worker@example.test y client@example.test; consulta la contraseña temporal definida en ese script de prueba, sin usar contraseñas reales. Al cerrar correctamente el proceso se elimina esa base temporal. Revisa permisos SQL y ensaya antes: crear el entorno puede tardar.

El dataset inicial de ese script no equivale al escenario numérico completo de la página siguiente. Si eliges ese entorno, prepara allí los artículos DEMO descritos o adapta sus cantidades y registra el valor inicial. No actives este servidor de QA en internet ni lo uses como sitio permanente.

<!-- PAGE -->
# Datos de demostración y valores de control

## Preparación por el administrador

1. Crea o identifica cuentas de prueba para Administrador, Trabajador y Cliente. El administrador inicial ya debe existir; el registro público solo crea clientes.
2. El cliente debe tener nombre con letras, correo de prueba único, teléfono ficticio y dirección ficticia. Define una contraseña de 12 a 25 caracteres en privado.
3. Configura un destino bancario expresamente ficticio solo en la base aislada. Escribe “Solo demostración no transferir”. No envíes dinero real para presentar.
4. Registra los siguientes ingredientes, proveedor, productos y recetas. Conserva una captura de los valores iniciales.

| Dato DEMO | Valor inicial o configuración |
| --- | --- |
| Harina DEMO | Unidad kg, existencia 10.000 y mínimo 1.000. |
| Crema DEMO | Unidad litro, existencia 5.000 y mínimo 1.000. |
| Pastel DEMO | Precio $450.00, existencia 5 piezas, foto válida y producto activo. |
| Receta Pastel DEMO | Por pieza: 0.500 kg de Harina DEMO y 0.250 litro de Crema DEMO. |
| Galleta DEMO | Precio $50.00, existencia 10 piezas, foto válida y producto activo. |
| Receta Galleta DEMO | Por pieza: 0.050 kg de Harina DEMO y 0.010 litro de Crema DEMO. |
| Producto agotado DEMO | Existencia 0, receta válida; precio e imagen de prueba. No incluirlo en el recorrido contable principal. |
| Proveedor DEMO | Nombre comercial y contacto completamente ficticios. |
| Fecha D | Día futuro de la demostración, por ejemplo dos días después, a las 12:00 CDMX. No usar una fecha ya vencida del documento. |

## Cálculos que debes poder explicar

Carrito de 2 Pastel DEMO y 1 Galleta DEMO: $950.00. Anticipo del 30 %: $285.00. Saldo en efectivo: $665.00. Consumo al entregar: 1.050 kg de harina y 0.510 litro de crema; reduce 2 pasteles y 1 galleta.

Compra de 2.000 kg de harina a $25.00 por kg: total $50.00. Antes de recibir, harina permanece en 10.000 kg; después queda en 12.000 kg. Si luego entregas el carrito anterior, queda harina 10.950 kg y crema 4.490 litros; pasteles 3 y galletas 9.

Una venta posterior de 1 pastel por $450.00 deja harina 10.450 kg, crema 4.240 litros y pasteles 2. Si se reciben $500.00, el cambio es $50.00. Estos valores solo aplican si ejecutas exactamente esa secuencia y no agregas otros movimientos.

<!-- PAGE -->
# Guion recomendado para la exposición

## Recorrido principal de quince a veinte minutos

| Orden | Qué mostrar | Qué explicar |
| --- | --- | --- |
| 1 | Catálogo público y buscador. | El visitante explora, pero el pedido necesita cuenta. |
| 2 | Registro o cliente ya preparado. | Datos obligatorios, rol Cliente y correo que se conserva. |
| 3 | Editar contacto y cancelar una confirmación. | No se guarda un cambio hasta confirmarlo. |
| 4 | Carrito con dos productos y cantidades. | Una sola solicitud reúne artículos y el servidor confirma precios. |
| 5 | Recogida y anticipo de $285.00. | Solicitud a cualquier hora; recogida de 10 a 20; no hay tarjeta. |
| 6 | Referencia ficticia en la base de demostración. | Enviar referencia no equivale a recibir dinero. |
| 7 | Trabajador acepta y pone en preparación. | Verificación manual y fecha automática. |
| 8 | Cambio de fecha con motivo y aviso al cliente. | El historial conserva la reprogramación. |
| 9 | Listo y entrega cobrando $665.00. | El saldo y el inventario se validan juntos. |
| 10 | Compra recibida e ingredientes actualizados. | Recepción única, sin sumar stock mientras está pendiente. |
| 11 | Caja de público general y comprobante. | Una venta ordinaria no requiere cuenta del comprador. |
| 12 | Resumen y permisos por rol. | Diferencia entre cobros, pedidos pendientes y ventas completadas. |

Ten iniciadas sesiones separadas para cada rol, por ejemplo perfiles de navegador diferentes. Una ventana nueva del mismo navegador puede compartir cookies: no asumas que mantiene otro rol. Prepara los folios de los casos largos para no dedicar toda la exposición a capturar datos.

## Personalizado como demostración complementaria

Si tienes cinco minutos adicionales, muestra una solicitud con imagen ficticia, la cotización del personal y la aceptación del cliente. Explica que los ingredientes reales se declaran al entregar. Puedes dejar el personalizado preparado antes de exponer y usar CP15 a CP17.

## Frases que ayudan a explicar

“Este anticipo es un cobro recibido, pero todavía no es una venta entregada.” “La aplicación no entra al banco; el trabajador comprueba el ingreso.” “La fecha no mueve por sí sola un pedido a entregado.” “Una compra pendiente no se suma al inventario.”

[COMPLETAR reparto del equipo] Quién demuestra cliente, trabajador y administrador; quién explica base de datos y quién registra evidencias. [COMPLETAR duración] Ajusta el recorrido al tiempo real asignado por el docente.

<!-- PAGE -->
# Acceso y registro

## CP01 Registro válido

Preparación: correo ficticio que aún no exista y contraseña privada de 12 a 25 caracteres. No reutilices correo real de otra persona.

1. Abre Crear mi cuenta. Escribe nombre con acentos, correo, teléfono y dirección ficticios.
2. Captura contraseña y confirmación iguales. Envía el formulario.
3. Inicia sesión con la cuenta recién creada.

Esperado: se crea exactamente un Cliente, se conservan teléfono y dirección y abre cliente.html. No aparece una elección de rol. Para demostrar persistencia, abre Editar contacto y comprueba los campos.

Evidencia: [INSERTAR EVIDENCIA CP01] Alta confirmada y contacto, sin contraseña. Resultado real: [COMPLETAR].

## CP02 Rechazar datos de registro inválidos

Preparación: no enviar un alta válida al terminar cada intento; cambia un campo por vez para identificar el motivo.

1. Prueba nombre Ana123 y después Ana@Pérez.
2. Prueba correo sin @ o sin dominio; deja teléfono o dirección vacíos.
3. Prueba 11 caracteres de contraseña y confirmaciones diferentes. Pega una cadena de 26 caracteres y observa el límite del navegador; para comprobar rechazo del servidor usa la prueba automatizada de registro, no afirmes que el truncado del campo demuestra por sí solo la API.

Esperado: el formulario o el servidor rechaza cada caso y no crea cuentas incompletas. Nombre María José Muñoz sí debe admitirse. El teléfono no admite letras.

Evidencia: [INSERTAR EVIDENCIA CP02] Mensajes visibles y registro automatizado si se muestra la validación de API. Resultado real: [COMPLETAR].

<!-- PAGE -->
# Sesiones permisos y contacto

## CP03 Roles y acceso protegido

Preparación: cuentas de cliente y trabajador, y una ventana sin sesión.

1. Sin sesión abre /admin.html y /trabajador.html.
2. Como cliente intenta entrar a /admin.html.
3. Como trabajador busca opciones para crear trabajadores o administrar proveedores.
4. Como administrador muestra Clientes y Trabajadores por separado.

Esperado: sin sesión se pide acceso; el cliente no obtiene el panel del administrador; el trabajador no administra usuarios ni proveedores. El servidor debe rechazar escrituras no autorizadas, no solo ocultar botones. Para demostrar esa capa utiliza los tests de permisos, sin manipular datos reales.

Evidencia: [INSERTAR EVIDENCIA CP03] Redirección y menús por rol. Resultado real: [COMPLETAR].

## CP04 Editar contacto con confirmación

Preparación: cliente ficticio con teléfono y dirección registrados.

1. Abre Editar contacto. Comprueba que el correo es texto de consulta.
2. Cambia teléfono o dirección y pulsa Guardar cambios. En el resumen pulsa Cancelar.
3. Cierra, vuelve a abrir y verifica que se conservan los datos anteriores.
4. Repite la edición y ahora confirma. Vuelve a abrir el contacto.

Esperado: cancelar no guarda; confirmar sí persiste los cambios. El correo se conserva. El intento de modificarlo a través de la API debe fallar con permiso denegado; está cubierto por la prueba del servicio de contacto.

Evidencia: [INSERTAR EVIDENCIA CP04] Confirmación y valores posteriores. Resultado real: [COMPLETAR].

<!-- PAGE -->
# Catálogo y carrito

## CP05 Búsqueda filtros y detalle

Preparación: productos activos en al menos dos categorías.

1. Sin sesión busca una parte del nombre de un producto.
2. Cambia de categoría y después elige Todos.
3. Busca un término sin coincidencias y limpia la búsqueda.
4. Abre la ficha y verifica foto, precio, unidad y descripción.

Esperado: los resultados corresponden a los filtros; una búsqueda vacía de resultados muestra un mensaje comprensible; limpiar filtros recupera el catálogo. No aparecen productos desactivados.

Evidencia: [INSERTAR EVIDENCIA CP05] Filtro, detalle y estado sin resultados. Resultado real: [COMPLETAR].

## CP06 Carrito con varios artículos

Preparación: Pastel DEMO de $450.00 y Galleta DEMO de $50.00.

1. Agrega un pastel, una galleta y de nuevo el mismo pastel.
2. Abre Carrito. Deben existir dos líneas y tres unidades.
3. Verifica total $950.00. Quita la galleta y comprueba $900.00; agrégala otra vez.
4. Recarga y comprueba que la selección se conserva en ese navegador.
5. Sin sesión intenta continuar; después inicia sesión como Cliente y abre el carrito.

Esperado: agrupa productos repetidos; calcula cantidades y total estimado; conserva selección; requiere sesión para enviar el pedido. No crea ventas ni descuenta existencias al agregar al carrito.

Evidencia: [INSERTAR EVIDENCIA CP06] Dos líneas con total y contador. Resultado real: [COMPLETAR].

<!-- PAGE -->
# Recogida y pagos del catálogo

## CP07 Horario de recogida

Preparación: abrir Nuevo pedido con el carrito de $950.00 y elegir un día futuro D.

1. Selecciona fecha en calendario y hora en la lista.
2. Comprueba que se puede elegir 10:00 y 20:00.
3. A las 20 h verifica que solo esté habilitado minuto 00.
4. Prueba una fecha pasada. Para 09:59 y 20:01 muestra los tests de política del servidor si la lista ya impide seleccionarlas.

Esperado: recogida futura entre 10 y 20 CDMX. El envío de solicitud puede hacerse fuera de ese horario; esto no habilita una recogida nocturna.

Evidencia: [INSERTAR EVIDENCIA CP07] Listas y validación de fecha pasada. Resultado real: [COMPLETAR].

## CP08 Anticipo y referencia pendiente

Preparación: destino bancario ficticio en la base aislada; carrito de $950.00 y recogida D a las 12:00.

1. Consulta importe. Con Transferencia verifica $950.00 y saldo $0.00.
2. Cambia a Efectivo al recoger y verifica anticipo $285.00 y saldo $665.00.
3. Solo en el entorno de prueba escribe una referencia única DEMO y confirma.
4. Abre el folio en Mis pedidos.

Esperado: queda pendiente de validación, con anticipo contable todavía $0.00 y sin venta completada. No se descuentan productos ni ingredientes. No aparece tarjeta como modalidad.

Evidencia: [INSERTAR EVIDENCIA CP08] Importes y pedido pendiente. Resultado real: [COMPLETAR].

<!-- PAGE -->
# Revisión y aceptación del pedido

## CP09 Solicitar corrección y reenviar

Preparación: pedido de CP08 con referencia ficticia pendiente.

1. Como trabajador abre Revisar transferencias y el folio.
2. Pulsa Por corregir y escribe un motivo específico de prueba.
3. Como cliente abre su notificación y el mismo pedido.
4. Corrige y reenvía la referencia; no crees otro pedido para corregirla.

Esperado: conserva el folio y los intentos anteriores; el cliente conoce el motivo; el nuevo intento queda pendiente; no se registra un pago al solicitar corrección.

Evidencia: [INSERTAR EVIDENCIA CP09] Historial de intentos y aviso del cliente. Resultado real: [COMPLETAR].

## CP10 Aceptar y confirmar fecha automática

Preparación: referencia pendiente del pedido de $950.00, modalidad Efectivo. La fecha D debe seguir siendo futura. La validación es simulada únicamente en la base aislada.

1. Como trabajador pulsa Verificar transferencia y aceptar.
2. Comprueba referencia, importe $285.00 y fecha automática D a las 12:00.
3. Marca la comprobación del ingreso ficticio y confirma.
4. Consulta el pedido y el aviso del cliente.

Esperado: anticipo $285.00, saldo $665.00, aceptación Aceptado, responsable asignado y entrega confirmada igual a la solicitada. El estado aún no es Entregado. Repetir una aceptación no debe duplicar el pago.

Evidencia: [INSERTAR EVIDENCIA CP10] Fecha y pago confirmados. Resultado real: [COMPLETAR].

<!-- PAGE -->
# Preparación y cambios de fecha

## CP11 Preparar y marcar listo

Preparación: pedido de CP10 aceptado y todavía pendiente.

1. Abre el detalle y pulsa Poner en preparación. Confirma.
2. Comprueba el estado y la entrega prevista.
3. Pulsa Marcar listo y confirma.
4. Abre el pedido como cliente y su aviso.

Esperado: Pendiente pasa a En preparación y después a Listo mediante botones directos. La fecha se conserva y el cliente recibe novedades. No se debe permitir preparar sin aceptación de pago ni saltar de Pendiente a Entregado.

Evidencia: [INSERTAR EVIDENCIA CP11] Indicador de progreso y estados. Resultado real: [COMPLETAR].

## CP12 Adelantar o retrasar entrega

Preparación: pedido activo con entrega D a las 12:00.

1. Pulsa Cambiar entrega prevista, elige D a las 11:00 y prueba guardar sin motivo.
2. Escribe “Adelanto acordado con cliente DEMO” y confirma.
3. Comprueba aviso, nueva fecha e historial.
4. Para probar retraso elige D a las 13:00 con un motivo diferente y vuelve a comprobar.

Esperado: el motivo es obligatorio para adelantar y para retrasar; fecha futura y horario válidos; historial conserva cada actualización. El cambio de fecha no marca el pedido como entregado.

Evidencia: [INSERTAR EVIDENCIA CP12] Nueva fecha, motivo y aviso. Resultado real: [COMPLETAR].

<!-- PAGE -->
# Entrega y existencias

## CP13 Entrega con saldo en efectivo

Preparación: pedido Listo, anticipo $285.00 y saldo $665.00. Captura existencias iniciales de ingredientes y productos inmediatamente antes de entregar.

1. Pulsa Marcar entregado.
2. Verifica el saldo y prueba un importe menor; debe rechazarse.
3. Captura $665.00 en efectivo y confirma.
4. Comprueba comprobante, venta, estado Entregado y movimientos.

Esperado: pago final $665.00, total pagado $950.00 y una venta completada. Reduce 2 pasteles, 1 galleta, 1.050 kg de harina y 0.510 litro de crema. No repetir entrega ni consumo al recargar.

Evidencia: [INSERTAR EVIDENCIA CP13] Saldo cero, venta y antes y después de inventario. Resultado real: [COMPLETAR].

## CP14 Faltantes y operación sin cambios parciales

Preparación: otro pedido DEMO Listo con saldo; reduce un ingrediente necesario a 0 mediante ajuste justificado SOLO en la base de prueba. Anota pagos e inventario.

1. Intenta entregar y cobrar el saldo.
2. Consulta de nuevo pedido, pagos, venta e inventario.
3. Repón mediante compra recibida o ajuste de prueba con motivo y reintenta.

Esperado: con faltante no se confirma entrega ni cobro final parcial. Después de reponer puede completarse una sola vez. Una referencia de aceptación anterior se conserva; no se inventa un segundo anticipo.

Evidencia: [INSERTAR EVIDENCIA CP14] Rechazo por faltante y valores sin cambios. Resultado real: [COMPLETAR].

<!-- PAGE -->
# Pedidos personalizados

## CP15 Solicitud con imágenes y cotización

Preparación: Cliente DEMO y archivo JPG o PNG ficticio pequeño.

1. Solicita un personalizado con descripción, fecha futura e imagen.
2. Comprueba que queda Por cotizar sin pago previo.
3. Como trabajador propone precio $600.00 y fecha válida.
4. Como cliente acepta la cotización vigente.

Esperado: referencia visible solo para titular y personal; total pendiente antes de cotizar y $600.00 después. No se prepara antes de aceptar cotización y referencia de transferencia. Una cuenta distinta no debe ver la imagen privada.

Evidencia: [INSERTAR EVIDENCIA CP15] Solicitud, cotización y aceptación. Resultado real: [COMPLETAR].

## CP16 Pago y consumo real de personalizado

Preparación: personalizado de $600.00 aceptado. Usar una referencia DEMO nueva.

1. Elige Efectivo: consulta anticipo $180.00 y saldo $420.00.
2. Envía referencia ficticia, acepta como trabajador y pasa a preparación y listo.
3. Al entregar captura consumo real de 0.400 kg de harina y 0.200 litro de crema y cobra $420.00.
4. Consulta movimientos, venta y pedido.

Esperado: una venta por $600.00, pagos por $180.00 y $420.00, consumo real declarado. No exige crear un pastel ficticio con receta antes de cotizar. El consumo queda vinculado a la entrega.

Evidencia: [INSERTAR EVIDENCIA CP16] Captura de ingredientes utilizados y venta. Resultado real: [COMPLETAR].

<!-- PAGE -->
# Caja y relación con clientes

## CP17 Venta a público general

Preparación: Pastel DEMO con receta y existencias suficientes. Si sigues la secuencia contable, ya se entregó el carrito y no se han hecho otros consumos.

1. Como trabajador abre Caja y conserva Público general.
2. Selecciona un pastel, método Efectivo y recibido $500.00.
3. Comprueba total $450.00 y confirma la venta.
4. Consulta cambio, comprobante y Mis ventas.

Esperado: cambio $50.00, venta por $450.00 sin cliente asociado, descuento de 1 pastel, 0.500 kg de harina y 0.250 litro de crema. No exige crear una cuenta del comprador.

Evidencia: [INSERTAR EVIDENCIA CP17] Venta anónima y movimiento. Resultado real: [COMPLETAR].

## CP18 Venta asociada y ficha de cliente

Preparación: otra venta aislada de prueba, cuenta Cliente DEMO y correo exacto.

1. En Caja busca y selecciona el correo del cliente.
2. Vende un artículo con existencias y forma de pago válida.
3. Como administrador busca ese cliente y abre la ficha.
4. Como cliente abre Mis compras; compara con una venta anónima.

Esperado: la venta asociada aparece en la cuenta y en sus estadísticas; la anónima no se atribuye al cliente. Los detalles y pagos no multiplican indebidamente el número o total de compras.

Evidencia: [INSERTAR EVIDENCIA CP18] Ficha y compra asociada. Resultado real: [COMPLETAR].

<!-- PAGE -->
# Compras e inventario de ingredientes

## CP19 Compra pendiente corregida y recibida

Preparación: Harina DEMO 10.000 kg, Proveedor DEMO y ninguna otra recepción intermedia.

1. Crea compra de 1.000 kg a $25.00. Antes de recibir corrige la cantidad a 2.000 kg.
2. Revisa el total final $50.00 y que harina aún sea 10.000 kg.
3. Confirma Recibir cantidades definitivas.
4. Revisa harina 12.000 kg y el movimiento de entrada de 2.000 kg.

Esperado: crear o corregir pendiente no aumenta inventario; recibir suma una vez. La compra queda cerrada para edición. Reabrir el detalle o actualizar el navegador no vuelve a sumarla.

Evidencia: [INSERTAR EVIDENCIA CP19] Pendiente, total corregido y recepción. Resultado real: [COMPLETAR].

## CP20 Compra cancelada y ajuste auditado

Preparación: ingredientes con valores iniciales conocidos y una compra pendiente adicional.

1. Cancela esa compra y comprueba que no aumentó el ingrediente.
2. En Productos pulsa Ajustar unidades sobre un producto con 5 unidades.
3. Fija existencia FINAL 15, escribe “Conteo físico DEMO” y confirma.
4. Consulta Movimientos y los ingredientes de su receta.

Esperado: cancelar pendiente no recibe stock; el ajuste deja 15 unidades, no 20; registra diferencia +10 y motivo. Ajustar unidades preparadas no consume ingredientes automáticamente.

Evidencia: [INSERTAR EVIDENCIA CP20] Cancelación y ajuste con historial. Resultado real: [COMPLETAR].

<!-- PAGE -->
# Fotografías y administración de cuentas

## CP21 Foto obligatoria y archivos inválidos

Preparación: administrador, foto válida, archivo de texto renombrado como JPG y una imagen mayor del límite.

1. Intenta alta de producto sin fotografía.
2. Intenta usar el texto renombrado o una imagen mayor de 5 MiB.
3. Registra con foto válida y comprueba el catálogo.
4. Prueba reemplazar la foto con otra válida.

Esperado: rechaza falta de foto y archivos inválidos; no deja un producto incompleto por una subida fallida. La foto válida se normaliza. Para referencias personalizadas prueba además más de tres archivos y más de 16 millones de píxeles, usando el límite específico de ese formulario.

Evidencia: [INSERTAR EVIDENCIA CP21] Rechazo y fotografía correcta. Resultado real: [COMPLETAR].

## CP22 Alta exclusiva de trabajadores y búsqueda

Preparación: administrador y correo ficticio único para nuevo trabajador.

1. Da de alta trabajador desde su sección, no desde el registro público.
2. Busca el trabajador por nombre o correo y prueba su acceso en otra sesión.
3. Busca un cliente por separado y abre su ficha.
4. Comprueba que el trabajador no puede dar de alta otro trabajador.

Esperado: listas separadas, roles correctos, sin mostrar hashes; alta de trabajadores exclusiva del administrador. Desactivar conserva el historial y bloquea las operaciones de esa cuenta.

Evidencia: [INSERTAR EVIDENCIA CP22] Listas y permiso bloqueado. Resultado real: [COMPLETAR].

<!-- PAGE -->
# Cancelaciones notificaciones y recuperación

## CP23 Cancelación y devolución controlada

Preparación: pedidos DEMO independientes; uno sin anticipo ni referencia pendiente y otro pagado pero no entregado.

1. Cancela el primero con motivo y comprueba Cancelado.
2. En el pagado intenta cancelar como cliente; después realiza la devolución manual completa como administrador únicamente en el entorno ficticio.
3. Consulta pago devuelto, motivo e historial.

Esperado: una referencia pendiente no puede ignorarse para cancelar; con pago la devolución requiere administrador. No hay reembolso bancario automático ni devolución parcial. Un pedido entregado no se cancela mediante este flujo.

Evidencia: [INSERTAR EVIDENCIA CP23] Reglas de cancelación e historial. Resultado real: [COMPLETAR].

## CP24 Avisos y lectura por usuario

Preparación: dos clientes DEMO distintos y un pedido de uno de ellos.

1. Provoca un cambio de fecha o estado y espera la actualización, aproximadamente 15 segundos, o pulsa Actualizar avisos.
2. Como titular abre el aviso y el pedido. Marca el aviso como leído.
3. En la segunda cuenta comprueba que no aparece ese pedido privado.
4. Como administrador muestra eventos generales de venta o compra.

Esperado: destinatarios correctos, lectura individual y enlaces al registro pertinente. El cliente ve sus propios cambios; no recibe los de otros clientes. No se promete que llegue un correo o aviso del sistema operativo.

Evidencia: [INSERTAR EVIDENCIA CP24] Avisos de cuentas separadas. Resultado real: [COMPLETAR].

<!-- PAGE -->
# Pruebas técnicas complementarias

## CP25 Reintento y edición simultánea

Preparación: entorno temporal y dos sesiones de personal sobre el mismo registro. Para pérdida de respuesta y concurrencia utiliza las pruebas automatizadas; no desconectes el sitio publicado durante una venta real.

1. Abre una compra pendiente en ambas sesiones. Guarda un cambio desde la primera.
2. Intenta guardar la versión antigua desde la segunda.
3. Ejecuta los tests de transacciones, idempotencia y concurrencia de inventario.

Esperado: conflicto de versión sin sobrescribir cambios recientes; una clave repetida con los mismos datos recupera la misma operación; dos ventas no pueden consumir el mismo último ingrediente. Una confirmación perdida no debe duplicar el cobro al reintentar.

Evidencia: [INSERTAR EVIDENCIA CP25] Conflicto y salida de tests. Resultado real: [COMPLETAR].

## CP26 Cierre de sesión y versión publicada

Preparación: alojamiento actualizado por HTTPS y una cuenta DEMO, o equivalente local para los permisos.

1. Inicia sesión, navega entre dos secciones y recarga para comprobar persistencia.
2. Cierra sesión y vuelve a abrir una ruta protegida.
3. Comprueba que /.env, /server/config.js y /backups no entregan archivos privados.
4. Confirma que registro, carrito y botones de pedidos corresponden a la versión presentada.

Esperado: sesión estable por HTTPS, cierre efectivo y rutas privadas no expuestas. Tener la versión correcta en local no demuestra que Alwaysdata también esté actualizado.

Evidencia: [INSERTAR EVIDENCIA CP26] URL pública y acceso protegido. Resultado real: [COMPLETAR].

<!-- PAGE -->
# Registro de resultados y cierre de la presentación

## Plantilla de ejecución

Copia esta ficha para cada caso ejecutado. Si no se ejecutó, escribe Pendiente o Bloqueado y su causa. No marques Aprobado solo porque el resultado esperado está descrito.

| Campo | Completar |
| --- | --- |
| Identificador del caso | [COMPLETAR CPxx]. |
| Fecha y ejecutor | [COMPLETAR fecha, hora CDMX e integrante]. |
| Entorno y versión | [COMPLETAR URL, base aislada y paquete]. |
| Datos y folios utilizados | [COMPLETAR producto, pedido, venta o compra DEMO]. |
| Valores iniciales | [COMPLETAR stock, saldo y estado antes]. |
| Resultado esperado | Copiar el resultado del caso. |
| Resultado real | [COMPLETAR qué sucedió y valores finales]. |
| Estado de la prueba | [COMPLETAR Aprobado, Fallido o Bloqueado]. |
| Evidencia | [COMPLETAR nombre de captura o video y momento]. |
| Incidencia y repetición | [COMPLETAR problema, corrección y nueva ejecución]. |

## Qué responder si preguntan cómo se comprobó

Muestra una evidencia del recorrido principal, una validación negativa, un permiso por rol y un antes y después de inventario. Para las transacciones y concurrencia utiliza la salida de tests, no una afirmación sin evidencia. El registro anterior del desarrollo tuvo 146 pruebas aprobadas, pero debes ejecutar y fechar tu propia comprobación previa a la presentación.

## Antes de exponer

Confirmar servidor e internet o respaldo local; verificar cuentas por rol; preparar fecha D futura; verificar recetas, stock y destino de pago de prueba; separar sesiones; tener fotos pequeñas; abrir los folios preparados; ensayar el recorrido y medirlo; guardar capturas; disponer de un respaldo. No cambies la fecha del sistema operativo para forzar estados: los estados de pedido son manuales.

## Después de exponer

Cierra sesiones y el servidor temporal. Si usaste una copia persistente de demostración, conserva evidencia y aplica el procedimiento de limpieza del equipo; no borres datos del negocio. Registra incidencias y entrega el informe con resultados reales. [COMPLETAR conclusión] Escribe qué funciones se demostraron, qué casos fallaron o quedaron pendientes y qué mejora se propondría para otra versión.
