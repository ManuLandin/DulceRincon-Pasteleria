# Recetas e inventario del catálogo original

Autorización del usuario: todos los productos con receta; inventario kg1–25, litros1–20, piezas10–15. Aplicado solo en pasteleria_db local, con respaldo privado previo y transacción idempotente.

Resultado:21 recetas base para una unidad vendible;25 ingredientes nuevos; Harina y Fresas reutilizados sin cambiar sus existencias, grenetina repuesta de0 a1kg con movimiento Ajuste. Nuevas existencias registradas como Apertura. Inventario total activo:17 ingredientes enkg (mínimo1,máximo25),7 enlitros (mínimo1,máximo20),4 enpiezas (mínimo10,máximo15). No se cambiaron precios ni existencias de productos, ni esquema, usuarios, ventas, pedidos o proveedores.

Las recetas son ejemplos ajustables y se identifican como tales en su descripción; no son fichas de producción validadas por el negocio. Cantidades fraccionarias por pieza representan el consumo de una unidad vendible (por ejemplo huevo por cupcake), admitido por el modelo decimal existente.

Verificación real de lectura:0 productos sin receta activa,21 recetas con detalles positivos e ingredientes activos. PrepararVenta (consulta sin mutación) pasó para los17 productos con stock, una unidad por producto;0 ventas realizadas y0 consumos de inventario. Cuatro productos continúan sin existencia, como se había solicitado.31 pruebas de cantidades, comercio y gestión aprobadas.

Datos propuestos:recetas-inventario-2026-11-13.json. Resultado confirmado:recetas-cargadas-2026-11-13.json. Script puntual:scripts/load-original-recipes.js --apply.
