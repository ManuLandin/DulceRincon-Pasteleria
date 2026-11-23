# Corrección de menús adaptables — 2026-11-07

Causa reproducida: dashboard.css fijaba la barra lateral en z-index1020, por debajo del backdrop de Bootstrap1040. El hit-test del botón cerrar devolvía offcanvas-backdrop en vez del botón. Ahora utiliza --bs-offcanvas-zindex (1045), conservando la escala de Bootstrap.

Segundo caso reproducido: al ampliar un panel abierto, la barra conserva position:fixed en escritorio y Bootstrap no limpiaba backdrop/scroll. shared.js cierra ambos menús con la API de Bootstrap al cruzar992px, incluida la finalización de su apertura. No se eliminan capas ni estilos de body manualmente; Bootstrap conserva foco, scroll y limpieza.

Verificación de navegador aislado sin MySQL: trabajador (enlace Pedidos, cerrar, logout), administrador (Clientes a320px), público (categoría, click fuera y ampliación a992px) y cliente (Escape). Anchos320/800/992/1200. Antes cierre bloqueado; después cierre recibe clic y al ampliar backdrop0/overflow vacío. Captura con datos QA. Viewport restablecido y servidor temporal detenido. No se modificaron datos reales.

npm test:63 aprobadas,0 fallos,11 pruebas MySQL omitidas por defecto. No hubo cambios en reglas de negocio ni esquema. Detalle en verification.json y tests.log.

Archivos modificados: assets/css/dashboard.css y assets/js/shared.js.
