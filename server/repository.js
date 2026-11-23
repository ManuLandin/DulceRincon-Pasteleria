import { validateCatalogQuery } from './validation.js';
import { AppError } from './errors.js';
import {transaction} from './transactions.js';

const productColumns = 'p.id_producto, p.id_categoria, p.nombre, p.descripcion, p.precio, p.existencia, p.stock_minimo, p.unidad, p.imagen, p.activo, c.nombre AS categoria';
const userColumns = 'u.id_usuario, u.nombre, u.correo, u.activo, r.nombre AS rol';
export function createRepository(pool) {
  return {
    async userByEmail(email) {
      const [rows] = await pool.execute(`SELECT ${userColumns}, u.contrasena_hash FROM USUARIO u JOIN ROL r ON r.id_rol=u.id_rol WHERE u.correo=? LIMIT 1`, [email]);
      return rows[0] || null;
    },
    async userById(id) {
      const [rows] = await pool.execute(`SELECT ${userColumns} FROM USUARIO u JOIN ROL r ON r.id_rol=u.id_rol WHERE u.id_usuario=? LIMIT 1`, [id]);
      return rows[0] || null;
    },
    async createCustomer(data) {
      const [result] = await pool.execute('INSERT INTO USUARIO (id_rol,nombre,correo,contrasena_hash,telefono,direccion) SELECT id_rol,?,?,?,?,? FROM ROL WHERE nombre=?', [data.nombre, data.correo, data.contrasena_hash, data.telefono, data.direccion, 'Cliente']);
      if (!result.affectedRows) throw new Error('No se encontró el rol Cliente.');
      return result.insertId;
    },
    async categories() {
      const [rows] = await pool.execute('SELECT id_categoria,nombre FROM CATEGORIA_PRODUCTO WHERE activo=TRUE ORDER BY id_categoria');
      return rows;
    },
    async productsPage(input) {
      const query = validateCatalogQuery(input);
      let where = 'p.activo=TRUE AND c.activo=TRUE';
      const values = [];
      if (query.categoria) { where += ' AND p.id_categoria=?'; values.push(query.categoria); }
      if (query.buscar) { where += " AND p.nombre LIKE ? ESCAPE '!'"; values.push('%' + query.buscar.replace(/[!%_]/g, '!$&') + '%'); }
      const [count] = await pool.execute(`SELECT COUNT(*) AS total FROM PRODUCTO p JOIN CATEGORIA_PRODUCTO c ON c.id_categoria=p.id_categoria WHERE ${where}`, values);
      // Solo enteros ya validados forman LIMIT/OFFSET; los textos siempre son parámetros.
      const offset = (query.pagina - 1) * query.limite;
      const [rows] = await pool.execute(`SELECT ${productColumns} FROM PRODUCTO p JOIN CATEGORIA_PRODUCTO c ON c.id_categoria=p.id_categoria WHERE ${where} ORDER BY p.id_producto DESC LIMIT ${query.limite} OFFSET ${offset}`, values);
      return { rows, total: Number(count[0].total) };
    },
    async productById(id, { includeInactive = false } = {}) {
      const active = includeInactive ? '' : ' AND p.activo=TRUE AND c.activo=TRUE';
      const [rows] = await pool.execute(`SELECT ${productColumns} FROM PRODUCTO p JOIN CATEGORIA_PRODUCTO c ON c.id_categoria=p.id_categoria WHERE p.id_producto=?${active} LIMIT 1`, [id]);
      return rows[0] || null;
    },
    async adminProducts() {
      const [rows] = await pool.execute(`SELECT ${productColumns} FROM PRODUCTO p JOIN CATEGORIA_PRODUCTO c ON c.id_categoria=p.id_categoria ORDER BY p.id_producto DESC`);
      return rows;
    },
    async createProduct(data, image,operator=null) {
      return transaction(pool,async connection=>{
        const [result] = await connection.execute('INSERT INTO PRODUCTO (id_categoria,nombre,descripcion,precio,existencia,stock_minimo,unidad,imagen) SELECT id_categoria,?,?,?,?,?,?,? FROM CATEGORIA_PRODUCTO WHERE id_categoria=? AND activo=TRUE', [data.nombre, data.descripcion, data.precio, data.existencia, data.stock_minimo, data.unidad, image, data.id_categoria]);
        if(!result.affectedRows)return null;
        if(data.existencia>0)await connection.execute('INSERT INTO MOVIMIENTO_PRODUCTO(id_producto,cantidad,existencia_resultante,tipo,id_usuario,motivo) VALUES (?,?,?,?,?,?)',[result.insertId,data.existencia,data.existencia,'Apertura',operator,'Existencia inicial del producto']);
        return result.insertId;
      });
    },
    async replaceImage(id, image) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [rows] = await connection.execute('SELECT imagen FROM PRODUCTO WHERE id_producto=? FOR UPDATE', [id]);
        if (!rows.length) { await connection.rollback(); return null; }
        await connection.execute('UPDATE PRODUCTO SET imagen=? WHERE id_producto=?', [image, id]);
        await connection.commit();
        return { anterior: rows[0].imagen };
      } catch (error) { await connection.rollback(); throw error; }
      finally { connection.release(); }
    },
    async isImageReferenced(image) {
      const [rows] = await pool.execute('SELECT id_producto FROM PRODUCTO WHERE imagen=? LIMIT 1', [image]);
      return rows.length > 0;
    },
    async createInitialAdmin(data) {
      const connection = await pool.getConnection();
      let locked = false;
      try {
        const [locks] = await connection.execute("SELECT GET_LOCK('dulcerincon_admin_inicial',5) AS obtenido");
        if (locks[0].obtenido !== 1) throw new AppError(409, 'Hay otra configuración de administrador en curso.');
        locked = true;
        const [existing] = await connection.execute('SELECT u.id_usuario FROM USUARIO u JOIN ROL r ON r.id_rol=u.id_rol WHERE r.nombre=? AND u.activo=TRUE LIMIT 1', ['Administrador']);
        if (existing.length) throw new AppError(409, 'Ya existe un administrador activo. No se creó ni modificó ninguna cuenta.');
        const [result] = await connection.execute('INSERT INTO USUARIO (id_rol,nombre,correo,contrasena_hash) SELECT id_rol,?,?,? FROM ROL WHERE nombre=?', [data.nombre, data.correo, data.contrasena_hash, 'Administrador']);
        if (!result.affectedRows) throw new Error('No se encontró el rol Administrador.');
        return result.insertId;
      } finally {
        if (locked) await connection.execute("SELECT RELEASE_LOCK('dulcerincon_admin_inicial')");
        connection.release();
      }
    }
  };
}
