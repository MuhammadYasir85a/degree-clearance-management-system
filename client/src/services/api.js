import axios from 'axios'

const api = axios.create({ baseURL: '/api', withCredentials: true, timeout: 30000 })
const getCache = new Map()
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('uet_portal_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
api.interceptors.response.use((response) => response, (error) => {
  if (error.response?.status === 401) {
    localStorage.removeItem('uet_portal_token')
    window.dispatchEvent(new Event('uet:unauthorized'))
  }
  return Promise.reject(error)
})
export const errorMessage = (error, fallback = 'The request could not be completed.') => error.response?.data?.message || fallback
export function cachedGet(url, { ttl = 15000, force = false } = {}) {
  const cached = getCache.get(url)
  if (!force && cached && (cached.pending || Date.now() - cached.createdAt < ttl)) return cached.promise
  const entry = { createdAt: Date.now(), pending: true }
  entry.promise = api.get(url).then((response) => { entry.pending = false; entry.createdAt = Date.now(); return response }).catch((error) => { getCache.delete(url); throw error })
  getCache.set(url, entry)
  return entry.promise
}
export function invalidateApiCache(...prefixes) {
  for (const key of getCache.keys()) if (prefixes.some((prefix) => key.startsWith(prefix))) getCache.delete(key)
}
export async function downloadPrivateFile(url, filename) {
  const response = await api.get(url.replace(/^\/api/, ''), { responseType: 'blob' })
  const objectUrl = URL.createObjectURL(response.data)
  const anchor = document.createElement('a')
  anchor.href = objectUrl; anchor.download = filename; anchor.click()
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
}
export async function privateFileObjectUrl(url) {
  const response = await api.get(url.replace(/^\/api/, ''), { responseType: 'blob' })
  return URL.createObjectURL(response.data)
}
export default api
