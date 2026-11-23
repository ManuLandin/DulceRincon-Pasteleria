# Actualización puntual del catálogo original

Autorización: volver a pasteleria_db y agregar5 productos por cada categoría existente, con precios Pasteles450–1500, Galletas50–125, Cupcakes35–85, Postres25–200; existencias15,10,5,1,0 en cada grupo y7 proveedores ficticios. No cargar usuarios, pedidos ni ventas del seeder de desarrollo.

Aplicado:20 productos,20 imágenes distintas y7 proveedores de ejemplo. Se registraron16 movimientos de apertura de existencias y una operación idempotente; se conservó íntegro el producto original #1 (Pastel de Fresa con Crema,450,10 unidades). Respaldo privado previo guardado en backups. No hubo cambios de esquema ni de funciones del sistema. No se añadieron recetas o ingredientes.

Verificación: cuatro grupos de5 productos, mínimo/máximo de precios correctos, una existencia cero por categoría, stock0/1/5/10/15, veinte hashes de imágenes distintos, siete proveedores presentes. API original3000 responde200 con21 productos en total, incluyendo el anterior.

Scripts/load-original-catalog.js es una carga puntual protegida para esta autorización (--apply), con validaciones, transacción, registro de apertura y clave de operación estable. Los archivos JSON contiguos documentan solicitud, fuentes y resultado. Las fotos se guardaron en el proyecto mediante el normalizador existente.
