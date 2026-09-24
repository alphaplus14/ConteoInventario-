import { useMemo, useState } from 'react'
import { formatQty, normalizeRef } from '../lib/normalize'
import ItemRow from './ItemRow'

export default function ItemList({ items, onEditQty, onEditDetail, onDelete }) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = normalizeRef(query)
    const qRaw = query.trim().toLowerCase()
    if (!qRaw) return items
    return items.filter((item) => {
      const refMatch = item.reference.includes(q)
      const detailMatch = (item.detail || '').toLowerCase().includes(qRaw)
      return refMatch || detailMatch
    })
  }, [items, query])

  return (
    <section className="card">
      <h2>Referencias</h2>
      <label>
        Buscar
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Por referencia o detalle"
          autoCorrect="off"
          autoComplete="off"
        />
      </label>

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
            />
          ))}
        </ul>
      )}

      <p className="totals">
        {items.length} referencias distintas · suma {formatQty(items.reduce((acc, i) => acc + Number(i.qty), 0))}
      </p>
    </section>
  )
}
