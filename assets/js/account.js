(() => {
  DR.ready.then(user => {
    if (!user) return;
    const firstName = user.nombre.split(/\s+/)[0];
    const initials = user.nombre.split(/\s+/).slice(0, 2).map(part => [...part][0]).join('').toUpperCase();
    document.querySelectorAll('.account-avatar').forEach(node => { node.textContent = initials; });
    const account = document.querySelector('.header-account');
    if (account) {
      account.href = DR.destination; account.setAttribute('aria-label', 'Mi cuenta, ' + user.nombre);
      account.replaceChildren(DR.element('span', 'account-avatar', initials), DR.element('span', 'account-name', firstName));
      if (!account.parentElement.querySelector('[data-logout]')) {
        const exit = DR.element('button', 'icon-button header-logout'); exit.type = 'button'; exit.dataset.logout = ''; exit.setAttribute('aria-label', 'Cerrar sesión'); exit.append(DR.element('i', 'ti ti-logout')); account.after(exit);
      }
    }
    const mobile = document.querySelector('.mobile-account'); if (mobile) { mobile.href = DR.destination; mobile.textContent = 'Mi cuenta'; }
    document.querySelectorAll('[data-user-name]').forEach(node => { node.textContent = user.nombre; });
    document.querySelectorAll('[data-user-greeting]').forEach(node => { node.textContent = 'Hola, ' + firstName + '.'; });
    const name = document.querySelector('.sidebar-user strong'); const role = document.querySelector('.sidebar-user small');
    if (name) name.textContent = user.nombre; if (role) role.textContent = user.rol;
  });
  document.addEventListener('click', async event => {
    const exit = event.target.closest('[data-logout]'); if (!exit) return;
    event.preventDefault(); exit.disabled = true;
    try { await DR.request('/auth/logout', { method: 'POST' }); location.assign('/index.html'); }
    catch (error) { exit.disabled = false; DR.notify?.(error.message); }
  });
})();
