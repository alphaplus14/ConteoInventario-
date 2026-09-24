import { useState } from 'react'

export default function SessionPicker({
  sessions,
  currentId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}) {
  const [name, setName] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [busy, setBusy] = useState(false)

  const current = sessions.find((s) => s.id === currentId)

  async function create(event) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setBusy(true)
    try {
      await onCreate(trimmed)
      setName('')
    } finally {
      setBusy(false)
    }
  }

  async function saveRename(event) {
    event.preventDefault()
    const trimmed = renameValue.trim()
    if (!trimmed || !current) return
    setBusy(true)
    try {
      await onRename(current.id, trimmed)
      setRenaming(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card session-picker">
      <h2>Sesión</h2>
      {sessions.length > 0 ? (
        <label>
          Elegir sesión
          <select
            value={currentId || ''}
            onChange={(e) => onSelect(e.target.value)}
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="muted">Crea una sesión para empezar a contar (ej. “Bodega principal”).</p>
      )}

      {current && !renaming ? (
        <div className="row-actions">
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              setRenameValue(current.name)
              setRenaming(true)
            }}
          >
            Renombrar
          </button>
          <button
            type="button"
            className="btn danger ghost"
            onClick={() => {
              if (window.confirm(`¿Borrar la sesión “${current.name}” y todo su conteo?`)) {
                onDelete(current.id)
              }
            }}
          >
            Borrar sesión
          </button>
        </div>
      ) : null}

      {renaming ? (
        <form className="inline-form" onSubmit={saveRename}>
          <input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            aria-label="Nuevo nombre de sesión"
          />
          <button type="submit" className="btn primary" disabled={busy}>
            Guardar
          </button>
          <button type="button" className="btn ghost" onClick={() => setRenaming(false)}>
            Cancelar
          </button>
        </form>
      ) : null}

      <form className="inline-form" onSubmit={create}>
        <input
          placeholder="Nueva sesión"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Nombre de la nueva sesión"
        />
        <button type="submit" className="btn" disabled={busy || !name.trim()}>
          Crear
        </button>
      </form>
    </section>
  )
}
