# Diseño de los mockups de la pastelería

Estado: aprobado por el usuario con una aclaración: habrá un solo inicio de sesión para todos; en el sistema futuro, el rol guardado en la BD determinará el destino después de autenticarse. El prototipo no implementa esa lógica.

## Intención y alcance confirmado

Crear cinco pantallas navegables de una pastelería: inicio público, inicio de sesión, inicio del administrador, inicio del trabajador e inicio del cliente. El usuario quiere revisar UI/UX; no solicita un sistema funcional.

El inicio público será la entrada principal. Su navegación incluirá exactamente: Pasteles, Galletas, Repostería, Cup cakes, Ubicación y Nosotros.

El cliente autenticado entrará a explorar productos y tendrá un apartado «Mis pedidos». No debe llegar primero a una lista de pedidos.

La interfaz usará HTML, CSS, JavaScript y Bootstrap. Los datos y textos pueden ser ejemplos. La referencia visual y el diagrama de datos adjuntos son material de consulta, no instrucciones para ampliar el alcance.

## Dirección elegida y alternativas

1. Boutique: blanco predominante, rosas pastel, rosa intenso en acciones, fotografías amplias, tipografía elegante y profundidad discreta. Elegida por el usuario por su equilibrio formal y coqueto.
2. Romántica: mayor presencia del rosa, marcos ornamentales y decoración inspirada en regalos. No elegida.

La implementación será una colección de páginas HTML con estilos y JavaScript compartidos. No requiere un framework de componentes ni construir el backend para revisar los mockups.

## Propuestas para confirmar con este documento

Estos detalles aún no fueron confirmados individualmente; se presentan juntos para que el usuario pueda aprobarlos o corregirlos antes de construir.

### Identidad y composición

- Nombre provisional para la maqueta: «Dulce Rosa». No representa una marca ya proporcionada por el usuario.
- Blanco como base; rosa muy claro para superficies secundarias, rosa pastel para bloques de marca y rosa profundo para botones y texto destacado.
- Títulos de inspiración boutique clásica, con una serif elegante; textos, navegación y datos en una sans serif legible. Sin caligrafía ornamental en párrafos.
- Fotografías de pasteles y repostería como protagonistas. Ornamentos finos, sombras teñidas de rosa y esquinas suavemente redondeadas, con un criterio consistente.
- Tienda visual y espaciosa; paneles internos más compactos y fáciles de recorrer. Misma paleta y componentes en las cinco pantallas.
- Diseño adaptable a escritorio y móvil, con menú lateral desplegable en móvil inspirado en la referencia.

### 1. Inicio público: index.html

- Cabecera con marca, navegación solicitada y acceso «Iniciar sesión».
- Presentación principal con fotografía destacada, una frase breve y enlace para explorar productos.
- Catálogo visual con las cuatro categorías de producto. Fotografías, nombres, descripciones y precios de ejemplo en pesos mexicanos.
- Secciones de ubicación y nosotros dentro de la misma página, con dirección, horarios e historia de ejemplo.
- Pie de página con información de contacto de ejemplo.

### 2. Inicio de sesión: login.html

- Un único formulario compartido por administrador, trabajador y cliente. No hay páginas de ingreso separadas por rol.
- En el sistema futuro, el backend leerá el rol del usuario en la BD y lo enviará a su pantalla correspondiente. Este comportamiento solo se documenta en la maqueta; no se conecta ninguna BD.
- Composición dividida entre una fotografía y el formulario.
- Campos etiquetados «Correo electrónico» y «Contraseña», control para mostrar la contraseña y botón «Iniciar sesión».
- Enlace para volver a la tienda.
- Formulario exclusivamente visual: no valida credenciales, no crea sesiones ni guarda contraseñas. No se añade un selector de rol como si fuera parte de una autenticación real.

### 3. Inicio del administrador: admin.html

- Cabecera con saludo, nombre de ejemplo y rol visible.
- Menú lateral con Resumen, Pedidos, Productos, Ventas, Inventario, Proveedores y Usuarios, tomando como referencia el diagrama compartido.
- Resumen de ventas del día, pedidos pendientes, productos e inventario bajo.
- Tabla breve de pedidos recientes y bloque de alertas de inventario.
- Los apartados del menú sirven para representar la estructura; no se construyen pantallas de gestión ni formularios CRUD adicionales.

### 4. Inicio del trabajador: trabajador.html

- Cabecera y menú lateral de la misma familia visual que el administrador.
- Menú con Mi jornada, Pedidos, Productos, Ventas e Inventario, sin administración de usuarios.
- Pedidos por preparar, próximas entregas y alertas de ingredientes como contenido principal.
- Lista de trabajo del día con estados y datos de ejemplo, sin modificar pedidos ni inventario.

### 5. Inicio del cliente: cliente.html

- Tienda centrada en explorar productos; conserva las categorías y el lenguaje visual del inicio público.
- Cabecera que identifica al cliente y ofrece «Mis pedidos» y salida visual a la tienda pública.
- Productos destacados y catálogo con fotografías, nombres y precios de ejemplo.
- «Mis pedidos» lleva a un apartado de la misma pantalla con una lista breve de pedidos, fechas, importes y estados de ejemplo.
- No se añade carrito, checkout, registro ni pago, al no formar parte de las cinco pantallas solicitadas.

## Navegación y límite de la simulación

Las cinco páginas estarán disponibles mediante enlaces. Una barra discreta, identificada como navegación del prototipo, permitirá revisar los tres roles sin credenciales; estará separada del contenido de la pastelería y se ocultará al imprimir.

Se permiten interacciones de presentación: abrir/cerrar el menú móvil, desplazarse a categorías o a «Mis pedidos», mostrar/ocultar la contraseña y recorrer las vistas. No habrá operaciones de negocio, envío de formularios, base de datos, autenticación, persistencia ni llamadas a servicios de pedidos.

Los controles que representen operaciones aún no implementadas no fingirán haberlas realizado. Deben tener un estado de maqueta claro y consistente.

## Decisiones de implementación delegadas tras aprobar

Elegir fuentes concretas, fotografías de ejemplo, medidas de espaciado, puntos de adaptación responsive y componentes Bootstrap coherentes con la dirección aprobada. Mantener las dependencias y recursos preparados para una revisión local, incluyendo instrucciones sencillas de apertura.

Usar etiquetas de formulario, navegación por teclado, foco visible, contraste legible y alternativas de texto en imágenes. Respetar la preferencia de movimiento reducido.

## Entrega y verificación

Entregar las cinco páginas y sus recursos compartidos en esta carpeta de proyecto, junto con instrucciones de revisión. Abrir el inicio público en el navegador cuando sea posible.

Verificar las cinco vistas en escritorio y móvil, sus enlaces, carga de imágenes, menú móvil, acceso a «Mis pedidos», legibilidad y ausencia de desbordamientos horizontales. Confirmar que no se realiza ninguna operación de autenticación ni de negocio.

No inicializar Git, crear commits, configurar Node/Express o MySQL ni publicar el sitio como parte de estos mockups.
