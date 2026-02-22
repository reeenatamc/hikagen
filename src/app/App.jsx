import './App.css'
import app from '../lib/firebase'

function App() {
  const projectId = app.options.projectId
  const isConfigured = Boolean(import.meta.env.VITE_FIREBASE_API_KEY)

  return (
    <main className="app">
      <h1>React + Firebase listo 🚀</h1>
      <p>
        Estado de configuración:{' '}
        <strong>{isConfigured ? 'Conectado' : 'Falta .env.local'}</strong>
      </p>
      <p>Proyecto Firebase: {projectId || 'No configurado'}</p>
      <p className="hint">
        Edita <code>.env.local</code> con tus variables y recarga la app.
      </p>
    </main>
  )
}

export default App
