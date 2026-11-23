(() => {
  const form = document.querySelector('[data-login-form], [data-register-form]');
  if (!form) return;
  const registration = form.hasAttribute('data-register-form');
  if (registration) {
    const name = form.elements.nombre;
    const validateName = () => name.setCustomValidity(/^(?:\p{L}\p{M}*)+(?: +(?:\p{L}\p{M}*)+)*$/u.test(name.value.trim().normalize('NFC')) ? '' : 'Escribe tu nombre usando solo letras y espacios, sin números ni símbolos.');
    name.addEventListener('input', validateName);
    form.addEventListener('submit', validateName);
  }
  const feedback = document.getElementById('login-feedback');
  function message(value, success = false) { feedback.hidden = false; feedback.textContent = value; feedback.classList.toggle('success', success); }
  if (!registration && new URLSearchParams(location.search).get('registro') === '1') message('Tu cuenta está lista. Inicia sesión para continuar.', true);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const submit = form.querySelector('[type="submit"]'); const original = submit.innerHTML;
    submit.disabled = true; submit.textContent = registration ? 'Creando tu cuenta…' : 'Iniciando sesión…'; feedback.hidden = true;
    const data = { correo: form.elements.correo.value, contrasena: form.elements.contrasena.value };
    if (registration) { data.nombre = form.elements.nombre.value; data.confirmacion = form.elements.confirmacion.value; data.telefono = form.elements.telefono.value; data.direccion = form.elements.direccion.value; }
    try {
      const result = await DR.request(registration ? '/auth/registro' : '/auth/login', { method: 'POST', body: data });
      form.reset(); location.assign(registration ? '/login.html?registro=1' : result.destino);
    } catch (error) { message(error.message); submit.disabled = false; submit.innerHTML = original; }
  });
})();
