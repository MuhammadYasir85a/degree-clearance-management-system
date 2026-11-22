import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { resolve, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fileTypeFromBuffer } from 'file-type';

const serverRoot = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const privateRoot = resolve(serverRoot, 'private-uploads');
const legacyRoot = resolve(serverRoot, 'uploads');
const allowed = new Map([
  ['application/pdf', '.pdf'], ['image/jpeg', '.jpg'], ['image/png', '.png'],
]);

export async function storeValidatedDocument(file) {
  if (!file?.buffer) throw Object.assign(new Error('No file uploaded.'), { status: 400 });
  const detected = await fileTypeFromBuffer(file.buffer);
  const extension = allowed.get(detected?.mime);
  if (!extension) {
    throw Object.assign(new Error('Invalid file content. Only genuine JPEG, PNG, and PDF files are allowed.'), { status: 400 });
  }
  const directory = resolve(privateRoot, 'documents');
  await mkdir(directory, { recursive: true });
  const filename = `${randomUUID()}${extension}`;
  const path = resolve(directory, filename);
  await writeFile(path, file.buffer, { flag: 'wx', mode: 0o600 });
  return { path, filename, mime: detected.mime };
}

export function resolveStoredDocument(fileUrl) {
  const value = String(fileUrl || '');
  const filename = basename(value);
  if (!filename || filename !== value.split('/').at(-1)) return null;
  return value.startsWith('/uploads/')
    ? resolve(legacyRoot, filename)
    : resolve(privateRoot, 'documents', filename);
}

export async function removeFile(path) {
  if (!path) return;
  try { await unlink(path); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}

export function safeDownloadName(documentType, storedPath) {
  return `${String(documentType).toLowerCase()}${extname(storedPath)}`;
}
