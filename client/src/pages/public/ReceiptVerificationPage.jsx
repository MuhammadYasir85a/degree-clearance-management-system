import { useEffect, useState } from 'react'
import { ArrowLeft, BadgeCheck, CalendarDays, GraduationCap, Search, ShieldAlert, ShieldCheck } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import api, { errorMessage } from '../../services/api.js'

const humanStatus = (value) => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())

export default function ReceiptVerificationPage() {
  const { receiptNumber = '' } = useParams(); const navigate = useNavigate()
  const [query, setQuery] = useState(receiptNumber); const [record, setRecord] = useState(receiptNumber ? undefined : null); const [error, setError] = useState('')
  useEffect(() => {
    if (!receiptNumber) return
    api.get(`/degree/verify-receipt/${encodeURIComponent(receiptNumber)}`).then(({ data }) => { setRecord(data.data); setError('') }).catch((requestError) => { setRecord(null); setError(errorMessage(requestError, 'This receipt could not be verified.')) })
  }, [receiptNumber])
  const submit = (event) => { event.preventDefault(); const value = query.trim().toUpperCase(); if (value) navigate(`/verify/${encodeURIComponent(value)}`) }
  return <main className="verification-page"><section className="verification-shell"><Link className="verification-brand" to="/login"><span><GraduationCap /></span><div><strong>GradFlow</strong><small>Official document verification</small></div></Link><div className="verification-card"><header><span><ShieldCheck /></span><p className="eyebrow">Public authenticity service</p><h1>Verify a collection receipt</h1><p>Scan the QR code on an official receipt or enter its reference below. No private documents are exposed.</p></header><form onSubmit={submit}><label htmlFor="receipt-reference">Receipt reference</label><div><Search /><input id="receipt-reference" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="RCT-GRADFLOW-…" autoComplete="off" /><button>Verify</button></div></form>{record === undefined && <div className="verification-loading"><span className="loader" /><p>Checking the university record</p></div>}{error && <div className="verification-result invalid"><ShieldAlert /><div><strong>Verification unsuccessful</strong><p>{error}</p></div></div>}{record && <div className="verification-result authentic"><div className="verification-seal"><BadgeCheck /><span><strong>Authentic record</strong><small>Issued by {record.institution}</small></span></div><dl><div><dt>Receipt number</dt><dd>{record.receipt_number}</dd></div><div><dt>Student</dt><dd>{record.student_name}</dd></div><div><dt>Registration</dt><dd>{record.registration_no}</dd></div><div><dt>Programme</dt><dd>{record.programme}</dd></div><div><dt>Collection date</dt><dd><CalendarDays />{new Date(record.collection_date).toLocaleDateString('en-PK', { dateStyle: 'long' })}</dd></div><div><dt>Current state</dt><dd>{humanStatus(record.status)}</dd></div></dl><p className="verification-note">Verified against the live academic issuance register. Identity and document details are intentionally limited.</p></div>}<footer><Link to="/login"><ArrowLeft />Return to portal</Link><span>Privacy-preserving verification</span></footer></div></section></main>
}
