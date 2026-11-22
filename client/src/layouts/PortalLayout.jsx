import { Outlet, NavLink } from 'react-router-dom'
import { Activity, Bell, BookOpen, Bot, Building2, CheckCheck, ChevronDown, Contrast, Eye, FileCheck2, FileSpreadsheet, GraduationCap, LayoutDashboard, ListChecks, LogOut, Mail, Menu, MonitorPlay, Moon, Palette, ReceiptText, Search, ShieldCheck, Sun, UserCog, UserRound, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import AIChatWidget from '../components/chat/AIChatWidget.jsx'
import api from '../services/api.js'
import CommandPalette from '../components/common/CommandPalette.jsx'
const nav = {
  student: [['/student/dashboard', 'Overview', LayoutDashboard], ['/student/clearance/apply', 'Clearance application', ShieldCheck], ['/student/degree/apply', 'Degree application', FileCheck2], ['/student/degree/status', 'Degree status', ListChecks], ['/student/degree/receipt', 'Collection receipt', GraduationCap]],
  officer: [['/officer/dashboard', 'Clearance inbox', ShieldCheck]], controller: [['/controller/dashboard', 'Degree verification', FileCheck2], ['/controller/handover', 'Handover desk', ReceiptText]],
  admin: [['/admin/dashboard', 'Institution overview', LayoutDashboard], ['/admin/eligible-students', 'Eligibility roster', FileSpreadsheet], ['/admin/departments', 'Departments', Building2], ['/admin/users', 'Users & staff', UserCog], ['/admin/clearances', 'Clearance oversight', ShieldCheck], ['/controller/dashboard', 'Degree oversight', FileCheck2], ['/controller/handover', 'Handover desk', ReceiptText], ['/admin/knowledge-base', 'Knowledge base', BookOpen], ['/admin/audit-logs', 'Audit logs', Activity]],
}
function BrandMark() { return <div className="brand-mark" aria-hidden="true"><GraduationCap size={25} strokeWidth={1.8} /></div> }
const themes = [
  ['light', Sun, 'Light', 'Bright institutional canvas'],
  ['dark', Moon, 'Dark', 'Low-light dashboard'],
  ['comfort', Eye, 'Eye comfort', 'Warm reduced-glare palette'],
  ['contrast', Contrast, 'High contrast', 'Sharper accessible contrast'],
]
export default function PortalLayout() {
  const { user, logout } = useAuth(); const [open, setOpen] = useState(false); const [userMenu, setUserMenu] = useState(false); const [noticeMenu, setNoticeMenu] = useState(false); const [appearanceMenu, setAppearanceMenu] = useState(false); const [commandOpen, setCommandOpen] = useState(false); const [theme, setTheme] = useState(() => { const saved = localStorage.getItem('uet_portal_theme'); return ['light', 'dark', 'comfort', 'contrast'].includes(saved) ? saved : 'light' }); const [reducedMotion, setReducedMotion] = useState(() => localStorage.getItem('uet_reduced_motion') === 'true'); const [presentation, setPresentation] = useState(() => localStorage.getItem('uet_presentation_mode') === 'true'); const [notifications, setNotifications] = useState([]); const [unread, setUnread] = useState(0); const menuArea = useRef(null)
  useEffect(() => {
    const close = (event) => { if (!menuArea.current?.contains(event.target)) { setUserMenu(false); setNoticeMenu(false); setAppearanceMenu(false) } }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [])
  useEffect(() => { document.documentElement.dataset.theme = theme; document.documentElement.style.colorScheme = theme === 'dark' ? 'dark' : 'light'; localStorage.setItem('uet_portal_theme', theme) }, [theme])
  useEffect(() => { document.documentElement.dataset.motion = reducedMotion ? 'reduced' : 'full'; localStorage.setItem('uet_reduced_motion', String(reducedMotion)) }, [reducedMotion])
  useEffect(() => { document.documentElement.dataset.presentation = presentation ? 'masked' : 'off'; localStorage.setItem('uet_presentation_mode', String(presentation)) }, [presentation])
  useEffect(() => { const shortcut = (event) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setCommandOpen((value) => !value) } }; document.addEventListener('keydown', shortcut); return () => document.removeEventListener('keydown', shortcut) }, [])
  const showNotifications = async () => {
    const next = !noticeMenu; setNoticeMenu(next); setUserMenu(false); setAppearanceMenu(false)
    if (next) { try { const { data } = await api.get('/notifications'); setNotifications(data.data.slice(0, 8)); setUnread(data.unread_count) } catch { setNotifications([]) } }
  }
  const readAll = async () => { await api.put('/notifications/read-all'); setUnread(0); setNotifications((items) => items.map((item) => ({ ...item, is_read: true }))) }
  if (!user) return <div className="app-loading"><span className="loader" /><p>Returning to sign in</p></div>
  return <div className="portal-shell"><header className="topbar"><div className="topbar-inner">
    <button className="icon-button mobile-menu" onClick={() => setOpen(!open)} aria-label="Toggle navigation">{open ? <X /> : <Menu />}</button>
    <NavLink to={nav[user.role][0][0]} className="brand"><BrandMark /><span><strong>GradFlow</strong><small>Academic Operations Platform</small></span></NavLink>
    <div className="topbar-tools" ref={menuArea}><button className="icon-button command-button" onClick={() => setCommandOpen(true)} aria-label="Open quick navigation"><Search size={19} /></button><div className="menu-anchor"><button className="icon-button appearance-button" onClick={() => { setAppearanceMenu(!appearanceMenu); setNoticeMenu(false); setUserMenu(false) }} aria-label="Appearance settings"><Palette size={19} /></button>{appearanceMenu && <div className="top-menu appearance-menu"><header><strong>Appearance</strong><small>Saved for this browser</small></header>{themes.map(([value, Icon, label, description]) => <button className={theme === value ? 'active' : ''} key={value} onClick={() => setTheme(value)}><span><Icon /></span><div><strong>{label}</strong><small>{description}</small></div>{theme === value && <CheckCheck />}</button>)}<button className={reducedMotion ? 'active' : ''} onClick={() => setReducedMotion((value) => !value)}><span><Eye /></span><div><strong>Reduced motion</strong><small>Limit animation and movement</small></div>{reducedMotion && <CheckCheck />}</button><button className={presentation ? 'active' : ''} onClick={() => setPresentation((value) => !value)}><span><MonitorPlay /></span><div><strong>Presentation privacy</strong><small>Mask personal details on screen</small></div>{presentation && <CheckCheck />}</button></div>}</div><div className="menu-anchor"><button className="icon-button notification-button" onClick={showNotifications} aria-label="Notifications"><Bell size={19} />{unread > 0 && <span />}</button>{noticeMenu && <div className="top-menu notification-menu"><header><div><strong>Notifications</strong><small>{unread} unread</small></div>{unread > 0 && <button onClick={readAll}><CheckCheck />Mark all read</button>}</header><div>{notifications.length ? notifications.map((item) => <article className={item.is_read ? '' : 'unread'} key={item.notification_id}><Mail /><div><strong>{item.title}</strong><p>{item.message}</p><small>{new Date(item.created_at).toLocaleDateString('en-PK')}</small></div></article>) : <p className="menu-empty">No notifications to show.</p>}</div></div>}</div>
      <div className="menu-anchor"><button className="user-identity" onClick={() => { setUserMenu(!userMenu); setNoticeMenu(false); setAppearanceMenu(false) }} aria-expanded={userMenu} aria-haspopup="menu"><span className="avatar">{user.full_name.split(' ').map((p) => p[0]).slice(0, 2).join('')}</span><span><strong>{user.full_name}</strong><small>{user.role === 'student' ? user.registration_no : user.role}</small></span><ChevronDown className={userMenu ? 'rotated' : ''} size={15} /></button>{userMenu && <div className="top-menu user-menu" role="menu"><div className="user-menu-profile"><span><UserRound /></span><div><strong>{user.full_name}</strong><small>{user.email}</small></div></div><NavLink to={nav[user.role][0][0]} onClick={() => setUserMenu(false)}><LayoutDashboard />Open dashboard</NavLink><button onClick={logout}><LogOut />Sign out securely</button></div>}</div>
    </div></div></header><div className="portal-body"><aside className={open ? 'sidebar sidebar-open' : 'sidebar'}>
      <div className="sidebar-label">Workspace</div><nav>{nav[user.role].map(([to, label, Icon]) => <NavLink key={to} to={to} onClick={() => setOpen(false)} className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}><Icon size={18} />{label}</NavLink>)}</nav>
      <div className="sidebar-support"><Bot size={20} /><div><strong>Need guidance?</strong><p>Use the university assistant for process questions.</p></div></div>
      <button className="nav-item logout" onClick={logout}><LogOut size={18} />Sign out</button>
    </aside><main className="main-content">{presentation && <div className="presentation-banner"><MonitorPlay />Presentation privacy is active — personal details are masked.<button onClick={() => setPresentation(false)}>Exit</button></div>}<Outlet /></main></div><CommandPalette entries={nav[user.role].map(([to, label, Icon]) => [to, label, Icon, `Open ${label.toLowerCase()}`])} open={commandOpen} onClose={() => setCommandOpen(false)} />{user.role === 'student' && <AIChatWidget />}</div>
}
