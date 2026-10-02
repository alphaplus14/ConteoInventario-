import { useCallback, useEffect, useRef, useState } from 'react'
import Auth from './components/Auth'
import CountForm from './components/CountForm'
import ItemList from './components/ItemList'
import SessionPicker from './components/SessionPicker'
import { dataErrorMessage } from './lib/errors'
import { formatQty, normalizeRef } from './lib/normalize'
import { hasSupabaseConfig, supabase } from './supabaseClient'

const LAST_SESSION_KEY = 'inventario:lastSessionId'

function sortItems(list) {
  return [...list].sort((a, b) => {
    const ta = new Date(a.updated_at).getTime()
    const tb = new Date(b.updated_at).getTime()
    if (tb !== ta) return tb - ta
    return a.reference.localeCompare(b.reference)
  })
}

function applyLocalAdd(prev, { sessionId, userId, reference, qty, detail }) {
  const now = new Date().toISOString()
  const existing = prev.find((i) => i.reference === reference)
  if (existing) {
    return sortItems(
      prev.map((i) =>
        i.reference === reference
          ? {
              ...i,
              qty: Number(i.qty) + qty,
              detail: detail || i.detail,
              updated_at: now,
            }
          : i,
      ),
    )
  }
  return sortItems([
    {
      session_id: sessionId,
      user_id: userId,
      reference,
      qty,
      detail: detail || null,
      updated_at: now,
      reviewed: false,
      review_status: null,
      review_note: null,
      reviewed_at: null,
    },
    ...prev,
  ])
}

function applyLocalUndo(prev, { reference, qty }) {
  const now = new Date().toISOString()
  return sortItems(
    prev
      .map((i) =>
        i.reference === reference
          ? { ...i, qty: Number(i.qty) - Number(qty), updated_at: now }
          : i,
      )
      .filter((i) => Number(i.qty) !== 0 || i.detail || i.reviewed),
  )
}

export default function App() {
  const [authReady, setAuthReady] = useState(false)
  const [user, setUser] = useState(null)

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setUser(data.session?.user ?? null)
      setAuthReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => {
      mounted = false
      data.subscription.unsubscribe()
    }
  }, [])

  if (!hasSupabaseConfig) {
    return (
      <div className="app">
        <h1>Falta configurar Supabase</h1>
        <p>
          Copia <code>.env.example</code> a <code>.env</code> y pega <code>VITE_SUPABASE_URL</code> y{' '}
          <code>VITE_SUPABASE_ANON_KEY</code>. Reinicia <code>npm run dev</code>.
        </p>
      </div>
    )
  }

  if (!authReady) {
    return (
      <div className="app">
        <p className="muted">Cargando…</p>
      </div>
    )
  }

  if (!user) return <Auth />

  return <CountApp user={user} />
}

function CountApp({ user }) {
  const [sessions, setSessions] = useState([])
  const [sessionId, setSessionId] = useState(localStorage.getItem(LAST_SESSION_KEY) || '')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [flash, setFlash] = useState('')
  const [syncError, setSyncError] = useState('')
  const pendingRef = useRef([])
  const processingRef = useRef(false)
  const undoBySessionRef = useRef({})
  const flashTimer = useRef(null)

  const showFlash = useCallback((text) => {
    setFlash(text)
    clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setFlash(''), 2800)
  }, [])

  const stackFor = useCallback((id) => {
    if (!id) return []
    if (!undoBySessionRef.current[id]) undoBySessionRef.current[id] = []
    return undoBySessionRef.current[id]
  }, [])

  const processQueue = useCallback(async () => {
    if (processingRef.current) return
    processingRef.current = true
    while (pendingRef.current.length > 0) {
      const op = pendingRef.current[0]
      op.started = true
      try {
        if (op.type === 'add') {
          const { error: err } = await supabase.rpc('add_count', {
            p_session: op.sessionId,
            p_ref: op.reference,
            p_qty: op.qty,
            p_detail: op.detail,
          })
          if (err) throw err
        } else if (op.type === 'undo') {
          const { data, error: err } = await supabase.rpc('undo_last', { p_session: op.sessionId })
          if (err) throw err
          if (op.applyFromServer) {
            const row = Array.isArray(data) ? data[0] : data
            if (row) {
              setItems((prev) => applyLocalUndo(prev, { reference: row.reference, qty: row.qty }))
              showFlash(`Deshecho: ${row.reference} −${formatQty(row.qty)}`)
            }
          }
        } else if (op.type === 'run') {
          await op.run()
        }
        pendingRef.current.shift()
        setSyncError('')
      } catch (err) {
        op.started = false
        setSyncError(dataErrorMessage(err))
        break
      }
    }
    processingRef.current = false
  }, [showFlash])

  const enqueue = useCallback(
    (op) => {
      pendingRef.current.push(op)
      processQueue()
    },
    [processQueue],
  )

  const loadSessions = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('sessions')
      .select('*')
      .order('created_at', { ascending: false })
    if (err) throw err
    setSessions(data || [])
    return data || []
  }, [])

  const loadItems = useCallback(async (id) => {
    if (!id) {
      setItems([])
      return
    }
    // Supabase devuelve como máximo 1000 filas por petición: paginar hasta traerlas todas.
    const PAGE_SIZE = 1000
    const all = []
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error: err } = await supabase
        .from('count_items')
        .select('*')
        .eq('session_id', id)
        .order('reference', { ascending: true })
        .range(from, from + PAGE_SIZE - 1)
      if (err) throw err
      all.push(...(data || []))
      if (!data || data.length < PAGE_SIZE) break
    }
    setItems(sortItems(all))
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const list = await loadSessions()
        if (cancelled) return
        const stored = localStorage.getItem(LAST_SESSION_KEY)
        const nextId = list.some((s) => s.id === stored) ? stored : list[0]?.id || ''
        setSessionId(nextId)
        if (nextId) localStorage.setItem(LAST_SESSION_KEY, nextId)
        await loadItems(nextId)
      } catch (err) {
        if (!cancelled) setError(dataErrorMessage(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loadItems, loadSessions])

  function selectSession(id) {
    setSessionId(id)
    localStorage.setItem(LAST_SESSION_KEY, id)
    loadItems(id).catch((err) => setError(dataErrorMessage(err)))
  }

  async function createSession(name) {
    const { data, error: err } = await supabase.from('sessions').insert({ name }).select().single()
    if (err) {
      setError(dataErrorMessage(err))
      return
    }
    setSessions((prev) => [data, ...prev])
    selectSession(data.id)
  }

  async function renameSession(id, name) {
    const { error: err } = await supabase.from('sessions').update({ name }).eq('id', id)
    if (err) {
      setError(dataErrorMessage(err))
      return
    }
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)))
  }

  async function deleteSession(id) {
    const { error: err } = await supabase.from('sessions').delete().eq('id', id)
    if (err) {
      setError(dataErrorMessage(err))
      return
    }
    pendingRef.current = pendingRef.current.filter((op) => op.sessionId !== id)
    delete undoBySessionRef.current[id]
    const remaining = sessions.filter((s) => s.id !== id)
    setSessions(remaining)
    const next = remaining[0]?.id || ''
    setSessionId(next)
    if (next) localStorage.setItem(LAST_SESSION_KEY, next)
    else localStorage.removeItem(LAST_SESSION_KEY)
    await loadItems(next)
  }

  function capture({ reference, qty, detail }) {
    if (!sessionId) return
    const ref = normalizeRef(reference)
    const trimmedDetail = detail.trim()
    const existing = items.find((i) => i.reference === ref)
    const nextQty = (existing ? Number(existing.qty) : 0) + qty

    setItems((prev) =>
      applyLocalAdd(prev, {
        sessionId,
        userId: user.id,
        reference: ref,
        qty,
        detail: trimmedDetail,
      }),
    )
    stackFor(sessionId).push({ reference: ref, qty })
    showFlash(`${ref} ahora lleva ${formatQty(nextQty)}`)
    enqueue({
      type: 'add',
      sessionId,
      reference: ref,
      qty,
      detail: trimmedDetail || null,
    })
  }

  function undo() {
    if (!sessionId) return
    const stack = stackFor(sessionId)
    if (stack.length) {
      const last = stack.pop()
      setItems((prev) => applyLocalUndo(prev, last))
      showFlash(`Deshecho: ${last.reference} −${formatQty(last.qty)}`)
      const pending = pendingRef.current
      for (let i = pending.length - 1; i >= 0; i -= 1) {
        const op = pending[i]
        if (
          op.type === 'add' &&
          !op.started &&
          op.sessionId === sessionId &&
          op.reference === last.reference &&
          Number(op.qty) === Number(last.qty)
        ) {
          pending.splice(i, 1)
          return
        }
      }
      enqueue({ type: 'undo', sessionId })
      return
    }
    enqueue({ type: 'undo', sessionId, applyFromServer: true })
  }

  function editQty(reference, qty) {
    const now = new Date().toISOString()
    undoBySessionRef.current[sessionId] = stackFor(sessionId).filter((e) => e.reference !== reference)
    setItems((prev) => sortItems(prev.map((i) => (i.reference === reference ? { ...i, qty, updated_at: now } : i))))
    enqueue({
      type: 'run',
      sessionId,
      run: async () => {
        const { error: err } = await supabase
          .from('count_items')
          .update({ qty, updated_at: now })
          .eq('session_id', sessionId)
          .eq('reference', reference)
        if (err) throw err
        const { error: logErr } = await supabase.from('count_log').delete().eq('session_id', sessionId).eq('reference', reference)
        if (logErr) throw logErr
      },
    })
  }

  function editDetail(reference, detail) {
    const nextDetail = detail.trim() ? detail.trim() : null
    const now = new Date().toISOString()
    setItems((prev) =>
      sortItems(prev.map((i) => (i.reference === reference ? { ...i, detail: nextDetail, updated_at: now } : i))),
    )
    enqueue({
      type: 'run',
      sessionId,
      run: async () => {
        const { error: err } = await supabase
          .from('count_items')
          .update({ detail: nextDetail, updated_at: now })
          .eq('session_id', sessionId)
          .eq('reference', reference)
        if (err) throw err
      },
    })
  }

  function updateReview(reference, fields) {
    setItems((prev) => prev.map((i) => (i.reference === reference ? { ...i, ...fields } : i)))
    enqueue({
      type: 'run',
      sessionId,
      run: async () => {
        const { error: err } = await supabase
          .from('count_items')
          .update(fields)
          .eq('session_id', sessionId)
          .eq('reference', reference)
        if (err) throw err
      },
    })
  }

  function reviewItem(reference, { status, note }) {
    const trimmedNote = (note || '').trim()
    updateReview(reference, {
      reviewed: true,
      review_status: status,
      review_note: trimmedNote || null,
      reviewed_at: new Date().toISOString(),
    })
    showFlash(`${reference} marcada como revisada`)
  }

  function unreviewItem(reference) {
    updateReview(reference, { reviewed: false, review_status: null, review_note: null, reviewed_at: null })
  }

  function deleteItem(reference) {
    undoBySessionRef.current[sessionId] = stackFor(sessionId).filter((e) => e.reference !== reference)
    setItems((prev) => prev.filter((i) => i.reference !== reference))
    enqueue({
      type: 'run',
      sessionId,
      run: async () => {
        const { error: err } = await supabase.from('count_items').delete().eq('session_id', sessionId).eq('reference', reference)
        if (err) throw err
        const { error: logErr } = await supabase.from('count_log').delete().eq('session_id', sessionId).eq('reference', reference)
        if (logErr) throw logErr
      },
    })
  }

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>Conteo</h1>
          <p className="muted small">{user.email}</p>
        </div>
        <button type="button" className="btn ghost" onClick={() => supabase.auth.signOut()}>
          Cerrar sesión
        </button>
      </header>

      {error ? (
        <p className="banner error" role="alert">
          {error}
        </p>
      ) : null}
      {syncError ? (
        <div className="banner error" role="alert">
          <p>{syncError}</p>
          <button type="button" className="btn" onClick={() => processQueue()}>
            Reintentar
          </button>
        </div>
      ) : null}
      {flash ? (
        <p className="banner success" role="status">
          {flash}
        </p>
      ) : null}

      <SessionPicker
        sessions={sessions}
        currentId={sessionId}
        onSelect={selectSession}
        onCreate={createSession}
        onRename={renameSession}
        onDelete={deleteSession}
      />

      {loading ? <p className="muted">Cargando sesión…</p> : null}

      {sessionId ? (
        <>
          <CountForm items={items} onCapture={capture} disabled={loading} />
          <div className="undo-bar">
            <button type="button" className="btn" onClick={undo}>
              Deshacer
            </button>
          </div>
          <ItemList
            items={items}
            onEditQty={editQty}
            onEditDetail={editDetail}
            onDelete={deleteItem}
            onReview={reviewItem}
            onUnreview={unreviewItem}
          />
        </>
      ) : (
        !loading && <p className="muted">Crea una sesión para capturar.</p>
      )}
    </div>
  )
}
