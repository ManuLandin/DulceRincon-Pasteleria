import session from 'express-session';

// Adaptador del contrato oficial de express-session; utiliza el mismo mysql2 actualizado.
export class MysqlSessionStore extends session.Store {
  constructor(pool) {
    super();
    this.pool = pool;
    this.cleanup = setInterval(() => this.pool.execute('DELETE FROM SESION_WEB WHERE expires<=?', [Math.floor(Date.now() / 1000)]).catch(() => {}), 15 * 60 * 1000);
    this.cleanup.unref();
  }
  get(id, callback) {
    this.pool.execute('SELECT data FROM SESION_WEB WHERE session_id=? AND expires>?', [id, Math.floor(Date.now() / 1000)])
      .then(([rows]) => callback(null, rows.length ? JSON.parse(rows[0].data) : null)).catch(callback);
  }
  set(id, data, callback = () => {}) {
    const expires = this.expiration(data);
    let json;
    try { json = JSON.stringify(data); } catch (error) { callback(error); return; }
    this.pool.execute('INSERT INTO SESION_WEB (session_id,expires,data) VALUES (?,?,?) ON DUPLICATE KEY UPDATE expires=?,data=?', [id, expires, json, expires, json]).then(() => callback()).catch(callback);
  }
  touch(id, data, callback = () => {}) {
    this.pool.execute('UPDATE SESION_WEB SET expires=? WHERE session_id=? AND expires>?', [this.expiration(data), id, Math.floor(Date.now() / 1000)]).then(() => callback()).catch(callback);
  }
  destroy(id, callback = () => {}) { this.pool.execute('DELETE FROM SESION_WEB WHERE session_id=?', [id]).then(() => callback()).catch(callback); }
  expiration(data) { return Math.floor((data.cookie?.expires ? new Date(data.cookie.expires).getTime() : Date.now() + 8 * 60 * 60 * 1000) / 1000); }
  close() { clearInterval(this.cleanup); }
}
