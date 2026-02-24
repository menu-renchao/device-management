import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { ToastProvider } from './contexts/ToastContext'

ReactDOM.createRoot(document.getElementById('root')).render(
  <ToastProvider>
    <App />
  </ToastProvider>,
)