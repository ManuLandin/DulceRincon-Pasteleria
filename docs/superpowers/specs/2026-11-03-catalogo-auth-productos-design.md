# Dulce Rincón: catálogo, acceso y alta de productos

Estado: aprobado explícitamente por el usuario. Fecha: 2026-11-03.

## Objetivo

Convertir los mockups existentes en una primera aplicación funcional: catálogo público conectado a la BD del usuario, registro de clientes, acceso único por roles y creación de productos con fotografía desde el área del administrador. Conservar la identidad y composición de Dulce Rincón.

## Confirmado por el usuario

- HTML, CSS, JavaScript y Bootstrap en la interfaz; Node.js y Express en el backend; MySQL.
- Una sola aplicación sirve la interfaz y la API. El usuario eligió este enfoque integrado frente a separar frontend y backend.
- Conexión local: 127.0.0.1, puerto 3306, usuario root, BD pasteleria_db. La contraseña se configura localmente, sin enviarla al chat.
- El esquema compartido por el usuario ya existe. No recrear ni vaciar la BD.
- Catálogo público: buscar por nombre, filtrar por categoría y abrir fotografía, descripción y precio del producto.
- La navegación conserva Pasteles, Galletas, Repostería, Cup cakes, Ubicación y Nosotros.
- Mostrar Postres de la BD como Repostería y Cupcakes como Cup cakes. No renombrar esas filas de la BD.
- Para realizar un pedido será obligatorio iniciar sesión. La creación de pedidos no se implementa en esta etapa.
- Un solo formulario de acceso, con destino determinado por el rol consultado en la BD.
- Registro público: asignar siempre Cliente. El visitante no puede seleccionar otro rol.
- No existe ninguna cuenta de administrador; hay que preparar la creación de la primera durante la configuración.
- Contraseñas protegidas mediante hash. Se propuso Argon2id con sal individual.
- El administrador puede crear un producto desde la página y subir una imagen desde su dispositivo.
- La foto es obligatoria para TODO producto nuevo, incluidas las cuatro categorías.
- Las imágenes quedan como archivos en el servidor; PRODUCTO guarda la ruta, no el contenido binario.
- Solamente el administrador puede agregar o cambiar fotografías y crear productos; se verifica en el servidor.

## Propuestas para confirmar con esta especificación

Son decisiones todavía no aprobadas individualmente. La aprobación del documento permite implementarlas; el usuario puede corregirlas antes.

### Registro y cuentas

- Formulario de registro con nombre, correo, contraseña y confirmación de contraseña. Teléfono y dirección quedan para una etapa posterior.
- Contraseña de entre 12 y 128 caracteres; sin exigir combinaciones arbitrarias de símbolos. Confirmación verificada antes de crear la cuenta.
- Registro exitoso lleva al acceso común; no inicia sesión automáticamente.
- El primer administrador se crea mediante un comando local con nombre, correo y contraseña ingresados por el usuario. La contraseña se pide oculta y no se incluye en comandos, archivos de ejemplo o registros.
- Ese comando no sustituye ni modifica cuentas existentes; se niega a crear otro administrador inicial cuando ya hay uno activo.
- No se implementan recuperación de contraseña, verificación por correo ni administración de trabajadores en esta entrega.

### Productos e imágenes

- Alta con nombre, categoría, descripción, precio, existencia inicial, stock mínimo, unidad y fotografía.
- Obligatorios: nombre, categoría activa, precio válido y fotografía. Descripción opcional; existencia y stock mínimo tienen valor inicial 0; unidad inicial pieza. El administrador puede capturar esos valores en el formulario.
- Formatos admitidos: JPG/JPEG, PNG y WebP. Tamaño máximo de archivo: 5 MiB. Validar el contenido real de la imagen además de su tipo declarado.
- Normalizar las imágenes a WebP, con un nombre aleatorio generado por el servidor. Limitar dimensiones y cantidad de píxeles; conservar proporciones.
- El administrador puede reemplazar la fotografía de un producto existente mediante una acción específica. Editar los demás datos y eliminar productos quedan pendientes.
- No insertar automáticamente productos ni precios inventados en la BD. El catálogo inicia con los productos activos que realmente existan y presenta un estado vacío cuando no hay ninguno.
- Si ya existen productos sin foto, conservarlos y mostrar un recurso neutral que indique fotografía pendiente. La obligatoriedad se aplica a las nuevas altas y a los reemplazos de foto.

### Sesiones y navegación

- Sesiones del lado del servidor almacenadas en MySQL; cookie HttpOnly y SameSite, con duración de 8 horas.
- Renovar el identificador al iniciar sesión y destruirlo al cerrar sesión. Revalidar usuario activo y rol para las acciones protegidas.
- Administrador entra a admin.html; Trabajador a trabajador.html; Cliente a cliente.html. Un visitante que intenta entrar a un panel debe iniciar sesión.
- El acceso directo a un panel de otro rol devuelve al inicio correspondiente a su propia cuenta.
- Retirar la barra PROTOTIPO de las páginas en funcionamiento: la navegación entre roles no sustituye una sesión.
- Las secciones todavía ilustrativas del administrador y trabajador permanecen identificadas como ejemplos, sin presentarlas como cifras reales de la BD. Los nombres de la cuenta y el acceso de productos sí son reales.
- El cliente ve el catálogo real. En Mis pedidos se muestra un estado pendiente de implementación en vez de pedidos inventados atribuidos a su cuenta.

## Enfoque y límites

Elegido: Express sirve las páginas y los endpoints desde un mismo origen y utiliza MySQL para los datos y sesiones. Mantiene el stack previsto y una sola configuración local.

Alternativa discutida: frontend y backend separados, con despliegue y configuración independientes. No elegida para esta etapa.

No se implementan pedidos, carrito, pagos, ventas, compras, recetas, inventario operativo ni gestión de usuarios. La existencia inicial de un producto es un dato del alta, no una operación de inventario. No publicar ni exponer el servidor en Internet.

## Cambios en la BD

- Preparar una migración explícita que agregue PRODUCTO.imagen, una ruta de texto de hasta 255 caracteres, inicialmente nullable para preservar posibles registros anteriores.
- Preparar una tabla para sesiones web, sin alterar las tablas funcionales existentes.
- No ejecutar de nuevo el CREATE DATABASE ni los INSERT de roles/categorías del SQL compartido.
- La configuración revisa que existan las tablas y los roles esperados. Si faltan, informa el problema en vez de inventar identificadores.
- Los nuevos productos siempre se guardan con imagen válida. Una migración posterior podría cerrar los valores nulos cuando el administrador complete las fotos antiguas.

## API y responsabilidades

- Catálogo público de categorías y productos activos, búsqueda por nombre, filtro por categoría, paginación y detalle por identificador.
- Registro limitado a Cliente; acceso, consulta de sesión y cierre de sesión.
- API de administrador para alta de productos con multipart/form-data, lista de productos y reemplazo de imagen.
- El formulario de productos pertenece al área del administrador; el catálogo deja de consumir el arreglo fijo de assets/js/catalog.js.
- Las categorías visibles se resuelven por sus datos e identificadores reales; no se asume que los IDs sean 1, 2, 3 o 4.
- UI con estado de carga, error recuperable, catálogo vacío y resultado sin coincidencias; conservar accesibilidad y funcionamiento móvil.

## Protección técnica

- Argon2id con parámetros adecuados para contraseñas; sal aleatoria por hash. El campo contrasena_hash existente es suficiente para el formato codificado.
- Consultas parametrizadas. No incluir hashes en respuestas ni registrar contraseñas.
- Validación de campos del lado del servidor, mensajes de acceso genéricos y límites de intentos para registro/acceso.
- Protección CSRF en operaciones que modifican datos y comprobación de sesión/rol antes de procesar una subida.
- Comprobar imágenes mediante decodificación, tamaño y tipo; nombres generados; limpiar archivos nuevos cuando falla el guardado del producto.
- Exponer únicamente páginas, assets y archivos públicos de producto. No servir la raíz completa del proyecto ni archivos .env, scripts, documentación o configuración.
- Configuración por variables de entorno, .env excluido de Git y .env.example sin secretos. HTTPS y cookie Secure configurables para un futuro despliegue.

## Configuración y entrega

1. Instalar dependencias y preparar un archivo de configuración local.
2. El usuario introduce localmente su contraseña de MySQL.
3. Comprobar conexión y ejecutar la migración acordada sin borrar datos.
4. Ejecutar el comando para crear el administrador inicial con los datos elegidos por el usuario.
5. Iniciar Express y revisar el flujo completo: catálogo, registro, acceso, alta de producto con foto y aparición en el catálogo.

No pedir ni asumir la contraseña de MySQL. Si la configuración o el alta inicial requieren interacción del usuario, preparar antes los comandos y archivos para que pueda completarla.

## Verificación

- Pruebas de hash/verificación y validaciones; acceso y registro con roles correctos.
- Pruebas HTTP de permisos y CSRF: un anónimo, Cliente o Trabajador no puede crear productos ni subir fotos.
- Alta sin imagen, imagen falsa, archivo demasiado grande, categoría inválida y precio inválido deben rechazarse.
- Alta válida y reemplazo: archivo y ruta coherentes; no dejar archivos huérfanos cuando la BD rechaza la operación.
- Catálogo: solo registros activos, filtros y búsqueda literal, detalle de ID inexistente y estado vacío.
- Pruebas aisladas sin borrar los datos existentes del usuario. Cualquier verificación con MySQL real debe utilizar configuración local y describir qué se comprobó.
- Revisión visual del formulario y catálogo en escritorio y móvil; sin atribuir al backend implementaciones todavía ilustrativas.
- Entregar instrucciones de arranque y distinguir lo verificado con pruebas aisladas de lo comprobado con la BD real.
