# Progreso: 2026-10-27-pasteleria-mockups.md

- Diseño aprobado con aclaración de ingreso único; implementación en esta sesión.
- Previo: carpeta vacía salvo documentación creada durante la conversación; no es un repositorio Git.
- Decisión: recursos locales y páginas sin módulos ES para apertura directa por file://.
- Decisión: verificar presentación y navegación en navegador; no introducir pruebas de lógica inexistente.
- Task 1: completa. Portada con menú exacto, catálogo, nosotros y ubicación; imágenes, tipografías, Bootstrap y Tabler locales.
- Task 2: completa. Un solo login sin selección de rol ni envío; cliente centrado en catálogo con Mis pedidos.
- Task 3: completa. Inicios diferenciados de administración y trabajador con datos de ejemplo.
- Verificación: 20 combinaciones de página/ancho (320, 768, 1024, 1440), sin desbordamiento horizontal. Cinco h1 únicos, sin anclas ausentes ni imágenes rotas.
- Navegación: menús públicos e internos abren y cierran; Escape cierra el menú interno. Trabajador sin enlace Usuarios.
- Login: mostrar contraseña cambia solo el tipo del campo; submit permanece en login.html y muestra aviso de maqueta.
- Cliente: enlace Mis pedidos llega a cliente.html#mis-pedidos y muestra dos pedidos ilustrativos.
- Corrección: el icono ti-whisk no existe en Tabler Webfont 3.31.0; sustituido en portada y trabajador por ti-chef-hat, incluido en los recursos locales.
- Consola: sin errores durante la revisión de navegador. JavaScript comprobado con node --check.
- Vista previa: servidor estático local en http://127.0.0.1:5501. Capturas de escritorio y móvil en docs/preview/.
- Revisión independiente: sin hallazgos críticos o importantes. Mejora menor detectada: mantener visible la identificación PROTOTIPO en móvil; corregida con una pequeña leyenda sobre la barra.
- Ajuste de legibilidad: «Mis pedidos» conserva una línea en pantallas estrechas.
- Task 4: completa. Confirmación final de 10 capturas: sin imágenes/iconos ausentes, sin desbordamiento horizontal y con identificación de prototipo visible en escritorio y móvil. Evidencia en docs/preview/verification.json. Portada abierta para revisión del usuario.
