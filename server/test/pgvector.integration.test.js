import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, mock, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';

// Execute real PostgreSQL migrations and the service's real parameterized SQL
// in an isolated in-memory WASM database. Never connect to the user's Neon DB.
const db = new PGlite({ extensions: { vector } });
mock.module('../src/config/env.js', { namedExports: {} });
mock.module('../src/config/prisma.js', {
  defaultExport: {
    $queryRaw: async (strings, ...values) => {
      const sql = strings.reduce((text, part, index) => `${text}${index ? `$${index}` : ''}${part}`, '');
      return (await db.query(sql, values)).rows;
    },
  },
  namedExports: { withDbRetry: (operation) => operation() },
});
const { searchKnowledgeBase } = await import('../src/services/ai.service.js');
const migration = (name) => readFile(new URL(`../prisma/migrations/${name}/migration.sql`, import.meta.url), 'utf8');
let registrationSql;

before(async () => {
  await db.exec(await migration('20261011082521_init'));
  // Existing Milestones 01-05 records must survive both new migrations.
  await db.exec(`
    INSERT INTO users(full_name,email,password_hash,role)
      VALUES ('Existing Student','existing@example.test','test-hash','student');
    INSERT INTO chat_sessions(user_id,started_at)
      VALUES (1,'2026-11-01 10:00:00.123456+00');
    INSERT INTO chat_messages(session_id,role,content,created_at)
      VALUES (1,'user','Existing message','2026-11-01 10:01:00.654321+00');
    INSERT INTO knowledge_base(title,category,content)
      VALUES ('Existing article','general_info','Existing content');
  `);
  registrationSql = await migration('20261116000000_registration_schema_sync');
  await db.exec(registrationSql);
  await db.exec(`
    INSERT INTO academic_programs(name,code,level) VALUES ('Software Engineering','TEST-SE','Undergraduate');
    INSERT INTO eligible_students(registration_no,email,full_name,program_id)
      VALUES ('TEST-1','eligible@example.test','Eligible Student',1);
  `);
  // Simulate a database whose program/registration schema already existed.
  await db.exec(registrationSql);
  await db.exec(await migration('20261117000000_m06_rag_chatbot'));
  await db.exec(await migration('20261122000000_backend_hardening'));
  await db.exec(await migration('20261123000000_password_recovery'));
});

after(async () => db.close());

test('full migration chain creates all sixteen tables and enables pgvector', async () => {
  const { rows } = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'");
  assert.equal(rows.length, 16);
  for (const table of ['academic_programs', 'eligible_students', 'registration_requests', 'knowledge_base', 'chat_sessions', 'password_reset_requests']) {
    assert.ok(rows.some((row) => row.table_name === table));
  }
  assert.equal((await db.query("SELECT extname FROM pg_extension WHERE extname='vector'")).rows.length, 1);
});

test('registration reconciliation preserves data and does not duplicate foreign keys', async () => {
  assert.equal((await db.query('SELECT full_name,program_id FROM users WHERE user_id=1')).rows[0].full_name, 'Existing Student');
  assert.equal((await db.query('SELECT COUNT(*)::int AS count FROM eligible_students')).rows[0].count, 1);
  assert.equal((await db.query('SELECT COUNT(*)::int AS count FROM academic_programs')).rows[0].count, 1);
  const { rows } = await db.query("SELECT conrelid::regclass::text AS relation FROM pg_constraint WHERE contype='f' AND conrelid IN ('eligible_students'::regclass,'registration_requests'::regclass)");
  assert.equal(rows.length, 2);
});

test('M06 backfills millisecond timestamps that work with JavaScript Date optimistic comparisons', async () => {
  const session = (await db.query('SELECT updated_at FROM chat_sessions WHERE session_id=1')).rows[0];
  assert.equal(new Date(session.updated_at).toISOString(), '2026-11-01T10:01:00.654Z');
  const claimed = await db.query('UPDATE chat_sessions SET updated_at=$1 WHERE session_id=1 AND updated_at=$2 RETURNING session_id', [new Date('2026-11-02'), new Date(session.updated_at)]);
  assert.equal(claimed.rows.length, 1);
  const article = (await db.query('SELECT updated_at FROM knowledge_base WHERE kb_id=1')).rows[0];
  assert.equal((await db.query('UPDATE knowledge_base SET is_active=false WHERE kb_id=1 AND updated_at=$1 RETURNING kb_id', [new Date(article.updated_at)])).rows.length, 1);
});

test('real pgvector retrieval ranks cosine similarity, applies threshold and excludes inactive or mismatched embeddings', async () => {
  const aligned = Array(384).fill(0); aligned[0] = 1;
  const perpendicular = Array(384).fill(0); perpendicular[1] = 1;
  const opposite = aligned.map((value) => -value);
  for (const [title, embedding, active, model] of [
    ['Best A', JSON.stringify(aligned), true, 'Xenova/all-MiniLM-L6-v2:quantized:mean-v1'],
    ['Best B', JSON.stringify(aligned), true, 'Xenova/all-MiniLM-L6-v2:quantized:mean-v1'],
    ['Unrelated', JSON.stringify(perpendicular), true, 'Xenova/all-MiniLM-L6-v2:quantized:mean-v1'],
    ['Opposite', JSON.stringify(opposite), true, 'Xenova/all-MiniLM-L6-v2:quantized:mean-v1'],
    ['Disabled', JSON.stringify(aligned), false, 'Xenova/all-MiniLM-L6-v2:quantized:mean-v1'],
    ['Other model', JSON.stringify(Array(768).fill(1)), true, 'gemini-embedding-001'],
    ['Legacy', 'invalid legacy vector', true, null],
  ]) {
    await db.query('INSERT INTO knowledge_base(title,category,content,embedding,is_active,embedding_model) VALUES ($1,$2,$3,$4,$5,$6)', [title, 'test', 'Grounded guidance', embedding, active, model]);
  }
  const matches = await searchKnowledgeBase(aligned, 4, 0.3);
  assert.deepEqual(matches.map((row) => row.title), ['Best A', 'Best B']);
  assert.equal(matches[0].similarity, 1);
  assert.equal((await searchKnowledgeBase(aligned, 1, 0.3)).length, 1);
  const all = await searchKnowledgeBase(aligned, 10, -1);
  assert.deepEqual(all.map((row) => row.title), ['Best A', 'Best B', 'Unrelated', 'Opposite']);
  assert.equal(all.at(-1).similarity, -1);
});

test('session deletion cascades messages in the migrated database', async () => {
  assert.equal((await db.query('SELECT COUNT(*)::int AS count FROM chat_messages WHERE session_id=1')).rows[0].count, 1);
  await db.exec('DELETE FROM chat_sessions WHERE session_id=1');
  assert.equal((await db.query('SELECT COUNT(*)::int AS count FROM chat_messages WHERE session_id=1')).rows[0].count, 0);
});

test('hardening constraints reject duplicate active clearances and duplicate document types', async () => {
  await db.query("INSERT INTO clearance_requests(student_id,status) VALUES (1,'in_progress')");
  await assert.rejects(db.query("INSERT INTO clearance_requests(student_id,status) VALUES (1,'correction_required')"));
  await db.query("UPDATE clearance_requests SET status='completed' WHERE clearance_id=1");
  await db.query("INSERT INTO clearance_requests(student_id,status) VALUES (1,'in_progress')");
  await db.query("INSERT INTO degree_applications(student_id,clearance_id,status,updated_at) VALUES (1,1,'application_started',CURRENT_TIMESTAMP)");
  await db.query("INSERT INTO documents(degree_app_id,document_type,file_url) VALUES (1,'CNIC','/private/documents/a.pdf')");
  await assert.rejects(db.query("INSERT INTO documents(degree_app_id,document_type,file_url) VALUES (1,'CNIC','/private/documents/b.pdf')"));
});
