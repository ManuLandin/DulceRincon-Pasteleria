import multer from 'multer';
import { integer, validateCatalogQuery, validateProduct } from './validation.js';
import { presentCategory, presentProduct } from './categories.js';
import { MAX_IMAGE_SIZE, saveImage, removeImage } from './images.js';
import { requireCsrf } from './auth.js';
import { AppError } from './errors.js';

export function mountProductRoutes(app, repository, guards, uploadDir, writeLimit) {
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_IMAGE_SIZE, files: 1, fields: 9, fieldSize: 4096, parts: 11 } }).single('imagen');
  const admin = [guards.requireUser, guards.requireAdmin];
  app.get('/api/categorias', async (req, res) => res.json({ categorias: (await repository.categories()).map(presentCategory) }));
  app.get('/api/productos', async (req, res) => {
    const query = validateCatalogQuery(req.query);
    const { rows, total } = await repository.productsPage(query);
    res.json({ productos: rows.map(presentProduct), paginacion: { pagina: query.pagina, limite: query.limite, total, paginas: Math.ceil(total / query.limite) } });
  });
  app.get('/api/productos/:id', async (req, res) => {
    const product = await repository.productById(integer(req.params.id, 'Producto', { min: 1 }));
    if (!product) throw new AppError(404, 'Este producto no está disponible.');
    res.json({ producto: presentProduct(product) });
  });
  app.get('/api/admin/productos', ...admin, async (req, res) => res.json({ productos: (await repository.adminProducts()).map(presentProduct) }));
  app.post('/api/admin/productos', ...admin, requireCsrf, writeLimit, upload, async (req, res) => {
    const data = validateProduct(req.body);
    if (!(await repository.categories()).some(c => c.id_categoria === data.id_categoria)) throw new AppError(400, 'Selecciona una categoría activa.');
    const image = await saveImage(req.file, uploadDir);
    let id;
    try { id = await repository.createProduct(data, image,req.user.id_usuario); if (!id) throw new AppError(400, 'La categoría seleccionada ya no está activa.'); }
    catch (error) { await removeImage(image, uploadDir); throw error; }
    const product = await repository.productById(id, { includeInactive: true });
    res.status(201).json({ producto: presentProduct(product) });
  });
  app.put('/api/admin/productos/:id/imagen', ...admin, requireCsrf, writeLimit, async (req, res, next) => {
    req.productId = integer(req.params.id, 'Producto', { min: 1 });
    if (!await repository.productById(req.productId, { includeInactive: true })) throw new AppError(404, 'No se encontró el producto.');
    next();
  }, upload, async (req, res) => {
    const image = await saveImage(req.file, uploadDir);
    let result;
    try { result = await repository.replaceImage(req.productId, image); if (!result) throw new AppError(404, 'No se encontró el producto.'); }
    catch (error) { await removeImage(image, uploadDir); throw error; }
    if (result.anterior) {
      try { if (!await repository.isImageReferenced(result.anterior)) await removeImage(result.anterior, uploadDir); }
      catch { /* La foto nueva ya está guardada; una limpieza fallida no revierte el producto. */ }
    }
    res.json({ producto: presentProduct(await repository.productById(req.productId, { includeInactive: true })) });
  });
}
