(() => {
  if (!['admin', 'trabajador'].includes(document.body.dataset.page)) return;
  const { el, button, read, all, write, message, feedback, form, dialog, table, facts, section, list, lines, date, state } = OP;
  const admin = document.body.dataset.page === 'admin', root = document.querySelector('[data-operation-workspace]');
  const labels = { resumen: admin ? 'Resumen del negocio' : 'Mi jornada', caja: 'Caja', pedidos: 'Pedidos', revisiones: 'Revisar transferencias', productos: 'Productos', categorias: 'Categorías', ingredientes: 'Ingredientes', recetas: 'Recetas', proveedores: 'Proveedores', compras: 'Compras a proveedores', ventas: admin ? 'Ventas' : 'Mis ventas', clientes: 'Clientes', trabajadores: 'Trabajadores', movimientos: 'Movimientos de inventario', notificaciones: 'Notificaciones', 'configuracion-bancaria': 'Configuración bancaria' };
  const allowed = admin ? Object.keys(labels) : ['resumen', 'caja', 'pedidos', 'revisiones', 'productos', 'ingredientes', 'ventas', 'notificaciones'];
  const moneyCol = (key, label) => ({ label, render: item => item[key] === null ? 'Por cotizar' : DR.money(item[key]) });
  const dateCol = (key, label) => ({ label, render: item => date(item[key]) });
  const activeCol = { label: 'Estado', render: item => Number(item.activo) ? 'Activo' : 'Inactivo' };
  const statusCol = { label: 'Estado', render: item => state(item.estado) };
  let generation = 0;
  function showError(error) { DR.notify(error.message); }
  function openForm(title, fields, action, row, refresh, options = {}) {
    const view = dialog(title);
    view.body.append(form(fields, async data => { await write(action, data); view.close(); refresh?.(); }, { initial: row ? { id: row.id || row.id_usuario || row.id_producto || row.id_categoria || row.id_ingrediente || row.id_proveedor || row.id_receta, version: row.version } : {}, ...options })); return view;
  }
  const text = (name, label, value = '', extra = {}) => [name, label, 'text', value, { maxLength: 100, ...extra }];
  const decimal = (name, label, value = '0', step = '0.001') => [name, label, 'number', value, { required: true, min: '0', step }];
  const active = row => ['activo', 'Registro activo', 'checkbox', row ? row.activo : 1];
  const masterConfig = {
    categorias: { singular: 'categoría', action: 'guardarCategoria', id: 'id_categoria', columns: [{ key: 'nombre', label: 'Nombre' }, { key: 'descripcion', label: 'Descripción' }, activeCol], fields: row => [text('nombre', 'Nombre', row?.nombre, { required: true, maxLength: 50 }), ['descripcion', 'Descripción', 'textarea', row?.descripcion, { maxLength: 255, wide: true }], active(row)] },
    ingredientes: { singular: 'ingrediente', action: 'guardarIngrediente', id: 'id_ingrediente', columns: [{ key: 'nombre', label: 'Ingrediente' }, { key: 'unidad', label: 'Unidad base' }, { key: 'existencia', label: 'Existencia' }, { key: 'stock_minimo', label: 'Mínimo' }, activeCol], fields: row => [text('nombre', 'Nombre', row?.nombre, { required: true }), ['unidad', 'Unidad base', 'select', row?.unidad || 'kg', { choices: ['kg', 'litro', 'pieza'], required: true, help: 'Usa siempre esta misma unidad en recetas y compras.', disabled: Boolean(row) }], decimal('stock_minimo', 'Existencia mínima', row?.stock_minimo || '0'), ...(!row ? [decimal('existencia', 'Existencia inicial', '0')] : []), active(row)] },
    proveedores: { singular: 'proveedor', action: 'guardarProveedor', id: 'id_proveedor', columns: [{ key: 'nombre', label: 'Proveedor' }, { key: 'telefono', label: 'Teléfono' }, { key: 'correo', label: 'Correo' }, activeCol], fields: row => [text('nombre', 'Nombre del proveedor', row?.nombre, { required: true }), text('telefono', 'Teléfono', row?.telefono, { maxLength: 20 }), ['correo', 'Correo', 'email', row?.correo, { maxLength: 100 }], ['direccion', 'Dirección', 'textarea', row?.direccion, { maxLength: 255, wide: true }], active(row)] },
    trabajadores: { singular: 'trabajador', action: 'guardarTrabajador', id: 'id_usuario', columns: [{ key: 'nombre', label: 'Nombre' }, { key: 'correo', label: 'Correo' }, { key: 'telefono', label: 'Teléfono' }, activeCol], fields: row => [text('nombre', 'Nombre completo', row?.nombre, { required: true }), ['correo', 'Correo', 'email', row?.correo, { required: true, maxLength: 100 }], text('telefono', 'Teléfono', row?.telefono, { maxLength: 20 }), ['direccion', 'Dirección', 'textarea', row?.direccion, { maxLength: 255 }], ['contrasena', row ? 'Nueva contraseña (opcional)' : 'Contraseña', 'password', '', { required: !row, minLength: 12, maxLength: 128, autocomplete: 'new-password', help: row ? 'Déjala vacía para conservar la actual.' : 'Entrega esta contraseña personalmente al trabajador.' }], ['confirmacion', 'Confirmar contraseña', 'password', '', { required: !row, maxLength: 128, autocomplete: 'new-password' }], active(row)] }
  };
  async function master(resource, host) {
    const config = masterConfig[resource], pane = section(labels[resource], resource === 'ingredientes' ? 'Las cantidades usan la unidad base registrada. Los ajustes conservan su motivo e historial.' : 'Conserva los registros y su historial mediante el estado activo.'); host.append(pane);
    let listing;
    async function edit(id) { try { const row = id ? await read(resource, { id }) : null; openForm((row ? 'Editar ' : 'Agregar ') + config.singular, config.fields(row), config.action, row, () => listing.load()); } catch (error) { showError(error); } }
    const columns = [...config.columns];
    if (admin) columns.push({ label: 'Acciones', render: row => { const group = el('div', 'operation-actions'); group.append(button('Editar', () => edit(row[config.id]))); if (resource === 'ingredientes') group.append(button('Ajustar existencia', () => adjust(resource, row, () => listing.load()))); if (resource === 'proveedores') group.append(button('Compras', () => supplier(row))); return group; } });
    listing = list(pane, resource, columns, { title: labels[resource], tools: admin ? [button('Agregar ' + config.singular, () => edit(), true)] : [] });
  }
  function adjust(resource, row, refresh) {
    const product = resource === 'productos';
    openForm('Ajustar existencia de ' + row.nombre, [decimal('existencia', 'Existencia final · ' + (row.unidad || 'piezas'), row.existencia, product ? '1' : '0.001'), ['motivo', 'Motivo del ajuste', 'textarea', '', { required: true, maxLength: 255, wide: true }]], product ? 'ajustarProducto' : 'ajustarIngrediente', row, refresh, { label: 'Registrar ajuste', confirm: data => '¿Fijar la existencia de ' + row.nombre + ' en ' + data.existencia + ' ' + row.unidad + '? El motivo quedará en el historial.' });
  }
  async function productEdit(id, refresh) {
    try {
      const [row, categories] = await Promise.all([read('productos', { id }), all('categorias')]);
      openForm('Editar producto', [text('nombre', 'Nombre', row.nombre, { required: true }), ['id_categoria', 'Categoría', 'select', row.id_categoria, { required: true, choices: categories.map(item => ({ value: item.id_categoria, label: item.nombre + (Number(item.activo) ? '' : ' · Inactiva') })) }], decimal('precio', 'Precio (MXN)', row.precio, '0.01'), ['descripcion', 'Descripción', 'textarea', row.descripcion, { maxLength: 255, wide: true }], text('unidad', 'Unidad', row.unidad, { required: true, maxLength: 20 }), decimal('stock_minimo', 'Mínimo de unidades preparadas', row.stock_minimo, '1'), active(row)], 'guardarProducto', row, refresh);
    } catch (error) { showError(error); }
  }
  function productList(host) {
    const pane = section('Productos registrados', 'La receta y las existencias disponibles se verifican nuevamente al cobrar o entregar.'); host.append(pane); let listing;
    const columns = [{ key: 'nombre', label: 'Producto' }, { key: 'categoria', label: 'Categoría' }, moneyCol('precio', 'Precio'), { key: 'existencia', label: 'Unidades preparadas' }, { label: 'Disponibilidad', render: row => row.disponibilidad ? row.disponibilidad.unidades + ' · ' + (row.disponibilidad.motivo || 'Disponible') : 'Consultar al vender' }, { label: 'Receta', render: row => row.id_receta || row.receta ? 'Registrada' : 'Sin receta' }, activeCol];
    if (admin) columns.push({ label: 'Acciones', render: row => { const group = el('div', 'operation-actions'); group.append(button('Editar', () => productEdit(row.id_producto, () => listing.load())), button('Ajustar unidades', () => adjust('productos', row, () => listing.load())), button('Receta', () => recipeEditor(null, row.id_producto, () => listing.load()))); return group; } });
    listing = list(pane, 'productos', columns, { title: 'Productos' });
  }
  async function recipeEditor(id, productId, refresh) {
    const view = dialog(id ? 'Editar receta' : 'Receta por unidad de producto'), status = feedback(); view.body.append(status); message(status, 'Cargando ingredientes y productos…');
    try {
      const [products, ingredients, recipes] = await Promise.all([all('productos'), all('ingredientes'), all('recetas')]);
      let row = id ? await read('recetas', { id }) : null;
      if (!row && productId) { const existing = recipes.find(item => Number(item.id_producto) === Number(productId) && Number(item.activo)); if (existing) row = await read('recetas', { id: existing.id_receta }); }
      const entries = lines(ingredients.filter(item => Number(item.activo)), { ingredient: true, initial: row?.detalles, label: 'Agregar ingrediente a receta' });
      const editor = form([['id_producto', 'Producto', 'select', row?.id_producto || productId || '', { required: true, disabled: Boolean(row), choices: [{ value: '', label: 'Selecciona…' }, ...products.map(item => ({ value: item.id_producto, label: item.nombre }))] }], text('nombre', 'Nombre de la receta', row?.nombre || '', { required: true }), ['descripcion', 'Descripción', 'textarea', row?.descripcion, { maxLength: 255 }], active(row)], async data => { await write('guardarReceta', { ...data, detalles: entries.values() }); view.close(); refresh?.(); }, { initial: row ? { id: row.id_receta, version: row.version, rendimiento: row.rendimiento } : {}, label: 'Guardar receta' });
      editor.querySelector('.operation-fields').after(el('p', 'operation-help', 'Cantidades para ' + (row?.rendimiento || 1) + ' unidad(es) del producto, en la unidad base de cada ingrediente.'), entries); status.remove(); view.body.append(editor);
    } catch (error) { message(status, error.message, true); }
  }
  function recipes(host) { const pane = section('Recetas', 'Cada receta representa una unidad de producto. Los consumos de ventas anteriores conservan sus cantidades originales.'); host.append(pane); let listing; listing = list(pane, 'recetas', [{ key: 'nombre', label: 'Receta' }, { label: 'Producto', render: row => row.producto || 'Producto #' + row.id_producto }, activeCol, { label: 'Acciones', render: row => button('Editar receta', () => recipeEditor(row.id_receta, null, () => listing.load())) }], { title: 'Recetas', tools: [button('Agregar receta', () => recipeEditor(null, null, () => listing.load()), true)] }); }
  async function supplier(row) {
    const view = dialog('Proveedor · ' + row.nombre); view.body.append(facts([['Teléfono', row.telefono], ['Correo', row.correo], ['Dirección', row.direccion]]));
    let listing; listing = list(view.body, 'compras', purchaseColumns(() => listing.load()), { title: 'Compras del proveedor', query: { id_proveedor: row.id_proveedor }, tools: [button('Registrar compra', () => purchaseEditor(null, row.id_proveedor, () => listing.load()), true)] });
  }
  const purchaseColumns = refresh => [{ label: 'Folio', render: row => button('#' + (row.folio || row.id_compra), () => purchaseDetail(row.id_compra, refresh)) }, { key: 'proveedor', label: 'Proveedor' }, dateCol('fecha', 'Fecha'), moneyCol('total', 'Total'), statusCol];
  function purchases(host) { const pane = section('Compras a proveedores', 'Corrige cantidades y precios mientras la compra esté pendiente. La recepción suma los ingredientes una sola vez.'); host.append(pane); let listing; listing = list(pane, 'compras', purchaseColumns(() => listing.load()), { title: 'Compras', tools: [button('Registrar compra', () => purchaseEditor(null, null, () => listing.load()), true)], filters: [['estado', 'Estado', 'select', '', { choices: [{ value: '', label: 'Todos' }, 'Pendiente', { value: 'Recibida', label: 'Entregada' }, 'Cancelada'] }], ['desde', 'Desde', 'date'], ['hasta', 'Hasta', 'date']] }); }
  async function purchaseEditor(id, supplierId, refresh) {
    const view = dialog(id ? 'Corregir compra pendiente' : 'Registrar compra'), status = feedback(); view.body.append(status); message(status, 'Cargando formulario…');
    try {
      const [providers, ingredients, row] = await Promise.all([all('proveedores'), all('ingredientes'), id ? read('compras', { id }) : Promise.resolve(null)]);
      const entries = lines(ingredients.filter(item => Number(item.activo)), { ingredient: true, price: true, initial: row?.detalles, label: 'Agregar ingrediente' });
      const fields = [['id_proveedor', 'Proveedor', 'select', row?.id_proveedor || supplierId || '', { required: true, disabled: Boolean(row), choices: [{ value: '', label: 'Selecciona…' }, ...providers.filter(item => Number(item.activo) || item.id_proveedor === row?.id_proveedor).map(item => ({ value: item.id_proveedor, label: item.nombre }))] }], ['observaciones', 'Observaciones de la compra', 'textarea', row?.observaciones, { maxLength: 255, wide: true }]];
      const editor = form(fields, async data => { await write('guardarCompra', { ...data, detalles: entries.values() }); view.close(); refresh?.(); }, { label: row ? 'Guardar cantidades definitivas' : 'Guardar compra pendiente', initial: row ? { id: row.id_compra, version: row.version } : {} });
      editor.querySelector('.operation-fields').after(entries); status.remove(); view.body.append(editor);
    } catch (error) { message(status, error.message, true); }
  }
  async function purchaseDetail(id, refresh) {
    const view = dialog('Compra #' + id), status = feedback(); view.body.append(status);
    async function load() {
      try {
        message(status, 'Cargando compra…'); const row = await read('compras', { id }); view.body.replaceChildren(status); message(status, '');
        view.body.append(facts([['Proveedor', row.proveedor], ['Fecha', date(row.fecha)], ['Estado', state(row.estado)], ['Total', DR.money(row.total)], ['Operador', row.operador], ['Observaciones', row.observaciones]]), table([{ key: 'nombre', label: 'Ingrediente' }, { key: 'unidad', label: 'Unidad' }, { key: 'cantidad', label: 'Cantidad' }, moneyCol('precio_unitario', 'Precio unitario'), moneyCol('subtotal', 'Subtotal')], row.detalles || []));
        if (row.estado === 'Pendiente') {
          const actions = el('div', 'operation-actions'); actions.append(button('Corregir compra', () => purchaseEditor(id, null, async () => { await load(); refresh?.(); })), button('Recibir cantidades definitivas', () => mutate('recibirCompra', '¿Recibir esta compra por ' + DR.money(row.total) + ' con las cantidades de la tabla? Se sumarán al inventario.'), true), button('Cancelar compra', () => mutate('cancelarCompra', '¿Cancelar esta compra pendiente?'))); view.body.append(actions);
        }
        async function mutate(action, confirmation) { if (!window.confirm(confirmation)) return; try { await write(action, { id, version: row.version }); await load(); refresh?.(); } catch (error) { message(status, error.message, true); } }
      } catch (error) { message(status, error.message, true); }
    }
    await load();
  }
  OP.purchaseDetail = purchaseDetail;
  function orders(host, review = false) {
    const pane = section(review ? 'Transferencias pendientes de revisión' : 'Pedidos', 'Revisa las transferencias pendientes, confirma el ingreso y acepta el pedido antes de prepararlo. Las referencias enviadas aún no son pagos.'); host.append(pane); let listing;
    listing = list(pane, 'pedidos', [{ label: 'Folio', render: row => button('#' + (row.folio || row.id_pedido), () => OP.orderDetail(row.id_pedido, { onSave: () => listing.load() })) }, { key: 'cliente', label: 'Cliente' }, { key: 'tipo', label: 'Tipo' }, statusCol, dateCol('fecha_entrega', 'Entrega confirmada'), moneyCol('total', 'Total'), moneyCol('saldo', 'Saldo'), { key: 'cotizacion_estado', label: 'Cotización' }, { key: 'aceptacion_estado', label: 'Aceptación / transferencia' }], { title: review ? 'Transferencias pendientes' : 'Pedidos', query: review ? { aceptacion_estado: 'Pendiente de validación' } : {}, tools: [button('Nuevo pedido', () => OP.createOrder({ onSave: () => listing.load() }), true), button('Solicitud personalizada', () => OP.createOrder({ personalized: true, onSave: () => listing.load() }))], filters: [['estado', 'Estado', 'select', '', { choices: [{ value: '', label: 'Todos' }, 'Pendiente', { value: 'En progreso', label: 'En preparación' }, 'Listo', { value: 'Despachado', label: 'Entregado' }, 'Cancelado'] }], ['desde', 'Desde', 'date'], ['hasta', 'Hasta', 'date']] });
  }
  async function cash(host) {
    const pane = section('Caja', 'Selecciona varios productos y, si el cliente lo desea, asocia su cuenta. El servidor confirma precios y existencias al cobrar.'); host.append(pane); const status = feedback(); pane.append(status); message(status, 'Cargando productos…');
    try {
      const products = (await all('productos')).filter(item => Number(item.activo)), picker = await OP.chooseClient(), entries = lines(products), total = el('p', 'operation-total');
      const availability = el('div', 'operation-help');
      let previewSequence = 0;
      availability.setAttribute('role', 'status');
      async function estimate() {
        const current = ++previewSequence;
        try {
          const details = entries.values();
          if (details.some(row => !row.id_producto || !Number.isInteger(Number(row.cantidad)) || Number(row.cantidad) <= 0)) { total.textContent = 'Selecciona tus artículos.'; availability.textContent = ''; return; }
          availability.textContent = 'Comprobando precios e ingredientes del conjunto…';
          const preview = await OP.previewSale(details); if (current !== previewSequence) return;
          total.textContent = 'Total por confirmar: ' + DR.money(preview.total);
          availability.textContent = preview.puede_vender ? 'Ingredientes y unidades disponibles para estos artículos.' : preview.faltantes.join(' · ');
        } catch (error) { if (current === previewSequence) availability.textContent = error.message; }
      }
      entries.addEventListener('change', estimate); entries.addEventListener('input', estimate); estimate();
      const editor = form([['metodo_pago', 'Método de pago', 'select', 'Efectivo', { required: true, choices: ['Efectivo', 'Transferencia'] }], ['referencia', 'Referencia de transferencia', 'text', '', { maxLength: 100 }], ['transferencia_verificada', 'He comprobado el ingreso de la transferencia fuera de la aplicación', 'checkbox', 0], ['recibido', 'Efectivo recibido (MXN)', 'number', '', { min: '0.01', step: '0.01', help: 'Opcional. Solo para calcular cambio en efectivo.' }]], async data => {
        if (data.metodo_pago === 'Transferencia' && (!data.referencia.trim() || !data.transferencia_verificada)) throw new Error('Escribe la referencia y confirma que comprobaste el ingreso antes de cobrar la transferencia.');
        const payload = { ...data, detalles: entries.values() }, customer = picker.value(); if (customer) payload.id_cliente = customer; if (!payload.recibido) delete payload.recibido;
        const preview = await OP.previewSale(payload.detalles);
        total.textContent = 'Total por confirmar: ' + DR.money(preview.total); availability.textContent = preview.faltantes.join(' · ');
        if (!preview.puede_vender) throw new Error('No se puede completar la venta. ' + preview.faltantes.join(' · ') + ' Puedes registrar un pedido para entrega posterior.');
        if (!window.confirm('¿Confirmar venta por ' + DR.money(preview.total) + ' con pago por ' + data.metodo_pago + '?')) return false;
        payload.total_autorizado = preview.total;
        const result = await write('vender', payload);
        try { const sale = await read('ventas', { id: result.id_venta || result.id }); const receipt = OP.receipt(sale); if (result.cambio !== undefined) receipt.body.prepend(el('p', 'operation-total', 'Cambio: ' + DR.money(result.cambio))); }
        catch (error) { DR.notify('Venta #' + result.id + ' registrada. Puedes consultar su comprobante en Ventas. ' + error.message); }
        await cashReload();
      }, { label: 'Registrar venta y cobro' });
      editor.prepend(picker, entries, total, availability); status.remove(); pane.append(editor, button('Crear pedido para entrega posterior', () => OP.createOrder()));
      const method = editor.controls.metodo_pago, received = editor.controls.recibido; function paymentMethod() { const transfer = method.value === 'Transferencia'; received.disabled = transfer; if (received.disabled) received.value = ''; editor.controls.referencia.required = transfer; editor.controls.referencia.closest('.operation-field').hidden = !transfer; editor.controls.transferencia_verificada.closest('.operation-field').hidden = !transfer; editor.controls.transferencia_verificada.disabled = !transfer; if (!transfer) { editor.controls.referencia.value = ''; editor.controls.transferencia_verificada.checked = false; } } method.addEventListener('change', paymentMethod); paymentMethod();
      async function cashReload() { host.replaceChildren(); await cash(host); }
    } catch (error) { message(status, error.message, true); pane.append(button('Volver a intentar', () => { host.replaceChildren(); cash(host); })); }
  }
  async function sales(host) { const workers = admin ? await all('trabajadores') : []; const operators = [{ value: '', label: 'Todos' }, { value: DR.user.id_usuario, label: DR.user.nombre }, ...workers.map(item => ({ value: item.id_usuario, label: item.nombre }))]; const pane = section(admin ? 'Ventas completadas' : 'Mis ventas completadas', 'Consulta cada venta y su comprobante. Los anticipos se muestran en cobros del resumen.'); host.append(pane); list(pane, 'ventas', [{ label: 'Folio', render: row => button('#' + (row.folio || row.id_venta), async () => { try { OP.receipt(await read('ventas', { id: row.id_venta })); } catch (error) { showError(error); } }) }, dateCol('fecha', 'Fecha'), { key: 'cliente', label: 'Cliente' }, { key: 'operador', label: 'Operador' }, moneyCol('total', 'Total'), { key: 'metodo_pago', label: 'Método' }], { title: 'Ventas', filters: [['desde', 'Desde', 'date'], ['hasta', 'Hasta', 'date'], ...(admin ? [['id_usuario', 'Operador', 'select', '', { choices: operators }]] : [])] }); }
  function clients(host) { const pane = section('Clientes', 'Busca por nombre o correo y abre su ficha para consultar sus compras, pedidos y saldos.'); host.append(pane); let listing; listing = list(pane, 'clientes', [{ label: 'Cliente', render: row => button(row.nombre, () => clientDetail(row.id_usuario, () => listing.load())) }, { key: 'correo', label: 'Correo' }, { key: 'telefono', label: 'Teléfono' }, activeCol], { title: 'Clientes' }); }
  async function clientDetail(id, refresh) {
    const view = dialog('Ficha del cliente'), status = feedback(); view.body.append(status);
    async function load() {
      try {
        const row = await read('cliente', { id }); view.title.textContent = row.nombre; view.body.replaceChildren(status); message(status, '');
        view.body.append(facts([['Correo', row.correo], ['Teléfono', row.telefono], ['Dirección', row.direccion], ['Cuenta', Number(row.activo) ? 'Activa' : 'Inactiva'], ['Registro', date(row.fecha_registro)], ['Compras completadas', row.resumen.compras_completadas], ['Importe comprado', DR.money(row.resumen.importe_comprado)], ['Última compra', row.resumen.ultima_compra ? date(row.resumen.ultima_compra) : 'Sin compras'], ['Pedidos abiertos', row.resumen.pedidos_abiertos], ['Saldo pendiente', DR.money(row.resumen.saldo_pendiente)]]));
        view.body.append(button('Editar cliente', () => openForm('Editar cliente', [text('nombre', 'Nombre', row.nombre, { required: true }), text('telefono', 'Teléfono', row.telefono, { required:true, maxLength: 20 }), ['direccion', 'Dirección', 'textarea', row.direccion, { required:true, maxLength: 255 }], active(row)], 'guardarCliente', row, async () => { await load(); refresh?.(); })));
        view.body.append(el('h3', 'operation-subheading', 'Historial de ventas'), row.ventas.length ? table([{ label: 'Folio', render: item => button('#' + item.id_venta, async () => { try { OP.receipt(await read('ventas', { id: item.id_venta })); } catch (error) { showError(error); } }) }, dateCol('fecha', 'Fecha'), moneyCol('total', 'Total'), statusCol], row.ventas) : el('p', 'operation-empty', 'Sin compras completadas.'));
        view.body.append(el('h3', 'operation-subheading', 'Pedidos'), row.pedidos.length ? table([{ label: 'Folio', render: item => button('#' + item.id_pedido, () => OP.orderDetail(item.id_pedido, { onSave: load })) }, statusCol, dateCol('fecha_entrega', 'Entrega'), moneyCol('total', 'Total'), moneyCol('saldo', 'Saldo')], row.pedidos) : el('p', 'operation-empty', 'Sin pedidos.'));
        view.body.append(el('h3', 'operation-subheading', 'Pagos'), row.pagos.length ? table([dateCol('fecha', 'Fecha'), moneyCol('importe', 'Importe'), { key: 'metodo_pago', label: 'Método' }], row.pagos) : el('p', 'operation-empty', 'Sin pagos registrados.'));
      } catch (error) { message(status, error.message, true); }
    }
    await load();
  }
  async function summary(host) {
    const pane = section(labels.resumen, 'Ventas completadas y dinero cobrado se presentan por separado, sin sumar anticipos dos veces.'); host.append(pane);
    const filters = form([['desde', 'Desde', 'date'], ['hasta', 'Hasta', 'date']], data => load(data), { label: 'Consultar periodo', success: '' }), status = feedback(), output = el('div'); pane.append(filters, status, output);
    async function load(query = {}) {
      message(status, 'Consultando resumen…');
      try {
        const data = await read('resumen', query), metrics = el('div', 'operation-metrics');
        for (const [label, value] of [['Ventas completadas', data.ventas ?? 0], ['Importe vendido', DR.money(data.total_ventas || 0)], ['Cobros recibidos', DR.money(data.cobros || 0)], ['Devoluciones', DR.money(data.devoluciones || 0)], ['Pedidos abiertos', data.pedidos_abiertos ?? 0], ['Entregas pendientes', data.pedidos_para_entregar ?? 0], ...(admin ? [['Productos activos', data.productos_activos ?? 0], ['Ingredientes bajo mínimo', data.ingredientes_bajo_minimo ?? 0]] : [])]) { const metric = el('article', 'operation-metric'); metric.append(el('span', '', label), el('strong', '', value)); metrics.append(metric); }
        output.replaceChildren(metrics);
        if (data.serie?.length) output.append(el('h3', 'operation-subheading', 'Ventas por día'), table([{ key: 'fecha', label: 'Fecha' }, { key: 'ventas', label: 'Ventas' }, moneyCol('total', 'Total')], data.serie));
        if (data.productos_mas_vendidos?.length) output.append(el('h3', 'operation-subheading', 'Productos más vendidos'), table([{ key: 'nombre', label: 'Producto' }, { key: 'cantidad', label: 'Cantidad' }, moneyCol('total', 'Total')], data.productos_mas_vendidos));
        message(status, 'Información actualizada.');
      } catch (error) { message(status, error.message, true); }
    }
    await load();
  }
  function movements(host) { const pane = section('Movimientos de inventario', 'Entradas, consumos y ajustes con su motivo y operador.'); host.append(pane); list(pane, 'movimientos', [dateCol('fecha', 'Fecha'), { key: 'nombre', label: 'Artículo' }, { key: 'tipo', label: 'Movimiento' }, { key: 'cantidad', label: 'Cantidad' }, { key: 'unidad', label: 'Unidad' }, { key: 'existencia_resultante', label: 'Existencia resultante' }, { key: 'motivo', label: 'Motivo' }, { label: 'Operador', render: row => row.operador || 'Usuario #' + row.id_usuario }, { label: 'Origen', render: row => row.id_compra ? 'Compra #' + row.id_compra : row.id_venta ? 'Venta #' + row.id_venta : 'Ajuste / apertura' }], { title: 'Movimientos', filters: [['desde', 'Desde', 'date'], ['hasta', 'Hasta', 'date']] }); }
  async function route() {
    const id = location.hash.slice(1).split('?')[0] || 'resumen', current = allowed.includes(id) ? id : 'resumen', token = ++generation;
    document.querySelectorAll('.workspace-nav a').forEach(link => { const selected = link.hash === '#' + current; link.classList.toggle('active', selected); if (selected) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); });
    document.querySelector('[data-workspace-title]').textContent = labels[current]; document.querySelector('[data-workspace-heading]').textContent = labels[current];
    const photos = document.querySelector('[data-photo-panel]'); if (photos) photos.hidden = current !== 'productos'; root.replaceChildren();
    try {
      if (masterConfig[current]) await master(current, root);
      else if (current === 'productos') productList(root);
      else if (current === 'recetas') recipes(root);
      else if (current === 'compras') purchases(root);
      else if (current === 'pedidos') orders(root);
      else if (current === 'revisiones') orders(root, true);
      else if (current === 'caja') await cash(root);
      else if (current === 'ventas') await sales(root);
      else if (current === 'clientes') clients(root);
      else if (current === 'movimientos') movements(root);
      else if (current === 'notificaciones') OP.notifications.mount(root);
      else if (current === 'configuracion-bancaria') await OP.notifications.bank(root);
      else await summary(root);
      if (token === generation) document.querySelector('[data-workspace-heading]').focus({ preventScroll: true });
      if (token === generation) await OP.notifications.openOrderFromHash();
    } catch (error) { const status = feedback(); root.append(status); message(status, error.message, true); }
  }
  DR.ready.then(user => {
    if (!user) { location.replace('/login.html'); return; }
    if ((admin && user.rol !== 'Administrador') || (!admin && !['Trabajador', 'Administrador'].includes(user.rol))) { location.replace(DR.destination); return; }
    document.querySelector('[data-workspace-date]').textContent = new Intl.DateTimeFormat('es-MX', { dateStyle: 'full', timeZone: 'America/Mexico_City' }).format(new Date());
    window.addEventListener('hashchange', route); route();
  });
  document.addEventListener('operation-saved', async event => {
    if (event.detail.action !== 'guardarCategoria' || !admin) return;
    const photoForm = document.querySelector('[data-product-form]'); if (!photoForm) return;
    try {
      const { categorias } = await DR.request('/categorias'), select = photoForm.elements.id_categoria, selected = select.value;
      select.replaceChildren(el('option', '', 'Selecciona una categoría')); select.firstElementChild.value = '';
      for (const category of categorias) { const option = el('option', '', category.nombre); option.value = category.id_categoria; select.append(option); }
      if (categorias.some(category => String(category.id_categoria) === selected)) select.value = selected;
      photoForm.querySelector('[type="submit"]').disabled = !categorias.length;
      const status = document.querySelector('[data-product-feedback]'); status.hidden = false; status.textContent = categorias.length ? 'Categorías actualizadas. Ya puedes agregar productos.' : 'Agrega o activa una categoría para dar de alta productos.';
    } catch (error) { showError(error); }
  });
})();
