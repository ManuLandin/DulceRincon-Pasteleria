export function presentCategory(row) {
  const key = row.nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const aliases = { postres: ['Repostería', 'reposteria'], cupcakes: ['Cup cakes', 'cup-cakes'], 'cup cakes': ['Cup cakes', 'cup-cakes'], reposteria: ['Repostería', 'reposteria'] };
  const [nombre, slug] = aliases[key] || [row.nombre, key.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')];
  return { id_categoria: row.id_categoria, nombre, nombre_original: row.nombre, slug };
}
export function presentProduct(row) {
  const categoria = presentCategory({ id_categoria: row.id_categoria, nombre: row.categoria });
  return {
    id_producto: row.id_producto, nombre: row.nombre, descripcion: row.descripcion || '',
    precio: String(row.precio), existencia: row.existencia, stock_minimo: row.stock_minimo,
    unidad: row.unidad || 'pieza', imagen: row.imagen || null,
    id_categoria: row.id_categoria, categoria: categoria.nombre, categoria_slug: categoria.slug,
    activo: Boolean(row.activo)
  };
}
