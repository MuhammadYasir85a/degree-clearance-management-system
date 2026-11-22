import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, ClipboardCheck, Save, Send, ShieldCheck, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api, { cachedGet, errorMessage, invalidateApiCache } from '../../services/api.js'
import { Card, PageHeader, Skeleton } from '../../components/common/UI.jsx'

const draftKey = 'uet_clearance_draft'

export default function ClearanceApply() {
  const navigate = useNavigate()
  const [preview, setPreview] = useState(null)
  const [step, setStep] = useState(1)
  const [notes, setNotes] = useState(() => localStorage.getItem(draftKey) || '')
  const [certified, setCertified] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { cachedGet('/clearance/preview', { ttl: 60000 }).then(({ data }) => setPreview(data.data)).catch((e) => setError(errorMessage(e))) }, [])
  const save = () => { localStorage.setItem(draftKey, notes); setMessage('Draft saved on this device. You can safely return later.') }
  const submit = async () => {
    if (!certified) { setError('Confirm the undertaking before submitting your application.'); return }
    setBusy(true); setError('')
    try { await api.post('/clearance/apply', { notes }); invalidateApiCache('/clearance'); localStorage.removeItem(draftKey); navigate('/student/dashboard') }
    catch (e) { setError(errorMessage(e)) } finally { setBusy(false) }
  }
  if (!preview) return <><PageHeader eyebrow="Clearance application" title="Prepare your request" description="Verify your record before formal routing." /><Card><Skeleton rows={7} /></Card></>
  const fields = [['Full name', preview.student.full_name], ['Father name', preview.student.father_name], ['Registration number', preview.student.registration_no], ['Program', preview.student.program?.name], ['CNIC', preview.student.cnic], ['Passing year', preview.student.passing_year], ['CGPA', preview.student.cgpa], ['Email', preview.student.email], ['Phone', preview.student.phone]]
  return <><PageHeader eyebrow="Clearance application" title="Application wizard" description="Review the three steps carefully. Submission routes the request to every active office." />
    {error && <div className="page-alert">{error}</div>}{message && <div className="success-alert"><CheckCircle2 />{message}</div>}
    <div className="wizard-steps">{[[1, UserRound, 'Academic record'], [2, Building2, 'Department preview'], [3, ClipboardCheck, 'Undertaking']].map(([number, Icon, label]) => <button key={number} className={step === number ? 'active' : step > number ? 'complete' : ''} onClick={() => setStep(number)}><span><Icon /></span><div><small>Step {number}</small><strong>{label}</strong></div></button>)}</div>
    <Card className="wizard-card">{step === 1 && <><div className="card-heading"><div><span className="section-icon"><UserRound /></span><div><p className="eyebrow">Bio verification</p><h2>Confirm your university record</h2></div></div></div><div className="profile-grid">{fields.map(([label, value]) => <div key={label}><small>{label}</small><strong>{value || 'Not recorded'}</strong></div>)}</div></>}
      {step === 2 && <><div className="card-heading"><div><span className="section-icon"><Building2 /></span><div><p className="eyebrow">Routing preview</p><h2>{preview.departments.length} active clearance offices</h2></div></div></div><div className="preview-departments">{preview.departments.map((department, index) => <div key={department.department_id}><span>{String(index + 1).padStart(2, '0')}</span><Building2 /><div><strong>{department.name}</strong><small>{department.code || 'University clearance office'}</small></div><ShieldCheck /></div>)}</div></>}
      {step === 3 && <><div className="card-heading"><div><span className="section-icon"><ClipboardCheck /></span><div><p className="eyebrow">Final declaration</p><h2>Notes and undertaking</h2></div></div></div><label className="notes-field">Optional note to clearance offices<textarea rows="5" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength="1000" placeholder="Add information that may help an office process your request." /></label><label className="undertaking"><input type="checkbox" checked={certified} onChange={(e) => setCertified(e.target.checked)} /><span>I certify that the information is correct and all known university dues and obligations have been settled.</span></label></>}
      <footer className="wizard-actions"><button className="button secondary" disabled={step === 1} onClick={() => setStep(step - 1)}><ArrowLeft />Back</button><button className="button secondary" onClick={save}><Save />Save draft</button>{step < 3 ? <button className="button primary" onClick={() => setStep(step + 1)}>Continue<ArrowRight /></button> : <button className="button primary" disabled={busy || !certified} onClick={submit}>{busy ? <span className="button-loader" /> : <><Send />Submit application</>}</button>}</footer>
    </Card></>
}
