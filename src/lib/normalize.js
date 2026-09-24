export function normalizeRef(value) {
  return String(value ?? '').trim().toUpperCase()
}

export function parseQty(value, { allowZero = false } = {}) {
  const n = Number(String(value ?? '').trim().replace(',', '.'))
  if (!Number.isFinite(n) || n < 0) return NaN
  if (n === 0 && !allowZero) return NaN
  return n
}

export function formatQty(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '0'
  if (Number.isInteger(n)) return String(n)
  return String(n)
}
