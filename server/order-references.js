import multer from 'multer';
import { createHash, randomUUID } from 'node:crypto';
import { basename, join, resolve } from 'node:path';
import { unlink, writeFile, readFile, readdir } from 'node:fs/promises';
import { requireCsrf } from './auth.js';
import { AppError } from './errors.js';
import { MAX_IMAGE_SIZE, saveImage } from './images.js';
import { integer } from './validation.js';

const privateName = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.webp$/;
const referenceUrl = (id, ref) => `/api/pedidos/${id}/referencias/${ref}`;

// Only metadata produced by the decoder may enter a transaction or a file path.
function validFile(file) {
  if (!file || !privateName.test(file.archivo) || !/^[a-f0-9]{64}$/.test(file.hash_original)) throw new AppError(400, 'La imagen de referencia contiene datos inválidos.');
}

export async function persistReferences(db, idPedido, actor, files) {
  if (!Array.isArray(files) || files.length > 3) throw new AppError(400, 'Puedes adjuntar hasta tres imágenes de referencia.');
  files.forEach(validFile);
  for (const file of files) await db.execute('INSERT INTO REFERENCIA_PEDIDO (id_pedido,archivo,hash_original,id_usuario) VALUES (?,?,?,?)', [idPedido, file.archivo, file.hash_original, actor.id_usuario]);
}

// archivo stays internal: transactions need it to clean regenerated retry files.
export async function referenceList(db, idPedido) {
  const [rows] = await db.execute('SELECT id_referencia,archivo,activo,fecha FROM REFERENCIA_PEDIDO WHERE id_pedido=? AND activo=1 ORDER BY id_referencia', [idPedido]);
  return rows.map(row => ({ ...row, url: referenceUrl(idPedido, row.id_referencia) }));
}

function allowedActor(req, res, next) {
  if (!['Cliente', 'Trabajador', 'Administrador'].includes(req.user?.rol)) return next(new AppError(403, 'Esta cuenta no puede adjuntar referencias.'));
  next();
}

function formData(req) {
  let data;
  try { data = JSON.parse(req.body?.datos); } catch { throw new AppError(400, 'Revisa los datos del formulario.'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new AppError(400, 'Revisa los datos del formulario.');
  const description = data.descripcion_personalizada;
  if (description !== undefined && (typeof description !== 'string' || description.trim().length > 1000)) throw new AppError(400, 'La descripción admite hasta 1000 caracteres.');
  if (typeof req.body.clave !== 'string' || !/^[a-zA-Z0-9_-]{16,100}$/.test(req.body.clave)) throw new AppError(400, 'Actualiza el formulario y vuelve a enviarlo.');
  return data;
}

function publicResult(result) {
  return { ...result, referencias: (result.referencias || []).map(({ archivo, hash_original, ...reference }) => reference) };
}

async function cleanup(files, directory, retained = []) {
  const keep = new Set(retained.map(file => file.archivo));
  for (const file of files) {
    if (keep.has(file.archivo)) continue;
    try { await unlink(join(directory, file.archivo)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}

const activeManifests = new Set();
const manifestName = /^cleanup-[a-f0-9-]{36}\.json$/;
async function reconcileManifest(commerce,directory,name){
  const path=join(directory,name),files=JSON.parse(await readFile(path,'utf8'));
  if(!Array.isArray(files)||files.length>3||files.some(file=>!privateName.test(file.archivo)))throw new Error('Manifest inválido.');
  // A locking read waits for an in-flight commit before deciding which files are unused.
  const retained=await commerce.referenceFilesInUse(files);
  await cleanup(files,directory,retained);await unlink(path);
}
export async function reconcileReferenceFiles(commerce,directory){
  let names;try{names=await readdir(directory);}catch(error){if(error.code==='ENOENT')return;throw error;}
  for(const name of names)if(manifestName.test(name)&&!activeManifests.has(join(directory,name))){
    try{await reconcileManifest(commerce,directory,name);}catch{/* Preserve files and manifest until the database can confirm their outcome. */}
  }
}
async function withNormalizedFiles(req, directory, commerce, action) {
  const saved = [];let committed = false, manifest;
  try {
    for (const file of req.files || []) {
      const path = await saveImage(file, directory);
      saved.push({ archivo: basename(path), hash_original: createHash('sha256').update(file.buffer).digest('hex') });
    }
    if(saved.length){manifest=join(directory,'cleanup-'+randomUUID()+'.json');activeManifests.add(manifest);await writeFile(manifest,JSON.stringify(saved),{flag:'wx'});}
    const result = await action(saved);committed = true;
    await cleanup(saved, directory, result.referencias || []);
    if(manifest)await unlink(manifest);
    return publicResult(result);
  } catch (error) {
    if(error.commitUncertain&&manifest){
      try{await reconcileManifest(commerce,directory,basename(manifest));}catch{/* An unknown commit must never destroy a possibly persisted reference. */}
    }else if(!committed){
      await cleanup(saved,directory);if(manifest)await unlink(manifest).catch(()=>{});
    }
    throw error;
  }finally{if(manifest)activeManifests.delete(manifest);}
}

export function mountReferenceRoutes(app, commerce, guards, referenceDir, limit) {
  if (!referenceDir) throw new Error('Falta configurar la carpeta privada de referencias.');
  const directory = resolve(referenceDir);
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_IMAGE_SIZE, files: 3, fields: 2, fieldSize: 16384, parts: 5 } }).array('referencias', 3);
  const write = [guards.requireUser, requireCsrf, allowedActor, limit || ((req, res, next) => next())];

  app.post('/api/pedidos-personalizados', ...write, upload, async (req, res) => {
    const data = formData(req);
    const datos = await withNormalizedFiles(req, directory, commerce, files => commerce.createWithReferences(req.user, { ...data, tipo: 'Personalizado' }, req.body.clave, files));
    res.status(201).json({ datos });
  });

  app.put('/api/pedidos/:id/referencias', ...write, async (req, res, next) => {
    req.orderId = integer(req.params.id, 'Pedido', { min: 1 });
    // Commerce applies the same ownership rules as the normal detail endpoint.
    const order = await commerce.read(req.user, 'pedidos', { id: String(req.orderId) });
    if (!order) throw new AppError(404, 'No se encontró el pedido.');
    next();
  }, upload, async (req, res) => {
    const data = formData(req);
    const version = integer(data.version, 'Versión', { min: 1 });
    if (!req.files?.length && data.vaciar_referencias !== true) throw new AppError(400, 'Adjunta imágenes o confirma que deseas quitar todas las referencias.');
    const datos = await withNormalizedFiles(req, directory, commerce, files => commerce.replaceReferences(req.user, req.orderId, version, req.body.clave, files));
    res.json({ datos });
  });

  app.get('/api/pedidos/:id/referencias/:idReferencia', guards.requireUser, allowedActor, async (req, res, next) => {
    const id = integer(req.params.id, 'Pedido', { min: 1 });
    const ref = integer(req.params.idReferencia, 'Referencia', { min: 1, max: Number.MAX_SAFE_INTEGER });
    const metadata = await commerce.referenceById(req.user, id, ref);
    if (!metadata || !privateName.test(metadata.archivo)) throw new AppError(404, 'No se encontró la imagen de referencia.');
    res.set({ 'Cache-Control': 'private, no-store', 'Content-Type': 'image/webp', 'X-Content-Type-Options': 'nosniff' });
    res.sendFile(join(directory, metadata.archivo), { cacheControl: false, lastModified: false, acceptRanges: false }, error => {
      if (error) next(error.code === 'ENOENT' ? new AppError(404, 'No se encontró la imagen de referencia.') : error);
    });
  });
}
