import { useEffect, useMemo, useRef, useState } from 'react'
import { formatQty, normalizeRef, parseQty } from '../lib/normalize'

export default function CountForm({ items, onCapture, disabled }) {
  const [reference, setReference] = useState('')
  const [qty, setQty] = useState('1')
  const [detail, setDetail] = useState('')
  const [showDetail, setShowDetail] = useState(false)
  const refInput = useRef(null)
  const qtyInput = useRef(null)

  useEffect(() => {
    refInput.current?.focus()
  }, [])

  const live = useMemo(() => {
    const ref = normalizeRef(reference)
    if (!ref) return null
    const item = items.find((i) => i.reference === ref)
    if (!item) return { ref, text: `${ref} es nueva` }
    const extra = item.detail ? ` · ${item.detail}` : ''
    return { ref, text: `${ref} lleva ${formatQty(item.qty)}${extra}` }
  }, [items, reference])

  function submit() {
    const ref = normalizeRef(reference)
    const amount = parseQty(qty)
    if (!ref || disabled) return
    if (!Number.isFinite(amount)) {
      qtyInput.current?.focus()
      qtyInput.current?.select()
      return
    }
    onCapture({ reference: ref, qty: amount, detail })
    setReference('')
    setQty('1')
    setDetail('')
    setShowDetail(false)
    refInput.current?.focus()
  }

  return (
    <form
      className="card form count-form"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <h2>Captura</h2>

      <label>
        Referencia
        <input
          ref={refInput}
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          autoCapitalize="characters"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="next"
          disabled={disabled}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              qtyInput.current?.focus()
              qtyInput.current?.select()
            }
          }}
        />
      </label>

      {live ? <p className="live-hint">{live.text}</p> : null}

      <label>
        Cantidad
        <input
          ref={qtyInput}
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          inputMode="decimal"
          enterKeyHint="done"
          disabled={disabled}
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submit()
            }
          }}
        />
      </label>

      {showDetail ? (
        <label>
          Detalle (opcional)
          <input
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="Ej. caja dañada"
            disabled={disabled}
          />
        </label>
      ) : (
        <button
          type="button"
          className="btn ghost"
          onClick={() => setShowDetail(true)}
        >
          + Detalle
        </button>
      )}

      <button type="submit" className="btn primary" disabled={disabled || !normalizeRef(reference)}>
        Guardar
      </button>
    </form>
  )
}
