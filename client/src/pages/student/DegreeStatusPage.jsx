import { useEffect, useState } from 'react'
import { CheckCircle2, Clock3, FileSearch, GraduationCap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cachedGet } from '../../services/api.js'
import { Card, EmptyState, PageHeader, Skeleton, StatusBadge } from '../../components/common/UI.jsx'

const stages = [
  ['application_started', 'Draft initiated', 'Application particulars and documents remain editable.'],
  ['documents_uploaded', 'Submitted by student', 'Application and uploaded files are locked.'],
  ['controller_review', 'Controller verification', 'The Examination Office is inspecting every document.'],
  ['degree_processing', 'Degree processing', 'Approved for printing and official ledger entry.'],
  ['degree_ready', 'Ready for collection', 'Degree is sealed and a pickup receipt has been issued.'],
  ['degree_collected', 'Degree collected', 'Physical handover has been recorded.'],
  ['completed', 'Archived permanently', 'The issuance workflow is complete.'],
]

export default function DegreeStatusPage() {
  const [application, setApplication] = useState(undefined)
  useEffect(() => { cachedGet('/degree/my-application').then(({ data }) => setApplication(data.data)).catch(() => setApplication(null)) }, [])
  if (application === undefined) return <><PageHeader eyebrow="Degree issuance" title="Application tracking" description="Follow every official processing stage." /><Card><Skeleton rows={7} /></Card></>
  if (!application) return <><PageHeader eyebrow="Degree issuance" title="Application tracking" description="Follow every official processing stage." /><Card><EmptyState icon={FileSearch} title="No degree application" description="Complete clearance and initiate a degree application to begin tracking." /></Card></>
  const active = stages.findIndex(([status]) => status === application.status)
  return <><PageHeader eyebrow="Degree issuance" title="Seven-stage application tracker" description={`Application #${application.degree_app_id}`} actions={<StatusBadge status={application.status} />} /><Card className="degree-tracker"><div className="tracker-heading"><span><GraduationCap /></span><div><h2>Official degree pipeline</h2><p>Stages progress sequentially and cannot be skipped.</p></div></div><div className="seven-stage-stepper">{stages.map(([status, label, description], index) => { const complete = index < active; const current = index === active; return <div className={complete ? 'complete' : current ? 'current' : ''} key={status}><span>{complete ? <CheckCircle2 /> : current ? <Clock3 /> : index + 1}</span><div><small>Stage {index + 1}</small><strong>{label}</strong><p>{description}</p></div></div> })}</div>{application.receipt && active >= 4 && <div className="tracker-receipt"><div><strong>Collection receipt available</strong><p>Review the scheduled pickup date and download the official applicant copy.</p></div><Link className="button primary" to="/student/degree/receipt">Open collection receipt</Link></div>}</Card></>
}
