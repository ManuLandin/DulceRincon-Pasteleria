# Plan de implementación de los mockups

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** entregar cinco vistas navegables de Dulce Rosa con una sola pantalla de inicio de sesión y una identidad boutique en blanco y rosa.

**Architecture:** HTML estático en la raíz, CSS y JavaScript compartidos en assets. Recursos visuales y Bootstrap locales para poder abrir index.html directamente, sin instalar un backend.

**Tech Stack:** HTML, CSS, JavaScript y Bootstrap 5.3.8; iconos Tabler; fuentes locales.

**Spec:** docs/superpowers/specs/2026-10-27-pasteleria-mockups-design.md

## Global Constraints

- Cinco páginas: index.html, login.html, admin.html, trabajador.html y cliente.html.
- Un solo formulario de ingreso para todos los roles. La selección del destino por rol de BD pertenece al sistema futuro.
- Sin autenticación, persistencia, pagos ni operaciones de negocio; no inicializar Git ni publicar.
- Menú público: Pasteles, Galletas, Repostería, Cup cakes, Ubicación y Nosotros.
- El cliente explora productos primero y dispone de «Mis pedidos» en la misma página.
- Dirección boutique aprobada, nombre provisional Dulce Rosa y contenido de ejemplo.

## Review Focus

- Apertura directa por file://: recursos y navegación deben funcionar sin fetch de plantillas ni módulos ES.
- Móvil de 320 px: navegación completa mediante panel lateral, sin desbordamiento horizontal.
- Formulario de ingreso: Enter y botón no envían ni guardan credenciales.
- Cliente autenticado: «Mis pedidos» conserva acceso al catálogo y no cambia la pantalla inicial.
- Teclado y movimiento reducido: foco visible, cierre del panel y contenido legible sin animaciones.

## Archivos e interfaces

- assets/css/base.css: tokens, tipografía, cabecera, pie y navegación de prototipo.
- assets/css/store.css: tienda pública y cliente.
- assets/css/dashboard.css: paneles administrativos y del trabajador.
- assets/css/login.css: formulario único de ingreso.
- assets/js/shared.js: renderiza cabecera/pie y barra del prototipo a partir de data-page del body; controla interacciones exclusivamente visuales.
- assets/js/catalog.js: inserta catálogo estático con datos de ejemplo en [data-catalog].
- assets/vendor/: Bootstrap, iconos y fuentes locales.
- assets/images/: fotografías de ejemplo, con origen anotado en CREDITS.md.
- README.md: apertura directa, servidor opcional y explicación de la futura redirección por rol.

### Task 1: Identidad y tienda pública

**Files:** index.html, assets/css/base.css, assets/css/store.css, assets/js/shared.js, assets/js/catalog.js, assets/vendor/, assets/images/, CREDITS.md.

**Interfaces:** body[data-page="publico"] o body[data-page="cliente"]; contenedores data-header, data-footer, data-catalog y data-prototype. Cada categoría se enlaza mediante su identificador en la página actual.

- [x] Descargar y comprobar recursos locales, incluyendo fotografías y fuentes.
- [x] Construir tokens y componentes compartidos: cabecera responsive, menú Bootstrap offcanvas, botones, catálogo, pie y barra de revisión separada.
- [x] Crear presentación principal, categorías, catálogo, ubicación y nosotros.
- [x] Verificar en navegador escritorio y móvil: carga local, enlaces y legibilidad.

### Task 2: Ingreso compartido e inicio del cliente

**Files:** login.html, cliente.html, assets/css/login.css; extender shared.js solo con controles de presentación.

**Interfaces:** formulario [data-login-form] cancela submit y presenta aviso de maqueta; [data-toggle-password] cambia visibilidad sin leer ni almacenar credenciales.

- [x] Crear el único formulario sin selector de roles y con retorno a la tienda.
- [x] Crear inicio de cliente orientado a catálogo y sección #mis-pedidos con ejemplos.
- [x] Comprobar teclado, mostrar contraseña, ausencia de envío y enlace a pedidos.

### Task 3: Paneles del administrador y trabajador

**Files:** admin.html, trabajador.html, assets/css/dashboard.css; sidebar compartido en shared.js.

**Interfaces:** body[data-page="admin"] o body[data-page="trabajador"]; contenedor data-sidebar con menú apropiado para cada rol. Acciones de negocio representadas como controles de muestra con explicación clara.

- [x] Crear resumen administrativo: métricas, ventas, pedidos e inventario.
- [x] Crear jornada del trabajador: preparación, próximas entregas e ingredientes.
- [x] Comprobar que el trabajador no muestra Usuarios y ambos paneles tienen navegación móvil.

### Task 4: Revisión y entrega

**Files:** README.md, docs/superpowers/plans/2026-10-27-pasteleria-progress.md y evidencias de revisión en docs/preview/.

- [x] Revisar cinco páginas en 1440, 1024, 768 y 320 px, imágenes, consola y enlaces.
- [x] Comprobar que los formularios no envían solicitudes y que los enlaces a roles se identifican como prototipo.
- [x] Ejecutar una revisión independiente sobre alcance, accesibilidad y navegación; resolver problemas importantes.
- [x] Abrir el inicio público en el navegador y entregar enlaces a las cinco páginas.

## Adaptación a este proyecto

Esta carpeta no es un repositorio Git. Se trabaja en ella sin crear repositorio, ramas, worktrees ni commits. Al tratarse de mockups reversibles sin lógica de negocio, se verifica visualmente y mediante navegación real; no se crean pruebas unitarias que repliquen el HTML. La ejecución continúa en esta sesión para concretar el trabajo ya autorizado.
