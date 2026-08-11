import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import '../../styles/tokens.css'

import { App } from './app.js'

const root = document.getElementById('root')
if (root === null) throw new Error('Elemen #root tidak ditemukan.')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
