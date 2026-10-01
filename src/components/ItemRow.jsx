import { useState } from 'react'
import { formatQty, parseQty } from '../lib/normalize'

export const REVIEW_OPTIONS = [
  { value: 'ok', label: 'OK' },
  { value: 'equivalente', label: 'Producto equivalente' },
  { value: 'no_creado', label: 'No creado en sistema' },
]

const REVIEW_LABELS = Object.fromEntries(REVIEW_OPTIONS.map((o) => [o.value, o.label]))

export default function ItemRow({ item, onEditQty, onEditDetail, onDelete, onReview, onUnreview }) {
  const [editing, setEditing] = useState(null)
  const [value, setValue] = useState('')
  const [reviewStatus, setReviewStatus] = useState('ok')

  function startQty() {
    setEditing('qty')
    setValue(formatQty(item.qty))
  }

  function startDetail() {
    setEditing('detail')
    setValue(item.detail || '')
  }

  function startReview() {
    setEditing('review')
    setReviewStatus(item.review_status || 'ok')
    setValue(item.review_note || '')
  }

  function cancel() {
    setEditing(null)
    setValue('')
  }

  function save() {
    if (editing === 'qty') {
      const n = parseQty(value, { allowZero: true })
      if (!Number.isFinite(n)) return
      onEditQty(item.reference, n)
    } else if (editing === 'detail') {
      onEditDetail(item.reference, value)
    } else if (editing === 'review') {
      onReview(item.reference, { status: reviewStatus, note: value })
    }
    cancel()
  }

  const reviewed = Boolean(item.reviewed)

  return (
    <li className={reviewed ? 'item-row reviewed' : 'item-row'}>
      <div className="item-main">
        <strong className="item-ref">{item.reference}</strong>
        <span className="item-qty">{formatQty(item.qty)}</span>
      </div>
      {item.detail ? <p className="item-detail">{item.detail}</p> : null}
      {reviewed ? (
        <div className="review-info">
          {item.review_status ? (
            <span className={item.review_status === 'ok' ? 'review-tag ok' : 'review-tag warn'}>
              {REVIEW_LABELS[item.review_status] || item.review_status}
            </span>
          ) : null}
          {item.review_note ? <span className="review-note">{item.review_note}</span> : null}
        </div>
      ) : null}

      {editing === 'review' ? (
        <form
          className="review-form"
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          <div className="chips" role="radiogroup" aria-label="Motivo de revisión">
            {REVIEW_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={reviewStatus === opt.value}
                className={reviewStatus === opt.value ? 'chip active' : 'chip'}
                onClick={() => setReviewStatus(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={reviewStatus === 'equivalente' ? 'Ej: equivale a REF-123' : 'Nota (opcional)'}
            aria-label="Nota de revisión"
            autoComplete="off"
          />
          <div className="review-form-actions">
            <button type="submit" className="btn primary">
              Marcar revisada
            </button>
            <button type="button" className="btn ghost" onClick={cancel}>
              Cancelar
            </button>
          </div>
        </form>
      ) : editing ? (
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            inputMode={editing === 'qty' ? 'decimal' : 'text'}
            aria-label={editing === 'qty' ? 'Nuevo total' : 'Detalle'}
          />
          <button type="submit" className="btn primary">
            OK
          </button>
          <button type="button" className="btn ghost" onClick={cancel}>
            Cancelar
          </button>
        </form>
      ) : (
        <div className="row-actions">
          {reviewed ? (
            <>
              <button type="button" className="btn ghost" onClick={startReview}>
                Cambiar motivo
              </button>
              <button type="button" className="btn ghost" onClick={() => onUnreview(item.reference)}>
                Desmarcar
              </button>
            </>
          ) : (
            <button type="button" className="btn review" onClick={startReview}>
              ✓ Revisar
            </button>
          )}
          <button type="button" className="btn ghost" onClick={startQty}>
            Editar total
          </button>
          <button type="button" className="btn ghost" onClick={startDetail}>
            {item.detail ? 'Editar detalle' : 'Añadir detalle'}
          </button>
          {item.detail ? (
            <button type="button" className="btn ghost" onClick={() => onEditDetail(item.reference, '')}>
              Quitar detalle
            </button>
          ) : null}
          <button
            type="button"
            className="btn danger ghost"
            onClick={() => {
              if (window.confirm(`¿Borrar ${item.reference}?`)) onDelete(item.reference)
            }}
          >
            Borrar
          </button>
        </div>
      )}
    </li>
  )
}
