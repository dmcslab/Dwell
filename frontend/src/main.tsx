import ReactDOM from 'react-dom/client'
import App from './App'
import { ThemeProvider } from './contexts/ThemeContext'
import './index.css'

// StrictMode removed: it double-mounts components in dev, immediately
// opening/closing WebSocket connections → black screen gaps
ReactDOM.createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
)
