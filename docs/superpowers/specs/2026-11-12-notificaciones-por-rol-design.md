# Notificaciones por rol

Eventos confirmados por el usuario: todos los propuestos el 12 de noviembre de 2026. Diseño aprobado por el usuario: «si lo apruebo».

Se amplía la campana e historial existentes, con avisos privados por destinatario. Es la opción coherente con el sistema actual; crear bandejas independientes duplicaría lectura, permisos y contadores.

Cliente: novedades únicamente de sus propios pedidos, cotizaciones, referencias/pagos, fechas, estados y entrega.
Trabajador: pedidos nuevos y los avisos operativos existentes de los pedidos que atiende.
Administrador: pedidos nuevos, pedidos que pasan a Listo, pedidos entregados, ventas completadas (mostrador y entrega de pedido), compras a proveedores creadas, recibidas y canceladas. Incluye eventos que registre el propio administrador para que la bandeja refleje la operación general. No se notifica como venta un anticipo ni una referencia sin verificar.

Cada aviso del administrador identifica su tipo: Pedidos, Entregas, Ventas o Compras, y permite abrir el pedido, comprobante de venta o compra correspondiente. Contador de no leídas y marcado individual/general existentes. Eventos nuevos desde la instalación; no reconstruir ni inventar avisos históricos.

Implementación: ampliar NOTIFICACION para admitir origen Pedido/Venta/Compra; conservar avisos previos y sus vínculos. Generar avisos dentro de las transacciones actuales, con claves únicas por evento/destinatario. Fallos o reintentos no deben producir avisos falsos ni duplicados. Migración repetible y respaldo antes de aplicar en la BD real. Se conservan permisos y pagos existentes. Avisos internos, sin mensajes externos.

Verificación: aislamiento por rol y cuenta; admin recibe todos los eventos aceptados; trabajador/cliente no reciben ventas/compras generales; recepción y cancelación excluyentes; venta y entrega una vez por operación; rollback y reintento; enlaces a cada tipo de registro; conservación de avisos anteriores; escritorio/móvil.
