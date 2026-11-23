/* Confirmación del importe del servidor y referencias privadas. */
(() => {
  const { el, button, field, form, feedback, message, facts, dialog } = OP;
  const modalities = [{ value: 'Transferencia', label: 'Transferencia: pagar el 100 %' }, { value: 'Efectivo', label: 'Efectivo al recoger: transferir primero el 30 %' }];
  function bankFacts(bank) { return facts([['Banco', bank.banco], ['Titular', bank.titular], ['CLABE', bank.clabe], ['Instrucciones', bank.instrucciones || 'Usa tu referencia o clave de rastreo al enviar el pedido.']]); }
  function imagePicker() {
    const node = el('div', 'operation-wide'), upload = field('referencias', 'Imágenes de referencia (opcionales)', 'file', '', { accept: 'image/jpeg,image/png,image/webp', multiple: true }), preview = el('div', 'reference-previews'), status = feedback();
    let files = [], urls = [], validating = false;
    node.append(upload.wrap, el('p', 'operation-help', 'Hasta 3 imágenes JPG, PNG o WebP. Máximo 5 MB y 16 millones de píxeles por imagen. Solo tú y el personal podrán verlas.'), status, preview);
    function render() {
      urls.forEach(url => URL.revokeObjectURL(url)); urls = [];
      preview.replaceChildren(...files.map((file, index) => {
        const row = el('div', 'reference-preview'), image = el('img'); image.src = URL.createObjectURL(file); urls.push(image.src); image.alt = 'Vista previa de referencia ' + (index + 1);
        row.append(image, el('p', '', file.name), button('Quitar imagen ' + (index + 1), () => { files.splice(index, 1); render(); })); return row;
      }));
    }
    upload.input.addEventListener('change', async () => {
      const incoming = [...upload.input.files]; upload.input.value = '';
      validating = true; upload.input.disabled = true;
      try {
        if (files.length + incoming.length > 3) throw new Error('Puedes adjuntar hasta 3 imágenes. Quita una para elegir otra.');
        for (const file of incoming) {
          if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Elige imágenes JPG, PNG o WebP.');
          if (file.size > 5 * 1024 * 1024) throw new Error('Cada imagen debe pesar como máximo 5 MB.');
          let bitmap; try { bitmap = await createImageBitmap(file); } catch { throw new Error('No pudimos leer una imagen. Elige otro archivo válido.'); }
          const pixels = bitmap.width * bitmap.height; bitmap.close(); if (pixels > 16000000) throw new Error('Cada imagen puede tener como máximo 16 millones de píxeles.');
        }
        files.push(...incoming); message(status, ''); render();
      } catch (error) { message(status, error.message, true); }
      finally { validating = false; upload.input.disabled = false; }
    });
    node.values = () => { if (validating) throw new Error('Espera a que terminemos de comprobar las imágenes.'); return [...files]; }; node.dispose = () => urls.forEach(url => URL.revokeObjectURL(url)); return node;
  }
  function gallery(order) {
    const wrapper = el('div'), items = order.referencias || [];
    wrapper.append(el('h3', 'operation-subheading', 'Imágenes de referencia'));
    if (!items.length) { wrapper.append(el('p', 'operation-help', 'Sin imágenes adjuntas.')); return wrapper; }
    const grid = el('div', 'reference-gallery');
    items.forEach((item, index) => {
      // Solo URLs autenticadas generadas para este pedido; nunca rutas de archivos.
      const url = String(item.url || ''); if (!/^\/api\/pedidos\/\d+\/referencias\/\d+$/.test(url)) return;
      const link = el('a'), image = el('img'); image.src = url; image.loading = 'lazy'; image.alt = 'Referencia del pedido ' + (index + 1); link.href = url;
      link.addEventListener('click', event => { event.preventDefault(); const modal = dialog('Referencia ' + (index + 1)), full = el('img', 'reference-full'); full.src = url; full.alt = image.alt; modal.body.append(full, el('p', 'operation-description', order.descripcion_personalizada || 'Referencia del pedido.')); });
      image.addEventListener('error', () => link.replaceChildren(el('span', 'operation-help', 'No se pudo cargar esta referencia. Vuelve a abrir el pedido.')), { once: true }); link.append(image); grid.append(link);
    }); wrapper.append(grid); return wrapper;
  }
  async function transferCheckout(base, { order, onSave, customer = false } = {}) {
    const view = dialog(order ? 'Enviar referencia del pedido #' + order.id_pedido : 'Confirmar transferencia del pedido'), status = feedback(), summary = el('div', 'checkout-summary'); let preview = null, generation = 0;
    const editor = form([['modalidad_pago', 'Cómo pagarás tu pedido', 'select', order?.modalidad_pago || 'Transferencia', { required: true, choices: modalities }], ['referencia', 'Referencia o clave de rastreo de la transferencia', 'text', '', { required: true, maxLength: 100 }]], async data => {
      if (!preview || !preview.configuracion_bancaria?.configurada) throw new Error('Consulta primero los datos bancarios y el importe de la transferencia.');
      if (!await OP.confirmAction('¿Enviar la referencia de ' + DR.money(preview.importe_transferir) + '? El personal comprobará el ingreso antes de aceptar y preparar el pedido.')) return false;
      const payload = { ...base, ...data, ...(preview.autorizacion_pago ? { autorizacion_pago: preview.autorizacion_pago } : {}), config_version: preview.configuracion_bancaria.version, total_autorizado: preview.total, ...(!order && preview.cotizacion_checkout ? { cotizacion_checkout: preview.cotizacion_checkout } : {}) };
      if (order) { payload.id = order.id_pedido; payload.version = order.version; }
      try {
        const result = await OP.write(order ? 'enviarReferencia' : 'crearPedido', payload);
        if (!(Number(result.id || result.id_pedido || order?.id_pedido) > 0)) throw new Error('La confirmación del pedido está incompleta. Vuelve a intentar la misma referencia.');
        view.close(); onSave?.(result); DR.notify('Referencia enviada. El pedido está pendiente de validación; todavía no se ha registrado un pago.');
        if (!order) await OP.orderDetail(result.id || result.id_pedido, { customer });
      } catch (error) {
        if (error.reconfirmarImporte) { await prepare(); throw new Error(error.message + ' Revisa los importes actualizados y confirma de nuevo.'); }
        throw error;
      }
    }, { label: 'Enviar referencia para validación' });
    editor.controls.referencia.autocomplete = 'off';
    editor.querySelector('.operation-fields').after(summary, status, button('Actualizar importe y datos bancarios', () => prepare()));
    view.body.append(el('p', 'operation-help', 'Transfiere fuera de la aplicación. La referencia enviada será revisada por el personal; no confirma un ingreso por sí sola.'), editor);
    async function prepare() {
      const current = ++generation; preview = null; editor.submitButton.disabled = true; editor.controls.referencia.disabled = true; message(status, 'Calculando el importe y consultando la cuenta…');
      try {
        const value = await OP.prepareOrder({ ...(order ? { id: order.id_pedido } : { detalles: base.detalles }), modalidad_pago: editor.controls.modalidad_pago.value });
        if (current !== generation) return;
        const bank = value.configuracion_bancaria;
        if (!bank || !bank.configurada || !bank.version) throw new Error('La cuenta bancaria aún no está configurada. Solicita al personal que complete la configuración para poder enviar tu referencia.');
        if (![value.total, value.importe_transferir, value.saldo_posterior].every(item => item !== null && item !== undefined && Number.isFinite(Number(item)))) throw new Error('El servidor no devolvió el importe completo. Vuelve a consultar antes de transferir.');
        preview = value;
        summary.replaceChildren(el('h3', '', 'Importes confirmados por la pastelería'), facts([['Total del pedido', DR.money(value.total)], [editor.controls.modalidad_pago.value === 'Efectivo' ? 'Anticipo por transferencia (30 %)' : 'Transferencia total (100 %)', DR.money(value.importe_transferir)], ['Saldo en efectivo al recoger', DR.money(value.saldo_posterior)]]), el('h3', '', 'Cuenta para esta transferencia'), bankFacts(bank));
        message(status, 'Revisa el destino y el importe antes de transferir.'); editor.submitButton.disabled = false; editor.controls.referencia.disabled = false;
      } catch (error) {
        if (current !== generation) return; summary.replaceChildren(); message(status, error.message, true);
        if (DR.user?.rol === 'Administrador') { const link = el('a', 'text-link', 'Configurar cuenta bancaria'); link.href = '#configuracion-bancaria'; link.addEventListener('click', () => view.close()); summary.append(link); }
      }
    }
    editor.controls.modalidad_pago.addEventListener('change', () => { editor.controls.referencia.value = ''; prepare(); }); await prepare(); return view;
  }
  async function createOrder({ customer = false, personalized = false, product, initialDetails = [], onSave } = {}) {
    const view = dialog(personalized ? 'Solicitar un personalizado' : 'Nuevo pedido del catálogo'), status = feedback(); view.body.append(status); message(status, 'Preparando formulario…');
    try {
      const products = personalized ? [] : customer ? await OP.catalogProducts() : (await OP.all('productos')).filter(item => Number(item.activo)), picker = customer ? null : await OP.chooseClient(true), entries = personalized ? null : OP.lines(products, { initial: initialDetails.length ? initialDetails : product ? [{ id_producto: product.id_producto, cantidad: '1' }] : [] }), images = personalized ? imagePicker() : null;
      const fields = [['fecha_solicitada', 'Fecha y hora solicitadas de recogida', 'datetime-local', '', { required: true }], ['observaciones', 'Observaciones', 'textarea', '', { maxLength: 255, wide: true }]];
      if (personalized) fields.unshift(['descripcion_personalizada', 'Describe el encargo completo', 'textarea', '', { required: true, maxLength: 1000, wide: true, help: 'Incluye tamaño, porciones, sabores y detalles de decoración.' }]);
      const editor = form(fields, async data => {
        const idCliente = picker?.value(), payload = { ...data, tipo: personalized ? 'Personalizado' : 'Catalogo', ...(idCliente ? { id_cliente: idCliente } : {}), ...(entries ? { detalles: entries.values() } : {}) };
        if (!personalized) { await transferCheckout(payload, { customer, onSave: result => { view.close(); onSave?.(result, payload.detalles); } }); return false; }
        const result = await OP.multipartWrite('/pedidos-personalizados', payload, images.values()); view.close(); onSave?.(); DR.notify('Solicitud enviada para cotizar. No necesitas pagar antes de conocer y aceptar el precio.'); await OP.orderDetail(result.id || result.id_pedido, { customer });
      }, { label: personalized ? 'Enviar solicitud para cotizar' : 'Consultar importe e instrucciones de pago' });
      editor.prepend(el('p', 'operation-help', personalized ? 'Primero recibirás una cotización. Después de aceptar el precio, podrás elegir el pago y enviar tu referencia.' : 'Transferencia total: 100 %. Efectivo al recoger: anticipo del 30 % por transferencia y saldo en efectivo. La fecha será confirmada por el personal.'));
      if (picker) editor.prepend(picker); if (entries) editor.querySelector('.operation-fields').before(entries); if (images) { editor.querySelector('.operation-fields').append(images); view.node.addEventListener('close', images.dispose, { once: true }); }
      status.remove(); view.body.append(editor);
    } catch (error) { message(status, error.message, true); }
  }
  async function replaceImages(order, reload) {
    const view = dialog('Corregir imágenes de referencia'), images = imagePicker();
    const editor = form([['vaciar_referencias', 'Quitar todas las referencias actuales', 'checkbox', 0]], async data => {
      const files = images.values(); if (!files.length && !data.vaciar_referencias) throw new Error('Elige imágenes nuevas o indica que quieres quitar las actuales.');
      if (files.length && data.vaciar_referencias) throw new Error('Para reemplazar las imágenes, desmarca quitar todas.');
      await OP.multipartWrite('/pedidos/' + order.id_pedido + '/referencias', { version: order.version, vaciar_referencias: data.vaciar_referencias }, files, 'PUT'); view.close(); await reload();
    }, { label: 'Guardar referencias', confirm: '¿Reemplazar la galería actual? Se conservará su historial.' });
    editor.prepend(el('p', 'operation-help', 'Estas imágenes reemplazarán las actuales. Solo se permite antes de que el personal cotice.'), images); view.body.append(editor); view.node.addEventListener('close', images.dispose, { once: true });
  }
  OP.createOrder = createOrder; OP.transferCheckout = transferCheckout; OP.referenceGallery = gallery; OP.replaceOrderImages = replaceImages; OP.bankFacts = bankFacts;
})();
