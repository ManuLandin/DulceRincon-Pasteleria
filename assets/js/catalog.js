(() => {
  const grid = document.querySelector('[data-catalog]'); if (!grid) return;
  const { element: el } = DR;
  let categories = [], category = '', page = 1, pages = 0, controller;
  const controls = el('div', 'catalog-controls'), searchWrap = el('div', 'catalog-search');
  const searchLabel = el('label', 'visually-hidden', 'Buscar productos por nombre'); searchLabel.htmlFor = 'product-search';
  const search = el('input', 'form-control'); search.type = 'search'; search.id = 'product-search'; search.placeholder = 'Busca tu próximo antojo…'; search.maxLength = 100;
  searchWrap.append(searchLabel, search, el('i', 'ti ti-search'));
  const filters = el('div', 'catalog-filters'); filters.setAttribute('aria-label', 'Filtrar productos por categoría');
  controls.append(searchWrap, filters); grid.before(controls); document.querySelector('.catalog-nav')?.remove();
  const status = el('p', 'catalog-status'); status.setAttribute('role', 'status'); grid.before(status);
  const pager = el('div', 'catalog-pager'), previous = el('button', 'btn-outline-rose', 'Anterior'), current = el('span', ''), next = el('button', 'btn-outline-rose', 'Siguiente'); previous.type = next.type = 'button';
  pager.append(previous, current, next); grid.after(pager);
  previous.addEventListener('click', () => { if (page > 1) { page--; load(); } }); next.addEventListener('click', () => { if (page < pages) { page++; load(); } });
  let timer; search.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { page = 1; load(); }, 280); });
  function renderFilters() {
    filters.replaceChildren();
    for (const item of [{ id_categoria: '', nombre: 'Todos' }, ...categories]) {
      const selected = String(item.id_categoria) === String(category);
      const button = el('button', selected ? 'active' : '', item.nombre); button.type = 'button'; button.setAttribute('aria-pressed', String(selected));
      button.addEventListener('click', () => { category = String(item.id_categoria); page = 1; renderFilters(); load(); }); filters.append(button);
    }
  }
  function state(message, retry = false) {
    grid.replaceChildren(); const box = el('div', 'catalog-empty'); box.append(el('i', 'ti ti-cake'), el('p', '', message));
    if (retry) { const button = el('button', 'btn-outline-rose', 'Volver a intentar'); button.type = 'button'; button.addEventListener('click', initialize); box.append(button); }
    grid.append(box); pager.hidden = true;
  }
  function card(product) {
    const article = el('article', 'product-card'), button = el('button', 'product-photo-button'); button.type = 'button'; button.setAttribute('aria-label', 'Ver detalle de ' + product.nombre);
    const photo = el('div', 'product-image'); photo.append(DR.productImage(product)); button.append(photo); button.addEventListener('click', () => detail(product.id_producto));
    article.append(button, el('span', 'product-type', product.categoria), el('h3', '', product.nombre), el('p', '', product.descripcion || 'Un detalle dulce de nuestro catálogo.'));
    const bottom = el('div', 'product-bottom'), price = el('span', 'product-price', DR.money(product.precio)); price.append(el('span', 'product-unit', ' / ' + product.unidad));
    const more = el('button', 'product-detail-link', 'Ver detalle'); more.type = 'button'; more.addEventListener('click', () => detail(product.id_producto)); bottom.append(price, more); article.append(bottom);
    if (window.DRCart) { const add = el('button', 'btn-outline-rose product-add-cart', 'Agregar al carrito'); add.type = 'button'; add.setAttribute('aria-label', 'Agregar ' + product.nombre + ' al carrito'); add.addEventListener('click', () => DRCart.add(product)); article.append(add); }
    return article;
  }
  async function load() {
    controller?.abort(); controller = new AbortController(); const active = controller;
    status.textContent = 'Buscando algo dulce…'; grid.setAttribute('aria-busy', 'true'); pager.hidden = true;
    try {
      const query = new URLSearchParams({ buscar: search.value.trim(), categoria: category, pagina: String(page), limite: '12' });
      const data = await DR.request('/productos?' + query, { signal: active.signal }); if (controller !== active) return;
      pages = data.paginacion.paginas;
      if (!data.productos.length) state(search.value || category ? 'No encontramos productos con esos filtros. Prueba otra búsqueda o categoría.' : 'Estamos preparando nuestro catálogo. Vuelve pronto para descubrir algo dulce.');
      else { grid.replaceChildren(...data.productos.map(card)); previous.disabled = page <= 1; next.disabled = page >= pages; current.textContent = 'Página ' + page + ' de ' + pages; pager.hidden = pages < 2; }
      status.textContent = data.paginacion.total + (data.paginacion.total === 1 ? ' producto disponible' : ' productos disponibles');
    } catch (error) { if (error.name !== 'AbortError' && controller === active) { status.textContent = ''; state(error.message, true); } }
    finally { if (controller === active) grid.removeAttribute('aria-busy'); }
  }
  const drawer = el('div', 'offcanvas offcanvas-end product-detail'); drawer.id = 'product-detail'; drawer.tabIndex = -1; drawer.setAttribute('aria-labelledby', 'product-detail-title');
  const header = el('div', 'offcanvas-header'), heading = el('h2', 'offcanvas-title', 'Un detalle dulce'); heading.id = 'product-detail-title';
  const close = el('button', 'icon-button'); close.type = 'button'; close.dataset.bsDismiss = 'offcanvas'; close.setAttribute('aria-label', 'Cerrar detalle'); close.append(el('i', 'ti ti-x'));
  const content = el('div', 'offcanvas-body'); header.append(heading, close); drawer.append(header, content); document.body.append(drawer);
  let detailRequest = 0; drawer.addEventListener('hide.bs.offcanvas', () => { detailRequest++; });
  async function detail(id) {
    const version = ++detailRequest; heading.textContent = 'Un detalle dulce'; content.replaceChildren(el('p', '', 'Cargando producto…')); bootstrap.Offcanvas.getOrCreateInstance(drawer).show();
    try {
      const { producto } = await DR.request('/productos/' + encodeURIComponent(id)); if (version !== detailRequest) return;
      heading.textContent = producto.nombre;
      content.replaceChildren(DR.productImage(producto, 'detail-photo'), el('p', 'product-type', producto.categoria), el('p', 'detail-price', DR.money(producto.precio)), el('p', 'detail-description', producto.descripcion || 'Un detalle dulce preparado con cariño.'), el('p', 'product-unit', 'Precio por ' + producto.unidad));
      const user = await DR.ready; if (version !== detailRequest) return;
      const note = el('div', 'detail-order-note');
      if (window.DRCart && (!user || user.rol === 'Cliente')) {
        note.append(el('p', '', 'Reúne tus favoritos en el carrito y elige la recogida al continuar. Necesitas iniciar sesión para enviar el pedido.'));
        const add = el('button', 'btn-rose', 'Agregar al carrito'); add.type = 'button'; add.addEventListener('click', () => { DRCart.add(producto); bootstrap.Offcanvas.getInstance(drawer)?.hide(); }); note.append(add);
      }
      else if (!user) { note.append(el('p', '', 'Inicia sesión para pedir este producto y consultar su preparación.')); const link = el('a', 'btn-rose', 'Iniciar sesión para pedir'); link.href = '/login.html'; note.append(link); }
      else if (user.rol === 'Cliente' && window.OP) { note.append(el('p', '', 'Selecciona la cantidad y fecha solicitada. El personal confirmará la entrega.')); note.append(OP.button('Pedir este producto', () => { bootstrap.Offcanvas.getInstance(drawer)?.hide(); OP.createOrder({ customer: true, product: producto }); }, true)); }
      else if (user.rol === 'Cliente') { const link = el('a', 'btn-rose', 'Pedir desde mi cuenta'); link.href = '/cliente.html#catalogo'; note.append(link); }
      else { const link = el('a', 'btn-outline-rose', 'Abrir caja'); link.href = DR.destination + '#caja'; note.append(link); }
      content.append(note);
    } catch (error) { if (version === detailRequest) content.replaceChildren(el('p', '', error.message)); }
  }
  async function selectHash(hash, scroll) {
    const selected = categories.find(item => item.slug === hash.slice(1)); if (!selected) return false;
    category = String(selected.id_categoria); page = 1; renderFilters(); load();
    if (scroll) document.getElementById('catalogo').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); return true;
  }
  async function initialize() {
    try {
      categories = (await DR.request('/categorias')).categorias;
      const order = ['pasteles', 'galletas', 'reposteria', 'cup-cakes'];
      categories.sort((a, b) => (order.indexOf(a.slug) + 1 || 99) - (order.indexOf(b.slug) + 1 || 99));
      renderFilters(); if (!await selectHash(location.hash, false)) load();
    } catch (error) { status.textContent = ''; state(error.message, true); }
  }
  document.addEventListener('click', async event => {
    const anchor = event.target.closest('a[href^="#"]'); if (!anchor || !['#pasteles', '#galletas', '#reposteria', '#cup-cakes'].includes(anchor.getAttribute('href'))) return;
    event.preventDefault();
    if (await selectHash(anchor.getAttribute('href'), true)) history.replaceState(null, '', anchor.getAttribute('href'));
    else { state('Esta categoría no está disponible por el momento.'); document.getElementById('catalogo').scrollIntoView(); }
  });
  initialize();
})();
