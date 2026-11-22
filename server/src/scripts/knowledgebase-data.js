const platformKnowledgeBase = [
  {
    title: 'Degree Application Prerequisites and Document Checklist',
    category: 'degree_process',
    content: `Students may begin degree issuance only after completing their academic requirements and institutional clearance.

Required documents:
1. Completed institutional clearance certificate.
2. Degree issuance fee deposit slip.
3. Degree verification fee deposit slip.
4. Identity document copy.
5. Recent passport-size photograph.
6. Secondary and higher-secondary marks certificates and certificates.
7. Practical training or internship certificate when required by the programme.

All uploaded files must be readable, complete, and consistent with the student's academic record. The Controller of Examinations may reject an unclear or incorrect document and request a corrected copy.`,
  },
  {
    title: 'Fee Deposit and Payment Guidance',
    category: 'fees_and_accounts',
    content: `Degree issuance and verification fees must be deposited using the institution's currently approved banking instructions.

Students should obtain the current fee amount, bank name, account title, account number, and deposit procedure from the Accounts Office or their institution's official fee notice. Separate slips may be required for degree issuance and degree verification.

GradFlow does not publish institution-specific bank credentials in the shared knowledge base. Students must not rely on old receipts, screenshots, or unofficial messages for payment details.`,
  },
  {
    title: 'Institutional Clearance Process and Corrections',
    category: 'clearance_rules',
    content: `Before degree issuance, a graduating student must complete clearance from every active office configured by the institution.

Common clearance responsibilities include academic records, accounts, library material, hostel obligations, transport, stores, final-year project requirements, student affairs, and other statutory offices.

If an office requests a correction, approvals already granted by other offices remain locked. Only the office requesting the correction reviews the student's response again. An approved review cannot be modified by an officer through the normal workflow.`,
  },
  {
    title: 'Degree Collection and Physical Handover',
    category: 'collection_policy',
    content: `After all required documents are verified, the degree application moves into processing. The Controller of Examinations issues a collection receipt when the degree is ready.

For physical handover, the student must present the original identity document, student card, and printed collection receipt. Staff must complete every handover verification check before recording collection.

The exact collection date, office location, and instructions appear on the student's official receipt and dashboard notification.`,
  },
  {
    title: 'Support, Office Contacts and Working Hours',
    category: 'general_info',
    content: `GradFlow is a generic academic operations platform used by university examination and clearance offices.

Institution-specific email addresses, telephone numbers, office locations, banking details, and working hours are intentionally not embedded in the shared platform knowledge base. Students should use the contact information published by their own institution or contact the relevant office shown in their application status.

For an official decision, contact the Controller of Examinations, Registrar, Accounts Office, or the department responsible for the pending review.`,
  },
];

const sourceDocuments = [
  'platform:degree-application-checklist',
  'platform:fee-deposit-guidance',
  'platform:clearance-rules',
  'platform:degree-collection-policy',
  'platform:support-guidance',
];

export function buildKnowledgeBaseArticles(activeDepartments = []) {
  const departmentNames = activeDepartments
    .map((department) => department?.name?.trim())
    .filter(Boolean);

  return platformKnowledgeBase.map((article, index) => ({
    ...article,
    source_document: sourceDocuments[index],
    ...(index === 2 && departmentNames.length > 0
      ? { content: `${article.content}\n\nCurrently active clearance offices:\n${departmentNames.map((name) => `- ${name}`).join('\n')}` }
      : {}),
  }));
}
