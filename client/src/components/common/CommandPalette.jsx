import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Command, Search, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function CommandPalette({ entries, open, onClose }) {
  const [query, setQuery] = useState(''); const input = useRef(null); const navigate = useNavigate()
  useEffect(() => { if (open) window.setTimeout(() => input.current?.focus(), 0) }, [open])
  useEffect(() => {
    if (!open) return undefined
    const close = (event) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', close); return () => document.removeEventListener('keydown', close)
  }, [open, onClose])
  const matches = useMemo(() => entries.filter(([, label, , description = '']) => `${label} ${description}`.toLowerCase().includes(query.toLowerCase())), [entries, query])
  const go = (to) => { navigate(to); onClose() }
  if (!open) return null
  return <div className="command-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="command-palette" role="dialog" aria-modal="true" aria-label="Quick navigation"><header><Search /><input ref={input} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search pages and actions…" onKeyDown={(event) => { if (event.key === 'Enter' && matches[0]) go(matches[0][0]) }} /><button onClick={onClose} aria-label="Close command palette"><X /></button></header><div>{matches.length ? matches.map(([to, label, Icon, description]) => <button key={to} onClick={() => go(to)}><span><Icon /></span><div><strong>{label}</strong><small>{description || 'Open workspace'}</small></div><ArrowRight /></button>) : <p className="command-empty">No matching page or action.</p>}</div><footer><span><Command />K to open</span><span>Enter to select · Esc to close</span></footer></section></div>
}
