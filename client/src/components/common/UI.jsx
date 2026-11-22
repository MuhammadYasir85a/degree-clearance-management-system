import { AlertCircle, CheckCircle2, Clock3, LockKeyhole } from 'lucide-react'
import { clsx } from 'clsx'
const config = {
  approved: ['Approved', 'success', CheckCircle2], completed: ['Completed', 'success', CheckCircle2], verified: ['Verified', 'success', CheckCircle2], degree_ready: ['Ready for collection', 'success', CheckCircle2],
  correction_required: ['Correction required', 'warning', AlertCircle], rejected: ['Rejected', 'danger', AlertCircle], pending: ['Pending', 'info', Clock3], in_progress: ['In progress', 'info', Clock3],
  not_applicable: ['Not applicable', 'neutral', CheckCircle2], locked: ['Locked', 'neutral', LockKeyhole],
}
export function StatusBadge({ status, label }) {
  const [text, tone, Icon] = config[status] || [String(status || 'Not started').replaceAll('_', ' '), 'neutral', Clock3]
  return <span className={clsx('status-badge', `status-${tone}`)}><Icon size={14} />{label || text}</span>
}
export function Card({ children, className, as: Tag = 'section' }) { return <Tag className={clsx('portal-card', className)}>{children}</Tag> }
export function PageHeader({ eyebrow, title, description, actions }) { return <header className="page-header"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>{actions && <div className="page-actions">{actions}</div>}</header> }
export function EmptyState({ icon: Icon, title, description, action }) { return <div className="empty-state"><span className="empty-icon"><Icon size={28} /></span><h3>{title}</h3><p>{description}</p>{action}</div> }
export function ProgressBar({ value }) { return <div className="progress-track" aria-label={`${value}% complete`}><span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div> }
export function Skeleton({ rows = 3 }) { return <div className="skeleton-list" aria-label="Loading">{Array.from({ length: rows }, (_, i) => <div className="skeleton-row" key={i} />)}</div> }
