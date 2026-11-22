import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import api, { cachedGet, invalidateApiCache } from '../services/api.js'
const AuthContext = createContext(null)
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const refresh = useCallback(async () => {
    try { setUser((await cachedGet('/auth/me', { ttl: 60000 })).data.user) } catch { setUser(null) } finally { setLoading(false) }
  }, [])
  useEffect(() => {
    const initialize = async () => refresh()
    void initialize()
    const clear = () => setUser(null)
    window.addEventListener('uet:unauthorized', clear)
    return () => window.removeEventListener('uet:unauthorized', clear)
  }, [refresh])
  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    localStorage.setItem('uet_portal_token', data.token); invalidateApiCache(''); setUser(data.user); return data.user
  }
  const logout = async () => { try { await api.post('/auth/logout') } finally { localStorage.removeItem('uet_portal_token'); invalidateApiCache(''); setUser(null) } }
  const value = useMemo(() => ({ user, loading, login, logout, refresh }), [user, loading, refresh])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
// The hook intentionally lives beside its provider so the authentication API
// remains a single, small module.
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext)
