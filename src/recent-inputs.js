const RECENT_INPUTS_KEY = 'numfate:recent-inputs'
const RECENT_INPUT_LIMIT = 4

export function formatRecentInput(numbers) {
  if (!Array.isArray(numbers) || numbers.length === 0) return ''
  return numbers.join(', ')
}

export function loadRecentInputs(storage) {
  if (!storage?.getItem) return []

  try {
    const parsed = JSON.parse(storage.getItem(RECENT_INPUTS_KEY) || '[]')
    return sanitizeRecentInputs(parsed)
  } catch {
    return []
  }
}

export function saveRecentInput(storage, numbers) {
  const entry = formatRecentInput(numbers)
  if (!entry || !storage?.setItem) {
    return loadRecentInputs(storage)
  }

  const next = [entry, ...loadRecentInputs(storage).filter((item) => item !== entry)].slice(0, RECENT_INPUT_LIMIT)

  try {
    storage.setItem(RECENT_INPUTS_KEY, JSON.stringify(next))
  } catch {}

  return next
}

function sanitizeRecentInputs(value) {
  if (!Array.isArray(value)) return []

  const seen = new Set()
  const output = []

  for (const item of value) {
    if (typeof item !== 'string') continue
    const text = item.trim().slice(0, 80)
    if (!text || seen.has(text)) continue
    seen.add(text)
    output.push(text)
    if (output.length >= RECENT_INPUT_LIMIT) break
  }

  return output
}
