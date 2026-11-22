import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { STATUTORY_DEPARTMENTS, REMAINING_STATUTORY_CODES } from '../src/config/statutory-departments.js';
import { createUniversityPdf, departmentApprovalLayout } from '../src/services/pdf.service.js';
import { removeFile } from '../src/services/file-storage.service.js';

test('statutory department catalog contains 13 unique official offices and five new offices', () => {
  assert.equal(STATUTORY_DEPARTMENTS.length, 13);
  assert.equal(new Set(STATUTORY_DEPARTMENTS.map(({ code }) => code)).size, 13);
  assert.deepEqual(STATUTORY_DEPARTMENTS.filter(({ code }) => REMAINING_STATUTORY_CODES.includes(code)).map(({ code }) => code), REMAINING_STATUTORY_CODES);
  for (const department of STATUTORY_DEPARTMENTS) {
    assert.match(department.code, /^[A-Z]{3}$/);
    assert.ok(department.name.length > 3);
    assert.ok(department.officerName.length > 3);
  }
});

test('dynamic certificate grid scales from two to three columns without fixed department indices', () => {
  assert.deepEqual(departmentApprovalLayout(8), { columns: 2, rows: 4 });
  assert.deepEqual(departmentApprovalLayout(13), { columns: 3, rows: 5 });
  assert.deepEqual(departmentApprovalLayout(17), { columns: 3, rows: 6 });
});

test('A4 clearance certificate renders all 13 approval stamps on one PDF page', async () => {
  const approvals = STATUTORY_DEPARTMENTS.map((department, index) => ({
    department: `${department.name} [${department.code}]`,
    officer: department.officerName,
    approvedAt: '22 Nov 2026, 10:00 PKT',
    verification: `VERIFY${String(index + 1).padStart(6, '0')}`,
  }));
  const generated = await createUniversityPdf({
    kind: 'clearance-certificate', reference: 'CERT-DYNAMIC-13', title: 'Clearance Certificate',
    fields: [['Student', 'Dynamic Test Student'], ['Status', 'Completed (13/13 departments)']],
    qrText: 'GRADFLOW-CLEARANCE-DYNAMIC-13', departmentApprovals: approvals,
  });
  try {
    const bytes = await readFile(generated.path);
    assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
    assert.ok(bytes.length > 2000);
    const pageObjects = bytes.toString('latin1').match(/\/Type\s*\/Page\b/g) || [];
    assert.equal(pageObjects.length, 1);
  } finally { await removeFile(generated.path); }
});
