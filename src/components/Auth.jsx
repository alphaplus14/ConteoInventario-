import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { authErrorMessage } from '../lib/errors'

export default function Auth() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(event) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (mode === 'login') {
        const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (err) throw err
      } else {
        const { error: err } = await supabase.auth.signUp({ email: email.trim(), password })
        if (err) throw err
      }
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <h1>Conteo de inventario</h1>
      </header>
      <p className="lede">Solo cuenta. Escribe referencia y cantidad; la app acumula el total.</p>

      <form className="card form" onSubmit={onSubmit}>
        <h2>{mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}</h2>

        <label>
          Correo
          <input
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label>
          Contraseña
          <input
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </label>

        {error ? <p className="banner error" role="alert">{error}</p> : null}

        <button type="submit" className="btn primary" disabled={busy}>
          {busy ? 'Espera…' : mode === 'login' ? 'Entrar' : 'Registrarme'}
        </button>

        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            setError('')
            setMode(mode === 'login' ? 'register' : 'login')
          }}
        >
          {mode === 'login' ? '¿No tienes cuenta? Crear una' : '¿Ya tienes cuenta? Iniciar sesión'}
        </button>
      </form>
    </div>
  )
}
