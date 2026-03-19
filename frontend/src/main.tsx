import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// StrictMode removed: it double-mounts components in dev which immediately
// opens and closes WebSocket connections, causing black screen gaps between
// ws.onopen firing and the server's 'connected' message arriving.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />
)
