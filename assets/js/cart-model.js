/* El carrito guarda solo identificadores y cantidades; los precios los valida el servidor. */
(() => {
  const key = 'dr-carrito-v1', maximum = 999999;
  let entries = [];
  const validId = id => Number.isSafeInteger(Number(id)) && Number(id) > 0;
  const validQuantity = value => Number.isSafeInteger(Number(value)) && Number(value) > 0 && Number(value) <= maximum;
  try {
    const stored = JSON.parse(localStorage.getItem(key) || '[]');
    if (Array.isArray(stored)) for (const item of stored.slice(0, 100)) {
      if (!item || !validId(item.id_producto) || !validQuantity(item.cantidad)) continue;
      const current = entries.find(row => row.id_producto === Number(item.id_producto));
      if (current) current.cantidad = Math.min(maximum, current.cantidad + Number(item.cantidad));
      else entries.push({id_producto:Number(item.id_producto),cantidad:Number(item.cantidad)});
    }
  } catch { /* Se puede seguir comprando si el almacenamiento está bloqueado. */ }
  function persist() { try { localStorage.setItem(key, JSON.stringify(entries)); } catch { /* Carrito en memoria. */ } }
  function set(id, quantity) {
    if (!validId(id) || !(Number(quantity) === 0 || validQuantity(quantity))) throw new Error('Usa una cantidad entera entre 1 y 999999.');
    id = Number(id); quantity = Number(quantity);
    if (!quantity) entries = entries.filter(row => row.id_producto !== id);
    else {
      const current = entries.find(row => row.id_producto === id);
      if (current) current.cantidad = quantity;
      else {
        if (entries.length >= 100) throw new Error('El carrito admite hasta 100 productos diferentes.');
        entries.push({id_producto:id,cantidad:quantity});
      }
    }
    persist();
  }
  window.DRCartModel = {
    items: () => entries.map(row => ({...row})),
    count: () => entries.reduce((total,row) => total + row.cantidad, 0),
    set,
    add(id, quantity = 1) {
      if (!validQuantity(quantity)) throw new Error('Usa una cantidad entera entre 1 y 999999.');
      const current = entries.find(row => row.id_producto === Number(id));
      set(id, (current?.cantidad || 0) + Number(quantity));
    },
    consume(snapshot) {
      for (const item of snapshot) {
        const current = entries.find(row => row.id_producto === Number(item.id_producto));
        if (current) set(current.id_producto, Math.max(0, current.cantidad - Number(item.cantidad)));
      }
    }
  };
})();
