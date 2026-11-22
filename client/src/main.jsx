import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './admin.css'
import './rag-admin.css'
import './audit.css'
import './controller.css'
import './officer.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter><App /></BrowserRouter>
  </StrictMode>,
)
