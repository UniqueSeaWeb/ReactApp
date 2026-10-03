import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './solar.css'
import SolarApp from './SolarApp.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SolarApp />
  </StrictMode>,
)
