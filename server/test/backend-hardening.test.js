import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { positiveInteger, pagination } from '../src/utils/http.utils.js';
import { storeValidatedDocument, removeFile } from '../src/services/file-storage.service.js';
import { createUniversityPdf, resolveGeneratedPdf } from '../src/services/pdf.service.js';

test('strict identifiers and bounded pagination reject ambiguous or excessive input', () => {
  assert.equal(positiveInteger('12'), 12);
  for (const value of ['12abc', '0', '-1', '1.5', '', null]) assert.throws(() => positiveInteger(value));
  assert.deepEqual(pagination({ page: '2', limit: '20' }), { page: 2, limit: 20, skip: 20 });
  assert.throws(() => pagination({ limit: '101' }));
});

test('document storage inspects bytes and rejects a forged MIME type', async () => {
  await assert.rejects(storeValidatedDocument({
    mimetype: 'application/pdf', buffer: Buffer.from('this is executable or arbitrary content'),
  }), /Invalid file content/);
});

test('generated university PDFs are real private PDF files', async () => {
  const generated = await createUniversityPdf({
    kind: 'receipt', reference: 'TEST-1', title: 'Test Receipt', fields: [['Student', 'Test Student']], qrText: 'GRADFLOW-TEST-RECEIPT-1',
  });
  try {
    assert.equal(resolveGeneratedPdf(generated.uri), generated.path);
    const bytes = await readFile(generated.path);
    assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
    assert.ok(bytes.length > 500);
  } finally {
    await removeFile(generated.path);
  }
});
