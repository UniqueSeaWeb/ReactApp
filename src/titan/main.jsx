import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './titan.css'
import TitanApp from './TitanApp.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <TitanApp />
  </StrictMode>,
)
