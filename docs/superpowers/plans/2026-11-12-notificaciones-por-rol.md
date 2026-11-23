# Notificaciones por rol — implementación

Objetivo: ampliar la bandeja existente según diseño aprobado. Sin Git ni commits en esta carpeta.

1. Regresión MySQL: venta, compra creada/recibida/cancelada, pedido nuevo/listo/entregado para admin; aislamiento, reintento y migración repetida. Observar RED.
2. Ampliar migración de notificaciones repetible: origen y clave única, pedido/evento opcionales para ventas/compras; conservar registros. Generar avisos transaccionales por evento y destinatario.
3. Mostrar tipo y enlazar al detalle de pedido/venta/compra con permisos del servidor. Probar suite y revisar cambios completos.
4. Respaldar, migrar localmente, reiniciar Express y verificar acceso. Documentar evidencia.

Decisión: reutilizar campana, lectura y contador; evita duplicar bandejas y permisos. Los avisos nuevos empiezan desde la instalación.
