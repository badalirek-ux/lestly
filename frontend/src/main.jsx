import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// StrictMode rimosso: causa doppio mount che rompe i WebSocket
createRoot(document.getElementById('root')).render(<App />)
