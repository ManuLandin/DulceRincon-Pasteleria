import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { AppError } from './errors.js';

export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
export async function saveImage(file, directory) {
  if (!file) throw new AppError(400, 'Selecciona la fotografía del producto; es obligatoria.');
  if (file.buffer.length > MAX_IMAGE_SIZE) throw new AppError(413, 'La fotografía supera el límite de 5 MB.');
  const formats = { 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' };
  if (!formats[file.mimetype]) throw new AppError(400, 'Usa una imagen JPG, PNG o WebP.');
  let output;
  try {
    const image = sharp(file.buffer, { limitInputPixels: 16000000, failOn: 'warning' });
    const metadata = await image.metadata();
    if (metadata.format !== formats[file.mimetype] || (metadata.pages || 1) !== 1) throw new Error('Invalid image format');
    output = await image.rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
  } catch { throw new AppError(400, 'No se pudo leer la fotografía. Selecciona un JPG, PNG o WebP válido, de hasta 16 millones de píxeles.'); }
  const name = `${randomUUID()}.webp`;
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, name), output, { flag: 'wx' });
  return `/uploads/productos/${name}`;
}
export async function removeImage(path, directory) {
  if (typeof path !== 'string' || !/^\/uploads\/productos\/[a-f0-9-]{36}\.webp$/.test(path)) return;
  try { await unlink(join(directory, path.split('/').at(-1))); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
