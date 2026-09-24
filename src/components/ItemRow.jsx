import { useState } from 'react'
import { formatQty, parseQty } from '../lib/normalize'

export default function ItemRow({ item, onEditQty, onEditDetail, onDelete }) {
  const [editing, setEditing] = useState(null)
  const [value, setValue] = useState('')

  function startQty() {
    setEditing('qty')
    setValue(formatQty(item.qty))
  }

  function startDetail() {
    setEditing('detail')
    setValue(item.detail || '')
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
    }
    cancel()
  }

  return (
    <li className="item-row">
      <div className="item-main">
        <strong className="item-ref">{item.reference}</strong>
        <span className="item-qty">{formatQty(item.qty)}</span>
      </div>
      {item.detail ? <p className="item-detail">{item.detail}</p> : null}

      {editing ? (
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
