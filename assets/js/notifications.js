/* Avisos propios de la sesión. No se envían identificadores de destinatario. */
(() => {
  const { el, button, read, write, message, feedback, date, section, form } = OP;
  const views = new Set(); let loading = false, unread = 0;
  function count(value) {
    unread = Number(value) || 0;
    document.querySelectorAll('[data-notification-bell]').forEach(node => {
      node.setAttribute('aria-label', 'Notificaciones: ' + unread + ' sin leer');
      const badge = node.querySelector('[data-notification-count]'); badge.textContent = unread > 99 ? '99+' : String(unread); badge.hidden = !unread;
    });
  }
  function mount(host) {
    const pane = section('Notificaciones', document.body.dataset.page === 'admin' ? 'Pedidos, entregas, ventas y compras de la pastelería.' : document.body.dataset.page === 'trabajador' ? 'Pedidos nuevos y novedades de los pedidos que atiendes.' : 'Cotizaciones, pagos y cambios de tus pedidos.'), status = feedback(), content = el('div', 'notification-list'), tools = el('div', 'operation-actions'), pager = el('div', 'operation-pager'), label = el('span');
    let page = 1, token = 0, fingerprint = '';
    const previous = button('Anterior', () => { page--; load(); }), next = button('Siguiente', () => { page++; load(); });
    const allRead = button('Marcar todas como leídas', async () => {
      allRead.disabled = true;
      try { await write('leerTodasNotificaciones', {}); await refresh(); }
      catch (error) { message(status, error.message, true); } finally { allRead.disabled = false; }
    });
    tools.append(button('Actualizar avisos', () => load()), allRead); pager.append(previous, label, next); pane.append(tools, status, content, pager); host.append(pane);
    async function load({ silent = false } = {}) {
      const requestToken = ++token; if (!silent) message(status, 'Consultando notificaciones…');
      content.setAttribute('aria-busy', 'true');
      try {
        const data = await read('notificaciones', { pagina: page, limite: 20 }); if (requestToken !== token || !pane.isConnected) return;
        count(data.no_leidas); allRead.disabled = !unread;
        const nextFingerprint = JSON.stringify({ page, data });
        if (fingerprint === nextFingerprint) { message(status, ''); return; }
        fingerprint = nextFingerprint;
        const nodes = data.items.map(item => {
          const row = el('article', Number(item.leida) ? 'notification-item' : 'notification-item notification-unread');
          const heading = el('h3', '', item.titulo), text = el('p', '', item.texto), meta = el('p', 'operation-help', date(item.fecha) + ' · ' + (Number(item.leida) ? 'Leída' : 'Sin leer')), actions = el('div', 'operation-actions');
          const entity = item.entidad || 'Pedido', source = item.id_origen || item.id_pedido;
          const category = entity === 'Venta' ? 'Ventas' : entity === 'Compra' ? 'Compras' : (item.tipo === 'Entrega' || item.titulo === 'Pedido listo para recoger') ? 'Entregas' : 'Pedidos';
          meta.textContent = category + ' · ' + meta.textContent;
          const link = el('a', 'text-link', 'Ver ' + entity.toLowerCase() + ' #' + source);
          link.href = entity === 'Venta' ? '#ventas' : entity === 'Compra' ? '#compras' : (document.body.dataset.page === 'cliente' ? '#mis-pedidos' : '#pedidos') + '?pedido=' + encodeURIComponent(source);
          async function mark() { if (!Number(item.leida)) await write('leerNotificacion', { id: item.id_notificacion }); }
          link.addEventListener('click', async event => {
            event.preventDefault(); link.setAttribute('aria-disabled', 'true');
            try {
              await mark();
              if(entity === 'Venta') OP.receipt(await read('ventas', {id:source}));
              else if(entity === 'Compra') await OP.purchaseDetail(source);
              else await OP.orderDetail(source, {customer:document.body.dataset.page === 'cliente'});
              await refresh();
            } catch(error) { message(status,error.message,true); }
            finally { link.removeAttribute('aria-disabled'); }
          });
          actions.append(link);
          if (!Number(item.leida)) actions.append(button('Marcar como leída', async event => { const control = event.currentTarget; control.disabled = true; try { await mark(); await refresh(); } catch (error) { message(status, error.message, true); control.disabled = false; } }));
          row.append(heading, text, meta, actions); return row;
        });
        content.replaceChildren(...(nodes.length ? nodes : [el('p', 'operation-empty', 'Todavía no tienes notificaciones. Aquí aparecerán las novedades de tus pedidos.')]));
        const pages = Math.max(1, Math.ceil(data.total / data.limite)); label.textContent = 'Página ' + page + ' de ' + pages; previous.disabled = page <= 1; next.disabled = page >= pages; pager.hidden = pages <= 1;
        message(status, '');
      } catch (error) { if (requestToken === token) message(status, error.message, true); }
      finally { if (requestToken === token) content.removeAttribute('aria-busy'); }
    }
    const view = { host: pane, load }; views.add(view); load(); return view;
  }
  async function refresh() {
    if (document.hidden || loading || !DR.user) return;
    loading = true;
    try {
      for (const view of views) if (!view.host.isConnected) views.delete(view);
      if (views.size) await Promise.all([...views].map(view => view.load({ silent: true })));
      else count((await read('notificaciones', { limite: 1 })).no_leidas);
    } catch (error) { document.querySelectorAll('[data-notification-bell]').forEach(node => { node.title = error.message; node.setAttribute('aria-label', 'Notificaciones: no se pudo actualizar. Abre la sección para reintentar.'); }); }
    finally { loading = false; }
  }
  async function bank(host) {
    const pane = section('Configuración bancaria', 'Captura la cuenta real que deben usar los clientes. Cada cambio se aplica a nuevas referencias; los intentos enviados conservan su destino original.'), status = feedback(); host.append(pane); pane.append(status); message(status, 'Consultando configuración…');
    try {
      const data = await read('configuracionBancaria'); message(status, data.configurada ? 'Cuenta configurada. Revisa los datos antes de guardar una nueva versión.' : 'No hay cuenta configurada. Los pedidos de catálogo y los envíos de referencia necesitan estos datos. Las solicitudes personalizadas pueden cotizarse.');
      const editor = form([['banco', 'Banco', 'text', data.banco || '', { required: true, maxLength: 100 }], ['titular', 'Titular de la cuenta', 'text', data.titular || '', { required: true, maxLength: 100 }], ['clabe', 'CLABE de 18 dígitos', 'text', data.clabe || '', { required: true, minLength: 18, maxLength: 18, pattern: '[0-9]{18}', autocomplete: 'off' }], ['instrucciones', 'Instrucciones adicionales', 'textarea', data.instrucciones || '', { maxLength: 255, wide: true }]], async values => { await write('guardarConfiguracionBancaria', { ...values, version: data.version }); host.replaceChildren(); await bank(host); }, { label: 'Guardar datos bancarios', confirm: '¿Guardar estos datos bancarios para los próximos pagos?' });
      editor.controls.clabe.inputMode = 'numeric'; pane.append(editor);
    } catch (error) { message(status, error.message, true); pane.append(button('Volver a intentar', () => { host.replaceChildren(); bank(host); })); }
  }
  let openedHash = '';
  async function openOrderFromHash() {
    const hash = location.hash; if (hash === openedHash) return;
    const query = new URLSearchParams(hash.split('?')[1] || ''), id = query.get('pedido'); if (!/^\d+$/.test(id || '')) return;
    openedHash = hash;
    try { if (/^\d+$/.test(query.get('aviso') || '')) await write('leerNotificacion', { id: query.get('aviso') }); await OP.orderDetail(id, { customer: document.body.dataset.page === 'cliente' }); }
    catch (error) { openedHash = ''; DR.notify(error.message); }
  }
  OP.notifications = { mount, refresh, bank, openOrderFromHash };
  DR.ready.then(user => {
    if (!user || !['Administrador', 'Trabajador', 'Cliente'].includes(user.rol)) return;
    const target = document.querySelector('.topbar-end') || document.querySelector('.header-inner');
    if (target) {
      const bell = el('a', 'notification-bell'); bell.href = '#notificaciones'; bell.dataset.notificationBell = '';
      const icon = el('i', 'ti ti-bell'); icon.setAttribute('aria-hidden', 'true'); const badge = el('span', 'notification-count', '0'); badge.dataset.notificationCount = ''; badge.hidden = true; badge.setAttribute('aria-hidden', 'true'); bell.append(icon, badge);
      if (target.classList.contains('header-inner')) target.insertBefore(bell, target.querySelector('.header-account')); else target.prepend(bell); count(0);
    }
    const host = document.querySelector('[data-customer-notifications]'); if (host) { mount(host); openOrderFromHash(); window.addEventListener('hashchange', openOrderFromHash); }
    refresh(); setInterval(refresh, 15000);
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); }); document.addEventListener('operation-saved', refresh);
  });
})();
