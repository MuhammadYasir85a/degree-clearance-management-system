import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, GraduationCap, LockKeyhole, Mail, ShieldCheck } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { errorMessage } from '../../services/api.js'
const home = { student: '/student/dashboard', officer: '/officer/dashboard', controller: '/controller/dashboard', admin: '/admin/dashboard' }
export default function LoginPage() {
  const { login } = useAuth(); const navigate = useNavigate(); const location = useLocation()
  const [form, setForm] = useState({ email: '', password: '' }); const [show, setShow] = useState(false); const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  const submit = async (event) => { event.preventDefault(); setError(''); setBusy(true); try { const user = await login(form.email, form.password); navigate(home[user.role], { replace: true }) } catch (e) { setError(errorMessage(e, 'Sign in failed.')) } finally { setBusy(false) } }
  return <main className="auth-page"><section className="auth-visual"><div className="academic-pattern" /><div className="auth-visual-content"><div className="large-brand"><span><GraduationCap size={34} /></span><div><strong>GradFlow</strong><small>Academic Operations Platform</small></div></div><div className="auth-message"><p className="eyebrow light">One connected workspace</p><h1>Academic services, organised.</h1><p>Clearance, document verification, degree processing, and collection in one secure platform.</p></div><div className="trust-line"><ShieldCheck size={20} /><span>Protected records and role-based access</span></div></div></section>
    <section className="auth-form-panel"><form className="login-card" onSubmit={submit}><div className="mobile-brand"><GraduationCap /><strong>GradFlow</strong></div><p className="eyebrow">Secure access</p><h2>Welcome back</h2><p className="form-intro">Sign in to continue to your workspace.</p>{location.state?.registered && <div className="success-alert"><ShieldCheck />Account activated. You can now sign in.</div>}{location.state?.passwordReset && <div className="success-alert"><ShieldCheck />Password changed. Sign in with your new password.</div>}{error && <div className="form-alert" role="alert">{error}</div>}
      <label>Account email<div className="input-wrap"><Mail size={18} /><input type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@university.edu.pk" /></div></label>
      <label>Password <Link className="forgot-link" to="/forgot-password">Forgot password?</Link><div className="input-wrap"><LockKeyhole size={18} /><input type={show ? 'text' : 'password'} autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Enter your password" /><button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
      <button className="button primary wide" disabled={busy}>{busy ? <span className="button-loader" /> : <>Sign in<ArrowRight size={18} /></>}</button><p className="auth-help">New eligible student? <Link to="/register">Create an account</Link></p>
    </form></section></main>
}
