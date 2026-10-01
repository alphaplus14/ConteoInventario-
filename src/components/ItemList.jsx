import { useMemo, useState } from 'react'
import { formatQty, normalizeRef } from '../lib/normalize'
import ItemRow from './ItemRow'

const FILTERS = [
  { value: 'all', label: 'Todas' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'reviewed', label: 'Revisadas' },
]

export default function ItemList({ items, onEditQty, onEditDetail, onDelete, onReview, onUnreview }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')

  const filtered = useMemo(() => {
    const q = normalizeRef(query)
    const qRaw = query.trim().toLowerCase()
    return items.filter((item) => {
      if (filter === 'pending' && item.reviewed) return false
      if (filter === 'reviewed' && !item.reviewed) return false
      if (!qRaw) return true
      const refMatch = item.reference.includes(q)
      const detailMatch = (item.detail || '').toLowerCase().includes(qRaw)
      const noteMatch = (item.review_note || '').toLowerCase().includes(qRaw)
      return refMatch || detailMatch || noteMatch
    })
  }, [items, query, filter])

  const reviewedCount = items.filter((i) => i.reviewed).length

  return (
    <section className="card">
      <h2>Referencias</h2>
      <label>
        Buscar
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Por referencia, detalle o nota"
          autoCorrect="off"
          autoComplete="off"
        />
      </label>

      <div className="chips filter-chips" role="radiogroup" aria-label="Filtrar referencias">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            role="radio"
            aria-checked={filter === f.value}
            className={filter === f.value ? 'chip active' : 'chip'}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="muted">{items.length === 0 ? 'Aún no hay capturas en esta sesión.' : 'Ninguna referencia coincide.'}</p>
      ) : (
        <ul className="item-list">
          {filtered.map((item) => (
            <ItemRow
              key={item.reference}
              item={item}
              onEditQty={onEditQty}
              onEditDetail={onEditDetail}
              onDelete={onDelete}
              onReview={onReview}
              onUnreview={onUnreview}
            />
          ))}
        </ul>
      )}

      <p className="totals">
        {items.length} referencias distintas · {reviewedCount} revisadas · suma{' '}
        {formatQty(items.reduce((acc, i) => acc + Number(i.qty), 0))}
      </p>
    </section>
  )
}
