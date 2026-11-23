(() => {
  const { el, button, read, all, write, message, feedback, field, form, dialog, table, facts, lines, date, state } = OP;
  function historyText(value) {
    let detail = value;
    if (typeof detail === 'string') { try { detail = JSON.parse(detail); } catch { return detail; } }
    const captions = { tipo: 'Tipo', fecha_solicitada: 'Fecha solicitada', fecha_entrega: 'Entrega', total: 'Total', nota: 'Nota', estado: 'Estado', motivo_retraso: 'Motivo del cambio de fecha', motivo: 'Motivo', importe: 'Importe', metodo_pago: 'Método', referencia: 'Referencia', devolucion: 'Devolución', id_trabajador: 'Responsable', id_venta: 'Venta', cotizacion_version: 'Cotización', consumo: 'Ingredientes utilizados' };
    return Object.entries(detail || {}).map(([key, item]) => {
      let text = item ?? 'Sin confirmar';
      if (key.startsWith('fecha_')) text = date(item);
      else if (['total', 'importe', 'devolucion'].includes(key) && item !== null) text = DR.money(item);
      else if (key === 'estado') text = state(item);
      else if (key === 'consumo' && Array.isArray(item)) text = item.map(line => 'Ingrediente #' + line.id_ingrediente + ': ' + line.cantidad).join(', ');
      else if (typeof item === 'object' && item) text = JSON.stringify(item);
      return (captions[key] || key) + ': ' + text;
    }).join(' · ');
  }
  async function chooseClient(required = false) {
    const wrap = el('div', 'operation-client-picker'), label = field('cliente_buscar', required ? 'Buscar cliente por correo (obligatorio)' : 'Asociar cliente por correo (opcional)', 'search', '', { maxLength: 100 }), results = el('div'), selected = el('p', 'operation-help', required ? 'Selecciona una cuenta de cliente.' : 'Venta al público general'), status = feedback();
    let client = null;
    const search = button('Buscar cliente', async () => {
      if (!label.input.value.trim()) { message(status, 'Escribe un nombre o correo para buscar.', true); return; }
      search.disabled = true;
      try {
        const data = await read('clientes', { buscar: label.input.value.trim() });
        results.replaceChildren(...data.items.filter(item => item.activo !== 0).map(item => button(item.nombre + ' · ' + item.correo, () => { client = item; selected.textContent = 'Cliente: ' + item.nombre + ' · ' + item.correo; results.replaceChildren(); })));
        message(status, data.items.length ? 'Selecciona al cliente correcto.' : 'No hay clientes con esa búsqueda.');
      } catch (error) { message(status, error.message, true); } finally { search.disabled = false; }
    });
    label.input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); search.click(); } });
    wrap.append(label.wrap, search, status, results, selected);
    if (!required) wrap.append(button('Usar público general', () => { client = null; selected.textContent = 'Venta al público general'; results.replaceChildren(); }));
    wrap.value = () => { if (required && !client) throw new Error('Selecciona una cuenta de cliente para el pedido.'); return client?.id_usuario; }; return wrap;
  }
  async function catalogProducts() {
    const items = []; let page = 1, response;
    do { response = await DR.request('/productos?pagina=' + page++ + '&limite=48'); items.push(...response.productos); } while (page <= response.paginacion.paginas);
    return items;
  }
  async function orderDetail(id, { customer = false, onSave } = {}) {
    const view = dialog('Pedido #' + id), status = feedback(); view.body.append(status);
    async function reload() {
      message(status, 'Cargando pedido…');
      try {
        const order = await read('pedidos', { id }); view.body.replaceChildren(status); message(status, ''); view.title.textContent = 'Pedido #' + (order.folio || order.id_pedido || id);
        view.body.append(facts([['Cliente', order.cliente || DR.user?.nombre], ['Tipo', order.tipo], ['Estado', state(order.estado)], ['Fecha solicitada', date(order.fecha_solicitada)], ['Entrega confirmada', date(order.fecha_entrega)], ['Motivo del cambio de fecha', order.motivo_retraso], ['Cotización', order.cotizacion_estado], ['Total (MXN)', order.total === null ? 'Por cotizar' : DR.money(order.total)], ['Anticipos / pagado', DR.money(order.anticipo || 0)], ['Saldo pendiente', order.saldo === null ? 'Por cotizar' : DR.money(order.saldo || 0)], ['Responsable', order.trabajador || order.nombre_trabajador]]));
        const newPolicy = Number(order.politica_pago) === 1, accepted = !newPolicy || order.aceptacion_estado === 'Aceptado';
        const progress = el('ol', 'order-progress'); progress.setAttribute('aria-label','Progreso del pedido');
        const stages = ['Aceptado','En preparación','Listo','Entregado'];
        const currentStage = !accepted ? -1 : order.estado === 'Despachado' ? 3 : order.estado === 'Listo' ? 2 : order.estado === 'En progreso' ? 1 : 0;
        stages.forEach((label,index)=>{const item=el('li',index<=currentStage?'completed':'',label);if(index===currentStage)item.setAttribute('aria-current','step');progress.append(item);});
        if(order.estado!=='Cancelado')view.body.prepend(progress);
        if (newPolicy) view.body.append(facts([['Aceptación del pedido', order.aceptacion_estado], ['Modalidad de pago', order.modalidad_pago || 'Se elegirá después de aceptar el precio'], ['Aceptado por', order.nombre_aceptado_por || order.aceptado_por], ['Fecha de aceptación', date(order.aceptado_fecha)]]));
        if (newPolicy && !accepted && !['Cancelado', 'Despachado'].includes(order.estado)) view.body.append(el('p', 'operation-feedback', 'La preparación comenzará cuando el personal verifique la transferencia y acepte el pedido. Enviar una referencia todavía no registra un pago.'));
        if (order.disponibilidad) {
          const availability = order.disponibilidad;
          view.body.append(el('h3', 'operation-subheading', 'Disponibilidad de ingredientes'));
          if (availability.pendiente_consumo) view.body.append(el('p', 'operation-help', 'El consumo real del personalizado se capturará al entregar.'));
          else if (!availability.puede_entregar) { view.body.append(el('p', 'operation-feedback operation-error', 'Pendiente por faltantes. El personal puede reprogramar la entrega.')); const shortages = el('ul'); (availability.faltantes || []).forEach(item => shortages.append(el('li', '', item))); view.body.append(shortages); }
          else view.body.append(el('p', 'operation-help', 'Existencias suficientes al consultar. Se comprobarán de nuevo al entregar.'));
        }
        if (order.descripcion_personalizada) view.body.append(el('h3', '', 'Tu solicitud'), el('p', 'operation-description', order.descripcion_personalizada));
        if (order.tipo === 'Personalizado' && OP.referenceGallery) view.body.append(OP.referenceGallery(order));
        if (order.observaciones) view.body.append(el('p', 'operation-description', order.observaciones));
        if (order.detalles?.length && (order.tipo !== 'Personalizado' || order.total !== null)) view.body.append(table([{ key: 'nombre', label: 'Artículo' }, { key: 'cantidad', label: 'Cantidad' }, { label: 'Precio', render: row => DR.money(row.precio_unitario) }, { label: 'Subtotal', render: row => DR.money(row.subtotal) }], order.detalles, 'Artículos del pedido'));
        const actions = el('div', 'operation-actions');
        if(order.estado!=='Cancelado')progress.after(actions);else view.body.append(actions);
        const active = !['Despachado', 'Cancelado'].includes(order.estado), custom = order.tipo === 'Personalizado';
        const pendingTransfer = (order.intentos_transferencia || []).find(item => item.estado === 'Pendiente');
        async function action(title, fields, actionName, extra = {}, options = {}) {
          const modal = dialog(title);
          const editor = form(fields, async data => { await write(actionName, { id: order.id_pedido || id, version: order.version, ...extra, ...data }); modal.close(); await reload(); onSave?.(); }, { label: title, confirm: options.confirm || '¿Confirmar esta operación para el pedido #' + id + '?', ...options });
          modal.body.append(editor); return { modal, editor };
        }
        if (customer && active && custom && order.cotizacion_estado === 'Pendiente de aceptación') {
          actions.append(button('Aceptar cotización', () => action('Aceptar cotización de ' + DR.money(order.total), [], 'aceptarCotizacion', { cotizacion_version: order.cotizacion_version })), button('Rechazar cotización', () => action('Rechazar cotización', [], 'rechazarCotizacion', { cotizacion_version: order.cotizacion_version })));
        }
        if (active && custom && order.cotizacion_estado === 'Por cotizar' && Number(order.cotizacion_version || 0) === 0 && OP.replaceOrderImages) actions.append(button('Corregir imágenes de referencia', () => OP.replaceOrderImages(order, reload)));
        if (newPolicy && active && !accepted && !pendingTransfer && (!custom || order.cotizacion_estado === 'Aceptado') && ['Pendiente de referencia', 'Por corregir'].includes(order.aceptacion_estado)) actions.append(button(order.aceptacion_estado === 'Por corregir' ? 'Corregir y reenviar referencia' : 'Consultar pago y enviar referencia', () => OP.transferCheckout({}, { order, customer, onSave: async () => { await reload(); onSave?.(); } }), true));
        if (newPolicy && order.intentos_transferencia?.length) {
          view.body.append(el('h3', 'operation-subheading', 'Referencias de transferencia enviadas'));
          for (const attempt of [...order.intentos_transferencia].reverse()) {
            const pane = el('article', 'transfer-attempt'); let bank = attempt.destino_snapshot;
            if (typeof bank === 'string') { try { bank = JSON.parse(bank); } catch { bank = null; } }
            pane.append(el('h4', '', 'Intento #' + attempt.id_intento + ' · ' + attempt.estado), facts([['Enviado', date(attempt.fecha)], ['Referencia', attempt.referencia], ['Importe esperado', DR.money(attempt.importe)], ['Modalidad', attempt.modalidad_pago], ['Resultado de revisión', attempt.motivo || attempt.estado], ['Revisión', attempt.fecha_revision ? date(attempt.fecha_revision) : 'Pendiente de comprobación']]));
            if (bank && OP.bankFacts) pane.append(el('p', 'operation-help', 'Destino mostrado al enviar esta referencia:'), OP.bankFacts(bank));
            if (!customer && active && attempt.estado === 'Pendiente') {
              const controls = el('div', 'operation-actions');
              const acceptButton = button('Verificar transferencia y aceptar', async () => {
                const modal = dialog('Verificar transferencia y aceptar'), note = feedback(); modal.body.append(note);
                try {
                  const fields = [['transferencia_verificada', 'He comprobado fuera de la aplicación que el ingreso de ' + DR.money(attempt.importe) + ' y la referencia coinciden', 'checkbox', 0, {required:true}]];
                  const plannedDate=order.fecha_entrega||order.fecha_solicitada;
                  const needsDate=!plannedDate||OP.parseDate(plannedDate).getTime()<=Date.now();
                  if(needsDate)fields.push(['fecha_entrega','Nueva entrega prevista (la solicitada ya venció)','datetime-local','',{required:true}],['motivo_retraso','Motivo del cambio de fecha','textarea','',{required:true,maxLength:255,wide:true}]);
                  if (DR.user.rol === 'Administrador' && !order.id_trabajador) {
                    const workers = (await all('trabajadores', { activo: '1' })).filter(item => Number(item.activo));
                    if (!workers.length) throw new Error('Agrega o activa un trabajador antes de aceptar este pedido.');
                    fields.unshift(['id_trabajador', 'Trabajador responsable', 'select', '', { required: true, choices: [{ value: '', label: 'Selecciona un trabajador' }, ...workers.map(item => ({ value: item.id_usuario, label: item.nombre }))] }]);
                  }
                  modal.body.prepend(el('p', 'operation-help', order.id_trabajador ? 'Se conservará el responsable actual: ' + (order.trabajador || order.nombre_trabajador || '#' + order.id_trabajador) : DR.user.rol === 'Trabajador' ? 'Al aceptar quedarás como responsable del pedido.' : 'Selecciona al trabajador que preparará el pedido.'));
                  modal.body.append(facts([['Importe a verificar',DR.money(attempt.importe)],['Referencia enviada',attempt.referencia],['Entrega prevista automática',date(plannedDate)]]));
                  const editor = form(fields, async data => {
                    if (!data.transferencia_verificada) throw new Error('Comprueba el ingreso y marca la confirmación antes de aceptar.');
                    await write('revisarTransferencia', { id: order.id_pedido || id, version: order.version, id_intento: attempt.id_intento, decision: 'Aceptar', ...(data.id_trabajador ? { id_trabajador: data.id_trabajador } : {}), ...(needsDate ? {fecha_entrega:data.fecha_entrega,motivo_retraso:data.motivo_retraso}: {}) }); modal.close(); await reload(); onSave?.();
                  }, { label: 'Confirmar ingreso y aceptar pedido' }); note.remove(); modal.body.append(editor);
                } catch (error) { message(note, error.message, true); }
              }, true);
              actions.prepend(acceptButton);
              controls.append(button('Por corregir', () => action('Solicitar corrección de referencia', [['motivo', 'Qué debe corregir el cliente', 'textarea', '', { required: true, maxLength: 255, wide: true }]], 'revisarTransferencia', { id_intento: attempt.id_intento, decision: 'Corregir' }, { confirm: '¿Solicitar corrección? No se registrará un pago.' })));
              pane.append(controls);
            }
            view.body.append(pane);
          }
        }
        if (!customer && active) {
          if (custom && order.cotizacion_estado !== 'Aceptado') actions.append(button('Cotizar encargo', () => action('Guardar cotización', [['total', 'Precio total del encargo (MXN)', 'number', order.total || '', { required: true, min: '0.01', step: '0.01' }], ['fecha_entrega', 'Entrega prevista (según solicitud)', 'datetime-local', localDate(order.fecha_entrega||order.fecha_solicitada), { required: true }], ['nota', 'Nota de la cotización', 'textarea', '', { maxLength: 255 }]], 'cotizarPedido')));
          async function advance(next,label) {
            if(!await OP.confirmAction('¿'+label+' el pedido #'+id+'? Se conservará la entrega prevista.'))return;
            message(status,'Actualizando pedido…');
            try {await write('actualizarPedido',{id:order.id_pedido||id,version:order.version,estado:next});await reload();onSave?.();}
            catch(error){message(status,error.message,true);}
          }
          if(accepted&&(!custom||order.cotizacion_estado==='Aceptado')){
            if(order.estado==='Pendiente')actions.append(button('Poner en preparación',()=>advance('En progreso','poner en preparación'),true));
            if(order.estado==='En progreso')actions.append(button('Marcar listo',()=>advance('Listo','marcar como listo'),true));
          }
          actions.append(button('Cambiar entrega prevista',()=>action('Cambiar entrega prevista',[
            ['fecha_entrega','Nueva fecha y hora de recogida','datetime-local',localDate(order.fecha_entrega||order.fecha_solicitada),{required:true}],
            ['motivo_retraso','Motivo del adelanto o retraso','textarea','',{required:true,maxLength:255,wide:true}]
          ],'actualizarPedido',{}, {confirm:'¿Confirmar la nueva entrega prevista? El cliente recibirá una notificación.'})));
          actions.append(button('Cambiar responsable', async () => {
            try {
              const workers = await all('trabajadores', { activo: '1' });
              const fields = [];
              if (workers.length) fields.push(['id_trabajador', 'Responsable de preparación', 'select', order.id_trabajador || '', { choices: [{ value: '', label: 'Sin asignar' }, ...workers.filter(item => Number(item.activo)).map(item => ({ value: item.id_usuario, label: item.nombre }))] }]);
              if(!fields.length)throw new Error('No hay trabajadores activos para asignar.');
              await action('Cambiar responsable', fields, 'actualizarPedido');
            } catch (error) { message(status, error.message, true); }
          }));
          if (accepted && Number(order.saldo) > 0 && (!newPolicy || order.modalidad_pago === 'Efectivo') && (!custom || order.cotizacion_estado === 'Aceptado')) actions.append(button('Registrar pago', () => action('Registrar pago', OP.paymentFields('', { cashOnly: newPolicy }), 'cobrarPedido', {}, { confirm: data => '¿Registrar un cobro de ' + DR.money(data.importe) + ' por ' + data.metodo_pago + '?' })));
          if (accepted && order.estado === 'Listo' && (!custom || order.cotizacion_estado === 'Aceptado')) actions.append(button('Marcar entregado', async () => {
            const modal = dialog('Entregar pedido #' + id), note = feedback(); modal.body.append(note); message(note, 'Preparando entrega…');
            try {
              const ingredients = custom ? (await all('ingredientes')).filter(item => Number(item.activo)) : [];
              const consumed = custom ? lines(ingredients, { ingredient: true, label: 'Agregar ingrediente utilizado' }) : null;
              const fields = Number(order.saldo) > 0 ? OP.paymentFields(order.saldo, { cashOnly: newPolicy }) : [];
              const editor = form(fields, async data => {
                const payload = { id: order.id_pedido || id, version: order.version };
                if (consumed) payload.detalles = consumed.values();
                if (Number(order.saldo) > 0) { if (Number(data.importe) !== Number(order.saldo)) throw new Error('El pago de entrega debe cubrir exactamente el saldo pendiente.'); payload.pago = data; }
                const result = await write('entregarPedido', payload); modal.close(); await reload(); onSave?.(); DR.notify('Entrega registrada.');
                if (result.id_venta) OP.receipt(await read('ventas', { id: result.id_venta }));
              }, { label: Number(order.saldo) > 0 ? 'Cobrar saldo y entregar' : 'Confirmar entrega' });
              if (consumed) { editor.prepend(el('p', '', 'Captura los ingredientes y cantidades realmente utilizados, en la unidad indicada.'), consumed); }
              else editor.prepend(el('p', '', 'Se descontarán los ingredientes de las recetas y las unidades vendidas en esta entrega.'));
              note.remove(); modal.body.append(editor);
            } catch (error) { message(note, error.message, true); }
          }, true));
        }
        if (active && order.estado === 'Pendiente' && Number(order.anticipo || 0) === 0 && !(customer && pendingTransfer)) actions.append(button('Cancelar pedido', () => action('Cancelar pedido', [['motivo', 'Motivo de cancelación', 'textarea', '', { required: true, maxLength: 255 }]], 'cancelarPedido')));
        if (customer && active && pendingTransfer) actions.append(el('p', 'operation-help', 'La transferencia está pendiente de revisión. El personal debe resolverla antes de que puedas cancelar.'));
        if (!customer && DR.user.rol === 'Administrador' && active && Number(order.anticipo || 0) > 0) actions.append(button('Cancelar con devolución completa', () => action('Registrar devolución y cancelar', [['motivo', 'Motivo de devolución', 'textarea', '', { required: true, maxLength: 255 }], ['metodo_pago', 'Método de devolución manual', 'select', 'Efectivo', { choices: ['Efectivo', 'Transferencia'] }]], 'cancelarPedido', { devolver: true }, { confirm: '¿Confirmar la devolución manual completa de ' + DR.money(order.anticipo) + ' y cancelar? Entrega el dinero por fuera de la aplicación.' })));
        view.body.append(el('h3', 'operation-subheading', 'Pagos registrados'));
        view.body.append(order.pagos?.length ? table([{ label: 'Fecha', render: row => date(row.fecha) }, { label: 'Importe', render: row => DR.money(row.importe) }, { key: 'metodo_pago', label: 'Método' }, { key: 'referencia', label: 'Referencia' }, { label: 'Situación', render: row => Number(row.devuelto) ? 'Devuelto' : 'Registrado' }], order.pagos) : el('p', 'operation-empty', 'No hay pagos registrados.'));
        view.body.append(el('h3', 'operation-subheading', 'Historial del pedido'));
        view.body.append(order.historial?.length ? table([{ label: 'Fecha', render: row => date(row.fecha) }, { key: 'accion', label: 'Acción' }, { label: 'Detalle', render: row => historyText(row.detalle) }, { key: 'operador', label: 'Operador' }], order.historial) : el('p', 'operation-empty', 'Sin movimientos adicionales.'));
      } catch (error) { message(status, error.message, true); }
    }
    await reload(); return view;
  }
  function localDate(value) { if (!value) return ''; const date = OP.parseDate(value); const parts = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(date); return parts.replace(' ', 'T'); }
  OP.chooseClient = chooseClient; OP.orderDetail = orderDetail; OP.catalogProducts = catalogProducts;
})();
