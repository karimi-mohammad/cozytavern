import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { initTokenizer } from './utils/tokenCounter'
import './index.css'

// بارگذاری tiktoken-wasm در پس‌زمینه (non-blocking)
// اگر پکیج نصب باشه، heuristic بهبودیافته با BPE دقیق جایگزین میشه
initTokenizer().catch(() => {
  console.warn('[TokenCounter] tiktoken-wasm not available, using improved heuristic')
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary label="app">
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
