import readline from 'node:readline';
import { createInterface } from 'node:readline/promises';

export async function ask(question) {
  const input = createInterface({ input: process.stdin, output: process.stdout });
  try { return await input.question(question); } finally { input.close(); }
}
export function askSecret(question) {
  if (!process.stdin.isTTY) throw new Error('Ejecuta este comando en una terminal interactiva para introducir la contraseña de forma oculta.');
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    const previousRaw = Boolean(stdin.isRaw);
    readline.emitKeypressEvents(stdin);
    stdin.setRawMode(true); stdin.resume(); process.stdout.write(question);
    let value = '';
    const finish = () => { stdin.removeListener('keypress', keypress); stdin.setRawMode(previousRaw); stdin.pause(); process.stdout.write('\n'); };
    function keypress(str, key = {}) {
      if (key.ctrl && key.name === 'c') { finish(); reject(new Error('Configuración cancelada.')); }
      else if (key.name === 'return' || key.name === 'enter') { finish(); resolve(value); }
      else if (key.name === 'backspace') { if (value.length) { value = [...value].slice(0, -1).join(''); process.stdout.write('\b \b'); } }
      else if (str && !key.ctrl && !key.meta && !str.includes('\u001b')) { value += str; process.stdout.write('*'.repeat([...str].length)); }
    }
    stdin.on('keypress', keypress);
  });
}
