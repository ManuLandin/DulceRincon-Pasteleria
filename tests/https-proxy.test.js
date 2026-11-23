import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { context, PASSWORD } from './helpers.js';
import { readConfig } from '../server/config.js';

test('proxy trust is opt-in and only a single controlled hop is accepted', () => {
  const env = { DB_PASSWORD: 'test-only', SESSION_SECRET: 'x'.repeat(48) };
  assert.equal(readConfig(env).trustProxyHops, 0);
  assert.equal(readConfig({...env, TRUST_PROXY_HOPS:'1'}).trustProxyHops, 1);
  for (const value of ['true', '-1', '2']) assert.throws(() => readConfig({...env, TRUST_PROXY_HOPS:value}), /TRUST_PROXY_HOPS/);
});

test('production login keeps a secure session through the configured HTTPS proxy', async t => {
  const { app } = await context(t, {production:true, trustProxyHops:1});
  const csrf = await request(app).get('/api/auth/csrf').set('X-Forwarded-Proto','https').expect(200);
  assert.match(csrf.headers['set-cookie'][0], /; Secure/);
  const login = await request(app).post('/api/auth/login').set('X-Forwarded-Proto','https')
    .set('Cookie',csrf.headers['set-cookie'][0].split(';')[0]).set('X-CSRF-Token',csrf.body.csrfToken)
    .send({correo:'admin@example.test',contrasena:PASSWORD}).expect(200);
  assert.match(login.headers['set-cookie'][0], /; Secure/);
  const me = await request(app).get('/api/auth/me').set('X-Forwarded-Proto','https')
    .set('Cookie',login.headers['set-cookie'][0].split(';')[0]).expect(200);
  assert.equal(me.body.usuario.rol,'Administrador');
});

test('production does not issue secure cookies for untrusted forwarded HTTPS or plain HTTP', async t => {
  const direct = await context(t, {production:true});
  const untrusted = await request(direct.app).get('/api/auth/csrf').set('X-Forwarded-Proto','https').expect(200);
  assert.equal(untrusted.headers['set-cookie'],undefined);
  const proxy = await context(t, {production:true, trustProxyHops:1});
  const plain = await request(proxy.app).get('/api/auth/csrf').set('X-Forwarded-Proto','http').expect(200);
  assert.equal(plain.headers['set-cookie'],undefined);
});
