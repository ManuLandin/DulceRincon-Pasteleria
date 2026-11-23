# Registro, recogida y carrito — 13 de noviembre de 2026

## Comportamiento

- El registro de clientes exige nombre formado por letras y espacios; admite acentos y ñ. Valida tanto el navegador como el servidor.
- Correo obligatorio con formato de correo. No verifica la propiedad del buzón mediante correo de confirmación.
- Contraseña nueva de registro: 12 a 25 caracteres. No cambia los hashes ni impide el acceso con contraseñas anteriores más largas. El generador inicial de administrador comparte la validación de registro y su texto se actualizó.
- Recogida: calendario, selector de hora y selector de minutos, de 10:00 a 20:00 CDMX. A las 20 h solo se permite minuto 00. Conserva todos los minutos ya permitidos y permite conservar fechas históricas sin editarlas al cambiar estados.
- Carrito accesible desde el encabezado del catálogo público y del cliente. Permite agregar varios productos, agrupar productos repetidos, cambiar cantidades, quitar artículos y consultar un total estimado.
- Guarda únicamente identificadores y cantidades en el navegador para conservar la selección al iniciar sesión. El servidor sigue siendo la autoridad de precios, disponibilidad y pago. No reserva existencias.
- Solo clientes autenticados pueden enviar pedidos. Los visitantes pueden preparar el carrito e iniciar sesión para continuar.
- Productos con existencia insuficiente muestran un aviso; conserva la regla previa de entrega por confirmar.
- El carrito se descuenta únicamente tras confirmar la creación del pedido, usando las líneas efectivamente enviadas. Cancelar o fallar no vacía el carrito.
- Reutiliza el pedido de catálogo con sus detalles y la confirmación de transferencia existente. No agrega tablas ni migraciones.

## Validación realizada

- Suite general: 141 casos, 113 aprobados, 28 omitidos (integración MySQL con activación explícita), 0 fallidos.
- Comprobación adicional tras ajustar el mensaje de contraseña: 15 casos aprobados, 0 fallidos.
- HTTP de la aplicación local reiniciada: datos de registro inválidos devuelven 400; catálogo responde 200. No se crearon cuentas ni pedidos reales para esta comprobación.
- Navegador: agregar dos productos, incrementar cantidad, actualizar total, quitar productos, revisar carrito en 390 px, seleccionar 20 h (resto de minutos deshabilitados) y mostrar error de nombre con números.
- Capturas en `docs/preview/2026-11-13-carrito/`.

## Aplicar en Alwaysdata

El paquete está en `backups/dulcerincon-registro-carrito-20261113.tar.gz`. No contiene `.env`, SQL, respaldos, dependencias instaladas ni credenciales. No modifica la base de datos.

En la terminal de **Windows**:

```powershell
scp "C:\Users\juanm\Documents\ESCUELA\SEPTIMO\software\Proy_pasteleria\backups\dulcerincon-registro-carrito-20261113.tar.gz" dulcerincon@ssh-dulcerincon.alwaysdata.net:/home/dulcerincon/pasteleria/
```

En la terminal **SSH de Alwaysdata**, guardar primero los archivos actuales para poder volver atrás. Ejecutar una sola vez; no sobrescribir una copia previa del mismo nombre:

```bash
cd /home/dulcerincon/pasteleria
```

```bash
test ! -e antes-registro-carrito-20261113.tar.gz && tar -czf antes-registro-carrito-20261113.tar.gz server/validation.js assets/js/auth.js assets/js/catalog.js assets/js/operation-core.js assets/js/order-checkout.js index.html cliente.html admin.html trabajador.html registro.html
```

Si la copia terminó sin error:

```bash
tar -xzf dulcerincon-registro-carrito-20261113.tar.gz
```

Reiniciar el sitio desde Web > Sites en el panel de Alwaysdata y recargar con Ctrl+F5. No hace falta reinstalar dependencias ni volver a importar la BD.

Para volver a la versión anterior, restaurar la copia `antes-registro-carrito-20261113.tar.gz` desde esa misma carpeta y reiniciar el sitio. Los nuevos archivos cart.js, cart-model.js y cart.css quedarían sin referencias, sin afectar a los datos.

## Archivos principales

`server/validation.js`; `registro.html`; `assets/js/auth.js`; `assets/js/cart-model.js`; `assets/js/cart.js`; `assets/js/catalog.js`; `assets/js/operation-core.js`; `assets/js/order-checkout.js`; `assets/css/cart.css`; inclusión de recursos en `index.html`, `cliente.html`, `admin.html`, `trabajador.html`; texto de `scripts/create-admin.js`; pruebas de registro/carrito/HTTP/selectores.
