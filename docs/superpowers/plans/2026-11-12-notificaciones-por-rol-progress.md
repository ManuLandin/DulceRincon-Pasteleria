# Avance notificaciones por rol

Diseño aprobado por usuario «si lo apruebo». Sin Git; trabajo en carpeta original, sin ramas/commits.

Pre-flight: NOTIFICACION refería obligatoriamente a PEDIDO e HISTORIAL_PEDIDO. Se amplía de forma compatible con origen opcional y clave estable para ventas/compras, conservando FK, avisos y lecturas anteriores.

Backend y migración implementados; regresión admin/roles/idempotencia/migración RED→GREEN. Enlaces Pedido/Venta/Compra comprobados por test de interfaz; se corrigió fixture para inspeccionar contenido real y no el nodo de estado.

Revisión independiente /root/review_role_notices: un hallazgo P2, aviso Listo repetido al editar pedido ya Listo. Corregido incorporando estado_anterior y exigiendo transición real; regresión MySQL añadida. Sin otros hallazgos accionables. No se cambian reglas comerciales.

QA escritorio con datos ficticios3002: compra creada y pedido nuevo en bandeja admin; enlace a compra abrió ingredientes/proveedor/total. Venta en efectivo ficticia de450 generó aviso Ventas y abrió comprobante correcto. Lectura y contador actualizados. Captura docs/preview/2026-11-12-notificaciones/admin-qa.png, sin registros reales.

Completado: suite final121/121, sin omisiones (MySQL temporal), log docs/preview/role-notices-final.log. Hallazgo Listo verificado RED→GREEN adicionalmente en role-notices-review-red.log y ejecución corregida. Sin dependencias nuevas.

Respaldo real antes-operacion-2026-11-13T03-33-10-887Z.sql (fecha UTC); migración repetible aplicada sin datos ficticios en la BD real. Express reiniciado. Login/catálogo/script200; avisos sin sesión401. QA cerrado mediante endpoint exclusivo, eliminando únicamente base y archivos temporales. No hay ramas/worktrees que integrar o limpiar. Captura preservada como evidencia de prueba.

No quedan hallazgos pendientes. No se alteraron reglas de pago, stock ni permisos. Los avisos generales nuevos se generan desde esta actualización; no se inventan notificaciones históricas.
