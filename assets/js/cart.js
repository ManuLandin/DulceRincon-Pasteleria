(() => {
  if (!document.querySelector('[data-catalog]')) return;
  const model = window.DRCartModel, el = DR.element;
  const trigger = el('button', 'header-cart'); trigger.type = 'button';
  const icon = el('i', 'ti ti-shopping-bag'); icon.setAttribute('aria-hidden', 'true');
  const label = el('span', 'cart-label', 'Carrito'), badge = el('span', 'cart-count', '0');
  trigger.append(icon, label, badge);
  document.querySelector('.header-inner')?.insertBefore(trigger, document.querySelector('.header-account'));
  let modal = null, products = new Map(), failures = new Map(), loading = false;
  function button(text, handler, primary = false) {
    const node = el('button', primary ? 'btn-rose' : 'btn-outline-rose', text); node.type = 'button'; node.addEventListener('click', handler); return node;
  }
  function updateCount() { const count = model.count(); badge.textContent = String(count); trigger.setAttribute('aria-label', 'Abrir carrito, ' + count + ' artículos'); }
  function change(action) {
    try { action(); updateCount(); if (modal) render(); }
    catch (error) { if (modal) { modal.status.textContent = error.message; modal.status.setAttribute('role', 'alert'); } else DR.notify(error.message); }
  }
  function close() { modal?.node.close(); }
  function render() {
    if (!modal) return;
    const {body, status, footer} = modal, items = model.items(); body.replaceChildren(); footer.replaceChildren();
    status.textContent = loading ? 'Actualizando productos y precios…' : '';
    if (!items.length) {
      body.append(el('div', 'cart-empty', 'Tu carrito está esperando algo dulce.'), el('p', 'cart-help', 'Explora el catálogo y agrega tus favoritos.'));
      footer.append(button('Seguir explorando', close)); return;
    }
    let totalCents = 0;
    for (const item of items) {
      const product = products.get(item.id_producto), row = el('article', 'cart-item');
      if (product) row.append(DR.productImage(product, 'cart-photo'));
      const info = el('div', 'cart-item-info'); info.append(el('h3', '', product?.nombre || 'Producto #' + item.id_producto));
      if (product) {
        const cents = Math.round(Number(product.precio) * 100), subtotal = cents * item.cantidad;
        totalCents += subtotal; info.append(el('p', 'cart-unit-price', DR.money(product.precio) + ' / ' + product.unidad));
        if (Number(product.existencia) < item.cantidad) info.append(el('p', 'cart-stock-note', 'Entrega por confirmar: la cantidad supera la existencia actual.'));
        row.append(info);
        const quantity = el('div', 'cart-quantity'), input = el('input', 'form-control');
        input.type = 'number'; input.min = '1'; input.max = '999999'; input.step = '1'; input.value = String(item.cantidad);
        input.setAttribute('aria-label', 'Cantidad de ' + product.nombre);
        input.addEventListener('change', () => {
          if (!input.value || !input.checkValidity()) { input.reportValidity(); input.value = String(item.cantidad); return; }
          change(() => model.set(item.id_producto, Number(input.value)));
        });
        const minus = button('−', () => change(() => model.set(item.id_producto, item.cantidad - 1))), plus = button('+', () => change(() => model.add(item.id_producto)));
        minus.setAttribute('aria-label', 'Restar uno de ' + product.nombre); plus.setAttribute('aria-label', 'Sumar uno de ' + product.nombre);
        quantity.append(minus, input, plus); row.append(quantity, el('strong', 'cart-subtotal', DR.money(subtotal / 100)));
      } else {
        info.append(el('p', 'cart-stock-note', failures.get(item.id_producto) || 'Consultando producto…')); row.append(info);
      }
      const remove = button('Quitar', () => change(() => model.set(item.id_producto, 0))); remove.classList.add('cart-remove'); remove.setAttribute('aria-label', 'Quitar ' + (product?.nombre || 'producto #' + item.id_producto)); row.append(remove); body.append(row);
    }
    const complete = items.every(item => products.has(item.id_producto));
    footer.append(el('p', 'cart-total', 'Total estimado: ' + (complete ? DR.money(totalCents / 100) : 'pendiente de actualizar')),
      el('p', 'cart-help', 'El precio final se confirma antes de transferir. Agregar al carrito no reserva existencias.'));
    const actions = el('div', 'cart-actions');
    actions.append(button('Seguir explorando', close));
    if (failures.size) actions.append(button('Actualizar productos', load));
    const checkout = button(DR.user ? 'Continuar con mi pedido' : 'Iniciar sesión para continuar', async () => {
      const user = await DR.ready;
      if (!user) { location.assign('/login.html'); return; }
      if (user.rol !== 'Cliente') { status.textContent = 'Los pedidos del carrito requieren una cuenta de cliente. Para ventas en mostrador, utiliza Caja.'; return; }
      if (!window.OP?.createOrder) { location.assign('/cliente.html#carrito'); return; }
      const snapshot = model.items(); if (!snapshot.length) return;
      close();
      OP.createOrder({customer:true,initialDetails:snapshot,onSave:(result,details) => {
        model.consume(details || snapshot); updateCount();
        document.dispatchEvent(new CustomEvent('cart-order-saved', {detail:result}));
      }});
    }, true);
    checkout.disabled = loading || !complete; actions.append(checkout); footer.append(actions);
  }
  async function load() {
    if (!modal || loading) return;
    loading = true; const current = modal; products = new Map(); failures = new Map(); render();
    const items = model.items();
    for (let offset = 0; offset < items.length; offset += 5) {
      const batch = items.slice(offset, offset + 5);
      const results = await Promise.allSettled(batch.map(item => DR.request('/productos/' + item.id_producto)));
      if (modal !== current) return;
      results.forEach((result, index) => {
        const id = batch[index].id_producto;
        if (result.status === 'fulfilled' && result.value.producto) products.set(id, result.value.producto);
        else failures.set(id, result.reason?.status === 404 ? 'Ya no está disponible. Quítalo para continuar.' : 'No se pudo consultar este producto. Actualiza para volver a intentar.');
      });
    }
    loading = false; if (modal === current) render();
  }
  function open() {
    if (modal) return;
    const node = el('dialog', 'cart-dialog'), header = el('header', 'cart-heading'), title = el('h2', '', 'Tu carrito'); title.id = 'cart-title';
    node.setAttribute('aria-labelledby', title.id);
    const status = el('p', 'cart-status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    const body = el('div', 'cart-body'), footer = el('footer', 'cart-footer'); header.append(title, button('Cerrar', close));
    node.append(header, status, body, footer); document.body.append(node); modal = {node,body,footer,status};
    node.addEventListener('close', () => { modal = null; node.remove(); trigger.focus(); }, {once:true});
    node.showModal(); loading = false; load();
  }
  trigger.addEventListener('click', open);
  window.DRCart = {
    open,
    add(product) { change(() => model.add(product.id_producto)); DR.notify(product.nombre + ' se agregó al carrito.'); }
  };
  updateCount();
  DR.ready.then(() => { if (modal) render(); if (location.hash === '#carrito') open(); });
})();
