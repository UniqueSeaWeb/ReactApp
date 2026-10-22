import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './futsal.css'
import FutsalApp from './FutsalApp.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <FutsalApp />
  </StrictMode>,
)
