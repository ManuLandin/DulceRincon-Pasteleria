(() => {
  const form = document.querySelector('[data-product-form]'); if (!form) return;
  const { element: el } = DR;
  const submit = form.querySelector('[type="submit"]');
  const feedback = document.querySelector('[data-product-feedback]');
  const listFeedback = document.querySelector('[data-list-feedback]');
  const list = document.querySelector('[data-admin-products]');
  const preview = document.querySelector('[data-product-preview]');
  const emptyPreview = document.querySelector('[data-preview-empty]');
  const select = form.elements.id_categoria;
  let previewURL;
  function message(node, value) { node.textContent = value; node.hidden = !value; }
  function validateFile(file) {
    if (!file) throw new Error('Selecciona una fotografía; es obligatoria.');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Usa una fotografía JPG, PNG o WebP.');
    if (file.size > 5 * 1024 * 1024) throw new Error('La fotografía supera el límite de 5 MB.');
  }
  function clearPreview() {
    if (previewURL) URL.revokeObjectURL(previewURL);
    previewURL = null; preview.removeAttribute('src'); preview.hidden = true; emptyPreview.hidden = false;
  }
  form.elements.imagen.addEventListener('change', () => {
    clearPreview(); message(feedback, '');
    const file = form.elements.imagen.files[0]; if (!file) return;
    try { validateFile(file); previewURL = URL.createObjectURL(file); preview.src = previewURL; preview.hidden = false; emptyPreview.hidden = true; }
    catch (error) { message(feedback, error.message); form.elements.imagen.value = ''; }
  });
  function item(product) {
    const article = el('article', 'managed-product'); article.append(DR.productImage(product));
    const info = el('div', 'managed-product-details'); info.append(el('h4', '', product.nombre), el('p', '', product.categoria + ' · ' + DR.money(product.precio) + (product.activo ? '' : ' · Inactivo')));
    const input = el('input', 'file-input-hidden'); input.type = 'file'; input.accept = 'image/jpeg,image/png,image/webp'; input.setAttribute('aria-label', 'Cambiar fotografía de ' + product.nombre); input.tabIndex = -1;
    const button = el('button', 'replace-photo', 'Cambiar fotografía'); button.type = 'button'; button.addEventListener('click', () => input.click());
    input.addEventListener('change', async () => {
      const file = input.files[0]; if (!file) return;
      try {
        validateFile(file); article.classList.add('saving'); button.disabled = true; message(listFeedback, 'Guardando fotografía…');
        const data = new FormData(); data.append('imagen', file);
        await DR.request('/admin/productos/' + encodeURIComponent(product.id_producto) + '/imagen', { method: 'PUT', body: data });
        message(listFeedback, 'Fotografía actualizada. Ya está disponible en el catálogo.'); await loadProducts();
      } catch (error) { message(listFeedback, error.message); }
      finally { article.classList.remove('saving'); button.disabled = false; input.value = ''; }
    });
    info.append(button, input); article.append(info); return article;
  }
  async function loadProducts() {
    try {
      const { productos } = await DR.request('/admin/productos');
      list.replaceChildren(...productos.map(item));
      if (!productos.length) list.append(el('p', 'catalog-empty', 'Tu catálogo aún no tiene productos. Agrega el primero con su fotografía.'));
    } catch (error) { message(listFeedback, error.message); }
  }
  document.querySelector('[data-reload-products]').addEventListener('click', loadProducts);
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (!form.reportValidity()) return;
    try { validateFile(form.elements.imagen.files[0]); } catch (error) { message(feedback, error.message); return; }
    submit.disabled = true; const original = submit.innerHTML; submit.textContent = 'Guardando producto…'; message(feedback, '');
    try {
      const result = await DR.request('/admin/productos', { method: 'POST', body: new FormData(form) });
      form.reset(); clearPreview(); message(feedback, '«' + result.producto.nombre + '» ya está guardado y aparece en el catálogo público.'); await loadProducts();
    } catch (error) { message(feedback, error.message); }
    finally { submit.disabled = false; submit.innerHTML = original; }
  });
  DR.ready.then(async user => {
    if (!user || user.rol !== 'Administrador') return;
    try {
      const { categorias } = await DR.request('/categorias');
      select.replaceChildren(el('option', '', 'Selecciona una categoría')); select.firstElementChild.value = '';
      for (const category of categorias) { const option = el('option', '', category.nombre); option.value = category.id_categoria; select.append(option); }
      if (!categorias.length) { message(feedback, 'No hay categorías activas. Revisa las categorías de la base de datos.'); return; }
      submit.disabled = false; await loadProducts();
    } catch (error) { message(feedback, error.message); }
  });
})();
