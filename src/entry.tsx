import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'

const isCoachApp = /^\/coach-app\/?$/.test(window.location.pathname)

if (isCoachApp) {
  void import('./pages/CoachApp.tsx').then(({ default: CoachApp }) => {
    const root = document.getElementById('root')
    if (!root) throw new Error('Missing root element')

    document.documentElement.classList.add('coach-app-document')
    document.body.classList.add('coach-app-document')
    document.title = 'PlayFooty Coach'

    createRoot(root).render(
      <StrictMode>
        <BrowserRouter>
          <CoachApp />
        </BrowserRouter>
      </StrictMode>,
    )
  })
} else {
  void import('./main.tsx')
}
