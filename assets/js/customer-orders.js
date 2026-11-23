(() => {
  if (document.body.dataset.page !== 'cliente') return;
  const { el, button, read, write, feedback, message, list, form, receipt, date } = OP;
  const orders = document.querySelector('[data-customer-orders]'), sales = document.querySelector('[data-customer-sales]');
  let orderList, contactDialog;
  DR.ready.then(async user => {
    if (!user) { location.replace('/login.html'); return; }
    if (user.rol !== 'Cliente') { location.replace(DR.destination); return; }
    orders.replaceChildren();
    orderList = list(orders, 'pedidos', [{ label: 'Pedido', render: row => button('#' + (row.folio || row.id_pedido), () => OP.orderDetail(row.id_pedido, { customer: true, onSave: () => orderList.load() })) }, { key: 'tipo', label: 'Tipo' }, { label: 'Estado', render: row => OP.state(row.estado) }, { label: 'Entrega confirmada', render: row => date(row.fecha_entrega) }, { key: 'cotizacion_estado', label: 'Cotización' }, { key: 'aceptacion_estado', label: 'Aceptación / transferencia' }, { label: 'Total', render: row => row.total === null ? 'Por cotizar' : DR.money(row.total) }, { label: 'Saldo', render: row => row.saldo === null ? 'Por cotizar' : DR.money(row.saldo) }], { title: 'Mis pedidos', tools: [button('Nuevo pedido', () => OP.createOrder({ customer: true, onSave: () => orderList.load() }), true)] });
    document.querySelector('[data-custom-order]').addEventListener('click', () => OP.createOrder({ customer: true, personalized: true, onSave: () => orderList.load() }));
    list(sales, 'ventas', [{ label: 'Folio', render: row => button('#' + (row.folio || row.id_venta), async () => { try { receipt(await read('ventas', { id: row.id_venta })); } catch (error) { DR.notify(error.message); } }) }, { label: 'Fecha', render: row => date(row.fecha) }, { label: 'Total', render: row => row.total === null ? 'Por cotizar' : DR.money(row.total) }, { key: 'metodo_pago', label: 'Método' }, { key: 'estado', label: 'Estado' }], { title: 'Mis compras', filters: [['desde', 'Desde', 'date'], ['hasta', 'Hasta', 'date']] });
    if (['#editar-contacto','#mi-contacto'].includes(location.hash)) await editContact();
  });
  async function editContact() {
    if (contactDialog) return;
    const view = OP.dialog('Editar contacto'), status = feedback(); contactDialog = view;
    view.node.addEventListener('close', () => { contactDialog = null; }, {once:true});
    view.body.append(status); message(status, 'Consultando contacto…');
    try {
      const row = await read('cliente');
      if (contactDialog !== view) return;
      const editor = form([['nombre', 'Nombre completo', 'text', row.nombre, { required: true, maxLength: 100, pattern:'[\\p{L}\\p{M} ]+', autocomplete: 'name' }], ['telefono', 'Teléfono', 'tel', row.telefono, { required:true, maxLength: 20, autocomplete: 'tel' }], ['direccion', 'Dirección', 'textarea', row.direccion, { required:true, maxLength: 255, wide: true, autocomplete: 'street-address' }]], async data => {
        await write('guardarCliente', data); DR.user.nombre = data.nombre.trim();
        document.querySelectorAll('[data-user-name]').forEach(node => { node.textContent = DR.user.nombre; });
        document.querySelectorAll('.account-name').forEach(node => { node.textContent = DR.user.nombre.split(/\s+/)[0]; });
        view.close(); DR.notify('Tus datos de contacto se actualizaron.');
      }, { initial: { id: row.id_usuario, version: row.version }, label: 'Guardar cambios', confirm:data=>'¿Confirmar estos cambios de contacto? Nombre: '+data.nombre+'. Teléfono: '+data.telefono+'. Dirección: '+data.direccion+'. El correo se conservará.' });
      message(status, ''); view.body.append(OP.facts([['Correo registrado (no se puede cambiar)',row.correo]]),editor);
    } catch (error) { message(status, error.message, true); }
  }
  document.addEventListener('click',event=>{
    const link=event.target.closest('a'); if (!link || !['#editar-contacto','#mi-contacto','cliente.html#editar-contacto','cliente.html#mi-contacto'].includes(link.getAttribute('href'))) return;
    event.preventDefault(); editContact();
  });
  document.addEventListener('operation-saved', event => { if (event.detail.action === 'crearPedido') orderList?.load(); });
})();
