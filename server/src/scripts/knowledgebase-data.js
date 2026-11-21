// ALL VERIFIED UET MARDAN DATA INCLUDED INTERNALLY
const officialKnowledgeBaseData = [
  {
    title: 'UET Mardan Degree Application Prerequisites & Mandatory Checklist',
    category: 'degree_process',
    content: `Per the official UET Mardan "Application Form for Issuance of Degree" and Prospectus:
Candidates must apply PERSONALLY for degree issuance (no one can apply on behalf of the candidate).

Eligibility Prerequisites:
1. Completion of all academic degree requirements in compliance with UET Mardan Satisfactory Academic Progress (SAP) rules and PEC/HEC guidelines.
2. Full settlement of all outstanding university dues.
3. Attached official UET Mardan Clearance Certificate.

Mandatory Document Checklist to attach with Degree Application:
1. University Clearance Certificate from UET Mardan (all departmental dues cleared).
2. Original Bank Deposit Slip for Issuance of Degree (deposited in Bank of Khyber).
3. Original Bank Deposit Slip for Verification of Degree (separate slip required).
4. Attested photocopy of CNIC.
5. Two (02) passport-size color photographs: ONE attested on the front and ONE attested on the back by the Chairman of the concerned Department.
6. Internship / 800-Hour Practical Training or Experience Certificate, duly attested by the Department Chairman (mandatory for engineering/computing programs).
7. Photocopy of Final Year DMC and an attested photocopy of SSC (Matric) Certificate.

Note: All particulars on the form must be filled in the candidate's own handwriting with names and father's name written in BLOCK letters. Incomplete forms will be rejected or cause delays.`
  },
  {
    title: 'UET Mardan Official Fee Structure & Bank Account Details',
    category: 'fees_and_accounts',
    content: `Official UET Mardan Fee Schedule (per Prospectus 2023-24):
1. Degree Issuance Fee: Rs. 5,000.
2. Duplicate Degree Fee: Rs. 10,000.
3. Semester Transcript / DMC (Ordinary): Rs. 1,000.
4. Semester Transcript / DMC (Urgent): Rs. 1,500.
5. Final Transcript / Final DMC (Ordinary Embossed): Rs. 1,200.
6. Final Transcript / Final DMC (Urgent Embossed): Rs. 2,400.

Official Bank & Deposit Details:
- Bank Name: The Bank of Khyber (BoK).
- Branch: Sugar Mill Road Branch, Mardan (Branch Code: 0179).
- Account Title: Miscellaneous Fund UETM.
- Account Number: 003001354859 (or 3001354859).
- IBAN: PK98 KHYB 0179 0030 0135 4859.

Important: Fees must be paid through bank challan/deposit slip at Bank of Khyber. Separate deposit slips are required for Degree Issuance and Degree Verification.`
  },
  {
    title: 'Clearance Process, Institutional Sections & Chairman Attestation',
    category: 'clearance_rules',
    content: `Before degree issuance, graduating students must complete institutional clearance across all university sections and obtain the official Clearance Certificate.

Key Clearance Sections & Offices (per UET Mardan Statutes):
1. Head of Concerned Academic Department / Chairman (Verifies curriculum requirements, FYP, and training).
2. Dean's Office (Academic compliance).
3. Central Library (Return of borrowed books, thesis copies, and clearance of overdue fines).
4. Central Store Section (Laboratory tools, apparatus, and equipment clearance).
5. Transport Section (Return of university bus route passes and clearance of outstanding dues).
6. Hostel Wardens (Clearance of room possession, mess bills, and hostel dues for resident students).
7. Treasurer / Accounts Section (Verification of tuition fees, fines, and overall university accounts).
8. Registrar Office & Admission Section (Final document archive and record verification).
9. Director of Works (Campus property clearance).

Correction & Re-review Policy:
Incomplete forms or missing particulars will not be processed. If any section flags an issue (e.g. pending dues or unreturned property), previously approved sections remain protected/locked while the student resolves the specific objection.`
  },
  {
    title: 'Degree Collection, Handover & Personal Application Policy',
    category: 'collection_policy',
    content: `UET Mardan Degree Handover & Collection Rules:
1. Personal Application Rule: The official degree regulation explicitly dictates that no one can apply on behalf of the candidate concerned. The student must apply directly.
2. Collection Readiness: When all 10 verified documents and clearance certificates are approved by the Controller of Examinations, the degree application transitions to "degree_ready", and a digital Collection Receipt is issued.
3. Physical Pickup:
   - Location: Office of the Controller of Examinations, Ground Floor, Academic Block, UET Mardan.
   - Requirements for Handover: The student must produce their Original CNIC, Student ID card, and the printed Collection Receipt.
   - Handover is formally recorded with date, signature, and permanent ledger entry.`
  },
  {
    title: 'UET Mardan Official Directory, Contacts & Working Hours',
    category: 'general_info',
    content: `Official Directory & Contact Information for UET Mardan:

Key Administrative Offices:
- Controller of Examinations: controller@uetmardan.edu.pk | Phone: +92-937-9230249
- Registrar Office: Registrar@uetmardan.edu.pk | Phone: +92-937-9230295 | Fax: +92-937-9230296
- Dean of Engineering: dean@uetmardan.edu.pk | Phone: +92-937-9230449
- General Inquiries: info@uetmardan.edu.pk

Academic Department Chairmen:
- Computer Software Engineering (SE): chair.se@uetmardan.edu.pk | Phone: +92-937-9230452
- Computer Science (CS): chair.cs@uetmardan.edu.pk | Phone: +92-937-9230452
- Electrical Engineering (EE): chair.ee@uetmardan.edu.pk | Phone: +92-937-9230482
- Telecommunication Engineering (TE): chair.te@uetmardan.edu.pk | Phone: +92-937-9230454

Hostels:
- Ahmad Shah Abdali Boys Hostel: Contact Warden Office
- Ayesha Girls Hostel: Phone: +92-937-9230236

Campus Address:
University of Engineering & Technology (UET) Mardan, Charsadda Road, Mardan, Khyber Pakhtunkhwa, Pakistan.

Official Working Hours:
Monday to Friday: 08:00 AM to 04:00 PM (Administrative & Examination offices). Closed on Saturdays, Sundays, and public holidays.`
  }
];

const sourceDocuments = [
  'm06:degree-application-checklist',
  'm06:fees-and-bank-details',
  'm06:clearance-sections',
  'm06:degree-collection-policy',
  'm06:official-directory',
];

/**
 * Return fresh article objects for the idempotent seeder. This module contains
 * data only; database writes and embedding generation belong to
 * seed-knowledgebase.js so importing it never starts work or exits Node.
 */
export function buildKnowledgeBaseArticles(activeDepartments = []) {
  const departmentNames = activeDepartments
    .map((department) => department?.name?.trim())
    .filter(Boolean);

  return officialKnowledgeBaseData.map((article, index) => ({
    ...article,
    source_document: sourceDocuments[index],
    ...(index === 2 && departmentNames.length > 0
      ? { content: `${article.content}\n\nCurrently active clearance departments in the system:\n${departmentNames.map((name) => `- ${name}`).join('\n')}` }
      : {}),
  }));
}
