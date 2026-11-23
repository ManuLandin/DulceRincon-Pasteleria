(() => {
  let token = null;
  async function request(path, { method = 'GET', body, signal } = {}) {
    const headers = { Accept: 'application/json' };
    if (!['GET', 'HEAD'].includes(method)) {
      if (!token) token = (await request('/auth/csrf')).csrfToken;
      headers['X-CSRF-Token'] = token;
    }
    if (body && !(body instanceof FormData)) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(body); }
    let response;
    try { response = await fetch('/api' + path, { method, headers, body, signal, credentials: 'same-origin' }); }
    catch (error) { if (error.name === 'AbortError') throw error; throw new Error('No pudimos conectar con el servidor. Comprueba que la aplicación esté iniciada y vuelve a intentarlo.'); }
    let data;
    try { data = await response.json(); }
    catch { throw new Error('La respuesta del servidor se interrumpió. Vuelve a intentar la misma operación para recuperar su resultado.'); }
    if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('El servidor devolvió una respuesta incompleta. Vuelve a intentar la misma operación.');
    if (data.csrfToken) token = data.csrfToken;
    if (!response.ok) {
      if (response.status === 403) token = null;
      const error = new Error(data.error || 'No se pudo completar la operación. Inténtalo de nuevo.');
      error.status = response.status; error.reconfirmarImporte=Boolean(data.reconfirmar_importe); throw error;
    }
    if (path === '/auth/logout') token = null;
    return data;
  }
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function productImage(product, className = '') {
    if (!product.imagen) return element('div', 'photo-pending ' + className, 'Fotografía pendiente');
    const image = element('img', className);
    image.src = /^\/uploads\/productos\/[a-f0-9-]{36}\.webp$/.test(product.imagen) ? product.imagen : '/assets/images/photo-pending.svg';
    image.alt = product.nombre; image.loading = 'lazy';
    image.addEventListener('error', () => image.replaceWith(element('div', 'photo-pending ' + className, 'Fotografía no disponible')), { once: true });
    return image;
  }
  window.DR = { request, element, productImage, user: null, money: value => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value)) };
  DR.ready = request('/auth/me').then(data => { DR.user = data.usuario; DR.destination = data.destino; return data.usuario; }).catch(error => { if (error.status !== 401) DR.connectionError = error.message; return null; });
})();
