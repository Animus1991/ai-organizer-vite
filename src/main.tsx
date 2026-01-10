// src/main.tsx
import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './pages/App'
import { AuthProvider } from './auth/AuthProvider'
import { ErrorBoundary } from './components/ErrorBoundary'
import './styles/modern-enhancements.css'
import './styles/typography.css'
import './style.css'

// Suppress uncaught message channel errors (usually from browser extensions like React DevTools)
window.addEventListener('error', (event) => {
  if (event.message && event.message.includes('message channel closed')) {
    event.preventDefault();
    console.debug('Suppressed message channel error (likely from browser extension)');
    return false;
  }
});

window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && typeof event.reason === 'object' && 'message' in event.reason) {
    const message = String(event.reason.message);
    if (message.includes('message channel closed') || message.includes('listener indicated an asynchronous response')) {
      event.preventDefault();
      console.debug('Suppressed unhandled promise rejection (likely from browser extension)');
      return false;
    }
  }
});

ReactDOM.createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
