import { useCallback, useEffect, useState } from 'react'
import { Activity, CalendarClock, Database, Download, Hash, Monitor, Search, ShieldCheck, UserRound, X } from 'lucide-react'
import api, { errorMessage } from '../../services/api.js'
import { Card, EmptyState, PageHeader, Skeleton } from '../../components/common/UI.jsx'

const titleCase = (value = '') => value.toLowerCase().split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
const formatTime = (value) => new Date(value).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' })

function AuditDetail({ record, onClose }) {
  const technicalDetails = record.details && Object.keys(record.details).length > 0
  return <div className="modal-backdrop"><section className="admin-modal audit-detail-modal" role="dialog" aria-modal="true" aria-labelledby="audit-detail-title">
    <header><div><p className="eyebrow">Audit event details</p><h2 id="audit-detail-title">{titleCase(record.action)}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close audit details"><X /></button></header>
    <div className="audit-summary"><span><ShieldCheck /></span><div><strong>Recorded institutional action</strong><p>{record.description || 'This event was recorded without an additional description.'}</p></div></div>
    <div className="audit-detail-grid">
      <article><span><UserRound /></span><div><small>Performed by</small><strong>{record.user?.full_name || 'Automated system'}</strong><p>{record.user?.email || 'System-generated event'}</p></div><b>{titleCase(record.user?.role || 'service')}</b></article>
      <article><span><CalendarClock /></span><div><small>Date and time</small><strong>{formatTime(record.created_at)}</strong><p>Pakistan Standard Time</p></div></article>
      <article><span><Database /></span><div><small>Affected record</small><strong>{titleCase(record.entity_type)}</strong><p>Institutional data entity</p></div><b>#{record.entity_id ?? 'N/A'}</b></article>
      <article><span><Monitor /></span><div><small>Network source</small><strong>{record.ip_address || 'Not captured'}</strong><p>{record.ip_address ? 'Request IP address' : 'Historical event recorded before IP tracking'}</p></div></article>
      <article><span><Hash /></span><div><small>Immutable event ID</small><strong>AUD-{String(record.log_id).padStart(6, '0')}</strong><p>Permanent audit reference</p></div></article>
      <article><span><Activity /></span><div><small>Event classification</small><strong>{titleCase(record.action)}</strong><p>System audit action</p></div></article>
    </div>
    {technicalDetails && <details className="audit-technical"><summary>View recorded change fields</summary><div>{Object.entries(record.details).map(([key, value]) => <p key={key}><span>{titleCase(key)}</span><strong>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</strong></p>)}</div></details>}
    <footer><span><ShieldCheck size={15} />This record is read-only and cannot be modified.</span><button className="button primary" onClick={onClose}>Close details</button></footer>
  </section></div>
}

export default function AuditLogs() {
  const [result, setResult] = useState(); const [search, setSearch] = useState(''); const [page, setPage] = useState(1); const [selected, setSelected] = useState(null); const [error, setError] = useState('')
  const load = useCallback(() => api.get(`/admin/audit-logs?search=${encodeURIComponent(search)}&page=${page}&limit=20`).then(({ data }) => setResult(data)).catch((e) => setError(errorMessage(e))), [search, page])
  useEffect(() => { const timer = setTimeout(load, 250); return () => clearTimeout(timer) }, [load])
  return <><PageHeader eyebrow="Compliance and forensics" title="Immutable activity audit" description="Read-only institutional event history. Audit records cannot be edited or deleted." actions={<a className="button secondary" href="/api/admin/audit-logs/export"><Download size={16} />Export CSV</a>} />
    {error && <div className="page-alert">{error}</div>}<Card><div className="table-toolbar"><div><h2>System event stream</h2><p>{result?.pagination.total ?? 0} immutable records</p></div><label className="search-field"><Search /><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Search action, user, or entity" /></label></div>
    {!result ? <Skeleton rows={8} /> : !result.data.length ? <EmptyState icon={Activity} title="No audit events found" description="Change the search terms." /> : <div className="responsive-table"><table><thead><tr><th>Timestamp</th><th>User</th><th>Action</th><th>Entity</th><th>IP address</th><th>Detail</th></tr></thead><tbody>{result.data.map((row) => <tr key={row.log_id}><td>{formatTime(row.created_at)}</td><td><strong>{row.user?.full_name || 'System'}</strong><small className="table-subtitle">{titleCase(row.user?.role || 'service')}</small></td><td><span className="audit-action-chip">{titleCase(row.action)}</span></td><td>{titleCase(row.entity_type)} {row.entity_id ? `#${row.entity_id}` : ''}</td><td>{row.ip_address || <span className="muted">Not captured</span>}</td><td><button className="button secondary small" onClick={() => setSelected(row)}>View details</button></td></tr>)}</tbody></table></div>}
    <div className="pagination"><button disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} of {Math.max(1, result?.pagination.pages || 1)}</span><button disabled={page >= (result?.pagination.pages || 1)} onClick={() => setPage(page + 1)}>Next</button></div></Card>
    {selected && <AuditDetail record={selected} onClose={() => setSelected(null)} />}
  </>
}
