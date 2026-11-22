import '../config/env.js';
import prisma, { withDbRetry } from '../config/prisma.js';

const oldDomain = /@(?:student\.)?uetmardan\.edu\.pk$/i;
const oldBrand = /(?:University of Engineering\s*&\s*Technology\s*\(UET\)\s*Mardan|University of Engineering\s*&\s*Technology Mardan|UET Mardan|UETM)/gi;

const genericEmail = (email) => String(email).replace(oldDomain, '@university.edu.pk');
const genericText = (value) => typeof value === 'string' ? value.replace(oldBrand, 'GradFlow') : value;

async function updateEmails(model) {
  const rows = await withDbRetry(() => model.findMany({
    where: { email: { contains: 'uetmardan.edu.pk', mode: 'insensitive' } },
  }));
  for (const row of rows) {
    const idField = 'user_id' in row ? 'user_id' : 'eligible_id' in row ? 'eligible_id' : 'request_id';
    await withDbRetry(() => model.update({ where: { [idField]: row[idField] }, data: { email: genericEmail(row.email) } }));
  }
  return rows.length;
}

async function updateTextRows(model, idField, fields) {
  const rows = await withDbRetry(() => model.findMany());
  let changed = 0;
  for (const row of rows) {
    const data = Object.fromEntries(fields
      .map((field) => [field, genericText(row[field])])
      .filter(([field, value]) => value !== row[field]));
    if (Object.keys(data).length) {
      await withDbRetry(() => model.update({ where: { [idField]: row[idField] }, data }));
      changed += 1;
    }
  }
  return changed;
}

async function main() {
  const [users, eligible] = await Promise.all([
    updateEmails(prisma.user),
    updateEmails(prisma.eligibleStudent),
  ]);
  const [notifications, logs, chats] = await Promise.all([
    updateTextRows(prisma.notification, 'notification_id', ['title', 'message']),
    updateTextRows(prisma.activityLog, 'log_id', ['description']),
    updateTextRows(prisma.chatMessage, 'message_id', ['content']),
  ]);
  const removedKnowledge = await withDbRetry(() => prisma.knowledgeBase.deleteMany({
    where: { source_document: { startsWith: 'm06:' } },
  }));
  console.log({ users, eligible, notifications, logs, chats, removedKnowledge: removedKnowledge.count });
}

main()
  .catch((error) => { console.error('Platform data migration failed.', { code: error.code || error.name }); process.exitCode = 1; })
  .finally(async () => { await withDbRetry(() => prisma.$disconnect()); });
