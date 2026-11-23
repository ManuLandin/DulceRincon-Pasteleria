/* Componentes de operación compartidos. Todo el contenido de la API se inserta como texto. */
(() => {
  const el = DR.element;
  let sequence = 0;
  const privatePending = new Map();
  const parseDate = value => new Date(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(value) ? value.replace(' ', 'T') + '-06:00' : value);
  const date = value => value ? new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Mexico_City' }).format(parseDate(value)) : 'Sin confirmar';
  const state = value => ({ 'En progreso': 'En preparación', Despachado: 'Entregado', Recibida: 'Entregada' }[value] || value || '—');
  const button = (label, handler, primary = false) => { const node = el('button', primary ? 'btn-rose' : 'btn-outline-rose', label); node.type = 'button'; if (handler) node.addEventListener('click', handler); return node; };
  async function read(resource, query = {}) { return (await DR.request('/operacion?' + new URLSearchParams({ recurso: resource, ...query }))).datos; }
  async function previewSale(detalles) { return resultOf(await DR.request('/operacion', { method: 'POST', body: { accion: 'prepararVenta', datos: { detalles } } })); }
  async function prepareOrder(data) { return resultOf(await DR.request('/operacion', { method: 'POST', body: { accion: 'prepararPedido', datos: data } })); }
  async function multipartWrite(path, data, files, method = 'POST') {
    const hashes = await Promise.all(files.map(async file => [...new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()))].map(byte => byte.toString(16).padStart(2, '0')).join('')));
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify({ usuario: DR.user?.id_usuario, path, method, data, hashes })));
    const fingerprint = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
    const previous = pendingRead()[fingerprint], entry = previous || { clave: crypto.randomUUID() };
    pendingUpdate(fingerprint, entry);
    const body = new FormData(); body.set('datos', JSON.stringify(data)); body.set('clave', typeof entry === 'string' ? entry : entry.clave);
    files.forEach(file => body.append('referencias', file));
    const result = resultOf(await DR.request(path, { method, body }));
    if (!(Number(result.id || result.id_pedido) > 0) || !(Number(result.version) > 0) || !Array.isArray(result.referencias) || result.referencias.length !== files.length || result.referencias.some(item => !(Number(item.id_referencia) > 0) || !item.url)) throw new Error('La respuesta de las referencias está incompleta. Reintenta con las mismas imágenes para recuperar el pedido.');
    pendingUpdate(fingerprint, undefined);
    document.dispatchEvent(new CustomEvent('operation-saved', { detail: { action: method === 'POST' ? 'crearPedido' : 'reemplazarReferencias', result } }));
    return result;
  }
  async function all(resource, query = {}) {
    const result = []; let page = 1, data;
    do { data = await read(resource, { ...query, pagina: page++ }); result.push(...(data.items || [])); } while (result.length < data.total && data.items?.length);
    return result;
  }
  // Una respuesta incompleta nunca confirma el cobro ni descarta su clave.
  function pendingRead() { try { return JSON.parse(sessionStorage.getItem('dr-operaciones-pendientes') || '{}'); } catch { return {}; } }
  function pendingUpdate(fingerprint, entry) { const current = pendingRead(); if (entry === undefined) delete current[fingerprint]; else current[fingerprint] = entry; sessionStorage.setItem('dr-operaciones-pendientes', JSON.stringify(current)); }
  function resultOf(response, action) {
    const data = response?.datos;
    if (!data || typeof data !== 'object' || Array.isArray(data) || (['crearPedido', 'enviarReferencia', 'revisarTransferencia'].includes(action) && (!(Number(data.id || data.id_pedido) > 0) || !(Number(data.version) > 0) || !Number.isInteger(Number(data.version))))) throw new Error('La respuesta de la operación está incompleta. Vuelve a intentar para recuperar el mismo folio.');
    return data;
  }
  async function write(action, data) {
    const scope = DR.user?.id_usuario || 'sesion';
    const serialized = JSON.stringify({ usuario: scope, accion: action, datos: data });
    if (action === 'guardarTrabajador' && data.contrasena) {
      const key = privatePending.get(serialized) || crypto.randomUUID(); privatePending.set(serialized, key);
      const result = resultOf(await DR.request('/operacion', { method: 'POST', body: { accion: action, datos: data, clave: key } }));
      privatePending.delete(serialized); document.dispatchEvent(new CustomEvent('operation-saved', { detail: { action, result } })); return result;
    }
    const authorized = ['vender', 'crearPedido', 'enviarReferencia'].includes(action);
    const intent = { ...data }; if (authorized) delete intent.total_autorizado;
    if (['crearPedido', 'enviarReferencia'].includes(action)) { delete intent.config_version; delete intent.autorizacion_pago; }
    if (action === 'crearPedido') delete intent.cotizacion_checkout;
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify({ usuario: scope, accion: action, datos: intent })));
    const fingerprint = [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
    const previous = pendingRead()[fingerprint];
    const entry = previous ? (typeof previous === 'string' ? { clave: previous, total_autorizado: data.total_autorizado, config_version: data.config_version, cotizacion_checkout: data.cotizacion_checkout, autorizacion_pago: data.autorizacion_pago } : previous) : { clave: crypto.randomUUID(), ...(authorized ? { total_autorizado: data.total_autorizado, ...(data.autorizacion_pago !== undefined ? { autorizacion_pago: data.autorizacion_pago } : {}), ...(data.config_version !== undefined ? { config_version: data.config_version } : {}), ...(data.cotizacion_checkout !== undefined ? { cotizacion_checkout: data.cotizacion_checkout } : {}) } : {}) };
    pendingUpdate(fingerprint, entry);
    const payload = authorized ? { ...data, total_autorizado: entry.total_autorizado, ...(entry.autorizacion_pago !== undefined ? { autorizacion_pago: entry.autorizacion_pago } : {}), ...(entry.config_version !== undefined ? { config_version: entry.config_version } : {}), ...(entry.cotizacion_checkout !== undefined ? { cotizacion_checkout: entry.cotizacion_checkout } : {}) } : data;
    try {
      const result = resultOf(await DR.request('/operacion', { method: 'POST', body: { accion: action, datos: payload, clave: entry.clave } }), action);
      pendingUpdate(fingerprint, undefined);
      document.dispatchEvent(new CustomEvent('operation-saved', { detail: { action, result } })); return result;
    } catch (error) {
      // Solo el servidor puede certificar que el precio cambió antes de confirmar.
      if (error.reconfirmarImporte) pendingUpdate(fingerprint, undefined);
      throw error;
    }
  }
  function message(node, text, error = false) { node.textContent = text; node.hidden = !text; node.classList.toggle('operation-error', error); node.setAttribute('role', error ? 'alert' : 'status'); }
  function feedback() { const node = el('p', 'operation-feedback'); node.hidden = true; node.setAttribute('aria-live', 'polite'); return node; }
  function field(name, label, type = 'text', value = '', options = {}) {
    const wrap = el('div', options.wide ? 'operation-field operation-wide' : 'operation-field');
    const id = 'operation-field-' + (++sequence), caption = el('label', 'form-label', label); caption.htmlFor = id;
    const input = el(type === 'textarea' ? 'textarea' : type === 'select' ? 'select' : 'input', 'form-control'); input.name = name; input.id = id;
    if (!['select', 'textarea'].includes(type)) input.type = type;
    if (type === 'select') for (const option of options.choices || []) { const item = el('option', '', option.label ?? option); item.value = option.value ?? option; input.append(item); }
    if (type === 'checkbox') { input.className = 'form-check-input'; input.checked = Boolean(Number(value)); }
    else input.value = value ?? '';
    if (type === 'textarea') input.rows = options.rows || 3;
    for (const key of ['required', 'min', 'max', 'step', 'maxLength', 'minLength', 'disabled', 'placeholder', 'autocomplete', 'accept', 'multiple', 'pattern']) if (options[key] !== undefined) input[key] = options[key];
    wrap.append(caption, input);
    if (type === 'datetime-local') {
      input.type = 'hidden'; input.required = false;
      const controls = el('div', 'pickup-controls pickup-dropdowns'), day = el('input', 'form-control'), hour = el('select', 'form-control'), minute = el('select', 'form-control');
      day.type = 'date'; day.id = id + '-day'; caption.htmlFor = day.id;
      day.setAttribute('aria-label', label + ': fecha'); hour.setAttribute('aria-label', label + ': hora'); minute.setAttribute('aria-label', label + ': minutos');
      day.required = hour.required = minute.required = Boolean(options.required);
      const parts = String(value || '').split('T'), originalHour = (parts[1] || '').slice(0, 2);
      const placeholder = el('option', '', 'Hora'); placeholder.value = ''; hour.append(placeholder);
      const hours = Array.from({length:11}, (_, index) => String(index + 10));
      if (originalHour && !hours.includes(originalHour)) hours.unshift(originalHour);
      for (const number of hours) { const option = el('option', '', number + ' h'); option.value = number; hour.append(option); }
      for (let index = 0; index < 60; index++) { const number = String(index).padStart(2, '0'), option = el('option', '', number + ' min'); option.value = number; minute.append(option); }
      day.value = parts[0] || ''; hour.value = originalHour || ''; minute.value = (parts[1] || '').slice(3, 5) || '00';
      function sync() {
        input.value = day.value && hour.value && minute.value ? day.value + 'T' + hour.value + ':' + minute.value : '';
        const unchanged = options.allowUnchanged && input.value === String(value || '').slice(0, 16);
        for (const option of minute.children) option.disabled = !unchanged && hour.value === '20' && option.value !== '00';
        const time = hour.value + ':' + minute.value;
        const invalid = !unchanged && hour.value && (time < '10:00' || time > '20:00');
        hour.setCustomValidity(invalid ? 'Selecciona una hora de recogida entre 10:00 y 20:00.' : '');
        day.setCustomValidity(!unchanged && input.value && new Date(input.value + '-06:00').getTime() <= Date.now() ? 'Elige una fecha y hora futuras para recoger.' : '');
      }
      day.addEventListener('input', sync); day.addEventListener('change', sync); minute.addEventListener('change', sync);
      hour.addEventListener('change', () => { if (hour.value === '20') minute.value = '00'; sync(); }); sync();
      controls.append(day, hour, minute); wrap.append(controls, el('small', 'operation-help', 'Elige la fecha en el calendario y selecciona hora y minutos. Recogida de 10:00 a 20:00, hora de Ciudad de México.'));
    }
    if (options.help) wrap.append(el('small', 'operation-help', options.help));
    return { wrap, input };
  }
  function form(fields, save, { label = 'Guardar cambios', confirm, initial = {}, close, success = 'Operación registrada correctamente.' } = {}) {
    const node = el('form', 'operation-form'), grid = el('div', 'operation-fields'), status = feedback(), submit = el('button', 'btn-rose', label); submit.type = 'submit'; node.method = 'post'; node.action = '/api/operacion';
    const inputs = {};
    for (const item of fields) { const control = field(...item); grid.append(control.wrap); inputs[item[0]] = control.input; }
    node.append(grid, status, submit); if (close) node.append(button('Cancelar', close));
    node.addEventListener('submit', async event => {
      event.preventDefault(); if (!node.reportValidity()) return;
      const data = { ...initial }; for (const [key, input] of Object.entries(inputs)) data[key] = input.type === 'checkbox' ? input.checked : input.value;
      submit.disabled = true;
      try {
        if (confirm && !await confirmAction(typeof confirm === 'function' ? confirm(data) : confirm)) return;
        message(status, 'Guardando…');
        const result = await save(data, node); message(status, result === false ? '' : success); }
      catch (error) { message(status, error.message, true); }
      finally { submit.disabled = false; }
    });
    node.controls = inputs; node.feedback = status; node.submitButton = submit; return node;
  }
  function dialog(title) {
    const node = el('dialog', 'operation-dialog'), header = el('div', 'operation-dialog-header'), heading = el('h2', '', title), body = el('div', 'operation-dialog-body');
    heading.id = 'operation-dialog-' + (++sequence); node.setAttribute('aria-labelledby', heading.id);
    const close = button('Cerrar', () => node.close()); close.classList.add('operation-dialog-close'); header.append(heading, close); node.append(header, body); document.body.append(node);
    node.addEventListener('close', () => node.remove(), { once: true }); node.showModal(); return { node, body, title: heading, close: () => node.close() };
  }
  function confirmAction(text) {
    const view = dialog('Confirmar operación'); let accepted = false;
    return new Promise(resolve => {
      view.body.append(el('p', 'operation-description', text), button('Cancelar', () => view.close()), button('Confirmar', () => { accepted = true; view.close(); }, true));
      view.node.addEventListener('close', () => resolve(accepted), { once: true });
    });
  }
  function table(columns, rows, caption) {
    const wrap = el('div', 'operation-table-wrap'), node = el('table', 'operation-table'), head = el('thead'), tr = el('tr'), body = el('tbody');
    const title = el('caption', 'visually-hidden', caption || 'Registros'); node.append(title);
    columns.forEach(column => { const th = el('th', '', column.label); th.scope = 'col'; tr.append(th); }); head.append(tr);
    for (const row of rows) { const line = el('tr'); for (const column of columns) { const cell = el('td'); const value = column.render ? column.render(row) : row[column.key]; if (value instanceof Node) cell.append(value); else cell.textContent = value ?? '—'; line.append(cell); } body.append(line); }
    node.append(head, body); wrap.append(node); return wrap;
  }
  function facts(data) { const list = el('dl', 'operation-facts'); for (const [label, value] of data) { list.append(el('dt', '', label), el('dd', '', value ?? '—')); } return list; }
  function section(title, description) { const node = el('section', 'operation-panel'), heading = el('div', 'operation-heading'); heading.append(el('h2', '', title)); if (description) heading.append(el('p', '', description)); node.append(heading); return node; }
  function list(host, resource, columns, { title = 'Registros', query = {}, filters = [], tools = [] } = {}) {
    const toolbar = el('form', 'operation-toolbar'), search = field('buscar', 'Buscar ' + title.toLowerCase(), 'search', '', { maxLength: 100, placeholder: 'Nombre, correo o folio' }), filterNodes = {};
    toolbar.append(search.wrap);
    for (const item of filters) { const control = field(...item); filterNodes[item[0]] = control.input; toolbar.append(control.wrap); }
    const find = el('button', 'btn-outline-rose', 'Buscar'); find.type = 'submit'; toolbar.append(find, ...tools);
    const status = feedback(), content = el('div'), pager = el('div', 'operation-pager'), label = el('span'); pager.hidden = true; let page = 1, token = 0;
    const previous = button('Anterior', () => { page--; load(); }), next = button('Siguiente', () => { page++; load(); }); pager.append(previous, label, next); host.append(toolbar, status, content, pager);
    async function load() {
      const current = ++token; message(status, 'Cargando registros…'); content.setAttribute('aria-busy', 'true'); pager.hidden = true;
      try {
        const params = { ...query, buscar: search.input.value.trim(), pagina: String(page) }; for (const [key, input] of Object.entries(filterNodes)) if (input.value) params[key] = input.value;
        const data = await read(resource, params); if (current !== token) return;
        content.replaceChildren(data.items.length ? table(columns, data.items, title) : el('p', 'operation-empty', params.buscar ? 'No hay coincidencias. Prueba con otra búsqueda.' : 'Todavía no hay registros.'));
        message(status, data.total + ' registros'); const pages = Math.max(1, Math.ceil(data.total / data.limite)); label.textContent = `Página ${page} de ${pages}`; previous.disabled = page <= 1; next.disabled = page >= pages; pager.hidden = pages <= 1;
      } catch (error) { if (current === token) { message(status, error.message, true); content.replaceChildren(button('Volver a intentar', load)); pager.hidden = true; } }
      finally { if (current === token) content.removeAttribute('aria-busy'); }
    }
    toolbar.addEventListener('submit', event => { event.preventDefault(); page = 1; load(); });
    load(); return { load, search: search.input };
  }
  function lines(items, { ingredient = false, price = false, initial = [], label = 'Agregar artículo' } = {}) {
    const node = el('div', 'operation-lines'), rows = el('div'), add = button(label, () => addRow());
    node.append(rows, add);
    function addRow(value = {}) {
      const row = el('div', 'operation-line'), key = ingredient ? 'id_ingrediente' : 'id_producto';
      const selection = field(key, ingredient ? 'Ingrediente · unidad' : 'Producto · precio', 'select', value[key], { required: true, choices: [{ value: '', label: 'Selecciona…' }, ...items.map(item => ({ value: item[key], label: item.nombre + (ingredient ? ' · ' + item.unidad : ' · ' + DR.money(item.precio)) }))] });
      const quantity = field('cantidad', 'Cantidad', 'number', value.cantidad || '1', { min: ingredient ? '0.001' : '1', step: ingredient ? '0.001' : '1', required: true }); row.append(selection.wrap, quantity.wrap);
      let cost; if (price) { cost = field('precio_unitario', 'Precio por unidad (MXN)', 'number', value.precio_unitario || '0.00', { min: '0', step: '0.01', required: true }); row.append(cost.wrap); }
      const remove = button('Quitar', () => { row.remove(); node.dispatchEvent(new Event('change', { bubbles: true })); }); row.append(remove); rows.append(row);
      row.values = () => ({ [key]: selection.input.value, cantidad: quantity.input.value, ...(cost ? { precio_unitario: cost.input.value } : {}) });
      node.dispatchEvent(new Event('change', { bubbles: true }));
    }
    (initial.length ? initial : [{}]).forEach(addRow);
    node.values = () => { const values = [...rows.children].map(row => row.values()); if (!values.length) throw new Error('Agrega al menos un artículo.'); if (new Set(values.map(item => item.id_ingrediente || item.id_producto)).size !== values.length) throw new Error('Agrupa cada artículo en una sola línea.'); return values; };
    return node;
  }
  function paymentFields(amount = '', { cashOnly = false } = {}) { return [['importe', 'Importe (MXN)', 'number', amount, { required: true, min: '0.01', step: '0.01' }], ['metodo_pago', 'Método de pago', 'select', 'Efectivo', { choices: cashOnly ? ['Efectivo'] : ['Efectivo', 'Transferencia'], required: true }], ['referencia', 'Referencia de transferencia', 'text', '', { maxLength: 100, help: cashOnly ? 'El saldo se recibe en efectivo.' : 'Obligatoria si el pago es por transferencia.' }]]; }
  function receipt(data, title = 'Comprobante de venta') {
    const view = dialog(title), body = el('article', 'operation-receipt');
    body.append(el('h3', '', 'Dulce Rincón'), el('p', '', 'Comprobante interno · MXN'), facts([['Folio', data.folio || '#' + (data.id_venta || data.id)], ['Fecha', date(data.fecha)], ['Operador', data.operador || data.nombre_operador], ['Cliente', data.cliente || 'Público general'], ['Total', DR.money(data.total)], ['Método', data.metodo_pago]]));
    body.append(table([{ key: 'nombre', label: 'Artículo' }, { key: 'cantidad', label: 'Cantidad' }, { label: 'Precio', render: item => DR.money(item.precio_unitario) }, { label: 'Subtotal', render: item => DR.money(item.subtotal) }], data.detalles || [], 'Artículos vendidos'));
    if (data.pagos?.length) body.append(el('h3', '', 'Pagos registrados'), table([{ label: 'Fecha', render: row => date(row.fecha) }, { label: 'Importe', render: row => DR.money(row.importe) }, { key: 'metodo_pago', label: 'Método' }, { key: 'referencia', label: 'Referencia' }], data.pagos));
    view.body.append(body, button('Imprimir comprobante', () => window.print())); return view;
  }
  window.OP = { confirmAction, el, previewSale, prepareOrder, multipartWrite, date, parseDate, state, button, read, all, write, message, feedback, field, form, dialog, table, facts, section, list, lines, paymentFields, receipt };
})();
