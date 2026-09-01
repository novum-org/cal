import { MotionConfig } from 'motion/react'
import { ThemeProvider } from 'next-themes'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'

import { Toaster } from '@/components/ui/sonner'
import './index.css'
import App from './App.tsx'
import { HERMITE } from './lib/motion.ts'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <BrowserRouter>
        <MotionConfig reducedMotion="user" transition={{ duration: 0.24, ease: HERMITE }}>
          <App />
          <Toaster />
        </MotionConfig>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
)
